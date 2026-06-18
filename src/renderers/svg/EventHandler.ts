import { select as d3Select } from 'd3-selection'
import type { Graph } from '../../Graph'
import type { GraphSvgRenderer } from './GraphSvgRenderer'
import type { Node } from '../../Node'
import type { Edge } from '../../Edge'
import type { GraphInteractions } from '../../GraphInteractions'
import type { Note } from '../../Note'

export class EventHandler {
    private graph: Graph
    private renderer!: GraphSvgRenderer
    private graphInteraction!: GraphInteractions<SVGGElement | SVGPathElement>

    constructor(graph: Graph) {
        this.graph = graph
    }

    public init(renderer: GraphSvgRenderer, graphInteraction: GraphInteractions<SVGGElement | SVGPathElement>): void {
        this.renderer = renderer
        this.graphInteraction = graphInteraction

        this.registerListeners()
    }

    public update(): void {
        // TODO: Only add registration to new nodes
        this.registerListeners()
    }

    public registerListeners(): void {
        if (this.renderer.getOptions().dragEnabled) {
            this.renderer.getNodeSelection()
                .call(this.graph.simulation.createDragBehavior())
        }

        if (!this.renderer.getOptions().interactionEnabled) {
            return
        }

        this.renderer.getNodeSelection()
            .on('dblclick.node', (event: PointerEvent, node: Node) => {
                event.stopPropagation()
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeDbclick(svgNode, event, node)
            })
            .on('click.node', (event: PointerEvent, node: Node) => {
                event.stopPropagation()
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeClick(svgNode, event, node)
            })
            .on('pointerdown.node', (event: PointerEvent, node: Node) => {
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodePointerDown(svgNode, event, node)
            })
            .on('pointerup.node', (event: PointerEvent, node: Node) => {
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodePointerUp(svgNode, event, node)
            })
            .on('contextmenu.node', (event: PointerEvent, node: Node) => {
                event.preventDefault()
                event.stopPropagation()
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeContextmenu(svgNode, event, node)
            })
            .on('mouseenter.node', (event: PointerEvent, node: Node) => {
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeHoverIn(svgNode, event, node)
            })
            .on('mouseleave.node', (event: PointerEvent, node: Node) => {
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeHoverOut(svgNode, event, node)
            })
            .on('dragging.node', (event: PointerEvent, node: Node) => {
                this.graphInteraction?.dragging(event, node)
            })

        this.renderer.getEdgeSelection()
            .on('dblclick.edge', (event: PointerEvent, edge: Edge) => {
                event.stopPropagation()
                const svgEdge = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeDbclick(svgEdge, event, edge)
            })
            .on('click.edge', (event: PointerEvent, edge: Edge) => {
                event.stopPropagation()
                const svgEdge = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeClick(svgEdge, event, edge)
            })
            .on('contextmenu.edge', (event: PointerEvent, edge: Edge) => {
                event.preventDefault()
                event.stopPropagation()
                const svgEdge = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeContextmenu(svgEdge, event, edge)
            })
            .on('mouseenter.edge', (event: PointerEvent, edge: Edge) => {
                const svgNode = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeHoverIn(svgNode, event, edge)
            })
            .on('mouseleave.edge', (event: PointerEvent, edge: Edge) => {
                const svgNode = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeHoverOut(svgNode, event, edge)
            })

        this.renderer.getNoteSelection()
            .on('dblclick.note', (event: PointerEvent, note: Note) => {
                event.stopPropagation()
                const svgNote = event.currentTarget as SVGGElement
                this.graphInteraction?.noteDbclick(svgNote, event, note)
            })
            .on('click.note', (event: PointerEvent, note: Note) => {
                event.stopPropagation()
                const svgNote = event.currentTarget as SVGGElement
                this.graphInteraction?.noteClick(svgNote, event, note)
            })
            .on('pointerdown.note', (event: PointerEvent, note: Note) => {
                const svgNote = event.currentTarget as SVGGElement
                this.graphInteraction?.notePointerDown(svgNote, event, note)
            })
            .on('pointerup.note', (event: PointerEvent, note: Note) => {
                const svgNote = event.currentTarget as SVGGElement
                this.graphInteraction?.notePointerUp(svgNote, event, note)
            })
            .on('contextmenu.note', (event: PointerEvent, note: Note) => {
                event.preventDefault()
                event.stopPropagation()
                const svgNote = event.currentTarget as SVGGElement
                this.graphInteraction?.noteContextmenu(svgNote, event, note)
            })
            .on('mouseenter.note', (event: PointerEvent, note: Note) => {
                const svgNote = event.currentTarget as SVGGElement
                this.graphInteraction?.noteHoverIn(svgNote, event, note)
            })
            .on('mouseleave.note', (event: PointerEvent, note: Note) => {
                const svgNote = event.currentTarget as SVGGElement
                this.graphInteraction?.noteHoverOut(svgNote, event, note)
            })
            .on('dragging.note', (event: PointerEvent, note: Note) => {
                this.graphInteraction?.dragging(event, note)
            })

        this.renderer.getNoteSelection()
            .selectAll<HTMLElement, Note>('.pvt-note-link-placeholder-icon')
            .on('click.note-handle', (event: PointerEvent) => {
                const handle = event.currentTarget as HTMLElement
                const parentNode = handle.closest('g.pvt-note')
                if (!parentNode) return
                const note = d3Select(parentNode as SVGGElement).datum() as Note

                event.preventDefault()
                event.stopPropagation()
                this.graphInteraction?.noteHandleClick(handle, event, note)
            })
            .on('pointerdown.note-handle', (event: PointerEvent) => {
                const handle = event.currentTarget as HTMLElement
                const parentNode = handle.closest('g.pvt-note')
                if (!parentNode) return
                const note = d3Select(parentNode as SVGGElement).datum() as Note

                event.preventDefault()
                event.stopPropagation()
                this.graphInteraction?.noteHandlePointerDown(handle, event, note)
            })

        this.renderer.getCanvasSelection()
            .on('click.canvas', (event: PointerEvent) => {
                this.graphInteraction?.canvasClick(event)
            })
            .on('pointerdown.canvas', (event: PointerEvent) => {
                this.graphInteraction?.canvasPointerDown(event)
            })
            .on('pointerup.canvas', (event: PointerEvent) => {
                this.graphInteraction?.canvasPointerUp(event)
            })
            .on('contextmenu.canvas', (event: PointerEvent) => {
                event.preventDefault()
                this.graphInteraction?.canvasContextmenu(event)
            })
            .on('mousemove.canvas', (event: PointerEvent) => {
                this.graphInteraction?.canvasMousemove(event)
            })
    }
}