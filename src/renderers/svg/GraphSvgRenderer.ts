import { select as d3Select, type Selection } from 'd3-selection'
// import 'd3-transition'
import { transition as d3Transition } from 'd3-transition'
import { zoom as d3Zoom, type ZoomBehavior, zoomIdentity as d3ZoomIdentity, zoomTransform, ZoomTransform } from 'd3-zoom'
import { Edge } from '../../Edge'
import { Node } from '../../Node'
import { NodeDrawer } from './NodeDrawer'
import { EdgeDrawer } from './EdgeDrawer'
import { LassoOverlay } from './LassoOverlay'
import { EventHandler } from './EventHandler'
import type { Graph } from '../../Graph'
import merge from 'lodash.merge'
import { GraphInteractions } from '../../GraphInteractions'
import { GraphRenderer } from '../../GraphRenderer'
import { SelectionBox } from './SelectionBox'
import type { EdgeStyle, GraphRendererOptions, LabelStyle, MarkerStyleMap, NodeStyle, SelectionBox as SelectionBoxI } from '../../interfaces/RendererOptions'
import { ClusterDrawer } from './ClusterDrawer'
import { NoteDrawer } from './NoteDrawer'
import { Note } from '../../Note'
import type { Point } from '../../utils/GeometryHelper'
d3Select.prototype.transition = d3Transition

/**
 * @default
{
    arrow: {
        pathD: 'M0,-5L10,0L0,5',
        viewBox: '0 -5 10 10',
        refX: 6,
        refY: 0,
        markerWidth: 12,
        markerHeight: 12,
        markerUnits: 'userSpaceOnUse',
        orient: 'auto',
        fill: 'var(--pvt-edge-stroke, #999)',
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
        }
    },
    circle: {
        pathD: 'M5,5m-3,0a3,3 0 1,0 6,0a3,3 0 1,0 -6,0',
        viewBox: '0 0 10 10',
        refX: 5,
        refY: 5,
        markerWidth: 10,
        markerHeight: 10,
        markerUnits: 'userSpaceOnUse',
        orient: 0,
        fill: 'var(--pvt-edge-stroke, #999)',
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
            markerWidth: 16,
            markerHeight: 16,
        }
    },
    diamond: {
        pathD: 'M0,-4L4,0L0,4L-4,0Z',
        viewBox: '-5 -5 10 10',
        refX: 0,
        refY: 0,
        markerWidth: 8,
        markerHeight: 8,
        markerUnits: 'userSpaceOnUse',
        orient: 0,
        fill: 'var(--pvt-edge-stroke, #999)',
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
            markerWidth: 14,
            markerHeight: 14,
        }
    }
}
 */
export const defaultMarkerStyleMap: MarkerStyleMap = {
    arrow: {
        pathD: 'M0,-5L10,0L0,5',
        viewBox: '0 -5 10 10',
        refX: 6,
        refY: 0,
        markerWidth: 12,
        markerHeight: 12,
        markerUnits: 'userSpaceOnUse',
        orient: 'auto',
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
        }
    },
    circle: {
        pathD: 'M5,5m-3,0a3,3 0 1,0 6,0a3,3 0 1,0 -6,0',
        viewBox: '0 0 10 10',
        refX: 5,
        refY: 5,
        markerWidth: 10,
        markerHeight: 10,
        markerUnits: 'userSpaceOnUse',
        orient: 0,
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
            markerWidth: 16,
            markerHeight: 16,
        }
    },
    diamond: {
        pathD: 'M0,-4L4,0L0,4L-4,0Z',
        viewBox: '-5 -5 10 10',
        refX: 0,
        refY: 0,
        markerWidth: 8,
        markerHeight: 8,
        markerUnits: 'userSpaceOnUse',
        orient: 0,
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
            markerWidth: 14,
            markerHeight: 14,
        }
    },
    bigcircle: {
        pathD: 'M5,5m-3,0a3,3 0 1,0 6,0a3,3 0 1,0 -6,0',
        viewBox: '0 0 10 10',
        refX: 5,
        refY: 5,
        markerWidth: 16,
        markerHeight: 16,
        markerUnits: 'userSpaceOnUse',
        orient: 0,
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
            markerWidth: 24,
            markerHeight: 24,
        }
    },
}

/**
 * @default
{
    shape: 'circle',
    size: 10,
    strokeWidth: var(--pvt-node-stroke-width, 2),
    color: 'var(--pvt-node-color, #007acc)',
    strokeColor: 'var(--pvt-node-stroke, #fff)',
    fontFamily: 'var(--pvt-label-font, system-ui, sans-serif)',
    textColor: 'var(--pvt-node-text-color, #fff)',
    iconUnicode: undefined,
    iconClass: undefined,
    svgIcon: undefined,
    imagePath: undefined,
    text: undefined,
}
 */
