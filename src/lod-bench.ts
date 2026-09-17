/**
 * Cost bench for zoom-driven level-of-detail (scratch, not shipped).
 *
 * Boots a grid of N nodes with the simulation off, then swaps every node between
 * two representations the MISP node designs actually use:
 *
 *   'shape' — native circle + `svgIcon` glyph  (the S tier)
 *   'card'  — `shape:'none'` + a 140x44 `html` card (the M tier)
 *
 * and times the swap. `window.__bench` is the whole surface a driver script needs.
 */
import { Pivotick, Node } from './index'
import type { RawEdge, RawNode } from './interfaces/GraphOptions'

type Tier = 'shape' | 'card'

/** Current tier — read by the style callbacks, so a swap is one assignment + a redraw. */
let tier: Tier = 'shape'

const GLYPH = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 9 L22 20 L10 20 Z" fill="currentColor"/></svg>'

/** The M-tier card: a fixed 140x44 box, so measurement is font-independent. */
function buildCard(node: Node): HTMLElement {
    const el = document.createElement('div')
    el.style.cssText = 'display:inline-flex;box-sizing:border-box;align-items:center;gap:6px;'
        + 'width:140px;height:44px;padding:0 8px;border:1px solid #334155;border-radius:6px;background:#fff'
    const dot = document.createElement('span')
    dot.style.cssText = 'flex:0 0 20px;height:20px;border-radius:50%;background:#1892B1'
    const text = document.createElement('span')
    text.style.cssText = 'font:12px/1.2 sans-serif;color:#0f172a;overflow:hidden;white-space:nowrap'
    text.textContent = String(node.getData().label ?? node.id)
    el.append(dot, text)
    return el
}

function buildData(n: number, pitchX = 180, pitchY = 90, cols = Math.ceil(Math.sqrt(n))): {
    nodes: Node[]; edges: never[]
} {
    const nodes: Node[] = []
    for (let i = 0; i < n; i++) {
        const node = new Node(`n-${i}`, { label: `10.13.${Math.floor(i / 256)}.${i % 256}` }, {}, `n-${i}`)
        node.x = (i % cols) * pitchX
        node.y = Math.floor(i / cols) * pitchY
        nodes.push(node)
    }
    return { nodes, edges: [] }
}

/**
 * A connected graph laid out by the simulation rather than placed on a grid —
 * what the spacing question actually applies to. Each node attaches to one
 * earlier node (a spanning tree), plus a few extra edges for structure.
 */
function buildConnected(n: number): { nodes: RawNode[]; edges: RawEdge[] } {
    const nodes: RawNode[] = []
    const edges: RawEdge[] = []
    for (let i = 0; i < n; i++) {
        nodes.push({ id: `n-${i}`, data: { label: `10.13.${Math.floor(i / 256)}.${i % 256}` } })
        if (i > 0) {
            // Deterministic parent, biased towards recent nodes so the tree branches.
            const parent = Math.max(0, i - 1 - ((i * 7919) % Math.min(i, 6)))
            edges.push({ id: `e-${i}`, from: `n-${parent}`, to: `n-${i}` })
        }
    }
    for (let j = 0; j < Math.floor(n / 8); j++) {
        const a = (j * 3571) % n
        const b = (j * 6949 + 13) % n
        if (a !== b) edges.push({ id: `x-${j}`, from: `n-${a}`, to: `n-${b}` })
    }
    return { nodes, edges }
}

const params = new URLSearchParams(location.search)
const N = Number(params.get('n') ?? 500)
/** `?sim=1` leaves physics on, so the bench can see a swap reheat the layout. */
const SIM = params.get('sim') === '1'
/** `?physics=auto` uses the shipped Auto preset — the spacing a real integrator gets. */
const PHYSICS = params.get('physics') === 'auto' ? 'auto' : 'manual'
/** `?graph=connected` lays out a real connected graph instead of a fixed grid. */
const CONNECTED = params.get('graph') === 'connected'
/**
 * `?tiers=1` declares the card as a real `tiers` entry instead of swapping it by hand, so a
 * crossing runs the shipped path: rendered-size threshold, hysteresis, on-screen check, the
 * one coalesced redraw and the edge refresh after it.
 */
