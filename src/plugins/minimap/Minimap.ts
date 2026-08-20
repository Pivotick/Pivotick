import type { Edge } from '../../Edge'
import type { GraphBounds } from '../../GraphRenderer'
import type { Node } from '../../Node'
import { UIComponent } from '../../ui/UIComponent'
import type { UIManager } from '../../ui/UIManager'
import type { MinimapOptions } from './options'
import './minimap.scss'

/** Above this many nodes the minimap paints density instead of drawing each node. */
const DETAIL_NODE_LIMIT = 1500
/** …and edges are dropped past this many, well before they turn into a grey wash. */
const DETAIL_EDGE_LIMIT = 4000

const DEFAULT_WIDTH = 200
/** Bounds for the height derived from the canvas aspect ratio. */
const MIN_HEIGHT = 70
const MAX_HEIGHT = 400
/** Inset (in minimap pixels) so content and the viewport rectangle never touch the frame. */
const PADDING = 4
/**
 * `collapsed: 'auto'` thresholds, counted in minimaps: it stays open while the canvas is
 * at least {@link EXPAND_ROOM_RATIO} minimaps wide *and* tall, and folds away below
 * {@link COLLAPSE_ROOM_RATIO}. Two thresholds rather than one so a canvas sitting on the
 * boundary — or being dragged across it — doesn't flap it open and shut.
 *
 * Four is the point where a default 200px minimap stops feeling like it is in the way:
 * an eighth of a 1600px canvas, but a third of a 600px one. Note that the derived height
 * tracks the canvas's aspect ratio, so on a normal canvas both axes give the same answer
 * and the height test only bites when the box is clamped — a short, wide canvas.
 */
const EXPAND_ROOM_RATIO = 4
const COLLAPSE_ROOM_RATIO = 3.6
/** Retina without paying for a 3× buffer. */
const MAX_DEVICE_PIXEL_RATIO = 2

/**
 * The collapse toggle's glyph: an arrow into a corner. It is rotated by CSS to point at
 * whichever corner the minimap docks in — the way it collapses — and flipped once it is
 * collapsed, so the same 12px path reads as both "put this away" and "bring it back".
 */
const COLLAPSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M3.4 3.4l5.2 5.2M8.6 5.6v3h-3"/></svg>'

/** How graph coordinates map onto minimap pixels. */
interface Projection {
    scale: number
    offsetX: number
    offsetY: number
}

/**
 * The minimap: a cached overview of the whole graph with a rectangle showing what is
 * currently on screen. Click to recentre, drag to pan, and fold it away with the small
 * toggle in the corner it faces.
 *
 * Two layers, which is the whole performance story:
 *
 * - the **content bitmap** — an offscreen canvas holding the graph, rasterised for the
 *   *content bounds* and rebuilt only when the picture changed (data, slow tick, resize);
 * - the **visible canvas** — one `drawImage` of that bitmap plus one rectangle, redrawn
 *   on every pan / zoom / drag.
 *
 * So navigating costs O(1) at any graph size, and the O(N) pass is rare. Above
 * {@link DETAIL_NODE_LIMIT} nodes the bitmap is painted as density (no per-node colour
 * lookups, no edges), which also reads better than tens of thousands of overlapping dots.
 *
 * Everything it needs is public API — `getContentBounds`, `setViewport`,
 * `screenToGraphCoordinates`, `getNodeStyle` — so it is renderer-agnostic and is exactly
 * as privileged as any consumer's own plugin.
 */