export const defaultNodeStyle: NodeStyle = {
    shape: 'circle',
    size: 10,
    strokeWidth: 'var(--pvt-node-stroke-width, 2)',
    color: 'var(--pvt-node-color, #007acc)',
    strokeColor: 'var(--pvt-node-stroke, #fff)',
    fontFamily: 'var(--pvt-label-font, system-ui, sans-serif)',
    textColor: 'var(--pvt-node-text-color, #fff)',
    textAnchorPosition: 'middle',
    textHorizontalShift: 0,
    textVerticalShift: 0,
    textRotateDegree: 0,
    iconUnicode: undefined,
    iconClass: undefined,
    svgIcon: undefined,
    imagePath: undefined,
    text: undefined,
    html: undefined,
}

/**
 * @default
{
    strokeWidth: 2,
    opacity: 1.0,
    curveStyle: 'bidirectional',
    dashed: false,
    animateDash: true,
    rotateLabel: false,
    markerEnd: 'arrow',
    markerStart: undefined,
    strokeColor: 'var(--pvt-edge-stroke, #999)',
}
 */
export const defaultEdgeStyle: EdgeStyle = {
    strokeWidth: 2,
    opacity: 1.0,
    curveStyle: 'bidirectional',
    dashed: false,
    animateDash: true,
    rotateLabel: false,
    markerEnd: 'arrow',
    markerStart: undefined,
    strokeColor: 'var(--pvt-edge-stroke, #999)',
}

/**
 * @default
{
    fontSize: 12,
    fontFamily: 'var(--pvt-label-font, system-ui, sans-serif)',
    color: 'var(--pvt-edge-label-color, #333)',
    backgroundColor: 'var(--pvt-edge-label-bg, #ffffffa0)',
}
 */
export const defaultLabelStyle: LabelStyle = {
    fontSize: 12,
    fontFamily: 'var(--pvt-label-font, system-ui, sans-serif)',
    color: 'var(--pvt-edge-label-color, #333)',
    backgroundColor: 'var(--pvt-edge-label-bg, #ffffffa0)',
}

const DEFAULT_RENDERER_OPTIONS = {
    type: 'svg',
    enableFocusMode: true,
    enableNodeExpansion: true,
    beforeRender: () => {},
    zoomEnabled: true,
    dragEnabled: true,
    interactionEnabled: true,
    minZoom: 0.05,
    maxZoom: 10,
    zoomAnimation: true,
    zoomAnimationDuration: 300,
    defaultNodeStyle: defaultNodeStyle,
    defaultEdgeStyle: defaultEdgeStyle,
    defaultLabelStyle: defaultLabelStyle,
    markerStyleMap: defaultMarkerStyleMap,
    selectionBox: {
        enabled: true,
    } as SelectionBoxI
} satisfies GraphRendererOptions


export class GraphSvgRenderer extends GraphRenderer {
    protected options: GraphRendererOptions

    private zoom: ZoomBehavior<SVGSVGElement, unknown>
    private eventHandler: EventHandler
    private selectionBox: SelectionBox | null = null
    
    public graphInteraction: GraphInteractions<SVGGElement | SVGPathElement>
    public nodeDrawer: NodeDrawer
    public edgeDrawer: EdgeDrawer
    public noteDrawer: NoteDrawer
    public lassoOverlay: LassoOverlay

    private svgCanvas: SVGSVGElement
    // private progressBar: SVGRectElement

    public svg: Selection<SVGSVGElement, unknown, null, undefined>
    public zoomGroup: Selection<SVGGElement, unknown, null, undefined>
    private edgeGroup: Selection<SVGGElement, unknown, null, undefined>
    private nodeGroup: Selection<SVGGElement, unknown, null, undefined>
    private noteGroup: Selection<SVGGElement, unknown, null, undefined>
    private noteEdgeGroup: Selection<SVGGElement, unknown, null, undefined>
    private selectionBoxGroup: Selection<SVGGElement, unknown, null, undefined>
    public defs: Selection<SVGDefsElement, unknown, null, undefined>

    private shadowEdgeGroup: Selection<SVGGElement, unknown, null, undefined>
    private shadowEdgePath: Selection<SVGPathElement, unknown, null, undefined>

    private handleLayer: Selection<SVGGElement, unknown, null, undefined>
    private connectionHandle: Selection<SVGGElement, unknown, null, undefined> | null = null
    private connectionHandleNode: Node | null = null

    private nodeGroupSelection!: Selection<SVGGElement, Node, SVGGElement, unknown>
    private edgeGroupSelection!: Selection<SVGPathElement, Edge, SVGGElement, unknown>
    private noteGroupSelection!: Selection<SVGGElement, Note, SVGGElement, unknown>
    private noteEdgeSelection!: Selection<SVGPathElement, { note: Note; target: Node }, SVGGElement, unknown>
    private nodeSelection!: Selection<SVGGElement, Node, SVGGElement, unknown>
    private edgeSelection!: Selection<SVGGElement, Edge, SVGGElement, unknown>
    private noteSelection!: Selection<SVGGElement, Note, SVGGElement, unknown>