const TIERS = params.get('tiers') === '1'
/** `?fade=<ms>` is `render.tierTransition` — 0 is the swap as it ships today. */
const FADE = Number(params.get('fade') ?? 0)
/**
 * `?pitch=x,y` sets the grid spacing, and `?cols=n` the row width.
 *
 * Needed to measure the worst case. A tier only engages once a node renders at its declared
 * width, and the drawer skips nodes that are off screen — so on a loose grid the zoom that
 * turns on 140px cards is also the zoom at which only a couple of dozen nodes are visible,
 * and a run measures those rather than all N. Packing the grid to roughly a card's pitch
 * puts every node on screen at the zoom where the card tier takes over.
 */
const PITCH = (params.get('pitch') ?? '180,90').split(',').map(Number)
const COLS = params.get('cols') ? Number(params.get('cols')) : undefined

const container = document.getElementById('app') as HTMLElement

const data = CONNECTED ? buildConnected(N) : buildData(N, PITCH[0], PITCH[1], COLS)

const graph = new Pivotick(container, data as never, {
    isDirected: false,
    UI: { mode: 'light', theme: 'light', sidebar: { collapsed: true } },
    simulation: { enabled: SIM, useWorker: false, physics: PHYSICS },
    render: {
        zoomAnimation: false,
        tierTransition: FADE,
        defaultNodeStyle: TIERS
            ? {
                shape: 'circle',
                size: 16,
                color: '#97CC04',
                strokeColor: '#4d6b00',
                // No `svgIcon` on the base on purpose: the style fold is `??`, so a tier can
                // override a channel but cannot unset one, and a glyph left on the base
                // outranks the card the tier asks for.
                // One tier, 140x44, so the threshold sits at zoom 1 and a run can cross it in
                // either direction by zooming either side.
                tiers: [{ width: 140, height: 44, style: { shape: 'none', html: buildCard } }],
            }
            : {
                shape: () => (tier === 'card' ? 'none' : 'circle'),
                size: 16,
                color: '#97CC04',
                strokeColor: '#4d6b00',
                svgIcon: () => (tier === 'card' ? undefined : GLYPH),
                html: (node: Node) => (tier === 'card' ? buildCard(node) : undefined),
            },
    },
} as never)

/** Resolve on the next frame — one hop of the rAF work `render()` defers. */
const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))

/** Wall-clock until the DOM stops changing, i.e. all deferred measurement has landed. */
async function settle(maxFrames = 240): Promise<number> {
    const start = performance.now()
    let quiet = 0
    for (let i = 0; i < maxFrames && quiet < 3; i++) {
        const before = document.querySelectorAll('#app foreignObject, #app g.pvt-node > *').length
        await frame()
        const after = document.querySelectorAll('#app foreignObject, #app g.pvt-node > *').length
        quiet = before === after ? quiet + 1 : 0
    }
    return performance.now() - start
}

/** Frame intervals, in ms, for the next `ms` of wall clock. */
function recordFrames(ms: number): Promise<number[]> {
    return new Promise((resolve) => {
        const deltas: number[] = []
        const start = performance.now()
        let last = start
        const step = (): void => {
            const now = performance.now()
            deltas.push(now - last)
            last = now
            if (now - start < ms) requestAnimationFrame(step)
            else resolve(deltas)
        }
        requestAnimationFrame(step)
    })
}

/** Long tasks (>50 ms of blocked main thread) observed since the last reset. */
const longTasks: number[] = []
try {
    new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration)
    }).observe({ entryTypes: ['longtask'] })
} catch { /* not supported — the bench still reports sync + settle time */ }

let zoomEvents = 0

