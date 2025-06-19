import { select as d3Select, type Selection } from 'd3-selection'
import { zoom as d3Zoom, zoomTransform as d3ZoomTransform, type ZoomBehavior } from 'd3-zoom'
import { Edge } from '../edge'
import { Node } from '../node'
import type { Graph } from '../graph'
import type { SvgRendererOptions } from '../graph-options'
import merge from 'lodash.merge'


const DEFAULT_RENDERER_OPTIONS: SvgRendererOptions = {
    minZoom: 0.1,
    maxZoom: 10,
    defaultNodeStyle: {
        shape: 'circle',
        color: '#007acc',
        size: 10,
        strokeColor: '#fff',
        strokeWidth: 2,
    }
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
    private nodeGroupSelection!: Selection<SVGGElement, Node, SVGGElement, unknown>
    private edgeGroupSelection!: Selection<SVGLineElement, Edge, SVGGElement, unknown>
    private nodeSelection!: Selection<SVGGElement, Node, SVGGElement, unknown>
    private edgeSelection!: Selection<SVGLineElement, Edge, SVGGElement, unknown>

    private renderNodeCB?: SvgRendererOptions['renderNode']
    private renderEdgeCB?: SvgRendererOptions['renderEdge']

    constructor(graph: Graph, container: HTMLElement, options: Partial<SvgRendererOptions>) {
        this.graph = graph
        this.container = container

        // this.options = {
        //     ...DEFAULT_RENDERER_OPTIONS,
        //     ...options,
        // }
        this.options = merge({}, DEFAULT_RENDERER_OPTIONS, options)

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

    public init(): void {
        const nodes = this.graph.getNodes()
        this.nodeGroupSelection = this.nodeGroup
            .selectAll<SVGGElement, Node>('g.node-shape')

        this.nodeSelection = this.nodeGroupSelection
            .data(nodes)
            .join(
                (enter) => enter
                    .append('g').classed('node-shape', true)
                    .each((node: Node, i: number, nodes: ArrayLike<SVGGElement>) => {
                        const selection = d3Select<SVGGElement, Node>(nodes[i])
                        this.renderNode(selection, node)
                    }),
                update => update
                    .each((node: Node, i: number, nodes: ArrayLike<SVGGElement>) => {
                        const selection = d3Select<SVGGElement, Node>(nodes[i])
                        this.renderNode(selection, node)
                    }),
                exit => exit.remove()
            )

        this.nodeSelection.call(this.graph.simulation.createDragBehavior())

        const edges = this.graph.getEdges()
        this.edgeGroupSelection = this.edgeGroup
            .selectAll<SVGLineElement, Edge>('line')

        this.edgeSelection = this.edgeGroupSelection
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
    }

    public getCanvas(): SVGSVGElement {
        return this.svgCanvas
    }

    public render(): void {
        this.renderEdges() // Render edges first so nodes are drawn on top of them
        this.renderNodes()
    }

    public renderNodes(): void {
        this.nodeSelection
            .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    }

    renderEdges(): void {
        this.edgeSelection
            .attr('x1', (d: Edge) => d.from.x ?? 0)
            .attr('y1', (d: Edge) => d.from.y ?? 0)
            .attr('x2', (d: Edge) => d.to.x ?? 0)
            .attr('y2', (d: Edge) => d.to.y ?? 0)
    }

    renderNode(theNodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
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
            this.defaultNodeRender(theNodeSelection, node)
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

    private defaultNodeRender(nodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
        const shape = node.getStyle()?.shape ?? this.options.defaultNodeStyle?.shape
        let actualShape = shape
        if (shape == 'square') {
            actualShape = 'rect'
        } else if (['triangle', 'hexagon', ].includes(shape)) {
            actualShape = 'path'
        }

        const strokeColor = node.getStyle()?.strokeColor ?? this.options.defaultNodeStyle?.strokeColor
        const strokeWidth = node.getStyle()?.strokeWidth ?? this.options.defaultNodeStyle?.strokeWidth
        const size = node.getStyle()?.size ?? this.options.defaultNodeStyle?.size
        const color = node.getStyle()?.size ?? this.options.defaultNodeStyle?.color

        const renderedNode = nodeSelection
            .append(actualShape)
            .attr('stroke', strokeColor)
            .attr('stroke-width', strokeWidth)
            .attr('fill', color)

        switch (shape) {
            case 'circle':
                renderedNode.attr('r', size)
                break
            case 'square':
                renderedNode
                    .attr('width', size * 2)
                    .attr('height', size * 2)
                    .attr('x', -size)
                    .attr('y', -size)
                break
            case 'triangle':
                { const trianglePath = [
                    [0, -size],
                    [size, size],
                    [-size, size]
                ].map(p => p.join(',')).join(' ')
                renderedNode
                    .attr('d', `M${trianglePath}Z`)
                    break }
            case 'hexagon':
                { const angle = Math.PI / 3 // 60°
                const hexPoints = Array.from({ length: 6 }, (_, i) => {
                    const a = angle * i
                    return [Math.cos(a) * size, Math.sin(a) * size]
                }).map(p => p.join(',')).join(' ')
                renderedNode
                    .attr('d', `M${hexPoints}Z`)
                break }
            default:
                renderedNode.attr('r', size)
                break
        }
    }
}
