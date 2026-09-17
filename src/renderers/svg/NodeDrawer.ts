import { select as d3Select, type Selection } from 'd3-selection'
import { transition as d3Transition } from 'd3-transition'
import { Node } from '../../Node'
import type { GraphBounds } from '../../GraphRenderer'
import { Edge } from '../../Edge'
import type { Graph } from '../../Graph'
import { GraphSvgRenderer } from './GraphSvgRenderer'
import { defaultLabelStyle } from '../../styles/defaults'
import { resolveIcon, tryResolveBoolean, tryResolveNumber, tryResolveString } from '../../utils/Getters'
import { parseSvgIconMarkup } from '../../utils/SvgSanitizer'
import { hasAllowedScheme, SAFE_IMAGE_SCHEMES } from '../../utils/urlSafety'
import type { CustomNodeShape, GraphRendererOptions, ImageFit, NodeShape, NodeStyle, NodeTier } from '../../interfaces/RendererOptions'
import { ClusterDrawer } from './ClusterDrawer'
import { BadgeDrawer, nodeRimAnchor, resolveBadges, RIM_PADDING } from './BadgeDrawer'
import { forceConstrainParent } from '../../plugins/d3Forces/ForceConstrainParent'
import { imageOff } from '../../ui/icons'
d3Select.prototype.transition = d3Transition

export class NodeDrawer {

    public graph: Graph
    public rendererOptions: GraphRendererOptions
    public graphSvgRenderer: GraphSvgRenderer
    public clusterDrawer: ClusterDrawer
    public badgeDrawer: BadgeDrawer
    private renderCB?: GraphRendererOptions['renderNode']
    /**
     * What each node's tiers resolved to last time it was drawn. The per-zoom pass reads this
     * rather than re-running the style chain, which is what keeps it at ~1 us per node, and
     * the remembered index is what gives the hysteresis band something to hold.
     */
    private tierState = new WeakMap<Node, TierState>()
    /**
     * Set the first time any node resolves a `tiers` array. A graph that declares none never
     * runs the per-zoom pass at all.
     */
    private tiersDeclared = false
    /** Pending frame for the coalesced tier pass, if any. */
    private tierRefreshFrame: number | null = null
    /** The node under the pointer, whatever the focus trigger does with it. */
    private hoveredNode: Node | null = null
    /** The node currently showing its focus drawing. There is only ever one. */
    private focusedNode: Node | null = null

    public constructor(rendererOptions: GraphRendererOptions, graph: Graph, graphSvgRenderer: GraphSvgRenderer) {
        this.graphSvgRenderer = graphSvgRenderer
        this.graph = graph
        this.rendererOptions = rendererOptions
        this.renderCB = this.rendererOptions?.renderNode
        this.clusterDrawer = new ClusterDrawer(this)
        this.badgeDrawer = new BadgeDrawer(graph)
    }