const api = {
    ready: false,
    nodeCount: N,

    /** How many nodes are in the DOM, and how many of them are cards. */
    counts(): { nodes: number; cards: number } {
        return {
            nodes: document.querySelectorAll('#app g.pvt-node').length,
            cards: document.querySelectorAll('#app g.pvt-node foreignObject').length,
        }
    },

    /** `renderer.update()` with nothing dirty: the fixed tax of the redraw pass. */
    noop(runs = 20): { median: number; mean: number } {
        const times: number[] = []
        for (let i = 0; i < runs; i++) {
            const t0 = performance.now()
            graph.renderer.update(false)
            times.push(performance.now() - t0)
        }
        times.sort((a, b) => a - b)
        return {
            median: times[Math.floor(times.length / 2)],
            mean: times.reduce((a, b) => a + b, 0) / times.length,
        }
    },

    /**
     * Swap `count` nodes (all of them by default) to `next` and time it.
     * `sync` is the blocking cost of `update()`; `settled` also covers the rAF
     * measurement pass that cards trigger.
     */
    async swap(next: Tier, count?: number): Promise<{
        sync: number; settled: number; longTasks: number[]; dirtied: number
    }> {
        longTasks.length = 0
        tier = next
        const nodes = graph.getMutableNodes()
        const subset = count === undefined ? nodes : nodes.slice(0, count)
        for (const node of subset) node.markDirty()
        const t0 = performance.now()
        graph.renderer.update(false)
        const sync = performance.now() - t0
        const settled = await settle()
        return { sync, settled, longTasks: [...longTasks], dirtied: subset.length }
    },

    /**
     * The same swap, optionally cross-faded, with the frames after it recorded.
     *
     * `fadeMs = 0` is the plain swap as it ships today and is the baseline the faded run is
     * read against. Above 0 the swap becomes:
     *
     *   1. lift each changing node's current drawing into a ghost group, detached;
     *   2. redraw, which fills the now-empty node group with the new drawing;
     *   3. wrap that new drawing, put the ghost back on top of it, fade the two past each
     *      other and drop the ghost when its fade ends.
     *
     * The ghost goes back **last** so the new drawing is the one `querySelector('.node')`
     * finds — the ghost still holds an old `.node` of its own.
     *
     * This is the expensive shape of the mechanism: it moves children twice per node. A
     * renderer that always drew into a tier wrapper would swap two wrappers instead and move
     * nothing, so these numbers are an upper bound on what the library would pay.
     */
    async swapFaded(next: Tier, fadeMs = 160, count?: number): Promise<{
        sync: number; lift: number; redraw: number; attach: number
        frames: number[]; settled: number; longTasks: number[]; dirtied: number; ghosts: number
    }> {
        longTasks.length = 0
        const all = graph.getMutableNodes()
        const subset = count === undefined ? all : all.slice(0, count)
        const SVG_NS = 'http://www.w3.org/2000/svg'

        const t0 = performance.now()

        const ghosts: Array<[SVGGElement, SVGGElement]> = []
        if (fadeMs > 0) {
            for (const node of subset) {
                const g = node.getGraphElement() as SVGGElement | null
                if (!g) continue
                const ghost = document.createElementNS(SVG_NS, 'g')
                ghost.setAttribute('pointer-events', 'none')
                ghost.setAttribute('class', 'pvt-node-outgoing')
                while (g.firstChild) ghost.append(g.firstChild)
                ghosts.push([g, ghost])
            }
        }
        const lift = performance.now() - t0

        for (const node of subset) node.markDirty()

        const t1 = performance.now()
        tier = next
        graph.renderer.update(false)
        const redraw = performance.now() - t1

        const t2 = performance.now()
        for (const [g, ghost] of ghosts) {
            const incoming = document.createElementNS(SVG_NS, 'g')
            while (g.firstChild) incoming.append(g.firstChild)
            g.append(incoming, ghost)
            incoming.animate([{ opacity: 0 }, { opacity: 1 }],
                { duration: fadeMs, easing: 'ease-out', fill: 'both' })
            const out = ghost.animate([{ opacity: 1 }, { opacity: 0 }],
                { duration: fadeMs, easing: 'ease-out', fill: 'both' })
            out.onfinish = () => ghost.remove()
        }
        const attach = performance.now() - t2
        const sync = performance.now() - t0

        // Long enough to cover the fade itself and the frames either side of it.
        const frames = await recordFrames(fadeMs + 240)
        const settled = await settle()
        return {
            sync, lift, redraw, attach, frames, settled,
            longTasks: [...longTasks], dirtied: subset.length, ghosts: ghosts.length,
        }
    },

    /**
     * Zoom to `k` and record every frame until the canvas is quiet again.
     *
     * The swap is not driven from here: setting the viewport fires the zoom event, the drawer
     * coalesces a tier pass into the next frame and decides for itself what changed. So this
     * measures the whole crossing the way a wheel gesture produces it, fade included.
     */
    async crossTo(k: number, forMs = 600): Promise<{
        frames: number[]; settled: number; longTasks: number[]
        cardsBefore: number; cardsAfter: number; ghostsPeak: number; reachedK: number
    }> {
        longTasks.length = 0
        const cardsBefore = api.counts().cards
        const renderer = graph.renderer as unknown as {
            getZoomTransform(): { k: number; x: number; y: number }
            setViewport(t: { x: number; y: number; scale: number }): void
        }
        // `setViewport` takes the point to centre on, not the top-left corner. Handing it a
        // corner flies the camera off the graph, and then every node fails the on-screen
        // check and no tier changes at all — which reads as "the swap costs nothing".
        //
        // Taken from the renderer's own bounds rather than measured off the DOM: `#app svg`
        // matches the first icon in the chrome, not the canvas, and a 16px "viewport" puts
        // the centre a couple of thousand units away from the graph.
        const view = (graph.renderer as unknown as { getVisibleBounds(): {
            x: number; y: number; width: number; height: number
        } | null }).getVisibleBounds()
        const centre = view
            ? { x: view.x + view.width / 2, y: view.y + view.height / 2 }
            : { x: 0, y: 0 }

        let ghostsPeak = 0
        const watch = setInterval(() => {
            const n = document.querySelectorAll('#app g.pvt-tier-ghosts > g').length
            if (n > ghostsPeak) ghostsPeak = n
        }, 8)

        renderer.setViewport({ x: centre.x, y: centre.y, scale: k })
        const frames = await recordFrames(forMs)
        const settled = await settle()
        clearInterval(watch)

        return {
            frames, settled, longTasks: [...longTasks],
            cardsBefore, cardsAfter: api.counts().cards, ghostsPeak,
            // Reported so a run that never reached the zoom it asked for — an initial fit
            // landing late will overwrite it — is visible rather than silently measuring
            // a crossing that did not happen.
            reachedK: renderer.getZoomTransform().k,
        }
    },

    /** Frame intervals while the viewport is panned programmatically, in ms. */
    async panFrames(steps = 60): Promise<number[]> {
        const renderer = graph.renderer as unknown as {
            getZoomTransform(): { k: number; x: number; y: number }
            setViewport(t: { x: number; y: number; scale: number }): void
        }
        const t = renderer.getZoomTransform()
        const deltas: number[] = []
        let last = performance.now()
        for (let i = 0; i < steps; i++) {
            renderer.setViewport({ x: -t.x / t.k + i * 4, y: -t.y / t.k, scale: t.k })
            await frame()
            const now = performance.now()
            deltas.push(now - last)
            last = now
        }
        return deltas
    },

    /**
     * Frame intervals while the viewport is *scaled*, in ms. Separate from
     * {@link panFrames} because a zoom re-rasterises every `foreignObject`,
     * where a pan only re-composites them.
     */
    async zoomFrames(steps = 60): Promise<number[]> {
        const renderer = graph.renderer as unknown as {
            getZoomTransform(): { k: number; x: number; y: number }
            setViewport(t: { x: number; y: number; scale: number }): void
        }
        const t = renderer.getZoomTransform()
        const deltas: number[] = []
        let last = performance.now()
        for (let i = 0; i < steps; i++) {
            // Sweep the scale up and back so the graph stays roughly in frame.
            const scale = t.k * (1 + 0.6 * Math.sin((i / steps) * Math.PI))
            renderer.setViewport({ x: -t.x / t.k, y: -t.y / t.k, scale })
            await frame()
            const now = performance.now()
            deltas.push(now - last)
            last = now
        }
        return deltas
    },

    /** What the tier decision is actually reading, for a run that measured no crossing. */
    tierDebug(): Record<string, unknown> {
        const node = graph.getMutableNodes()[0]
        const k = api.zoomK()
        const layoutSize = node?.getLayoutSize()
        return {
            k,
            layoutSize,
            rendered: layoutSize === undefined ? null : layoutSize * 2 * k,
            circleRadius: node?.getCircleRadius(),
            drawnTier: node?.getGraphElement()?.getAttribute('data-pvt-tier'),
            visible: node?.visible,
        }
    },

    /** Current zoom scale. Polled by a driver waiting for the initial fit to stop moving. */
    zoomK(): number {
        return (graph.renderer as unknown as { getZoomTransform(): { k: number } }).getZoomTransform().k
    },

    zoomEventCount(): number { return zoomEvents },
    resetZoomCount(): void { zoomEvents = 0 },

    /** Node positions and collision radii, to see whether a swap disturbs the layout. */
    layout(): { pos: Record<string, [number, number]>; radius: Record<string, number> } {
        const pos: Record<string, [number, number]> = {}
        const radius: Record<string, number> = {}
        for (const node of graph.getMutableNodes()) {
            pos[node.id] = [node.x ?? 0, node.y ?? 0]
            radius[node.id] = node.getCircleRadius()
        }
        return { pos, radius }
    },

    /** Largest distance any node moved between two {@link layout} snapshots. */
    drift(before: Record<string, [number, number]>): number {
        let max = 0
        for (const node of graph.getMutableNodes()) {
            const was = before[node.id]
            if (!was) continue
            const dx = (node.x ?? 0) - was[0]
            const dy = (node.y ?? 0) - was[1]
            max = Math.max(max, Math.hypot(dx, dy))
        }
        return max
    },

    /**
     * What spacing the shipped physics actually produced, and what that means for
     * tier unlocking under rule B. Distances are graph units, which are CSS pixels
     * at zoom 1. `fitZoom` is the zoom the initial fit chose, so the `xFromFit`
     * figures say how far a user has to zoom in from first sight.
     */
    spacing(tierWidths: Record<string, number>): Record<string, unknown> {
        const nodes = graph.getMutableNodes().filter(n => n.visible)
        const nearest: number[] = []
        for (const a of nodes) {
            let best = Infinity
            for (const b of nodes) {
                if (a === b) continue
                const d = Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0))
                if (d < best) best = d
            }
            if (isFinite(best)) nearest.push(best)
        }
        nearest.sort((a, b) => a - b)
        const at = (q: number) => nearest[Math.floor(nearest.length * q)] ?? 0
        const median = at(0.5)

        const fitZoom = (graph.renderer as unknown as {
            getZoomTransform(): { k: number }
        }).getZoomTransform().k

        // Under rule B a tier unlocks when the on-screen gap can hold it:
        // spacing x zoom >= tierWidth.
        const unlock: Record<string, unknown> = {}
        for (const [name, width] of Object.entries(tierWidths)) {
            const zoom = median > 0 ? width / median : Infinity
            unlock[name] = {
                zoom: +zoom.toFixed(2),
                xFromFit: fitZoom > 0 ? +(zoom / fitZoom).toFixed(2) : null,
            }
        }

        return {
            nodes: nodes.length,
            nodeRadius: nodes[0]?.getCircleRadius() ?? 0,
            nearestNeighbour: {
                p10: +at(0.1).toFixed(1),
                median: +median.toFixed(1),
                p90: +at(0.9).toFixed(1),
            },
            fitZoom: +fitZoom.toFixed(3),
            unlock,
        }
    },

    /**
     * Cost of one `nextTick()` — rewriting every node transform and every edge path.
     * A fixed-screen-size mode has to do exactly this on each zoom event, because a
     * counter-scaled node changes both its own transform and where its edges land.
     */
    tickCost(runs = 30): { median: number; mean: number; edges: number } {
        const renderer = graph.renderer as unknown as { nextTick(): void }
        const times: number[] = []
        for (let i = 0; i < runs; i++) {
            const t0 = performance.now()
            renderer.nextTick()
            times.push(performance.now() - t0)
        }
        times.sort((a, b) => a - b)
        return {
            median: times[Math.floor(times.length / 2)],
            mean: times.reduce((a, b) => a + b, 0) / times.length,
            edges: graph.getMutableEdges().filter(e => e.visible).length,
        }
    },

    /** Current simulation temperature — non-zero means the layout is still moving. */
    alpha(): number {
        const sim = graph.simulation as unknown as { simulation?: { alpha(): number } }
        return sim?.simulation?.alpha?.() ?? -1
    },
}

;(window as unknown as { __bench: typeof api }).__bench = api

graph.on('ready', () => {
    graph.renderer.getGraphInteraction().on('canvasZoom', () => { zoomEvents++ })
    api.ready = true
})