export class Minimap extends UIComponent {
    private readonly options: MinimapOptions
    private root?: HTMLDivElement
    private surface?: HTMLCanvasElement
    /** The collapse toggle, and whether it has the minimap folded away. */
    private toggle?: HTMLButtonElement
    private collapsed = false
    /** Whether the collapsed state follows the available room (`collapsed: 'auto'`). */
    private readonly autoCollapse: boolean
    /** Latched by the first explicit choice, which ends {@link autoCollapse}. */
    private userChose = false
    private context?: CanvasRenderingContext2D
    /** Offscreen content layer, and the graph-space extent it covers. */
    private bitmap?: HTMLCanvasElement
    private bitmapBounds: GraphBounds | null = null
    private observer?: ResizeObserver
    /** Hidden element used to resolve CSS colour expressions (see cssColor). */
    private probe?: HTMLSpanElement
    /** Resolved colours, keyed by the expression they came from. */
    private readonly colorCache = new Map<string, string>()
    private rebuildFrame: number | null = null
    private paintFrame: number | null = null
    /** Offset between the pointer and the viewport centre, held for the duration of a drag. */
    private dragOffset: { x: number, y: number } | null = null
    /** Whether the pointer moved since it went down — a press that doesn't move is a click. */
    private dragMoved = false
    /** Counts content rasterisations — asserted by the tests, cheap enough to always keep. */
    private rebuildCount = 0

    constructor(uiManager: UIManager, options: MinimapOptions = {}) {
        super(uiManager)
        this.options = options
        this.autoCollapse = options.collapsed === 'auto'
        this.collapsed = options.collapsed === true
    }

    /* ---------- lifecycle ---------- */

    protected onMount(container?: HTMLElement) {
        if (!container) return

        this.root = document.createElement('div')
        this.root.className = 'pvt-minimap'
        this.root.dataset.position = this.options.position ?? 'bottom-right'

        this.surface = document.createElement('canvas')
        this.surface.className = 'pvt-minimap-surface'
        this.root.appendChild(this.surface)

        this.toggle = document.createElement('button')
        this.toggle.type = 'button'
        this.toggle.className = 'pvt-minimap-toggle'
        this.toggle.innerHTML = COLLAPSE_ICON
        this.listen(this.toggle, 'click', () => this.setCollapsed(!this.collapsed))
        this.root.appendChild(this.toggle)

        // Inside the root, so theme custom properties resolve against the real cascade.
        this.probe = document.createElement('span')
        this.probe.style.display = 'none'
        this.root.appendChild(this.probe)
        container.appendChild(this.root)

        this.context = this.surface.getContext('2d') ?? undefined
        // Resolved before the first paint, so an 'auto' minimap with no room for it never
        // opens only to fold itself away a frame later.
        if (this.autoCollapse) this.collapsed = !this.hasRoom(EXPAND_ROOM_RATIO)
        this.applyCollapsed()
        this.resize()
        this.wirePointer()
    }

    protected onAfterMount() {
        const graph = this.uiManager.graph

        const onData = () => this.queueRebuild()
        graph.on('dataBatchChanged', onData)
        this.track(() => graph.off('dataBatchChanged', onData))

        // Filtering changes which nodes are drawn without touching the data or the
        // simulation, so it emits neither of the signals above — the minimap has to watch
        // the query engine itself or it keeps showing nodes that left the canvas. Covers
        // the filter panel, the legend, `setFilter` and per-node `excludeNode` alike.
        const onFilterChange = () => this.queueRebuild()
        graph.queryEngine.on('filterChange', onFilterChange)
        this.track(() => graph.queryEngine.off('filterChange', onFilterChange))

        // A slow tick is every 10th simulation tick — often enough to follow a settling
        // layout, rare enough that the O(N) pass isn't in the frame budget.
        this.trackInteraction('simulationSlowTick', () => this.queueRebuild())
        // With the simulation disabled a drag produces no ticks at all, so the dropped
        // node would keep showing at its old place. Once per drag, not per pointermove:
        // rebuilding mid-drag would put the O(N) pass back in the frame budget.
        this.trackInteraction('dragended', () => this.queueRebuild())
        // Panning / zooming leaves the content alone: only the rectangle moves.
        this.trackInteraction('canvasZoom', () => this.queuePaint())

        // No resize event on the interaction bus, and the rectangle is wrong the moment
        // the canvas changes size.
        const canvas = this.uiManager.layout?.canvas
        if (canvas && typeof ResizeObserver !== 'undefined') {
            this.observer = new ResizeObserver(() => {
                // The canvas is what the minimap covers, so its size is what 'auto'
                // tracks — the window resizing, and the sidebar opening on top of it.
                this.reconsiderRoom()
                this.resize()
                this.queueRebuild()
            })
            this.observer.observe(canvas)
        }

        this.queueRebuild()
    }