    public render(theNodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {

        // Resolved once and shared: badges need it on both paths, and it is the same value the
        // default path would have resolved for itself.
        const style = this.getNodeStyle(node)

        // Before anything is drawn: the footprint is declared, not measured, so the layout
        // knows it from the first tick and the drawing below can never move the node.
        node.setLayoutSize(style.layoutSize)

        // `renderNode` claims the node outright — but only for the nodes it actually draws.
        // Returning nothing hands this one back to the styling pipeline, so one callback can
        // card a few nodes and leave the rest their shapes.
        const custom = cardContent(this.renderCB?.(node))
        if (custom !== undefined) {
            // Before the card, so it paints behind: the box selection and hover are drawn on.
            appendBackingBox(theNodeSelection, 10)
            const fo = theNodeSelection.append('foreignObject')
                .attr('width', 20)
                .attr('height', 20)
            appendCard(fo, custom)

            // In here, we could add support of other lightweight framework such as jQuery, Vue.js, ..

            // The card *is* the node here, so nothing is drawn behind it.
            this.fitCardToContent(fo, node, 0)

        } else {
            this.genericNodeRender(theNodeSelection, style, node)
            // A shapeless node's geometry belongs to its content, which measures itself. The
            // block below reads the drawn shape's box, and with no shape to read falls back
            // to a 50x50 guess — which would overwrite whatever the card measured.
            if (style.shape !== 'none') requestAnimationFrame(() => {
                const nodeElement = theNodeSelection.node()
                if (!nodeElement) return

                let width = 50, height = 50 // default fallback size of a node
                const shapeElement = nodeElement.querySelector('.node') as SVGGraphicsElement | null
                const bbox = shapeElement?.getBBox()
                if (bbox && bbox.width > 0 && bbox.height > 0) {
                    width = Math.ceil(bbox.width)
                    height = Math.ceil(bbox.height)
                }

                if (this.rendererOptions.enableNodeExpansion && (!node.hasChildren() || !node.expanded)) {
                    if (style.shape == 'square') {
                        node.setCircleRadius(Math.SQRT1_2 * Math.max(width, height)) // Is the only shape that has a coord. shift
                    } else {
                        node.setCircleRadius(0.5 * Math.max(width, height))
                    }
                    // A custom shape only learns its real radius here, having been drawn at a guess.
                    if (this.isCustomShape(style.shape as NodeShape)) this.badgeDrawer.reanchor(node)
                }

                // After the radius: setting it clears any border the shape had.
                this.applyShapeBorder(node, style.shape as NodeShape, bbox)
            })
        }

        // Published so a tier swap is assertable without reading pixels, and legible in the
        // inspector. `base` is the floor style, i.e. no tier qualified.
        if (this.tiersDeclared) {
            const active = this.tierState.get(node)?.index ?? BASE_TIER
            theNodeSelection.attr('data-pvt-tier', active === BASE_TIER ? 'base' : String(active))
        }

        this.badgeDrawer.render(theNodeSelection, node, resolveBadges(style, node, this.graph))

        // Only a node a pivot run created and could still write can be unsaved: one
        // whose pivot declares no `save` is not savable, and marking it would be a nag
        // with no remedy.
        if (this.graph.pivots.markUnsaved) {
            const pivots = this.graph.pivots
            theNodeSelection.classed('pvt-node-unsaved', pivots.isSavable(node) && !pivots.isSaved(node))
        }

        // A tier swap rebuilds the node's children, taking the card with it. Redrawn last so
        // it sits on top of whatever the tier drew.
        if (this.focusedNode === node) this.drawFocusTier(node)

        if (this.rendererOptions.enableNodeExpansion && node.hasChildren()) {
            if (node.expanded) {
                const cluster = this.clusterDrawer.render(theNodeSelection, node, () => {
                    NodeDrawer.handleChildrenExpanded(this.graph, node, cluster)
                })
                requestAnimationFrame(() => {
                    ClusterDrawer.updateToNewRadiusExpanded(this.graph, node)
                })
            }

            requestAnimationFrame(() => {
                this.addExpandCollapseIcons(theNodeSelection, node)
            })
        }
    }

    /**
     * How far from `node`'s centre an edge leaving along the unit vector
     * `(dirX, dirY)` should start: its real border, grown by `outset`. Shared by
     * every drawer that lands something on a node's rim.
     *
     * The node caches its own geometry, so this stays pure arithmetic — resolving
     * a style here would run for both ends of every edge on every tick.
     */
    public borderReach(node: Node, dirX: number, dirY: number, outset = 0): number {
        if (node.getCircleRadius() || node.getBorderBox()) {
            return node.getBorderDistance(dirX, dirY, outset)
        }
        // Never measured and no radius of its own: fall back to the styled size.
        return (tryResolveNumber(this.getNodeStyle(node).size, node) as number) + outset
    }

    /**
     * Size a `foreignObject` card to the HTML it holds, then let that box drive
     * the node's collision radius and where edges land on it. HTML-in-SVG is the
     * common way to get a styled node, so the card — not a bounding circle — is
     * the node's real border.
     *
     * `shapeHalfExtent` is the half-size of any shape still drawn behind the card
     * (0 when the card *is* the node): the node never shrinks below it, so edges
     * cannot end up inside a shape that is still visible.
     */
    private fitCardToContent(
        fo: Selection<SVGForeignObjectElement, Node, null, undefined>,
        node: Node,
        shapeHalfExtent: number,
        writesGeometry = true
    ): void {
        // During the initial layout the graph's .zoom-layer is display:none, so the
        // content measures 0×0 — retry on later frames until it has real dimensions
        // (bounded), else the card would stay locked at its placeholder size.
        const maxMeasureAttempts = 300
        const measureAndSize = (attempt: number): void => {
            const foNode = fo.node()
            if (!foNode || !foNode.isConnected) return

            // The shell appendCard put the card in — a shrink-to-fit box, so this measures
            // the card's own size and not the placeholder it was dropped into.
            const content = foNode.firstElementChild as HTMLElement | null
            if (!content) return

            const bcr = content.getBoundingClientRect()
            if ((bcr.width === 0 || bcr.height === 0) && attempt < maxMeasureAttempts) {
                requestAnimationFrame(() => measureAndSize(attempt + 1))
                return
            }

            // getBoundingClientRect reports screen pixels, so a card first measured
            // while the graph is zoomed comes back scaled. Undo the zoom.
            const scale = foNode.getScreenCTM()?.a || 1
            const width = Math.ceil(bcr.width / scale)
            const height = Math.ceil(bcr.height / scale)
            if (width === 0 || height === 0) return // never measurable: keep the fallback size

            fo.attr('width', width)
                .attr('height', height)
                // Offset the position so it's centered
                .attr('x', -width / 2)
                .attr('y', -height / 2)

            // Feed the measured size into the node radius so the force sim's
            // collision + charge see the real card, not the default r=10 (else
            // large HTML cards get packed until they overlap). Expanded clusters
            // are skipped — their bubble radius is owned by the cluster drawer.
            if (writesGeometry && (!node.hasChildren() || !node.expanded)) {
                const halfWidth = Math.max(width / 2, shapeHalfExtent)
                const halfHeight = Math.max(height / 2, shapeHalfExtent)
                const measuredRadius = Math.max(halfWidth, halfHeight)
                if (node.getCircleRadius() !== measuredRadius) {
                    node.setCircleRadius(measuredRadius)
                    // Measurement only lands once the card is on-screen — the zoom
                    // layer is display:none during the initial layout, so this runs
                    // after the sim has cooled. Nudge it once so collision re-spaces
                    // the freshly-sized cards. A node with a declared footprint spaces
                    // by that instead, so the measurement changes nothing to re-space.
                    if (node.getLayoutSize() === undefined) this.scheduleCollisionReheat()
                }
                // Anchor on the card only when it reaches past the shape behind it;
                // a shape that still sticks out keeps its circle, which fits it better.
                if (width / 2 > shapeHalfExtent || height / 2 > shapeHalfExtent) {
                    node.setBorderBox(halfWidth * 2, halfHeight * 2) // after the radius, which clears it
                }
            }
            // The card is the node when nothing is drawn behind it, so the box selection and
            // hover paint has to follow the card rather than stay on the placeholder.
            if (shapeHalfExtent === 0) {
                const backing = foNode.parentElement
                    ?.querySelector<SVGRectElement>(':scope > rect.node')
                if (backing) fitBackingBox(backing, content, width, height)
            }
            // The card's real box is only known here, so the rim moves with it.
            if (writesGeometry) this.badgeDrawer.reanchor(node)
        }
        requestAnimationFrame(() => measureAndSize(0))
    }

    /**
     * Anchor edges on the node's rectangular border when that is what it renders
     * as. Circle, triangle and hexagon keep the circle radius: their bounding box
     * is a worse fit than it, most of all on the diagonals.
     *
     * A custom path is only trusted when its box is centred on the node's origin,
     * since a border is stored as half-extents around the centre.
     */
    private applyShapeBorder(node: Node, shape: NodeShape, bbox?: DOMRect): void {
        if (!bbox || bbox.width <= 0 || bbox.height <= 0) return
        // A border is half-extents around the centre, so an off-centre box cannot
        // be expressed as one — those keep their circle.
        const centred = Math.abs(bbox.x + bbox.width / 2) <= 0.5
            && Math.abs(bbox.y + bbox.height / 2) <= 0.5
        if (!centred) return
        if (shape !== 'square' && !this.isCustomShape(shape)) return
        node.setBorderBox(bbox.width, bbox.height)
    }

    /** Pending frame for the debounced collision reheat, if any. */
    private collisionReheatFrame: number | null = null

    /**
     * Reheat the sim once so collision re-spaces custom nodes whose radius was
     * just set from their measured size. Custom nodes measure asynchronously (and
     * on different frames), so this is debounced to one reheat after the last
     * measurement lands, and is a no-op when the simulation is disabled.
     */
    private scheduleCollisionReheat(): void {
        if (this.collisionReheatFrame !== null) {
            cancelAnimationFrame(this.collisionReheatFrame)
        }
        this.collisionReheatFrame = requestAnimationFrame(() => {
            this.collisionReheatFrame = null
            // d3-force caches node radii at init, so a plain reheat wouldn't pick
            // up the size we just set — re-initialise the forces first.
            this.graph.simulation?.refreshForcesAndReheat()
        })
    }

    public updatePositions(nodeSelection: Selection<SVGGElement, Node, SVGGElement, unknown>): void {
        nodeSelection
            .attr('transform', d => {
                const x = d.x ? (isFinite(d.x) ? d.x : 0) : 0
                const y = d.y ? (isFinite(d.y) ? d.y : 0) : 0
                return `translate(${x},${y})`
            })
    }

    /** The node's style before any tier is folded over it: the floor a tier merges onto. */
    private computeBaseStyle(node: Node): NodeStyle {
        let styleFromStyleMap: Partial<NodeStyle> = {}
        if (this.rendererOptions.nodeStyleMap && typeof this.rendererOptions.nodeTypeAccessor === 'function') {
            const nodeType = this.rendererOptions.nodeTypeAccessor(node)
            if (nodeType) {
                styleFromStyleMap = this.rendererOptions.nodeStyleMap[nodeType] ?? {}
            }
        }

        const style = node.getStyle()
        // A node's own `styleCb` wins outright and takes the style map out of the chain with
        // it. The fold below merges whatever layers it is handed, so the short-circuit is
        // resolved here, before folding, rather than expressed as a precedence rule.
        const styleFromNode = style.styleCb ? style.styleCb(node) : style
        const styleMapLayer = style.styleCb ? {} : styleFromStyleMap

        const defaults = this.rendererOptions.defaultNodeStyle
        const base = mergeStyleLayers([
            styleFromNode,
            styleMapLayer,
            // The computed form of the default slot: it fills what neither the node nor the
            // style map named, and still loses to both.
            defaults.styleCb?.(node) ?? {},
            defaults,
        ])

        // Declaring tiers buys the right spacing for free, and the footprint has to be known
        // here — before the simulation starts — rather than measured after it.
        if (base.tiers?.length) base.layoutSize = base.layoutSize ?? widestTierHalfWidth(base.tiers)
        return base
    }

    /** The base style with whichever tier currently qualifies folded over it. */
    private computeNodeStyle(node: Node): NodeStyle {
        const base = this.computeBaseStyle(node)

        const tiers = base.tiers
        if (!tiers?.length) {
            this.tierState.delete(node)
            return base
        }
        this.tiersDeclared = true

        const footprint = base.layoutSize as number
        const index = this.pickTier(node, tiers, footprint)
        this.tierState.set(node, { tiers, footprint, index })
        return index === BASE_TIER ? base : mergeStyleLayers([tiers[index].style, base])
    }

    /**
     * Which of `tiers` a node draws at right now, or {@link BASE_TIER} when none qualifies.
     *
     * The decision is on rendered size — the footprint in CSS pixels — never on the zoom
     * scalar: `k` multiplies coordinates the force layout invented, so the same `k` means a
     * different apparent size on a different graph.
     */
    private pickTier(node: Node, tiers: NodeTier[], footprint: number): number {
        const rendered = footprint * 2 * this.graphSvgRenderer.getZoomTransform().k
        const previous = this.tierState.get(node)?.index ?? BASE_TIER

        let picked = BASE_TIER
        let pickedThreshold = -Infinity
        for (let i = 0; i < tiers.length; i++) {
            const threshold = tierThreshold(tiers[i])
            // The tier already showing holds until the node shrinks well past its threshold.
            // Without the band a node parked on the line flips every frame — and since every
            // node shares a footprint, they are all parked on the same line at once.
            const engageAt = i === previous ? threshold * TIER_HYSTERESIS : threshold
            if (rendered >= engageAt && threshold >= pickedThreshold) {
                picked = i
                pickedThreshold = threshold
            }
        }
        return picked
    }

    /** Which tier `node` is currently drawn at, or {@link BASE_TIER} for the floor style. */
    public getActiveTier(node: Node): number {
        return this.tierState.get(node)?.index ?? BASE_TIER
    }

    /**
     * Re-pick every on-screen node's tier and redraw the ones that changed.
     *
     * Wired to the zoom event, which d3 fires on pan as well as on scale — and must, since
     * panning is what brings a node with a stale tier into view. Coalesced to one pass per
     * frame so it keeps up with the gesture instead of lagging behind it.
     */
    public refreshTiers(): void {
        if (!this.tiersDeclared || this.tierRefreshFrame !== null) return
        this.tierRefreshFrame = requestAnimationFrame(() => {
            this.tierRefreshFrame = null
            this.applyTierChanges()
        })
    }

    private applyTierChanges(): void {
        const visible = this.graphSvgRenderer.getVisibleBounds()
        let changed = false
        for (const node of this.graph.getMutableNodes()) {
            if (!node.visible) continue
            const state = this.tierState.get(node)
            // Never drawn, so it has no tier to change; its first render picks one.
            if (!state) continue
            // Off-screen nodes keep whatever tier they had and are re-picked when they
            // scroll in. A local check, not library-wide culling.
            if (visible && !intersectsBounds(node, state.footprint, visible)) continue

            const index = this.pickTier(node, state.tiers, state.footprint)
            if (index === state.index) continue
            state.index = index
            node.markDirty()
            changed = true
        }
        // One update for the whole crossing: every node shares a footprint, so they cross
        // together, and walking the graph per node would cost more than the redraw.
        if (changed) this.graphSvgRenderer.update(false)
    }

    // --- Focus tier ---------------------------------------------------------------------

    /** Called on every zoom event, which d3 also fires on pan. */
    public onZoom(): void {
        this.rescaleFocusTier()
        this.refreshTiers()
    }

    /** Remember the node under the pointer and promote or demote accordingly. */
    public setHoveredNode(node: Node | null): void {
        this.hoveredNode = node
        this.updateFocusTier()
    }

    /**
     * Promote whichever node should be showing its focus drawing, and demote the one that
     * was. Hover wins over selection: it is the more recent gesture, and the more specific.
     */
    public updateFocusTier(): void {
        const trigger = this.rendererOptions.focusTierTrigger ?? 'both'
        if (trigger === 'off') return this.setFocusedNode(null)

        const hovered = trigger === 'selection' ? null : this.hoveredNode
        // Only a node selected on its own: `selectedNode` is null for any wider selection,
        // and promoting fifty box-selected nodes would be a wall of overlapping cards.
        const selected = trigger === 'hover'
            ? null
            : this.graphSvgRenderer.getGraphInteraction().getSelectedNode()?.node ?? null

        const candidate = hovered ?? selected
        this.setFocusedNode(candidate && this.focusStyleOf(candidate) ? candidate : null)
    }

    private setFocusedNode(node: Node | null): void {
        if (this.focusedNode === node) return
        if (this.focusedNode) this.clearFocusTier(this.focusedNode)
        this.focusedNode = node
        if (node) this.drawFocusTier(node)
    }

    /** The focus drawing merged over the node's resolved *base* style, or null if it has none. */
    private focusStyleOf(node: Node): NodeStyle | null {
        // Over the base, never over the active tier: a chip tier's `shape: 'none'` or `html`
        // would otherwise leak into a card that never asked for it.
        const base = this.computeBaseStyle(node)
        if (!base.focusTier) return null
        return this.resolveStyleValues(mergeStyleLayers([base.focusTier as Partial<NodeStyle>, base]), node)
    }

    private drawFocusTier(node: Node): void {
        const element = node.getGraphElement()
        const style = this.focusStyleOf(node)
        if (!element || !style) return

        const selection = d3Select<SVGGElement, Node>(element)
        this.clearFocusTier(node)
        // Nothing in this renderer calls .order(), so a raise sticks across the next join.
        selection.raise()

        const wrapper = selection.append('g')
            .datum(node)
            .classed('pvt-node-focus', true)
            // Counter-scales the zoom layer, so the drawing holds its size in CSS pixels
            // however far out the graph is. Reading one node must not require zooming to it.
            .attr('transform', `scale(${1 / this.graphSvgRenderer.getZoomTransform().k})`)

        this.genericNodeRender(wrapper as Selection<SVGGElement, Node, null, undefined>, style, node, false)
    }

    private clearFocusTier(node: Node): void {
        node.getGraphElement()?.querySelector(':scope > g.pvt-node-focus')?.remove()
    }

    /** Hold the focus drawing's screen size across a zoom. One transform write, at most. */
    private rescaleFocusTier(): void {
        if (!this.focusedNode) return
        const wrapper = this.focusedNode.getGraphElement()
            ?.querySelector<SVGGElement>(':scope > g.pvt-node-focus')
        if (wrapper) {
            wrapper.setAttribute('transform', `scale(${1 / this.graphSvgRenderer.getZoomTransform().k})`)
        }
    }

    public getNodeStyle(node: Node): NodeStyle {
        return this.resolveStyleValues(this.computeNodeStyle(node), node)
    }

    /**
     * Collapse a merged style's resolvable channels against `node` and fill in the literal
     * defaults. Separate from the merge so a focus drawing, which merges a different set of
     * layers, resolves its values the same way.
     */
    private resolveStyleValues(nodeStyle: NodeStyle, node: Node): NodeStyle {
        if (typeof nodeStyle.shape === 'function') {
            nodeStyle.shape = nodeStyle.shape(node) as NodeShape
        }

        nodeStyle.strokeWidth = nodeStyle.strokeWidth !== undefined ? (tryResolveString(nodeStyle.strokeWidth.toString(), node) ?? 'var(--pvt-node-stroke-width, 2)') : 'var(--pvt-node-stroke-width, 2)'
        nodeStyle.strokeColor = nodeStyle.strokeColor !== undefined ? (tryResolveString(nodeStyle.strokeColor, node) ?? 'var(--pvt-node-stroke, #fff)') : 'var(--pvt-node-stroke, #fff)'
        nodeStyle.size = nodeStyle.size !== undefined ? (tryResolveNumber(nodeStyle.size, node) ?? 10) : 10
        nodeStyle.color = nodeStyle.color !== undefined ? (tryResolveString(nodeStyle.color, node) ?? 'var(--pvt-node-color, #007acc)') : 'var(--pvt-node-color, #007acc)'
        nodeStyle.textColor = nodeStyle.textColor !== undefined ? (tryResolveString(nodeStyle.textColor, node) ?? 'var(--pvt-node-text-color, #fff)') : 'var(--pvt-node-text-color, #fff)'
        nodeStyle.textAnchorPosition = nodeStyle.textAnchorPosition !== undefined ? tryResolveString(nodeStyle.textAnchorPosition, node) as ('start' | 'middle' | 'end') : 'middle'
        nodeStyle.textHorizontalShift = nodeStyle.textHorizontalShift !== undefined ? (tryResolveNumber(nodeStyle.textHorizontalShift, node) ?? 0) : 0
        nodeStyle.textVerticalShift = nodeStyle.textVerticalShift !== undefined ? (tryResolveNumber(nodeStyle.textVerticalShift, node) ?? 0) : 0
        nodeStyle.textRotateDegree = nodeStyle.textRotateDegree !== undefined ? (tryResolveNumber(nodeStyle.textRotateDegree, node) ?? 0) : 0
        nodeStyle.textTruncate = nodeStyle.textTruncate !== undefined ? (tryResolveBoolean(nodeStyle.textTruncate, node) ?? true) : true
        nodeStyle.text = nodeStyle.text !== undefined ? tryResolveString(nodeStyle.text, node) : undefined

        nodeStyle.iconUnicode = nodeStyle.iconUnicode !== undefined ? tryResolveString(nodeStyle.iconUnicode, node) : undefined
        nodeStyle.iconClass = nodeStyle.iconClass !== undefined ? tryResolveString(nodeStyle.iconClass, node) : undefined
        nodeStyle.svgIcon = nodeStyle.svgIcon !== undefined ? tryResolveString(nodeStyle.svgIcon, node) : undefined
        nodeStyle.imagePath = nodeStyle.imagePath !== undefined ? tryResolveString(nodeStyle.imagePath, node) : undefined
        // imagePath can be driven by graph data, and rendering it fetches the URL. Drop anything
        // outside the image schemes so hostile data can't turn a render into a tracking beacon.
        // Dropped silently on purpose: this runs per node per render, so a log would flood.
        if (nodeStyle.imagePath !== undefined && !hasAllowedScheme(nodeStyle.imagePath, SAFE_IMAGE_SCHEMES)) {
            nodeStyle.imagePath = undefined
        }
        nodeStyle.imageFit = nodeStyle.imageFit !== undefined ? (tryResolveString(nodeStyle.imageFit, node) as ImageFit) : undefined

        return nodeStyle
    }

    private isCustomShape(shape: NodeShape): shape is CustomNodeShape {
        return typeof shape === 'object' && shape !== null && 'd' in shape
    }

    // Draw the "image unavailable" glyph for a picture whose source failed to load, so the
    // node shows its shape + a crossed-out-picture icon rather than the browser's broken-image
    // placeholder. The broken `<image>` is hidden (not removed) so it still carries the src for
    // getNodeImageHref — keeping the preview / tooltip / lightbox fallbacks consistent.
    private renderImageFallback(
        nodeSelection: Selection<SVGGElement, Node, null, undefined>,
        imageSelection: Selection<SVGImageElement, Node, null, undefined>,
        style: NodeStyle
    ): void {
        imageSelection.style('display', 'none')
        const size = style.size as number
        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svgEl.innerHTML = imageOff
        if (svgEl.children[0]?.nodeName === 'svg') { // let the glyph fill the box we size below
            svgEl.children[0].removeAttribute('width')
            svgEl.children[0].removeAttribute('height')
        }
        const extent = size * 1.1
        nodeSelection
            .append(() => svgEl)
            .attr('class', 'node-content pvt-node-image-fallback')
            .attr('x', -extent / 2)
            .attr('y', -extent / 2)
            .attr('width', extent)
            .attr('height', extent)
            .attr('color', style.textColor)
    }

    /**
     * Draw `style` into `nodeSelection`.
     *
     * `writesGeometry` is false for a focus drawing, which is transient and counter-scaled:
     * its size in graph units means nothing to the layout, so it must not become the node's
     * collision radius or its edge-anchoring border. It is a parameter rather than a flag on
     * the drawer because several of the writes below land asynchronously.
     */
    private genericNodeRender(nodeSelection: Selection<SVGGElement, Node, null, undefined>, style: NodeStyle, node: Node, writesGeometry = true): void {
        style.size = style.size as number
        style.shape = style.shape as NodeShape
        style.text = style.text as string
        style.textAnchorPosition = style.textAnchorPosition as 'start' | 'middle' | 'end'
        style.textHorizontalShift = style.textHorizontalShift as number
        style.textVerticalShift = style.textVerticalShift as number
        style.textRotateDegree = style.textRotateDegree as number

        // A shapeless node still gets a box — it is just drawn in nothing. That box is what
        // the selection and hover rules paint (they are `> .node` child rules, so with no
        // element they paint nothing at all) and what the pointer hits across the card.
        const shapeless = style.shape === 'none'

        // A 'frame' image node IS the picture: it renders as a rectangle sized to
        // the image's aspect ratio (resized async in the imagePath branch), so it
        // rides the square/rect path regardless of the requested shape. A shapeless one
        // keeps its own shape name — the box below is already a rect, so the frame still
        // takes the picture's proportions, invisibly.
        const framed = !!style.imagePath && style.imageFit === 'frame'
        if (framed && !shapeless) {
            style.shape = 'square'
        }

        // map logical node shapes to SVG element tag names (use string to allow 'rect' which is not part of NodeShape)
        let actualShape: string = style.shape as string
        if (style.shape == 'square' || shapeless) {
            actualShape = 'rect'
        } else if (this.isCustomShape(style.shape) || ['triangle', 'hexagon',].includes(style.shape)) {
            actualShape = 'path'
        }

        const renderedNode = nodeSelection
            .append(actualShape)
            // `transparent`, not `none`: `none` is not hit-testable, so the node would be
            // unclickable anywhere its content does not cover.
            .attr('stroke', shapeless ? 'none' : style.strokeColor)
            .attr('stroke-width', shapeless ? 0 : style.strokeWidth)
            // Published so the selection and hover rings can be drawn relative to it: they
            // replace this stroke, and a fixed width would render a thick border thinner.
            .style('--pvt-node-own-stroke-width', shapeless ? '0' : String(style.strokeWidth))
            .attr('fill', shapeless ? 'transparent' : style.color)
            .classed('node', true)

        switch (style.shape) {
            case 'circle':
                renderedNode.attr('r', style.size)
                if (writesGeometry) node.setCircleRadius(style.size)
                break
            case 'square':
                renderedNode
                    .attr('width', style.size * 2)
                    .attr('height', style.size * 2)
                    .attr('x', -style.size)
                    .attr('y', -style.size)
                if (writesGeometry) node.setCircleRadius(Math.SQRT1_2 * style.size)
                break
            case 'triangle':
                {
                    const trianglePath = [
                        [0, -style.size],
                        [style.size, style.size],
                        [-style.size, style.size]
                    ].map(p => p.join(',')).join(' ')
                    renderedNode
                        .attr('d', `M${trianglePath}Z`)
                    if (writesGeometry) node.setCircleRadius(style.size)
                    break
                }
            case 'none':
                // A placeholder box, replaced by the measured card when there is one. No
                // circle radius: the content owns the geometry, and until something measures
                // `borderReach` falls back to `size` anyway.
                renderedNode
                    .attr('width', style.size * 2)
                    .attr('height', style.size * 2)
                    .attr('x', -style.size)
                    .attr('y', -style.size)
                break
            case 'hexagon':
                {
                    const angle = Math.PI / 3 // 60°
                    const hexPoints = Array.from({ length: 6 }, (_, i) => {
                        const a = angle * i
                        return [Math.cos(a) * (style.size as number), Math.sin(a) * (style.size as number)]
                    }).map(p => p.join(',')).join(' ')
                    renderedNode
                        .attr('d', `M${hexPoints}Z`)
                    if (writesGeometry) node.setCircleRadius(style.size)
                    break
                }
            default:
                if (this.isCustomShape(style.shape)) {
                    renderedNode.attr('d', style.shape.d)
                    if (writesGeometry) node.setCircleRadius(15) // Just guessing for now. Actual size is assigned on the next frame
                } else {
                    renderedNode.attr('r', style.size)
                    if (writesGeometry) node.setCircleRadius(style.size)
                }
                break
        }

        // ---- Content ----
        if (style.iconUnicode || style.iconClass) {
            // Resolve the glyph + font from the class font-agnostically (FA, misp-iconify, …).
            // iconUnicode is a direct-character override; when both are given the class supplies the font.
            const resolved = style.iconClass ? resolveIcon(style.iconClass) : undefined
            const useResolvedFont = !!resolved && resolved.glyph !== ''
            const glyph = style.iconUnicode ?? resolved?.glyph
            // Skip unknown/unresolvable classes rather than rendering a ☐ placeholder.
            if (glyph) {
                const iconText = nodeSelection
                    .append('text')
                    .attr('fill', style.textColor)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'central')
                    .attr('font-size', style.size * 1.2)
                    .attr('class', 'node-content icon icon-unicode')
                    .text(glyph)
                // Trust the probed font only when the class actually resolved; otherwise fall
                // back to the --pvt-node-icon-font-family default carried by .icon-unicode.
                if (useResolvedFont) {
                    iconText
                        .style('font-family', resolved.fontFamily)
                        .style('font-weight', resolved.fontWeight)
                        .style('font-style', resolved.fontStyle)
                }
            }
        } else if (style.svgIcon) {
            const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
            // svgIcon can be driven by graph data, so it never reaches the live tree unsanitized.
            svgEl.appendChild(parseSvgIconMarkup(style.svgIcon))
            if (svgEl.children[0]?.nodeName === 'svg') { // Make sure the icon takes the full size of the container
                svgEl.children[0].removeAttribute('width')
                svgEl.children[0].removeAttribute('height')
            }
            nodeSelection
                .append(() => svgEl)
                .attr('class', 'node-content')
                .attr('x', -style.size * 0.7)
                .attr('y', -style.size * 0.7)
                .attr('width', style.size * 1.4)
                .attr('height', style.size * 1.4)
                .attr('color', style.strokeColor)
        } else if (style.imagePath) {
            // How the picture sits on the node:
            //   'icon'    – small picture centred on the shape (default; legacy look)
            //   'cover'   – picture fills the shape, cropped to preserve aspect ratio
            //   'contain' – whole picture fits inside the shape (letterboxed)
            //   'frame'   – node becomes a rectangle the size of the picture, so the
            //               stroke hugs it: whole picture, no crop, no letterbox bars
            const fit = style.imageFit ?? 'icon'
            if (fit === 'frame') {
                const box = style.size * 2
                const image = nodeSelection
                    .append('image')
                    .attr('class', 'node-content')
                    .attr('xlink:href', style.imagePath)
                    .attr('preserveAspectRatio', 'xMidYMid meet')
                    .attr('x', -style.size)
                    .attr('y', -style.size)
                    .attr('width', box)
                    .attr('height', box)
                image.on('error', () => this.renderImageFallback(nodeSelection, image, style))
                // The image's aspect ratio is only known once it loads. Fit the box's
                // longest side to `2 × size` and shrink the frame + image to match, so
                // the whole picture shows with the stroke wrapping it tightly.
                const probe = new Image()
                probe.onload = () => {
                    if (!probe.naturalWidth || !probe.naturalHeight) return
                    const aspect = probe.naturalWidth / probe.naturalHeight
                    const w = aspect >= 1 ? box : box * aspect
                    const h = aspect >= 1 ? box / aspect : box
                    image.attr('x', -w / 2).attr('y', -h / 2).attr('width', w).attr('height', h)
                    renderedNode.attr('x', -w / 2).attr('y', -h / 2).attr('width', w).attr('height', h)
                    if (writesGeometry) {
                        node.setCircleRadius(0.5 * Math.max(w, h))
                        node.setBorderBox(w, h) // after the radius, which clears it
                        // The frame only takes its real proportions here; without this the rim
                        // chrome stays pinned to the square guess and ends up over the picture.
                        this.badgeDrawer.reanchor(node)
                    }
                    if (this.rendererOptions.enableNodeExpansion && node.hasChildren()) {
                        this.addExpandCollapseIcons(nodeSelection, node)
                    }
                }
                probe.src = style.imagePath
            } else {
                const extent = fit === 'icon' ? style.size * 1.2 : style.size * 2
                const par = fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'
                const image = nodeSelection
                    .append('image')
                    .attr('class', 'node-content')
                    .attr('xlink:href', style.imagePath)
                    .attr('x', -extent / 2)
                    .attr('y', -extent / 2)
                    .attr('width', extent)
                    .attr('height', extent)
                    .attr('preserveAspectRatio', par)
                image.on('error', () => this.renderImageFallback(nodeSelection, image, style))
            }
        } else if (style.html) {
            // Nothing back means no card, so one callback can card some nodes and leave
            // the others to their shape.
            const rendered = cardContent(style.html(node))
            if (rendered !== undefined) {
                const fo = nodeSelection.append('foreignObject')
                    .attr('class', 'node-content')
                    .attr('width', style.size * 2)
                    .attr('height', style.size * 2)
                    .attr('x', -style.size)
                    .attr('y', -style.size)
                appendCard(fo, rendered)
                // The box above is only a guess: measure the card and grow to it, so a
                // card wider than `2 × size` is neither clipped nor anchored as a circle.
                // The half-extent below is the shape still drawn behind it — nothing, for a
                // shapeless node, whose card owns its geometry outright.
                this.fitCardToContent(fo, node, shapeless ? 0 : style.size, writesGeometry)
            }
        }
        // Do not have text dislay be mutually exclusive with icons
        if (style.text) {
            // label and background group to allow for rotating together
            const labelG = nodeSelection.append('g')
                .classed('pvt-node-label-group', true)

            // Shifted clear of the node, so it is laid out with no shape to fit inside.
            const floated = Math.abs(style.textVerticalShift) >= 1 || Math.abs(style.textHorizontalShift) >= 1
            // …and a shapeless node's label has nothing behind it wherever it sits, so it
            // gets the same treatment: the node's own `textColor` is white by default, which
            // here would be drawn straight onto the canvas.
            const isOusideNode = floated || shapeless
            const [fontSize, text] = this.computeTextLayout(style.text, style.size, floated, style.textTruncate as boolean)

            const x_pos = style.textHorizontalShift * (style.size + fontSize/2*1.2)
            const y_pos = - style.textVerticalShift * (style.size + fontSize/2*1.2)

            const textSelection = labelG
                .append('text')
                .attr('class', 'pvt-node-label')
                .attr('text-anchor', style.textAnchorPosition)
                .attr('x', x_pos)
                .attr('y', y_pos)
                .attr('dominant-baseline', 'central')
                .attr('font-size', fontSize)
                .attr('font-family', style.fontFamily)
                // Labels floated outside sit on the edge-label pill (rect below),
                // so pair them with its themed colour to stay readable in any theme.
                .attr('fill', isOusideNode ? defaultLabelStyle.color : style.textColor)
                .text(text)

            const bbox = textSelection.node()?.getBBox()
            // An untruncated label spills past the shape, where the node's own text colour
            // is drawn against the canvas instead of the node (white on white, by default).
            // Give it the floated label's pill + colour so the whole string stays readable.
            const spillsOutOfNode = !isOusideNode && style.textTruncate === false
                && !!bbox && bbox.width > (style.size as number) * 2
            if (spillsOutOfNode) textSelection.attr('fill', defaultLabelStyle.color)

            if ((isOusideNode || spillsOutOfNode) && bbox) {
                const paddingX = 4
                const paddingY = 2
                labelG.insert('rect', 'text')
                    .attr('x', bbox.x - paddingX)
                    .attr('y', bbox.y - paddingY)
                    .attr('width', bbox.width + 2 * paddingX)
                    .attr('height', bbox.height + 2 * paddingY)
                    .attr('fill', defaultLabelStyle.backgroundColor)
                    .attr('rx', 2)
                    .attr('ry', 2)
            }
            
            // Remember the label's own placement so an expanding cluster can pull it
            // along with the node (and steer an outside label clear of the dashed
            // boundary) without re-deriving the style. See handleChildrenExpanded.
            labelG
                .attr('data-pvt-label-outside', isOusideNode ? '1' : '0')
                .attr('data-pvt-label-x', x_pos)
                .attr('data-pvt-label-y', y_pos)
                .attr('data-pvt-label-rotate', style.textRotateDegree)
                .attr('transform', `rotate(${style.textRotateDegree}, ${x_pos}, ${y_pos})`)

        }
    }

