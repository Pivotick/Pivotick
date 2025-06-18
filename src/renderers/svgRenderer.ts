import { select as d3Select } from 'd3-selection'
import { Edge } from '../edge';
import { Node } from '../node';
import type { Graph } from '../graph';
import type { GraphCallbacks } from '../graph-options';



export interface SvgRendererOptions {
    renderNode?: GraphCallbacks['renderNode']
    renderEdge?: GraphCallbacks['renderEdge']
}

export class SvgRenderer {
    private container: HTMLElement;
    private graph: Graph;
    
    private svgCanvas: SVGSVGElement;

    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
    private edgeGroup: d3.Selection<SVGGElement, unknown, null, undefined>
    private nodeGroup: d3.Selection<SVGGElement, unknown, null, undefined>
    private edgeSelection!: d3.Selection<SVGLineElement, Edge, SVGGElement, unknown>;
    private nodeSelection!: d3.Selection<SVGCircleElement, Node, SVGGElement, unknown>

    private renderNodeCB?: SvgRendererOptions['renderNode'];
    private renderEdgeCB?: SvgRendererOptions['renderEdge'];

    constructor(container: HTMLElement, graph: Graph) {
        this.graph = graph;
        this.container = container;

        this.renderNodeCB = this.graph.getOptions()?.callbacks?.renderNode
        this.renderEdgeCB = this.graph.getOptions()?.callbacks?.renderEdge

        this.svgCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        this.svgCanvas.setAttribute('width', '100%')
        this.svgCanvas.setAttribute('height', '100%')

        this.container.appendChild(this.svgCanvas)
        this.svg = d3Select(this.svgCanvas)
        

        this.edgeGroup = this.svg.append('g').attr('class', 'edges');
        this.nodeGroup = this.svg.append('g').attr('class', 'nodes');
    }

    getCanvas(): SVGSVGElement {
        return this.svgCanvas
    }

    render(): void {
        this._render()
    }

    _render(): void {
        this.renderEdges() // Render edges first so nodes are drawn on top of them
        this.renderNodes()
    }

    renderNodes(): void {
        const nodes = this.graph.getNodes();

        this.nodeSelection = this.nodeGroup
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .selectAll<SVGCircleElement, Node>('circle')
        
        this.nodeSelection
            .data(nodes)
            .join(
                enter => enter.append('circle'),
                update => update,
                exit => exit.remove()
            )

        const that = this
        this.nodeSelection.each(function (this: SVGCircleElement, node: Node) {
            const theNodeSelection = d3Select<SVGCircleElement, Node>(this)
            that.renderNode(theNodeSelection, node)
        })

        this.nodeSelection
            .attr("cx", (d: Node) => d.x ?? 0)
            .attr("cy", (d: Node) => d.y ?? 0);
    }

    renderEdges(): void {
        const edges = this.graph.getEdges()
        this.edgeSelection = this.edgeGroup
            .selectAll<SVGLineElement, Edge>('line')

        this.edgeSelection
            .data(edges)
            .join(
                enter => enter.append('line'),
                update => update,
                exit => exit.remove()
            )

        const that = this
        this.edgeSelection.each(function (this: SVGLineElement, edge: Edge) {
            const theEdgeSelection = d3Select<SVGLineElement, Edge>(this)
            that.renderEdge(theEdgeSelection, edge)
        })

        this.edgeSelection
            .attr("x1", (d: Edge) => d.from.x ?? 0)
            .attr("y1", (d: Edge) => d.from.y ?? 0)
            .attr("x2", (d: Edge) => d.to.x ?? 0)
            .attr("y2", (d: Edge) => d.to.y ?? 0)
    }

    renderNode(theNodeSelection: d3.Selection<SVGCircleElement, Node, null, undefined>, node: Node): void {
        if (this.renderNodeCB) {
            const rendered = this?.renderNodeCB?.(node, theNodeSelection)
            const fo = theNodeSelection.append('foreignObject')
                .attr('width', 40)  // FIXME: calculate the correct size of the FO based on the rendered content
                .attr('height', 40)

            if (typeof rendered === 'string') {
                fo.html(rendered);
            } else if (rendered instanceof HTMLElement) {
                fo.node()?.append(rendered);
            }
            // In here, we could add support of other lightweight framework such as jQuery, Vue.js, ..
        } else {
            this.nodeSelection
                .attr("r", 10)
                .attr("fill", '#007acc')
        }
    }

    renderEdge(theEdgeSelection: d3.Selection<SVGLineElement, Edge, null, undefined>, edge: Edge): void {
        if (this.renderEdgeCB) {
            const rendered = this?.renderEdgeCB?.(edge, theEdgeSelection)
            const fo = theEdgeSelection.append('foreignObject')
                .attr('width', 40)  // FIXME: calculate the correct size of the FO based on the rendered content
                .attr('height', 40)

            if (typeof rendered === 'string') {
                fo.html(rendered);
            } else if (rendered instanceof HTMLElement) {
                fo.node()?.append(rendered);
            }
            // In here, we could add support of other lightweight framework such as jQuery, Vue.js, ..
        } else {
            theEdgeSelection
                .attr("stroke", "#999")
                .attr("stroke-opacity", 0.8)
                .attr("stroke-width", 2)
        }
    }
}
