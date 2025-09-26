import { type Selection } from 'd3-selection'
import { Node, type NodeData } from '../../Node'
import type { Graph } from '../../Graph'
import type { GraphRendererOptions, NodeStyle, NodeStyleFinal } from '../../GraphOptions'
import type { GraphSvgRenderer } from './GraphSvgRenderer'
import { faGlyph, tryResolveString } from '../../utils/Getters'

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

    public render(theNodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
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

            // In here, we could add support of other lightweight framework such as jQuery, Vue.js, ..

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
                this.highlightSelection(theNodeSelection, node)
              })

        } else {
            this.defaultNodeRender(theNodeSelection, node)
            requestAnimationFrame(() => {
                const nodeElement = theNodeSelection.node()
                if (!nodeElement) return

                const bbox = nodeElement.getBBox()
                const width = Math.ceil(bbox.width)
                const height = Math.ceil(bbox.height)

                node._circleRadius = 0.5 * Math.max(width, height)
                this.highlightSelection(theNodeSelection, node)
            })
        }
    }

    public updatePositions(nodeSelection: Selection<SVGGElement, Node<NodeData>, SVGGElement, unknown>): void {
        nodeSelection
            .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
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
            fontFamily: style?.fontFamily ?? this.rendererOptions.defaultNodeStyle.fontFamily,
            size: style?.size ?? this.rendererOptions.defaultNodeStyle.size,
            color: style?.color ?? this.rendererOptions.defaultNodeStyle.color,
            textColor: style?.textColor ?? this.rendererOptions.defaultNodeStyle.textColor,
            iconUnicode: style?.iconUnicode ?? this.rendererOptions.defaultNodeStyle.iconUnicode,
            iconClass: style?.iconClass ?? this.rendererOptions.defaultNodeStyle.iconClass,
            svgIcon: style?.svgIcon ?? this.rendererOptions.defaultNodeStyle.svgIcon,
            imagePath: style?.imagePath ?? this.rendererOptions.defaultNodeStyle.imagePath,
            text: style?.text ?? this.rendererOptions.defaultNodeStyle.text,
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
                fontFamily: node.getStyle()?.fontFamily ?? styleFromStyleMap?.fontFamily,
                size: node.getStyle()?.size ?? styleFromStyleMap?.size,
                color: node.getStyle()?.color ?? styleFromStyleMap?.color,
                textColor: node.getStyle()?.textColor ?? styleFromStyleMap?.textColor,
                iconUnicode: node.getStyle()?.iconUnicode ?? styleFromStyleMap?.iconUnicode,
                iconClass: node.getStyle()?.iconClass ?? styleFromStyleMap?.iconClass,
                svgIcon: node.getStyle()?.svgIcon ?? styleFromStyleMap?.svgIcon,
                imagePath: node.getStyle()?.imagePath ?? styleFromStyleMap?.imagePath,
                text: node.getStyle()?.text ?? styleFromStyleMap?.text,
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

        // ---- Content ----
        if (style.iconUnicode || style.iconClass) {
            nodeSelection
                .append('text')
                .attr('fill', style.textColor)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('font-size', style.size * 1.2)
                .attr('class', 'node-content icon ' + (style.iconUnicode ? 'icon-unicode' : (style.iconClass ?? '')))
                .text(style.iconUnicode ?? (faGlyph(style.iconClass ?? '') ?? '☐'))
        } else if (style.svgIcon) {
            const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
            svgEl.innerHTML = style.svgIcon
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
            const scale = 1.2
            nodeSelection
                .append('image')
                .attr('class', 'node-content')
                .attr('xlink:href', style.imagePath)
                .attr('x', -style.size * (scale/2))
                .attr('y', -style.size * (scale/2))
                .attr('width', style.size * scale)
                .attr('height', style.size * scale)
        } else if (style.text) {
            nodeSelection
                .append('text')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('font-size', style.size * 0.8)
                .attr('font-family', style.fontFamily)
                .attr('fill', style.textColor)
                .text(style.text)
        }
    }

    private highlightSelection(nodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
        nodeSelection.selectAll('.pivotick-node-selected-highlight').remove() // remove old overlay if exists
        if (this.graphSvgRenderer.getGraphInteraction().getSelectedNode()?.node.id === node.id) {
            nodeSelection
                .append('circle')
                .attr('class', 'pivotick-node-selected-highlight')
                .attr('r', node._circleRadius ?? 4) // slightly larger than node
                .attr('pointer-events', 'none') // doesn't interfere with interaction
        }
        if (this.graphSvgRenderer.getGraphInteraction().getSelectedNodeIDs()?.includes(node.id)) {
            nodeSelection
                .append('circle')
                .attr('class', 'pivotick-node-selected-highlight')
                .attr('r', node._circleRadius ?? 4) // slightly larger than node
                .attr('pointer-events', 'none') // doesn't interfere with interaction
        }
    }

}