    /**
     * This method is called on every node
     * Each node takes care of its own state, otherwise each node gets set multiple times
     * Each node takes care only of edges out, to avoid setting twice the same edge (for from and to nodes)
     */
    public checkForHighlight(nodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
        const nodeSelected = this.isNodeSelected(node)
        const nodeAdjacentToSelection = this.isNodeAdjacentToSelection(node)
        const applyShadow = this.hasVisibleSelection()
        
        // Manage node
        node.getGraphElement()?.classList.toggle('pvt-node-selected-highlight', nodeSelected)
        if (this.rendererOptions.enableFocusMode && applyShadow) {
            node.getGraphElement()?.classList.toggle('pvt-node-selected-highlight-shadow', !nodeSelected && !nodeAdjacentToSelection)
        } else {
            node.getGraphElement()?.classList.toggle('pvt-node-selected-highlight-shadow', false)
        }

        // Manage edges out
        node.getEdgesOut().forEach((edge) => {
            const edgeAdjacentToSelection = this.isEdgeAdjacentToSelection(edge)
            if (this.rendererOptions.enableFocusMode && applyShadow) {
                edge.getGraphElement()?.classList.toggle('pvt-edge-selected-highlight-shadow', !edgeAdjacentToSelection)
            } else {
                edge.getGraphElement()?.classList.toggle('pvt-edge-selected-highlight-shadow', false)
            }
        })

    }

