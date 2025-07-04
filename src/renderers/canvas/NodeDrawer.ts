import { type Selection } from 'd3-selection'
import { Node } from '../../Node'
import type { Graph } from '../../Graph'
import type { GraphSvgRendererOptions, NodeStyle } from '../../GraphOptions'

export class NodeDrawer {

    private graph: Graph
    private rendererOptions: GraphSvgRendererOptions
    private renderCB?: GraphSvgRendererOptions['renderNode']

    public constructor(rendererOptions: GraphSvgRendererOptions, graph: Graph) {
        this.graph = graph
        this.rendererOptions = rendererOptions
        this.renderCB = this.rendererOptions?.renderNode
    }

    public render(ctx: CanvasRenderingContext2D, node: Node): void {
        ctx.beginPath()
        ctx.arc(node.x ?? 0, node.y ?? 0, this.rendererOptions.defaultNodeStyle.size, 0, Math.PI * 2)
        ctx.fillStyle = this.rendererOptions.defaultNodeStyle.color
        ctx.fill()
        ctx.strokeStyle = this.rendererOptions.defaultNodeStyle.strokeColor
        ctx.lineWidth = this.rendererOptions.defaultNodeStyle.strokeWidth
        ctx.stroke()
    }

    private defaultNodeRender(nodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
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

    private genericNodeRender(nodeSelection: Selection<SVGGElement, Node, null, undefined>, style: NodeStyle, node: Node): void {
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