    private lassoModeActive = false

    /** Fires when the canvas becomes visible, to re-measure node sizes. */
    private sizeObserver: IntersectionObserver | null = null

    constructor(graph: Graph, container: HTMLElement, graphInteraction: GraphInteractions<SVGGElement | SVGPathElement>, options: Partial<GraphRendererOptions>) {
        super(graph, container, options)

        this.options = merge({}, DEFAULT_RENDERER_OPTIONS, options)

        this.graphInteraction = graphInteraction
        this.eventHandler = new EventHandler(this.graph)
        this.nodeDrawer = new NodeDrawer(this.options, this.graph, this)
        this.edgeDrawer = new EdgeDrawer(this.options, this.graph, this)
        this.noteDrawer = new NoteDrawer(this.options, this.graph, this)

        this.svgCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        this.svgCanvas.setAttribute('width', '100%')
        this.svgCanvas.setAttribute('height', '100%')
        this.svgCanvas.setAttribute('fill', 'none')
        this.svgCanvas.setAttribute('class', 'pvt-canvas-element')
        this.svgCanvas.setAttribute('data-renderer-drag-enabled', this.options.dragEnabled ? '1' : '0')

        this.getCanvas().appendChild(this.svgCanvas)
        this.svg = d3Select(this.svgCanvas)

        this.zoomGroup = this.svg.append('g').attr('class', 'zoom-layer hidden')
        this.edgeGroup = this.zoomGroup.append('g').attr('class', 'edges')

        this.shadowEdgeGroup = this.zoomGroup.append('g').attr('class', 'shadow-edges').style('pointer-events', 'none')
        this.shadowEdgePath = this.shadowEdgeGroup.append('path').attr('class', 'pvt-shadow-edge').style('display', 'none')

        this.noteEdgeGroup = this.zoomGroup.append('g').attr('class', 'note-edges')

        this.selectionBoxGroup = this.svg.append('g').attr('class', 'selection-box')
        this.nodeGroup = this.zoomGroup.append('g').attr('class', 'nodes')

        // Notes sit above the graph — they are annotations meant to stay readable,
        // never obscured by a node. Their connectors stay in the note-edges layer
        // (below the nodes) so a link line doesn't float across unrelated nodes.
        this.noteGroup = this.zoomGroup.append('g').attr('class', 'notes')

        this.handleLayer = this.zoomGroup.append('g').attr('class', 'connection-handle-layer')

        this.defs = this.svg.append('defs')
        this.edgeDrawer.renderDefinitions()

        this.lassoOverlay = new LassoOverlay(this.options, this.graph, this)

        this.zoom = d3Zoom<SVGSVGElement, unknown>()
        this.zoom = this.zoom
            .filter((event) => {
                
                if (!this.options.zoomEnabled)
                    return false

                if (event.ctrlKey || event.shiftKey || event.altKey)
                    return false

                const target = event.target as HTMLElement
                if (
                    target.tagName === 'INPUT' ||
                    target.tagName === 'SELECT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.closest('[contenteditable="true"]')
                ) {
                    return false
                }

                // Disable panning while connect mode is active
                if (this.graph.editing.connectManager.isActiveAndNotIdle()) {
                    if (event.type === 'wheel') return true
                    if (event.button === 1) return true
                    return false
                }

                const shouldProceed = this.graphInteraction.canvasBeforeZoom(event)
                if (!shouldProceed) {
                    return false
                }

                return true
            })
            .scaleExtent([this.options.minZoom, this.options.maxZoom])
            .on('zoom', (event) => {
                this.zoomGroup.attr('transform', event.transform)
                this.graphInteraction.canvasZoom(event)
            })

        this.svg.call(this.zoom)
        this.svg.on('dblclick.zoom', null)


        if (this.options.selectionBox.enabled) {
            this.selectionBox = new SelectionBox(this, this.svgCanvas, this.selectionBoxGroup.node())
        }

        // Watches changes on the canvas (like sizing and visibility)
        // and recompute actual node size only when visibility changes
        this.sizeObserver = new IntersectionObserver((entries) => {
            if (entries.some(entry => entry.isIntersecting)) {
                this.remeasureVisibleNodes()
            }
        }, { threshold: 0 })
        this.sizeObserver.observe(this.svgCanvas)
    }