    private getSelectedNodeIDs(): string[] {
        const gi = this.graphSvgRenderer.getGraphInteraction()
        const selectedIds = gi.getSelectedNodeIDs()
        return Array.isArray(selectedIds) ? selectedIds : []
    }

    /**
     * Whether the selection contains anything that is actually on screen — the gate for
     * focus-mode dimming.
     *
     * A hidden node can be selected without ever being drawn (a filtered-out search
     * result, or a row in the data dock), and its element is gone from the DOM entirely.
     * Dimming on the strength of a selection like that would grey out the whole canvas
     * with nothing highlighted, which reads as a broken graph.
     *
     * Short-circuits on the first visible node, so the usual case costs one check.
     */
    private hasVisibleSelection(): boolean {
        const gi = this.graphSvgRenderer.getGraphInteraction()
        return gi.getSelectedNodes().some(selection => selection.node.visible)
    }

    private isNodeSelected(node: Node): boolean {
        return this.getSelectedNodeIDs().includes(node.id)
    }

    private isNodeAdjacentToSelection(node: Node): boolean {
        return node.getEdgesOut().some((edge) => this.isNodeSelected(edge.to))
            || node.getEdgesIn().some((edge) => this.isNodeSelected(edge.from))
    }

    private isEdgeAdjacentToSelection(edge: Edge): boolean {
        return this.isNodeSelected(edge.from) || this.isNodeSelected(edge.to)
    }

