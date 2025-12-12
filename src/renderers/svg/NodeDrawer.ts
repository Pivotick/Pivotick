import { type Selection } from 'd3-selection'
import { Node } from '../../Node'
import type { Graph } from '../../Graph'
import type { GraphSvgRenderer } from './GraphSvgRenderer'
import { faGlyph, tryResolveNumber, tryResolveString } from '../../utils/Getters'
import type { CustomNodeShape, GraphRendererOptions, NodeShape, NodeStyle } from '../../interfaces/RendererOptions'

export class NodeDrawer {

    // @ts-expect-error: graph might be used in future updates
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
            const rendered = this?.renderCB?.(node)
            fo.attr('width', 20)
                .attr('height', 20)

            if (typeof rendered === 'string') {
                fo.text(rendered)
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

                node.setCircleRadius(0.5 * Math.max(width, height))
                this.checkForHighlight(theNodeSelection, node)
              })

        } else {
            this.defaultNodeRender(theNodeSelection, node)
            requestAnimationFrame(() => {
                const nodeElement = theNodeSelection.node()
                if (!nodeElement) return

                const bbox = nodeElement.getBBox()
                const width = Math.ceil(bbox.width)
                const height = Math.ceil(bbox.height)

                node.setCircleRadius(0.5 * Math.max(width, height))
                this.checkForHighlight(theNodeSelection, node)
            })
        }
    }

    public updatePositions(nodeSelection: Selection<SVGGElement, Node, SVGGElement, unknown>): void {
        nodeSelection
            .attr('transform', d => {
                const x = d.x ? (isFinite(d.x) ? d.x : 0) : 0
                const y = d.y ? (isFinite(d.y) ? d.y : 0) : 0
                return `translate(${x},${y})`
            })
    }

    private defaultNodeRender(nodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
        const style = this.getNodeStyle(node)
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

        const style = node.getStyle()
        let styleFromNode: Partial<NodeStyle> = {}
        if (style.styleCb) {
            styleFromNode = style.styleCb(node)
        } else {
            styleFromNode = {
                shape: style?.shape ?? styleFromStyleMap?.shape,
                strokeColor: style?.strokeColor ?? styleFromStyleMap?.strokeColor,
                strokeWidth: style?.strokeWidth ?? styleFromStyleMap?.strokeWidth,
                fontFamily: style?.fontFamily ?? styleFromStyleMap?.fontFamily,
                size: style?.size ?? styleFromStyleMap?.size,
                color: style?.color ?? styleFromStyleMap?.color,
                textColor: style?.textColor ?? styleFromStyleMap?.textColor,
                iconUnicode: style?.iconUnicode ?? styleFromStyleMap?.iconUnicode,
                iconClass: style?.iconClass ?? styleFromStyleMap?.iconClass,
                svgIcon: style?.svgIcon ?? styleFromStyleMap?.svgIcon,
                imagePath: style?.imagePath ?? styleFromStyleMap?.imagePath,
                text: style?.text ?? styleFromStyleMap?.text,
            }
        }
        return this.mergeNodeStylingOptions(styleFromNode)
    }

    public getNodeStyle(node: Node): NodeStyle {
        const nodeStyle = this.computeNodeStyle(node)

        if (typeof nodeStyle.shape === 'function') {
            nodeStyle.shape = nodeStyle.shape(node) as NodeShape
        }

        nodeStyle.strokeWidth = nodeStyle.strokeWidth !== undefined ? (tryResolveString(nodeStyle.strokeWidth.toString(), node) ?? 'var(--pvt-node-stroke-width, 2)') : 'var(--pvt-node-stroke-width, 2)'
        nodeStyle.strokeColor = nodeStyle.strokeColor !== undefined ? (tryResolveString(nodeStyle.strokeColor, node) ?? 'var(--pvt-node-stroke, #fff)') : 'var(--pvt-node-stroke, #fff)'
        nodeStyle.size = nodeStyle.size !== undefined ? (tryResolveNumber(nodeStyle.size, node) ?? 10) : 10
        nodeStyle.color = nodeStyle.color !== undefined ? (tryResolveString(nodeStyle.color, node) ?? 'var(--pvt-node-color, #007acc)') : 'var(--pvt-node-color, #007acc)'
        nodeStyle.textColor = nodeStyle.textColor !== undefined ? (tryResolveString(nodeStyle.textColor, node) ?? 'var(--pvt-node-text-color, #fff)') : 'var(--pvt-node-text-color, #fff)'
        nodeStyle.text = nodeStyle.text !== undefined ? tryResolveString(nodeStyle.text, node) : undefined

        nodeStyle.iconUnicode = nodeStyle.iconUnicode !== undefined ? tryResolveString(nodeStyle.iconUnicode, node) : undefined
        nodeStyle.iconClass = nodeStyle.iconClass !== undefined ? tryResolveString(nodeStyle.iconClass, node) : undefined
        nodeStyle.svgIcon = nodeStyle.svgIcon !== undefined ? tryResolveString(nodeStyle.svgIcon, node) : undefined
        nodeStyle.imagePath = nodeStyle.imagePath !== undefined ? tryResolveString(nodeStyle.imagePath, node) : undefined

        return nodeStyle
    }

    // private isCustomShape(shape: unknown): shape is CustomNodeShape {
    //     return typeof shape === 'object' && shape !== null && 'd' in (shape as any)
    // }

    private isCustomShape(shape: NodeShape): shape is CustomNodeShape {
        return typeof shape === 'object' && shape !== null && 'd' in shape
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private genericNodeRender(nodeSelection: Selection<SVGGElement, Node, null, undefined>, style: NodeStyle, _node: Node): void {
        style.size = style.size as number
        style.shape = style.shape as NodeShape
        style.text = style.text as string
        
        // map logical node shapes to SVG element tag names (use string to allow 'rect' which is not part of NodeShape)
        let actualShape: string = style.shape as string
        if (style.shape == 'square') {
            actualShape = 'rect'
        } else if (this.isCustomShape(style.shape) || ['triangle', 'hexagon',].includes(style.shape)) {
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
                        return [Math.cos(a) * (style.size as number), Math.sin(a) * (style.size as number)]
                    }).map(p => p.join(',')).join(' ')
                    renderedNode
                        .attr('d', `M${hexPoints}Z`)
                    break
                }
            default:
                if (this.isCustomShape(style.shape)) {
                    renderedNode.attr('d', style.shape.d)
                } else {
                    renderedNode.attr('r', style.size)
                }
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
                .attr('font-size', this.computeFontSize(style.text, style.size))
                .attr('font-family', style.fontFamily)
                .attr('fill', style.textColor)
                .text(style.text)
        }
    }

    private checkForHighlight(nodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
        if (this.isNodeSelected(node)) {
            this.highlightSelection(nodeSelection, node)
        } else {
            this.deHighlightSelection(nodeSelection, node)
        }
    }

    private isNodeSelected(node: Node): boolean {
        const gi = this.graphSvgRenderer.getGraphInteraction()
        const selected = gi.getSelectedNode()
        const selectedIds = gi.getSelectedNodeIDs()

        const matchSingle = selected?.node?.id === node.id
        const matchMultiple = Array.isArray(selectedIds) ? selectedIds.includes(node.id) : false

        return matchSingle || matchMultiple
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private deHighlightSelection(nodeSelection: Selection<SVGGElement, Node, null, undefined>, _node: Node): void {
        nodeSelection.classed('pvt-node-selected-highlight', false)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private highlightSelection(nodeSelection: Selection<SVGGElement, Node, null, undefined>, _node: Node): void {
        nodeSelection.classed('pvt-node-selected-highlight', true)
    }

    private computeFontSize(label: string, nodeSize: number) {
        const base = nodeSize * 0.8
        const maxWidth = nodeSize * 1.6

        // approximate width: ~0.6em per character
        const estWidth = label.length * base * 0.6

        if (estWidth > maxWidth) {
            const scale = maxWidth / estWidth
            return base * scale
        }

        return base
    }
}
