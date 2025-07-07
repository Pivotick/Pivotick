import { type Selection } from 'd3-selection'
import { Node } from '../../Node'
import type { Graph } from '../../Graph'
import type { GraphRendererOptions, NodeStyle } from '../../GraphOptions'
import type { GraphSvgRenderer } from './GraphSvgRenderer'

export class NodeDrawer {

    private graph: Graph
    private rendererOptions: GraphRendererOptions
    private graphSvgRenderer: GraphSvgRenderer
    private renderCB?: GraphRendererOptions['renderNode']

    public constructor(rendererOptions: GraphRendererOptions, graph: Graph, graphSvgRenderer: GraphSvgRenderer) {
        this.graphSvgRenderer = graphSvgRenderer
        this.graph = graph
        this.rendererOptions = rendererOptions
        this.renderCB = this.rendererOptions?.renderNode
    }

    public render(theNodeSelection: Selection<SVGForeignObjectElement, Node, null, undefined>, node: Node): void {
        if (this.renderCB) {
            const fo = theNodeSelection.append('foreignObject')
            const rendered = this?.renderCB?.(node, fo)
            fo.attr('width', 20)
                .attr('height', 20)
            node._circleRadius = 10

            if (typeof rendered === 'string') {
                fo.html(rendered)
            } else if (rendered instanceof HTMLElement) {
                fo.node()?.append(rendered)
            }

            requestAnimationFrame(() => {
                const foNode = fo.node() as SVGForeignObjectElement
                if (!foNode) return

                const content = foNode.firstElementChild as HTMLElement | null
                if (!content) return

                const bcr = content.getBoundingClientRect()
                const width = Math.ceil(bcr.width)
                const height = Math.ceil(bcr.height)

                fo.attr('width', width)
                    .attr('height', height)

                // Offset the position so it's centered
                fo.attr('x', -width / 2)
                    .attr('y', -height / 2)

                node._circleRadius = 0.5 * Math.max(width, height)
              })

            // In here, we could add support of other lightweight framework such as jQuery, Vue.js, ..
        } else {
            this.defaultNodeRender(theNodeSelection, node)
            requestAnimationFrame(() => {
                const nodeElement = theNodeSelection.node()
                if (!nodeElement) return

                const bbox = nodeElement.getBBox()
                const width = Math.ceil(bbox.width)
                const height = Math.ceil(bbox.height)

                node._circleRadius = 0.5 * Math.max(width, height)
            })
        }
    }

    private defaultNodeRender(nodeSelection: Selection<SVGForeignObjectElement, Node, null, undefined>, node: Node): void {
        const style = this.computeNodeStyle(node)
        this.genericNodeRender(nodeSelection, style, node)
    }

    private mergeNodeStylingOptions(style: Partial<NodeStyle>): NodeStyle {
        const mergedStyle = {
            shape: style?.shape ?? this.rendererOptions.defaultNodeStyle.shape,
            strokeColor: style?.strokeColor ?? this.rendererOptions.defaultNodeStyle.strokeColor,
            strokeWidth: style?.strokeWidth ?? this.rendererOptions.defaultNodeStyle.strokeWidth,
            size: style?.size ?? this.rendererOptions.defaultNodeStyle.size,
            color: style?.color ?? this.rendererOptions.defaultNodeStyle.color,
        }
        return mergedStyle
    }

    private computeNodeStyle(node: Node): NodeStyle {
        let styleFromStyleMap: Partial<NodeStyle> = {}
        if (this.rendererOptions.nodeStyleMap && typeof this.rendererOptions.nodeTypeAccessor === 'function') {
            const nodeType = this.rendererOptions.nodeTypeAccessor(node)
            if (nodeType) {
                styleFromStyleMap = this.rendererOptions.nodeStyleMap[nodeType] ?? {}
            }
        }

        let styleFromNode
        if (node.getStyle()?.styleCb) {
            styleFromNode = node.getStyle().styleCb(node)
        } else {
            styleFromNode = {
                shape: node.getStyle()?.shape ?? styleFromStyleMap?.shape,
                strokeColor: node.getStyle()?.strokeColor ?? styleFromStyleMap?.strokeColor,
                strokeWidth: node.getStyle()?.strokeWidth ?? styleFromStyleMap?.strokeWidth,
                size: node.getStyle()?.size ?? styleFromStyleMap?.size,
                color: node.getStyle()?.color ?? styleFromStyleMap?.color,
            }
        }
        return this.mergeNodeStylingOptions(styleFromNode)
    }

    public getNodeStyle(node: Node): NodeStyle {
        return this.computeNodeStyle(node)
    }

    private genericNodeRender(nodeSelection: Selection<SVGForeignObjectElement, Node, null, undefined>, style: NodeStyle, node: Node): void {
        let actualShape = style.shape
        if (style.shape == 'square') {
            actualShape = 'rect'
        } else if (['triangle', 'hexagon',].includes(style.shape)) {
            actualShape = 'path'
        }

        const renderedNode = nodeSelection
            .append(actualShape)
            .attr('stroke', style.strokeColor)
            .attr('stroke-width', style.strokeWidth)
            .attr('fill', style.color)

        switch (style.shape) {
            case 'circle':
                renderedNode.attr('r', style.size)
                break
            case 'square':
                renderedNode
                    .attr('width', style.size * 2)
                    .attr('height', style.size * 2)
                    .attr('x', -style.size)
                    .attr('y', -style.size)
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
                    break
                }
            case 'hexagon':
                {
                    const angle = Math.PI / 3 // 60°
                    const hexPoints = Array.from({ length: 6 }, (_, i) => {
                        const a = angle * i
                        return [Math.cos(a) * style.size, Math.sin(a) * style.size]
                    }).map(p => p.join(',')).join(' ')
                    renderedNode
                        .attr('d', `M${hexPoints}Z`)
                    break
                }
            default:
                renderedNode.attr('r', style.size)
                break
        }
    }

}