    private computeTextLayout(label: string, nodeSize: number, isOusideNode: boolean = false, truncate: boolean = true): [number, string] {
        const base = nodeSize * 0.9
        // Allow wider strings when text is outside the node
        const maxWidth = isOusideNode ? base * 5 : base * 2
        // Scale font to node size, ensuring readability with 12px
        const fontSize = Math.max(12, base * 0.5)
 
        // Approximate width: ~0.55em per character
        const charWidth = fontSize * 0.55
        const maxChars = Math.floor(maxWidth / charWidth) - 1

        if (truncate && label.length > maxChars && label.length > 7) {
            // Since text is too long, add ellipsis
            const charsToKeep = Math.max(6, maxWidth / charWidth) - 1 // Reserve 1 space for "…"

            const tailChars = 3
            const headChars = charsToKeep - tailChars
            const truncated = label.slice(0, headChars) + '…' + label.slice(label.length - tailChars)
            // Near the threshold head+…+tail can be as long as (or longer than) the raw
            // label — only ellipsize when it actually shortens the string.
            if (truncated.length < label.length) label = truncated
        }

        return [fontSize, label]
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private addExpandCollapseIcons(theNodeSelection: Selection<SVGGElement, Node, null, undefined>, _node: Node): void {
        const iconRadius = 8      // radius of the small circle

        const toggleExpand = (node: Node, expand: boolean) => {
            if (this.graph.UIManager.tooltip) this.graph.UIManager.tooltip.hide(node)
            this.graph.toggleExpandNode(node)
            if (!expand) { // reheating the simulation is done after the opening transition completes
                this.graph.simulation.reheat(0.05)
                if (this.graph.simulation.isFitViewOnExpandCollapse()) {
                    this.graph.renderer.fitAndCenterWhenSettled()
                }
            }
        }

        // Ensure we have a group to contain icons
        theNodeSelection.each((node, i, nodes) => {
            const group = d3Select<SVGGElement, Node>(nodes[i])

            // Remove existing icons if any
            group.selectAll<SVGGElement, unknown>(':scope > .node-icon').remove()

            // An expanded node is drawn as a bubble with its shape pushed to the NW rim, so
            // the affordance belongs on the bubble — measuring the shape would strand it near
            // the cluster's centre. Otherwise the same rim maths as the badges, so the two
            // agree on where a corner is: on a square or an image frame the circumscribed 45°
            // point sits well inside the shape.
            const clusterArea = nodes[i].querySelector<SVGCircleElement>(':scope > .pvt-cluster-area')
            const clusterRadius = node.expanded ? Number(clusterArea?.getAttribute('_final_r')) || 0 : 0
            const anchor = clusterRadius > 0
                ? { x: clusterRimOffset(clusterRadius), y: clusterRimOffset(clusterRadius) }
                : nodeRimAnchor(nodes[i], node, !node.expanded ? 'ne' : 'se')

            const svgG = group.append('g')
                .classed('node-icon', true)
                .classed(!node.expanded ? 'expand-icon' : 'collapse-icon', true)
                .attr('transform', `translate(${anchor.x}, ${anchor.y})`)
            svgG
                .append('title')
                .text(!node.expanded ? 'Expand node' : 'Collapse nodes')
            svgG
                .append('circle')
                .attr('r', iconRadius)
                .style('cursor', 'pointer')
                .on('click', (evt: PointerEvent) => {
                    evt.stopPropagation()
                    toggleExpand(node, !node.expanded)
                })

            group.select(!node.expanded ? ':scope > .expand-icon' : ':scope > .collapse-icon')
                .append('text')
                .text(!node.expanded ? '+' : '-')

        })
    }

    public static handleChildrenExpanded(graph: Graph, node: Node, cluster: Selection<SVGCircleElement, Node, null, undefined>): void {
        // Adapt position if children are expanded
        graph.simulation.reheat(0.1)
        const clusterRadius = Number(cluster.attr('_final_r')) // 'r' attribute is being transitioned, get the final value

        // Compute the offset for the north-west position (45° angle, distance = clusterRadius + padding)
        const offset = clusterRimOffset(clusterRadius)

        const nodeGroup = node.getGraphElement()

        // Get the main node element (whatever shape it is: circle, rect, path, etc.)
        const origNode = nodeGroup?.querySelector('& > .node')
        if (origNode) {
            d3Select(origNode)
                .transition()
                .duration(250)
                .on('end', () => {
                    if (graph.simulation.isFitViewOnExpandCollapse()) {
                        graph.renderer.fitAndCenterWhenSettled()
                    }
                })
                .attr('transform', `translate(${-offset}, ${-offset})`)
        }

        // Pull the node's icon/content (glyph, svg, image, html) to the same NW rim
        // so it keeps sitting on the shape instead of being left at the cluster centre.
        nodeGroup?.querySelectorAll<SVGGraphicsElement>(':scope > .node-content').forEach((content) => {
            d3Select(content)
                .transition()
                .duration(250)
                .attr('transform', `translate(${-offset}, ${-offset})`)
        })

        // Badges ride to the NW rim with the shape, keeping their corners. Unlike the label
        // they are not steered away from the bubble: a badge is small enough to sit over the
        // boundary without hiding anything, and re-flowing would change what a corner means
        // halfway through an interaction.
        const badgeGroup = nodeGroup?.querySelector<SVGGElement>(':scope > .pvt-node-badges')
        if (badgeGroup) {
            d3Select(badgeGroup)
                .transition()
                .duration(250)
                .attr('transform', `translate(${-offset}, ${-offset})`)
        }

        // Move the label with the node. An inner label rides along centred on the
        // shape; a label floating outside the node is steered into the top-left
        // quadrant so it never overlaps the dashed cluster boundary (e.g. a
        // bottom-right label becomes top-left, a right label becomes left, etc.).
        const labelGroup = nodeGroup?.querySelector<SVGGElement>(':scope > .pvt-node-label-group')
        if (labelGroup) {
            const outside = labelGroup.getAttribute('data-pvt-label-outside') === '1'
            const xPos = Number(labelGroup.getAttribute('data-pvt-label-x')) || 0
            const yPos = Number(labelGroup.getAttribute('data-pvt-label-y')) || 0
            const rotate = Number(labelGroup.getAttribute('data-pvt-label-rotate')) || 0

            let translate: string
            if (outside) {
                // Keep the label's original reach but force it up-and-left of the node.
                const targetX = -offset - Math.abs(xPos)
                const targetY = -offset - Math.abs(yPos)
                translate = `translate(${targetX - xPos}, ${targetY - yPos})`
            } else {
                translate = `translate(${-offset}, ${-offset})`
            }
            d3Select(labelGroup)
                .transition()
                .duration(250)
                .attr('transform', `${translate} rotate(${rotate}, ${xPos}, ${yPos})`)
        }

        // Reposition the expand/collapse icon
        const origIcons: SVGGElement | undefined | null = nodeGroup?.querySelector('& > .node-icon')
        if (origIcons) {
            d3Select(origIcons)
                .transition()
                .duration(250)
                .attr('transform', !node.expanded ? `translate(${offset}, ${-(offset)})` : `translate(${offset}, ${offset})`)
        }

        const childSubgraph = node.getSubgraph()
        if (childSubgraph) {
            childSubgraph.simulation.getSimulation()
                .force('constrainParent', forceConstrainParent<Node>(Number(clusterRadius), 10))
        }
    }
}

/**
 * How far along the 45° diagonal a cluster bubble's corner sits, in the node group's own
 * coordinates. Shared by everything that rides an expanded node's rim so the shape, its
 * badges, its label and the collapse affordance all measure the same circle.
 */
function clusterRimOffset(clusterRadius: number): number {
    return (clusterRadius + RIM_PADDING) / Math.SQRT2
}

/**
 * What a render callback actually gave us to draw, or `undefined` for "nothing" — which
 * hands the node back to the normal styling pipeline. An empty string counts as nothing,
 * the same way `text: ''` and `badges: []` opt out of their channels.
 */
/** How far a tier's rendered size falls below its threshold before it gives way. */
const TIER_HYSTERESIS = 0.85

/** No tier qualifies: the node draws at its base style, which is the floor. */
export const BASE_TIER = -1

/** What the per-zoom pass needs to re-pick a node's tier without re-running the style chain. */
interface TierState {
    tiers: NodeTier[]
    footprint: number
    index: number
}

/** The rendered footprint, in CSS pixels, at which `tier` takes over. */
function tierThreshold(tier: NodeTier): number {
    return tier.minRenderedSize ?? tier.width
}

/** Half the widest declared tier: the footprint a node gets for free by declaring tiers. */
function widestTierHalfWidth(tiers: NodeTier[]): number {
    return tiers.reduce((widest, tier) => Math.max(widest, tier.width), 0) / 2
}

/** Whether a node's footprint box reaches into the part of graph space that is on screen. */
function intersectsBounds(node: Node, footprint: number, bounds: GraphBounds): boolean {
    const x = node.x ?? 0
    const y = node.y ?? 0
    return x + footprint >= bounds.x
        && x - footprint <= bounds.x + bounds.width
        && y + footprint >= bounds.y
        && y - footprint <= bounds.y + bounds.height
}

/**
 * Every channel the style chain resolves. The fold walks this list rather than the keys of
 * whatever layer it is handed: `defaultNodeStyle` leaves `svgIcon`, `imagePath`, `html` and
 * `badges` unset, so deriving the list from it would silently drop a node's own values for
 * them.
 */
const NODE_STYLE_KEYS = [
    'shape', 'strokeColor', 'strokeWidth', 'fontFamily', 'size', 'color', 'textColor',
    'textAnchorPosition', 'textHorizontalShift', 'textVerticalShift', 'textRotateDegree',
    'textTruncate', 'iconUnicode', 'iconClass', 'svgIcon', 'imagePath', 'imageFit', 'text',
    'html', 'badges', 'layoutSize', 'tiers', 'focusTier',
] as const satisfies readonly (keyof NodeStyle)[]

/**
 * Collapse an ordered list of style layers, narrowest first, into one resolved style: for
 * each channel the first layer that names it wins.
 *
 * Layers arrive already collapsed — a `styleCb` has been called, and any layer a narrower one
 * takes out of the chain has been replaced with `{}`. The fold expresses precedence between
 * layers, nothing else.
 *
 * `null` falls through like `undefined`, matching the `??` chains this replaces: a `styleCb`
 * returning an explicit `undefined` for a channel has always meant "I am not naming this one".
 */
function mergeStyleLayers(layers: Partial<NodeStyle>[]): NodeStyle {
    const merged: Record<string, unknown> = {}
    for (const key of NODE_STYLE_KEYS) {
        let resolved: unknown = undefined
        for (const layer of layers) {
            const value = layer?.[key]
            if (value !== undefined && value !== null) {
                resolved = value
                break
            }
        }
        merged[key] = resolved
    }
    return merged as unknown as NodeStyle
}

function cardContent(rendered: unknown): HTMLElement | string | undefined {
    if (typeof rendered === 'string') return rendered === '' ? undefined : rendered
    return rendered instanceof HTMLElement ? rendered : undefined
}

/**
 * Put a card inside the `foreignObject`, in a shrink-to-fit box of our own.
 *
 * That box is what gets measured, and `width: max-content` is what makes the measure
 * honest: a card whose own root is `width: 100%` would otherwise resolve the percentage
 * against the placeholder box the renderer had just guessed, and report the guess back as
 * its size — leaving the card squeezed into it. A string gets the same box, so it measures
 * like any other card instead of never measuring at all.
 *
 * `flex`, not `inline-block`: an inline-level card root — `display: inline-flex`, which is
 * what a hand-written card usually is — would sit on a line box and measure its own height
 * plus the descender space under it, silently growing every such card by a few pixels.
 */
function appendCard(
    fo: Selection<SVGForeignObjectElement, Node, null, undefined>,
    content: HTMLElement | string,
): void {
    const shell = document.createElement('div')
    shell.className = 'pvt-node-card'
    shell.style.cssText = 'display:flex;width:max-content;height:max-content'
    if (typeof content === 'string') shell.textContent = content
    else shell.append(content)
    fo.node()?.append(shell)
}

/**
 * The corner radius an author gave a card, in user units, so the ring around it is not a
 * sharp box around a rounded card. A percentage is resolved here against the card's own box:
 * that is what `border-radius` means, whereas an SVG `rx` percentage would resolve against
 * the viewport.
 */
function cardCornerRadius(card: Element, width: number, height: number): number {
    const declared = getComputedStyle(card).borderTopLeftRadius
    const value = parseFloat(declared)
    if (!Number.isFinite(value) || value <= 0) return 0
    return declared.endsWith('%') ? (value / 100) * Math.min(width, height) : value
}

/**
 * Put the backing box on the measured card, and round its corners to match.
 *
 * The box stays exactly the card's size. It is not just what the selection and hover rings
 * are painted on — the badge rim and the pointer hit area are measured off it too — so
 * padding it out for the ring's sake would push the badges off the card and inflate the hit
 * area. A stroke is centred on the edge it follows, which means the inner half of the ring
 * goes behind the card and the outer half clears it: the same half a shaped node shows
 * outside its own rim.
 */
function fitBackingBox(backing: SVGRectElement, shell: HTMLElement, width: number, height: number): void {
    backing.setAttribute('width', String(width))
    backing.setAttribute('height', String(height))
    backing.setAttribute('x', String(-width / 2))
    backing.setAttribute('y', String(-height / 2))

    // `shell` is the shrink-to-fit box appendCard wraps every card in, so the radius lives on
    // the card inside it — unless the card was a bare string, which has no element to ask.
    const card = shell.firstElementChild
    backing.setAttribute('rx', String(card ? cardCornerRadius(card, width, height) : 0))
}

/**
 * The invisible box a card-only node is selected, hovered and clicked on.
 *
 * Both state looks are `> .node` child rules, so a node with no shape element has no
 * selected or hovered look at all; and `fill: none` would leave it unclickable wherever
 * the card does not cover. Sized from the card once that measures.
 */
function appendBackingBox(
    nodeSelection: Selection<SVGGElement, Node, null, undefined>,
    halfExtent: number,
): void {
    nodeSelection.append('rect')
        .attr('stroke', 'none')
        .attr('stroke-width', 0)
        .attr('fill', 'transparent')
        .attr('width', halfExtent * 2)
        .attr('height', halfExtent * 2)
        .attr('x', -halfExtent)
        .attr('y', -halfExtent)
        .classed('node', true)
}