    protected onGraphReady() {
        this.queueRebuild()
    }

    protected onDestroy() {
        if (this.rebuildFrame !== null) cancelAnimationFrame(this.rebuildFrame)
        if (this.paintFrame !== null) cancelAnimationFrame(this.paintFrame)
        this.rebuildFrame = null
        this.paintFrame = null
        this.observer?.disconnect()
        this.observer = undefined
        this.root?.remove()
        this.root = undefined
        this.toggle = undefined
        this.probe = undefined
        this.colorCache.clear()
        this.surface = undefined
        this.context = undefined
        this.bitmap = undefined
    }

    /** How many times the content bitmap has been rasterised. */
    public getRebuildCount(): number {
        return this.rebuildCount
    }

    /* ---------- collapsing ---------- */

    /** Whether the minimap is folded away to just its toggle. */
    public isCollapsed(): boolean {
        return this.collapsed
    }

    /**
     * Fold the minimap away to its toggle, or bring it back. Collapsed it draws nothing
     * at all — not even the rectangle — so it costs nothing while it is put away.
     *
     * Calling this ends `collapsed: 'auto'`: from here on the state is whatever it was
     * last set to.
     */
    public setCollapsed(collapsed: boolean) {
        // An explicit choice outranks the room. Without this, opening the sidebar would
        // fold away the minimap the user had just opened by hand.
        this.userChose = true
        this.setCollapsedState(collapsed)
    }

    private setCollapsedState(collapsed: boolean) {
        if (collapsed === this.collapsed) return
        this.collapsed = collapsed
        this.applyCollapsed()
        // Expanding comes back to a stale bitmap sized for the old canvas, and every
        // signal that would have refreshed it was skipped while collapsed.
        if (!collapsed) {
            this.resize()
            this.queueRebuild()
        }
    }

    /** Re-resolve `collapsed: 'auto'` against the room the canvas has now. */
    private reconsiderRoom() {
        if (!this.autoCollapse || this.userChose) return
        if (this.collapsed) {
            if (this.hasRoom(EXPAND_ROOM_RATIO)) this.setCollapsedState(false)
        } else if (!this.hasRoom(COLLAPSE_ROOM_RATIO)) {
            this.setCollapsedState(true)
        }
    }

