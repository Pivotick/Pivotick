import { select as d3Select, type Selection } from 'd3-selection'
import { zoom as d3Zoom, zoomTransform as d3ZoomTransform, type ZoomBehavior } from 'd3-zoom'
import { Edge } from '../edge'
import { Node } from '../node'
import type { Graph } from '../graph'
import type { SvgRendererOptions } from '../graph-options'


const DEFAULT_RENDERER_OPTIONS: SvgRendererOptions = {
    minZoom: 0.1,
    maxZoom: 10,
}

export class SvgRenderer {
    private container: HTMLElement
    private graph: Graph
    private zoom: ZoomBehavior<SVGSVGElement, unknown>

    private options: SvgRendererOptions
    
    private svgCanvas: SVGSVGElement

    private svg: Selection<SVGSVGElement, unknown, null, undefined>
    private zoomGroup: Selection<SVGGElement, unknown, null, undefined>
    private edgeGroup: Selection<SVGGElement, unknown, null, undefined>
    private nodeGroup: Selection<SVGGElement, unknown, null, undefined>
    private edgeSelection!: Selection<SVGLineElement, Edge, SVGGElement, unknown>
    private nodeSelection!: Selection<SVGCircleElement, Node, SVGGElement, unknown>

    private renderNodeCB?: SvgRendererOptions['renderNode']
    private renderEdgeCB?: SvgRendererOptions['renderEdge']

    constructor(graph: Graph, container: HTMLElement, options: Partial<SvgRendererOptions>) {
        this.graph = graph
        this.container = container

        this.options = {
            ...DEFAULT_RENDERER_OPTIONS,
            ...options,
        }

        this.renderNodeCB = this.options?.renderNode
        this.renderEdgeCB = this.options?.renderEdge

        this.svgCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        this.svgCanvas.setAttribute('width', '100%')
        this.svgCanvas.setAttribute('height', '100%')   

        this.container.appendChild(this.svgCanvas)
        this.svg = d3Select(this.svgCanvas)
        

        this.zoomGroup = this.svg.append('g').attr('class', 'zoom-layer')
        this.edgeGroup = this.zoomGroup.append('g').attr('class', 'edges')
        this.nodeGroup = this.zoomGroup.append('g').attr('class', 'nodes')

        this.zoom = d3Zoom<SVGSVGElement, unknown>()
        this.svg.call(this.zoom)
        this.zoom
            .scaleExtent([this.options.minZoom, this.options.maxZoom])
            .on('zoom', (event) => {
                this.zoomGroup.attr('transform', event.transform)
            })
    }

    getCanvas(): SVGSVGElement {
        return this.svgCanvas
    }

    render(): void {
        this.renderEdges() // Render edges first so nodes are drawn on top of them
        this.renderNodes()
    }

    renderNodes(): void {
        const nodes = this.graph.getNodes()

        this.nodeSelection = this.nodeGroup
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .selectAll<SVGCircleElement, Node>('circle')

        this.nodeSelection
            .data(nodes)
            .join(
                (enter) => enter
                    .append('circle')
                    .each((node: Node, i: number, nodes: ArrayLike<SVGCircleElement>) => {
                        const selection = d3Select<SVGCircleElement, Node>(nodes[i])
                        this.renderNode(selection, node)
                      }),
                update => update
                    .each((node: Node, i: number, nodes: ArrayLike<SVGCircleElement>) => {
                        const selection = d3Select<SVGCircleElement, Node>(nodes[i])
                        this.renderNode(selection, node)
                    }),
                exit => exit.remove()
            )

        this.nodeSelection.call(this.graph.simulation.createDragBehavior())


        this.nodeSelection
            .attr('cx', (d: Node) => d.x ?? 0)
            .attr('cy', (d: Node) => d.y ?? 0)
    }

    renderEdges(): void {
        const edges = this.graph.getEdges()
        this.edgeSelection = this.edgeGroup
            .selectAll<SVGLineElement, Edge>('line')

        this.edgeSelection
            .data(edges)
            .join(
                (enter) => enter
                    .append('line')
                    .each((edge: Edge, i: number, edges: ArrayLike<SVGLineElement>) => {
                        const selection = d3Select<SVGLineElement, Edge>(edges[i])
                        this.renderEdge(selection, edge)
                    }),
                update => update
                    .each((edge: Edge, i: number, edges: ArrayLike<SVGLineElement>) => {
                        const selection = d3Select<SVGLineElement, Edge>(edges[i])
                        this.renderEdge(selection, edge)
                    }),
                exit => exit.remove()
            )

        this.edgeSelection
            .attr('x1', (d: Edge) => d.from.x ?? 0)
            .attr('y1', (d: Edge) => d.from.y ?? 0)
            .attr('x2', (d: Edge) => d.to.x ?? 0)
            .attr('y2', (d: Edge) => d.to.y ?? 0)
    }

    renderNode(theNodeSelection: Selection<SVGCircleElement, Node, null, undefined>, node: Node): void {
        if (this.renderNodeCB) {
            const rendered = this?.renderNodeCB?.(node, theNodeSelection)
            const fo = theNodeSelection.append('foreignObject')
                .attr('width', 40)  // FIXME: calculate the correct size of the FO based on the rendered content
                .attr('height', 40)

            if (typeof rendered === 'string') {
                fo.html(rendered)
            } else if (rendered instanceof HTMLElement) {
                fo.node()?.append(rendered)
            }
            // In here, we could add support of other lightweight framework such as jQuery, Vue.js, ..
        } else {
            theNodeSelection
                .attr('r', 10)
                .attr('fill', '#007acc')
        }
    }

    renderEdge(theEdgeSelection: Selection<SVGLineElement, Edge, null, undefined>, edge: Edge): void {
        if (this.renderEdgeCB) {
            const rendered = this?.renderEdgeCB?.(edge, theEdgeSelection)
            const fo = theEdgeSelection.append('foreignObject')
                .attr('width', 40)  // FIXME: calculate the correct size of the FO based on the rendered content
                .attr('height', 40)

            if (typeof rendered === 'string') {
                fo.html(rendered)
            } else if (rendered instanceof HTMLElement) {
                fo.node()?.append(rendered)
            }
            // In here, we could add support of other lightweight framework such as jQuery, Vue.js, ..
        } else {
            theEdgeSelection
                .attr('stroke', '#999')
                .attr('stroke-opacity', 0.8)
                .attr('stroke-width', 2)
        }
    }
}