    /**
     * Re-measure nodes still at the placeholder radius now the canvas is visible.
     * A node rendered while the canvas was hidden has no layout box, so it keeps
     * the default radius (25); once visible we can read its real bbox.
     *
     * No-op until the first render has assigned `nodeSelection` — the visibility
     * observer can fire before any data has been rendered (data-less construction
     * or a failed `init()`), where dereferencing `nodeSelection` would throw.
     */
    private remeasureVisibleNodes(): void {
        if (!this.nodeSelection) return
        this.nodeSelection.each((node: Node, i: number, nodes: ArrayLike<SVGGElement>) => {
            if (node.getCircleRadius() !== 25) return // default width/height that might be innacurate

            const shape = nodes[i].querySelector('.node') as SVGGraphicsElement | null
            if (!shape) return
            const bbox = shape.getBBox()
            node.setCircleRadius(0.5 * Math.max(bbox.width, bbox.height))
        })
    }

    public setupRendering(): void {
        this.createHtmlProgressBar()
    }

    /** Release renderer-owned resources so observers can't fire on a removed canvas. */
    public override destroy(): void {
        this.sizeObserver?.disconnect()
        this.sizeObserver = null
    }

    public getZoomBehavior(): ZoomBehavior<SVGSVGElement, unknown> {
        return this.zoom
    }

    public getZoomTransform(): ZoomTransform {
        return zoomTransform(this.svgCanvas)
    }

    public screenToGraphCoordinates(screenX: number, screenY: number): Point {

        const svgRect = this.svgCanvas.getBoundingClientRect()

        const localX = screenX - svgRect.left
        const localY = screenY - svgRect.top

        const transform = this.getZoomTransform()

        return {
            x: transform.invertX(localX),
            y: transform.invertY(localY),
        } as Point
    }

    public graphToScreenCoordinates(graphX: number, graphY: number): Point {

        const svgRect = this.svgCanvas.getBoundingClientRect()
        const transform = this.getZoomTransform()

        const localX = transform.applyX(graphX)
        const localY = transform.applyY(graphY)

        return {
            x: localX + svgRect.left,
            y: localY + svgRect.top,
        } as Point
    }

    public getSelectionBox(): SelectionBox | null {
        return this.selectionBox
    }

    public getOptions(): GraphRendererOptions {
        return this.options
    }

    public getNodeStyle(node: Node): NodeStyle {
        return this.nodeDrawer.getNodeStyle(node)
    }

    public init(): void {
        if (this.options.beforeRender) {
            this.options.beforeRender(this.graph)
        }
        this.dataUpdate()
        this.eventHandler.init(this, this.graphInteraction)
    }

    public update(dataChanged = false): void {
        this.dataUpdate()
        if (dataChanged) {
            this.eventHandler.update()
        }
    }