    /**
     * Whether the canvas is at least `ratio` minimaps across, in both axes. A canvas that
     * can't be measured (detached, `display:none`) counts as having room: the
     * ResizeObserver will ask again with a real size, and folding on a zero-sized canvas
     * would only be a guess.
     */
    private hasRoom(ratio: number): boolean {
        const canvas = this.uiManager.layout?.canvas
        if (!canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return true
        const { width, height } = this.targetSize()
        return canvas.clientWidth >= width * ratio && canvas.clientHeight >= height * ratio
    }

    /** Reflect the collapsed state on the DOM: the CSS does the rest. */
    private applyCollapsed() {
        if (!this.root || !this.toggle) return
        this.root.dataset.collapsed = String(this.collapsed)
        // Collapsed, the stylesheet sizes the root to the button; expanded, resize() owns
        // the box, so hand it back rather than leaving a stale inline size behind.
        if (this.collapsed) {
            this.root.style.width = ''
            this.root.style.height = ''
        }

        const label = this.collapsed ? 'Show the minimap' : 'Collapse the minimap'
        this.toggle.title = label
        this.toggle.setAttribute('aria-label', label)
        this.toggle.setAttribute('aria-expanded', String(!this.collapsed))
    }

    /* ---------- sizing ---------- */

    private get dpr(): number {
        return Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
    }

    /**
     * The box the minimap asks for: the width is configured, the height follows the
     * canvas's aspect ratio so the viewport rectangle isn't stretched.
     */
    private targetSize(): { width: number, height: number } {
        const canvas = this.uiManager.layout?.canvas
        const width = this.options.width ?? DEFAULT_WIDTH
        const aspect = canvas && canvas.clientWidth > 0 ? canvas.clientHeight / canvas.clientWidth : 0.625
        const height = this.options.height
            ?? Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, width * aspect)))
        return { width, height }
    }

    /** Size the surface to {@link targetSize}, in both CSS and device pixels. */
    private resize() {
        if (!this.surface || !this.root || this.collapsed) return
        const { width, height } = this.targetSize()

        this.root.style.width = `${width}px`
        this.root.style.height = `${height}px`
        // Size the pixel buffer from the surface's *laid-out* size, so the drawing keeps
        // the right aspect whatever the border and any consumer CSS do to the box.
        const cssWidth = this.surface.clientWidth || width
        const cssHeight = this.surface.clientHeight || height
        this.surface.width = Math.round(cssWidth * this.dpr)
        this.surface.height = Math.round(cssHeight * this.dpr)
    }

    /** Nothing to do while we're collapsed, display:none, detached or zero-sized. */
    private get hidden(): boolean {
        if (!this.root || !this.surface || this.collapsed) return true
        return !this.root.isConnected || this.root.offsetParent === null || this.surface.width === 0
    }

    /* ---------- scheduling ---------- */

    private queueRebuild() {
        if (this.rebuildFrame !== null) return
        this.rebuildFrame = requestAnimationFrame(() => {
            this.rebuildFrame = null
            this.rebuild()
        })
    }

    private queuePaint() {
        if (this.paintFrame !== null || this.rebuildFrame !== null) return
        this.paintFrame = requestAnimationFrame(() => {
            this.paintFrame = null
            this.paint()
        })
    }

    /* ---------- content bitmap ---------- */

    private rebuild() {
        if (this.hidden || !this.surface) return

        // Cleared per rebuild: a theme switch changes what the same expression resolves to.
        this.colorCache.clear()
        const bounds = this.uiManager.graph.renderer?.getContentBounds() ?? null
        this.bitmapBounds = bounds
        if (bounds) {
            this.rasterise(bounds)
            this.rebuildCount++
        }
        this.paint()
    }

    /**
     * Draw the graph into the offscreen bitmap, in the bitmap's own coordinate space:
     * content is mapped from `bounds` onto the bitmap with no padding, so the blit in
     * {@link paint} can place it wherever the display projection says it goes.
     */
    private rasterise(bounds: GraphBounds) {
        const surface = this.surface!
        if (!this.bitmap) this.bitmap = document.createElement('canvas')
        const bitmap = this.bitmap
        bitmap.width = surface.width
        bitmap.height = surface.height

        const context = bitmap.getContext('2d')
        if (!context) return
        context.clearRect(0, 0, bitmap.width, bitmap.height)

        const scale = Math.min(bitmap.width / bounds.width, bitmap.height / bounds.height)
        const projection: Projection = { scale, offsetX: -bounds.x * scale, offsetY: -bounds.y * scale }

        const nodes = this.uiManager.graph.getMutableVisibleNodes().filter((node) => !node.isChild)
        if (nodes.length > DETAIL_NODE_LIMIT) {
            this.drawDensity(context, nodes, projection)
            return
        }

        this.drawEdges(context, projection)
        this.drawNodes(context, nodes, projection)
    }

    /**
     * Hairline edges under the nodes. Skipped entirely past {@link DETAIL_EDGE_LIMIT} —
     * at thumbnail size a dense edge set washes out the clusters it is meant to reveal.
     */
    private drawEdges(context: CanvasRenderingContext2D, projection: Projection) {
        const edges = this.uiManager.graph.getEdges().filter((edge: Edge) => edge.visible !== false)
        if (edges.length === 0 || edges.length > DETAIL_EDGE_LIMIT) return

        context.save()
        context.strokeStyle = this.ink('--pvt-minimap-edge', 'rgba(120,140,170,0.55)')
        context.lineWidth = Math.max(0.5, 0.5 * this.dpr)
        context.beginPath()
        for (const edge of edges) {
            const from = edge.from
            const to = edge.to
            if (!from?.visible || !to?.visible) continue
            if (typeof from.x !== 'number' || typeof to.x !== 'number') continue
            context.moveTo(this.px(from.x, projection), this.py(from.y as number, projection))
            context.lineTo(this.px(to.x, projection), this.py(to.y as number, projection))
        }
        context.stroke()
        context.restore()
    }

    /** A dot per node in the colour the renderer actually painted it. */
    private drawNodes(context: CanvasRenderingContext2D, nodes: Node[], projection: Projection) {
        const renderer = this.uiManager.graph.renderer
        for (const node of nodes) {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') continue
            // getNodeStyle allocates and resolves strings, so it is called once per node
            // per rebuild — never per frame.
            const style = renderer?.getNodeStyle(node)
            const size = typeof style?.size === 'number' ? style.size : 10
            const radius = Math.max(1, Math.min(4 * this.dpr, size * projection.scale))

            context.beginPath()
            context.fillStyle = typeof style?.color === 'string'
                ? this.cssColor(style.color, '#7EA2FB')
                : '#7EA2FB'
            context.arc(this.px(node.x, projection), this.py(node.y, projection), radius, 0, Math.PI * 2)
            context.fill()
        }
    }

    /**
     * The big-graph path: one small stamp per node in a single ink, letting the alpha
     * accumulate. Cost is one `fillRect` per node with no style resolution at all, and
     * dense regions saturate into a density map — a truer picture of a large graph than
     * 50k overlapping dots.
     */
    private drawDensity(context: CanvasRenderingContext2D, nodes: Node[], projection: Projection) {
        const size = Math.max(1, Math.round(this.dpr))
        context.save()
        context.fillStyle = this.ink('--pvt-minimap-ink', 'rgba(90,120,190,0.75)')
        context.globalAlpha = 0.35
        for (const node of nodes) {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') continue
            context.fillRect(this.px(node.x, projection), this.py(node.y, projection), size, size)
        }
        context.restore()
    }

    private px(x: number, projection: Projection): number {
        return x * projection.scale + projection.offsetX
    }

    private py(y: number, projection: Projection): number {
        return y * projection.scale + projection.offsetY
    }

    /** A themed colour, resolved from the minimap's own CSS custom properties. */
    private ink(variable: string, fallback: string): string {
        if (!this.root) return fallback
        const value = getComputedStyle(this.root).getPropertyValue(variable).trim()
        return this.cssColor(value, fallback)
    }

    /**
     * Turn any CSS colour *expression* into something a canvas can actually paint.
     *
     * This matters more than it looks: the renderer's resolved node colour is usually
     * something like `var(--pvt-node-color, #007acc)`, and a custom property's value is
     * substituted rather than computed, so `getPropertyValue` hands back
     * `color-mix(in srgb, var(…) 80%, transparent)` verbatim. Assigning either to
     * `fillStyle` is a no-op, and the canvas silently keeps the previous colour — which
     * is how every dot ends up black. So let the browser resolve it: park the value on a
     * probe inside the themed subtree and read back the computed `color`.
     */
    private cssColor(value: string, fallback: string): string {
        if (!value) return fallback
        // Plain colours (#rgb, rgb(), a keyword) need no round trip.
        if (!value.includes('var(') && !value.includes('color-mix')) return value

        const cached = this.colorCache.get(value)
        if (cached) return cached

        const probe = this.probe
        if (!probe) return fallback
        probe.style.color = ''
        probe.style.color = value
        // An expression the browser rejects outright leaves the property empty.
        const resolved = probe.style.color === '' ? fallback : (getComputedStyle(probe).color || fallback)
        this.colorCache.set(value, resolved)
        return resolved
    }

    /* ---------- visible canvas ---------- */

    /**
     * The region currently on screen, in graph coordinates — what the rectangle draws,
     * derived from the canvas's
     * own corners through the renderer's public coordinate transform, so no zoom
     * transform (and no d3) is needed here.
     */
    public getViewportBounds(): GraphBounds | null {
        const canvas = this.uiManager.layout?.canvas
        const renderer = this.uiManager.graph.renderer
        if (!canvas || !renderer) return null

        const rect = canvas.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return null

        const topLeft = renderer.screenToGraphCoordinates(rect.left, rect.top)
        const bottomRight = renderer.screenToGraphCoordinates(rect.right, rect.bottom)
        return {
            x: topLeft.x,
            y: topLeft.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y,
        }
    }

    /** The extent the minimap shows: the graph, plus wherever the user is looking. */
    private displayBounds(): GraphBounds | null {
        const content = this.bitmapBounds
        const viewport = this.getViewportBounds()
        if (!content) return viewport
        if (!viewport) return content

        const x = Math.min(content.x, viewport.x)
        const y = Math.min(content.y, viewport.y)
        return {
            x,
            y,
            width: Math.max(content.x + content.width, viewport.x + viewport.width) - x,
            height: Math.max(content.y + content.height, viewport.y + viewport.height) - y,
        }
    }

    /** Where the display extent lands on the surface, honouring the frame inset. */
    private projectionFor(bounds: GraphBounds): Projection {
        const surface = this.surface!
        const usableWidth = Math.max(1, surface.width - 2 * PADDING * this.dpr)
        const usableHeight = Math.max(1, surface.height - 2 * PADDING * this.dpr)
        const scale = Math.min(usableWidth / bounds.width, usableHeight / bounds.height)
        return {
            scale,
            offsetX: (surface.width - bounds.width * scale) / 2 - bounds.x * scale,
            offsetY: (surface.height - bounds.height * scale) / 2 - bounds.y * scale,
        }
    }

    private paint() {
        if (this.hidden || !this.context || !this.surface) return
        const context = this.context
        context.clearRect(0, 0, this.surface.width, this.surface.height)

        const display = this.displayBounds()
        if (!display || display.width <= 0 || display.height <= 0) return
        const projection = this.projectionFor(display)

        // The cached content, scaled and offset into place — never re-rasterised.
        const content = this.bitmapBounds
        if (this.bitmap && content) {
            const sourceScale = Math.min(this.bitmap.width / content.width, this.bitmap.height / content.height)
            context.drawImage(
                this.bitmap,
                0, 0, content.width * sourceScale, content.height * sourceScale,
                this.px(content.x, projection), this.py(content.y, projection),
                content.width * projection.scale, content.height * projection.scale,
            )
        }

        const viewport = this.getViewportBounds()
        if (!viewport) return
        const x = this.px(viewport.x, projection)
        const y = this.py(viewport.y, projection)
        const width = viewport.width * projection.scale
        const height = viewport.height * projection.scale

        context.save()
        // Dim what is *outside* the viewport rather than tinting what's inside: when the
        // whole graph is in view the rectangle covers the minimap, and a fill would then
        // wash out the entire picture.
        context.fillStyle = this.ink('--pvt-minimap-shroud', 'rgba(20,24,32,0.10)')
        const { width: surfaceWidth, height: surfaceHeight } = this.surface
        context.fillRect(0, 0, surfaceWidth, Math.max(0, y))
        context.fillRect(0, y + height, surfaceWidth, Math.max(0, surfaceHeight - (y + height)))
        context.fillRect(0, Math.max(0, y), Math.max(0, x), Math.min(height, surfaceHeight))
        context.fillRect(x + width, Math.max(0, y), Math.max(0, surfaceWidth - (x + width)), Math.min(height, surfaceHeight))

        context.strokeStyle = this.ink('--pvt-minimap-viewport-stroke', 'rgba(126,162,251,0.9)')
        context.lineWidth = Math.max(1, this.dpr)
        context.strokeRect(x, y, width, height)
        context.restore()
    }

    /* ---------- interaction ---------- */

    private wirePointer() {
        const surface = this.surface
        if (!surface) return

        this.listen(surface, 'pointerdown', (event) => {
            const pointer = event as PointerEvent
            if (pointer.button !== 0) return
            const point = this.graphPointAt(pointer)
            if (!point) return

            // Pressing *inside* the rectangle starts a drag that keeps the grab offset,
            // so the view follows the cursor rather than snapping its centre under it.
            // Pressing outside recentres straight away.
            const viewport = this.getViewportBounds()
            const inside = viewport !== null
                && point.x >= viewport.x && point.x <= viewport.x + viewport.width
                && point.y >= viewport.y && point.y <= viewport.y + viewport.height

            this.dragOffset = inside && viewport
                ? { x: viewport.x + viewport.width / 2 - point.x, y: viewport.y + viewport.height / 2 - point.y }
                : { x: 0, y: 0 }
            this.dragMoved = false

            surface.setPointerCapture(pointer.pointerId)
            surface.classList.add('pvt-minimap-dragging')
            // A press inside the rectangle isn't a move yet — it might be a click, which
            // should recentre (see the pointerup below).
            if (!inside) this.moveViewTo(point)
            pointer.preventDefault()
        })

        this.listen(surface, 'pointermove', (event) => {
            if (this.dragOffset === null) return
            const point = this.graphPointAt(event as PointerEvent)
            if (!point) return
            this.dragMoved = true
            this.moveViewTo(point)
        })

        const end = (event: Event) => {
            if (this.dragOffset === null) return
            const pointer = event as PointerEvent
            // Pressed and released inside the rectangle without moving: that's a click,
            // and a click recentres on where it landed.
            if (!this.dragMoved && pointer.type === 'pointerup') {
                const point = this.graphPointAt(pointer)
                this.dragOffset = { x: 0, y: 0 }
                if (point) this.moveViewTo(point)
            }
            this.dragOffset = null
            this.dragMoved = false
            surface.classList.remove('pvt-minimap-dragging')
            if (surface.hasPointerCapture?.(pointer.pointerId)) surface.releasePointerCapture(pointer.pointerId)
        }
        this.listen(surface, 'pointerup', end)
        this.listen(surface, 'pointercancel', end)
    }

    /** Where a pointer event lands, in graph coordinates. */
    private graphPointAt(event: PointerEvent): { x: number, y: number } | null {
        if (!this.surface) return null
        const display = this.displayBounds()
        if (!display) return null

        const rect = this.surface.getBoundingClientRect()
        const projection = this.projectionFor(display)
        // Client px → surface px (the surface is scaled by DPR) → graph coordinates.
        const surfaceX = (event.clientX - rect.left) * (this.surface.width / rect.width)
        const surfaceY = (event.clientY - rect.top) * (this.surface.height / rect.height)
        return {
            x: (surfaceX - projection.offsetX) / projection.scale,
            y: (surfaceY - projection.offsetY) / projection.scale,
        }
    }

    private moveViewTo(point: { x: number, y: number }) {
        const offset = this.dragOffset ?? { x: 0, y: 0 }
        this.uiManager.graph.renderer?.setViewport({ x: point.x + offset.x, y: point.y + offset.y })
        this.queuePaint()
    }
}