    public dataUpdate(): void {
        const nodes: Node[] = this.graph.getMutableNodes()
            .filter(node => node.visible)

        const nodeGroupNode: SVGGElement = this.nodeGroup.node() as SVGGElement
        this.nodeGroupSelection = this.nodeGroup
            .selectAll<SVGGElement, Node>('g.pvt-node')
            .filter(function () {
                return this.parentNode === nodeGroupNode
            })

        this.nodeSelection = this.nodeGroupSelection
            .data(nodes, (node: Node) => node.id)
            .join(
                (enter) => {
                    return enter
                    .append('g')
                    .classed('pvt-node', true)
                    .classed('pvt-node-has-children', (node) => node.hasChildren())
                    .classed('pvt-node-expanded', (node) => node.expanded === true)
                    .each((node: Node, i: number, nodes: ArrayLike<SVGGElement>) => {
                            node.clearDirty()
                            const selection = d3Select<SVGGElement, Node>(nodes[i])
                            selection.attr('id', `node-${node.domID}`)
                            this.nodeDrawer.render(selection, node)
                        })
                },
                (update) => {
                    return update
                        .classed('pvt-node-expanded', (node) => node.expanded === true)
                        .each((node: Node, i: number, nodes: ArrayLike<SVGGElement>) => {
                            const selection = d3Select<SVGGElement, Node>(nodes[i])
                            if (node.isDirty()) {
                                node.clearDirty()
                                if (!node.expanded) { // teardown any created clusters.
                                    ClusterDrawer.collapseAllOpenedClusters(node)
                                    ClusterDrawer.toggleSyntheticEdges(node)
                                    ClusterDrawer.resolveCrossClusterEdges(this.nodeDrawer.graph)
                                    const parentGraph = this.nodeDrawer.graph.getParentGraph()
                                    let currParentGraph = parentGraph
                                    while (currParentGraph) {
                                        currParentGraph.renderer.update(false)
                                        currParentGraph = currParentGraph.getParentGraph()
                                    }
                                    if (parentGraph) { // We're in a subgraph, propagate change to upper graph
                                        ClusterDrawer.updateToNewRadiusCollapsed(node, true, parentGraph)
                                    }
                                }
                                selection.selectChildren().remove()
                                this.nodeDrawer.render(selection, node)
                            }
                            this.nodeDrawer.checkForHighlight(selection, node)
                        })
                },
                exit => exit.remove()
            )

        const edges = this.graph.getMutableEdges()
            .filter(edge => {
                return edge.visible
            })
        this.edgeGroupSelection = this.edgeGroup
            .selectAll<SVGPathElement, Edge>('g.pvt-edge-group')

        this.edgeSelection = this.edgeGroupSelection
            .data(edges, (edge: Edge) => edge.id)
            .join(
                (enter) => enter
                    .append('g')
                    .classed('pvt-edge-group', true)
                    .classed('pvt-edge-synthetic', (edge) => edge.isSynthetic === true)
                    .each((edge: Edge, i: number, edges: ArrayLike<SVGGElement>) => {
                        edge.clearDirty()
                        const selection = d3Select<SVGGElement, Edge>(edges[i])
                        selection.attr('id', `edge-${edge.domID}`)
                        this.edgeDrawer.render(selection, edge)
                    }),
                update => update
                    .each((edge: Edge, i: number, edges: ArrayLike<SVGPathElement>) => {
                        if (edge.isDirty()) {
                            edge.clearDirty()
                            const selection = d3Select<SVGGElement, Edge>(edges[i])
                            selection.selectChildren().remove()
                            this.edgeDrawer.render(selection, edge)
                        }
                    }),
                exit => exit.remove()
            )

        const notes = this.graph.noteManager.getVisibleNotes()
        this.noteGroupSelection = this.noteGroup
            .selectAll<SVGGElement, Note>('g.pvt-note')

        this.noteSelection = this.noteGroupSelection
            .data(notes, (note: Note) => note.id)
            .join(
                enter => enter
                    .append('g')
                    .classed('pvt-note', true)
                    .each((note, i, notes) => {
                        const selection = d3Select<SVGGElement, Note>(notes[i])
                        selection.attr('id', `note-${note.domID}`)
                        this.noteDrawer.render(selection, note)
                    }),

                update => update
                    .each((note, i, notes) => {

                        if (!note.isDirty() && !note.isAttachmentDirty()) {
                            return
                        }

                        note.clearDirty()

                        const selection = d3Select<SVGGElement, Note>(notes[i])

                        if (note.isAttachmentDirty()) {

                            this.noteDrawer.refreshLink(note)

                            note.clearAttachmentDirty()
                        } else if (!note.isEditing()) {

                            // While editing, the colour/surface pills apply their
                            // change to the live DOM directly — rebuilding here
                            // would blow away the editor state and reset the save
                            // button back to the edit icon.
                            selection.selectChildren().remove()

                            this.noteDrawer.render(selection, note)
                        }

                    }),

                exit => exit.remove()
            )

        // Builds array of note target pairs
        const noteEdges: { note: Note; target: Node }[] = []
        for (const note of this.graph.noteManager.getVisibleNotes()) {
            const attached = note.getAttachedElement()
            if (!attached || attached.type !== 'node') continue
            const target = this.graph.getMutableNode(attached.id)
            if (!target || !target.visible) continue
            noteEdges.push({ note, target })
        }

        this.noteEdgeSelection = this.noteEdgeGroup
            .selectAll<SVGPathElement, { note: Note; target: Node }>('path')
            .data(noteEdges, d => d.note.id)
            .join(
                enter => enter
                    .append('path')
                    .attr('class', 'pvt-note-edge')
                    .attr('stroke', 'var(--pvt-edge-stroke, #999)')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '6 4')
                    .attr('fill', 'none')
                    .attr('opacity', 0.7)
                    .attr('d', d => this.noteEdgePath(d.note, d.target)),
                update => update
                    .attr('d', d => this.noteEdgePath(d.note, d.target)),
                exit => exit.remove()
            )
    }

    public getCanvasSelection(): Selection<SVGSVGElement, unknown, null, undefined> {
        return this.svg
    }

    public getZoomGroup(): SVGGElement | null {
        return this.zoomGroup.node()
    }

    public nextTick(): void {
        this.updateEdgePositions() // Render edges first so nodes are drawn on top of them
        this.updateNoteEdgePositions()
        this.updateNotePositions()
        this.updateNodePositions()
    }

    public nextTickFor(nodes: Node[]): void {
        this.updateEdgePositions(nodes) // Render edges first so nodes are drawn on top of them
        this.updateNodePositions(nodes)
    }

    public zoomIn(): void {
        const zoomBehavior = this.getZoomBehavior()
        const canvas = this.getCanvasSelection()

        if (!zoomBehavior || !canvas) return

        if (this.options.zoomAnimation) {
            canvas.transition().duration(300).call(zoomBehavior.scaleBy, 1.5)
        } else {
            canvas.call(zoomBehavior.scaleBy, 1.5)
        }
    }

    public zoomOut(): void {
        const zoomBehavior = this.getZoomBehavior()
        const canvas = this.getCanvasSelection()

        if (!zoomBehavior || !canvas) return

        if (this.options.zoomAnimation) {
            canvas.transition().duration(300).call(zoomBehavior.scaleBy, 0.667)
        } else {
            canvas.call(zoomBehavior.scaleBy, 0.667)
        }
    }

    public fitAndCenter(forceScale?: number): void {
        const zoomBehavior = this.getZoomBehavior()
        const canvas = this.getCanvasSelection()
        const svgEl = canvas.node() as SVGSVGElement
        const zoomLayerEl = canvas.select('.zoom-layer').node() as SVGGElement

        if (!zoomBehavior || !svgEl || !zoomLayerEl) return

        const bounds = zoomLayerEl.getBBox()
        if (bounds.width == 0 || bounds.height == 0) return

        const fullWidth = svgEl.clientWidth
        const fullHeight = svgEl.clientHeight
        const width = bounds.width
        const height = bounds.height

        // Midpoint of content
        const midX = bounds.x + width / 2
        const midY = bounds.y + height / 2

        let scale
        if (forceScale) {
            scale = forceScale
        } else {
            // Scale so that content fits (with some padding)
            scale = Math.min(
                fullWidth / width,
                fullHeight / height
            ) * 0.8
            scale = Math.min(scale, 3)
        }

        const translateX = fullWidth / 2 - scale * midX
        const translateY = fullHeight / 2 - scale * midY

        const transform = d3ZoomIdentity
            .translate(translateX, translateY)
            .scale(scale)

        if (this.options.zoomAnimation) {
            canvas.transition().duration(this.options.zoomAnimationDuration).call(zoomBehavior.transform, transform)
        } else {
            canvas.call(zoomBehavior.transform, transform)
        }
    }

    /**
     * Fit-and-centre once the zoom layer has stopped resizing.
     *
     * Some content lays out over several animation frames + d3 transitions
     * *after* the main sim stops (i.e. after `waitForSimulationStop()`
     * resolves) — e.g. an expanded cluster drawing its bubble/badges and its
     * nested subgraph. Fitting right then measures a transient bbox and locks in
     * a wrong, off-centre transform that is never corrected. So poll `getBBox()`
     * until it holds steady for a few frames (hard-capped so it can never hang),
     * then fit. This is cause-agnostic: a static layout is already steady and
     * resolves in a few frames; anything still moving is waited out.
     */
    public fitAndCenterWhenSettled(forceScale?: number): void {
        const zoomLayerEl = this.zoomGroup.node()
        if (!zoomLayerEl) {
            this.fitAndCenter(forceScale)
            return
        }

        const maxFrames = 180    // ~3s @60fps: a hard cap, not the usual path
        const stableTarget = 3   // consecutive steady frames before we commit
        const epsilon = 0.5      // px: ignore sub-pixel jitter from late layout
        let prev: DOMRect | null = null
        let stableFrames = 0
        let frame = 0

        const step = (): void => {
            const b = zoomLayerEl.getBBox()
            const steady = prev !== null
                && Math.abs(b.width - prev.width) < epsilon
                && Math.abs(b.height - prev.height) < epsilon
                && Math.abs(b.x - prev.x) < epsilon
                && Math.abs(b.y - prev.y) < epsilon
            stableFrames = steady ? stableFrames + 1 : 0
            prev = b
            frame++
            if (stableFrames >= stableTarget || frame >= maxFrames) {
                this.fitAndCenter(forceScale)
                return
            }
            requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
    }

    public focusElement(element: Node | Edge | Note): void {
        const targetEl: SVGGElement | null = element.getGraphElement()
        const zoomBehavior = this.getZoomBehavior()
        const canvas = this.getCanvasSelection()
        const svgEl = canvas.node() as SVGSVGElement
        const zoomLayerEl = canvas.select('.zoom-layer').node() as SVGGElement

        if (!zoomBehavior || !svgEl || !zoomLayerEl || !targetEl) return
        const svgBounds = zoomLayerEl.getBBox()

        const fullWidth = svgEl.clientWidth
        const fullHeight = svgEl.clientHeight
        const width = svgBounds.width
        const height = svgBounds.height

        const transformList = targetEl.transform.baseVal

        let dx = 0, dy = 0
        if (transformList.numberOfItems > 0) {
            const t = transformList.getItem(0) // assumes only one transform (translate/scale)

            dx = t.matrix.e
            dy = t.matrix.f
        }

        const scale = Math.min(
            fullWidth / width,
            fullHeight / height
        ) * 1.5
        const translateX = fullWidth / 2 - scale * dx
        const translateY = fullHeight / 2 - scale * dy

        const transform = d3ZoomIdentity
            .translate(translateX, translateY)
            .scale(scale)

        canvas.transition().duration(300).call(zoomBehavior.transform, transform)
    }

    public highlightElement(element: Node | Edge): void {
        const targetEl: SVGGElement | null = element.getGraphElement()
        if (element instanceof Edge) {
            this.edgeSelection.classed('pvt-edge-highlighted', false)
            targetEl?.classList.add('pvt-edge-highlighted')
        } else if (element instanceof Node) {
            this.nodeSelection.classed('pvt-node-highlighted', false)
            targetEl?.classList.add('pvt-node-highlighted')
        }
    }

    public unHighlightElement(element: Node | Edge): void {
        const targetEl: SVGGElement | null = element.getGraphElement()
        if (element instanceof Edge) {
            targetEl?.classList.remove('pvt-edge-highlighted')
        } else if (element instanceof Node) {
            targetEl?.classList.remove('pvt-node-highlighted')
        }
    }

    public clearHighlightedElements(): void {
        this.edgeSelection.classed('pvt-edge-highlighted', false)
        this.nodeSelection.classed('pvt-node-highlighted', false)
    }

    private updateNodePositions(nodes?: Node[]): void {
        if (nodes) {
            const nodeIds = new Set(nodes?.map(n => n.id))
            const selectedNodes = this.nodeSelection.filter(d => nodeIds.has(d.id))
            this.nodeDrawer.updatePositions(selectedNodes)
        } else {
            this.nodeDrawer.updatePositions(this.nodeSelection)
        }
    }

    private updateEdgePositions(nodes?: Node[]): void {
        if (nodes) {
            const edges = nodes.flatMap(n => [...n.getEdgesOut(), ...n.getEdgesIn()])
            const edgeIds = new Set(edges?.map(e => e.id))
            const selectedEdges = this.edgeSelection.filter(d => edgeIds.has(d.id))
            this.edgeDrawer.updatePositions(selectedEdges)
        } else {
            this.edgeDrawer.updatePositions(this.edgeSelection)
        }
    }

    private updateNoteEdgePositions(): void {
        if (!this.noteEdgeSelection) return
        this.noteEdgeSelection.attr('d', d => this.noteEdgePath(d.note, d.target))
    }

    private noteEdgePath(note: Note, target: Node): string | null {
        const centerX = note.x + note.width / 2
        const centerY = note.y + note.height / 2

        const targetX = target.x ?? 0
        const targetY = target.y ?? 0

        const dx = targetX - centerX
        const dy = targetY - centerY
        const dist = Math.hypot(dx, dy)

        if (dist === 0) return null

        const nx = dx / dist
        const ny = dy / dist

        const drawOffsetStart = 4
        const startX = centerX + nx * drawOffsetStart
        const startY = centerY + ny * drawOffsetStart

        const rTo = target.getCircleRadius() || this.nodeDrawer.getNodeStyle(target).size as number
        const drawOffsetEnd = 8
        const endX = targetX - nx * (rTo + drawOffsetEnd)
        const endY = targetY - ny * (rTo + drawOffsetEnd)

        return `M ${startX},${startY} L ${endX},${endY}`
    }

    private updateNotePositions(): void {
        this.noteDrawer.updatePositions(this.noteSelection)
    }

    public getNodeSelection(): Selection<SVGGElement, Node, SVGGElement, unknown> {
        return this.nodeSelection
    }

    public getEdgeSelection(): Selection<SVGGElement, Edge, SVGGElement, unknown> {
        return this.edgeSelection
    }

    public getNoteSelection(): Selection<SVGGElement, Note, SVGGElement, unknown> {
        return this.noteSelection
    }

    // @ts-expect-error fixme: Don't really understand the typescript error below
    public getGraphInteraction(): GraphInteractions<SVGGElement | SVGPathElement> {
        return this.graphInteraction
    }

    public getEventHandler(): EventHandler {
        return this.eventHandler
    }

    public toggleLassoMode(enabled: boolean) {
        this.lassoModeActive = enabled
        this.lassoOverlay.setEnabled(enabled)
    }

    public enterNoteEditMode(note: Note): void {
        this.noteDrawer.enterEditMode(note)
    }

    public getNodeClosestToCursor(maxDistance?: number): Node | null {
        maxDistance = maxDistance ?? Infinity
        const pointerEvent = this.graphInteraction.getLastPointerEvent()

        if (!pointerEvent) {
            return null
        }

        const svgRect = this.svgCanvas.getBoundingClientRect()

        // Cursor position in SVG viewport coordinates
        const screenX = pointerEvent.clientX - svgRect.left
        const screenY = pointerEvent.clientY - svgRect.top

        // Convert screen coordinates into graph/world coordinates
        const transform = this.getZoomTransform()
        
        const graphX = transform.invertX(screenX)
        const graphY = transform.invertY(screenY)

        let closestNode: Node | null = null
        let closestDistance = Infinity

        const nodes: Node[] = this.graph.getMutableNodes().filter(node => node.visible)
        for (const node of nodes) {
            const dx = (node.x ?? 0) - graphX
            const dy = (node.y ?? 0) - graphY

            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance < closestDistance && distance <= maxDistance) {
                closestDistance = distance
                closestNode = node
            }
        }

        return closestNode
    }

    public getClosestElementToCursor(maxDistance?: number): Node | Edge | Note | null {

        maxDistance = maxDistance ?? Infinity
        const pointerEvent = this.graphInteraction.getLastPointerEvent()

        if (!pointerEvent) {
            return null
        }

        const svgRect = this.svgCanvas.getBoundingClientRect()

        // Cursor position in SVG viewport coordinates
        const screenX = pointerEvent.clientX - svgRect.left
        const screenY = pointerEvent.clientY - svgRect.top

        // Convert screen coordinates into graph/world coordinates
        const transform = this.getZoomTransform()

        const graphX = transform.invertX(screenX)
        const graphY = transform.invertY(screenY)

        let closestElement: Node | Edge | Note | null = null
        let closestDistance = Infinity

        const checkElement = (element: Node | Edge | Note, x: number, y: number) => {
            const dx = x - graphX
            const dy = y - graphY

            // const distance = Math.sqrt(dx * dx + dy * dy)
            const distance = element instanceof Note
                ? this.getDistanceToNote(element, graphX, graphY)
                : Math.sqrt(dx * dx + dy * dy)

            if (distance < closestDistance && distance <= maxDistance) {
                closestDistance = distance
                closestElement = element
            }
        }

        for (const node of this.graph.getMutableNodes()) {
            if (!node.visible) continue

            checkElement(node, node.x ?? 0, node.y ?? 0)
        }

        for (const note of this.graph.getNotes()) {
            if (!note.visible) continue

            checkElement(note, note.x ?? 0, note.y ?? 0)
        }

        return closestElement
    }

    private getDistanceToNote(note: Note, x: number, y: number): number {

        const left = note.x
        const right = note.x + note.width
        const top = note.y
        const bottom = note.y + note.height

        // Cursor is inside note
        if (
            x >= left &&
            x <= right &&
            y >= top &&
            y <= bottom
        ) {
            return 0
        }

        // Distance to closest point on rectangle
        const closestX = Math.max(left, Math.min(x, right))

        const closestY = Math.max(top, Math.min(y, bottom))

        return Math.hypot(x - closestX, y - closestY)
    }

    public showShadowEdge(params: {
        source: Node | Note,
        targetNode?: Node,
        targetPosition?: { x: number, y: number },
        invalid?: boolean
    }): void {

        const { source, targetNode, targetPosition, invalid = false } = params

        if (source.x == null || source.y == null) {
            return
        }

        let targetX: number
        let targetY: number
        let targetRadius = 0

        if (targetNode) {

            if (targetNode.x == null || targetNode.y == null) {
                return
            }

            targetX = targetNode.x
            targetY = targetNode.y
            targetRadius = targetNode.getCircleRadius() || this.nodeDrawer.getNodeStyle(targetNode).size as number

        } else if (targetPosition) {

            targetX = targetPosition.x
            targetY = targetPosition.y

        } else {
            return
        }

        let sourceRadius
        let wantedSourceX = source.x
        let wantedSourceY = source.y

        if (source instanceof Node) {
            sourceRadius = source.getCircleRadius() || this.nodeDrawer.getNodeStyle(source).size as number
        } else if (source instanceof Note) {
            wantedSourceX += source.width / 2
            wantedSourceY += source.height / 2
            sourceRadius = 0
        } else {
            sourceRadius = 12
        }

        const dx = targetX - wantedSourceX
        const dy = targetY - wantedSourceY

        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance === 0) {
            return
        }

        const nx = dx / distance
        const ny = dy / distance

        const startX = wantedSourceX + nx * (sourceRadius + 4)
        const startY = wantedSourceY + ny * (sourceRadius + 4)

        const endX = targetX - nx * (targetRadius + 8)
        const endY = targetY - ny * (targetRadius + 8)

        let path: string | null

        if (targetNode) {

            path = this.edgeDrawer.buildArcPath({
                fromX: wantedSourceX,
                fromY: wantedSourceY,
                toX: targetX,
                toY: targetY,
                fromRadius: sourceRadius,
                toRadius: targetRadius,
                drawOffsetStart: 4,
                drawOffsetEnd: 8,
            })

        } else {

            path = `M ${startX},${startY} L ${endX},${endY}`
        }

        this.shadowEdgePath
            .attr('d', path)
            .attr('stroke', invalid ? 'var(--pvt-danger, #e5484d)' : 'var(--pvt-edge-stroke, #999)')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '6 4')
            .attr('fill', 'none')
            .attr('opacity', 0.7)
            .attr('marker-end', invalid ? null : 'url(#arrow)')
            .classed('pvt-shadow-edge--invalid', invalid)
            .style('display', null)
    }

    public hideShadowEdge(): void {
        this.shadowEdgePath.style('display', 'none')
    }
}
