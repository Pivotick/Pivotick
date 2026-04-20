import { select as d3Select, type Selection } from 'd3-selection'
import { transition as d3Transition } from 'd3-transition'
import { Node } from '../../Node'
import type { Graph } from '../../Graph'
import { GraphSvgRenderer, defaultLabelStyle } from './GraphSvgRenderer'
import { faGlyph, tryResolveNumber, tryResolveString } from '../../utils/Getters'
import type { CustomNodeShape, GraphRendererOptions, NodeShape, NodeStyle } from '../../interfaces/RendererOptions'
import { ClusterDrawer } from './ClusterDrawer'
import { forceConstrainParent } from '../../plugins/layout/MicroForce'
d3Select.prototype.transition = d3Transition

export class NodeDrawer {

    public graph: Graph
    public rendererOptions: GraphRendererOptions
    public graphSvgRenderer: GraphSvgRenderer
    public clusterDrawer: ClusterDrawer
    private renderCB?: GraphRendererOptions['renderNode']

    public constructor(rendererOptions: GraphRendererOptions, graph: Graph, graphSvgRenderer: GraphSvgRenderer) {
        this.graphSvgRenderer = graphSvgRenderer
        this.graph = graph
        this.rendererOptions = rendererOptions
        this.renderCB = this.rendererOptions?.renderNode
        this.clusterDrawer = new ClusterDrawer(this)
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

                if (this.rendererOptions.enableNodeExpansion && (!node.hasChildren() || !node.expanded)) {
                    node.setCircleRadius(0.5 * Math.max(width, height))
                }
              })

        } else {
            this.defaultNodeRender(theNodeSelection, node)
            requestAnimationFrame(() => {
                const nodeElement = theNodeSelection.node()
                if (!nodeElement) return

                let width = 50, height = 50 // default fallback size of a node
                const bbox = nodeElement.getBBox()
                if (bbox.width > 0 && bbox.height > 0) {
                    width = Math.ceil(bbox.width)
                    height = Math.ceil(bbox.height)
                }

                if (this.rendererOptions.enableNodeExpansion && (!node.hasChildren() || !node.expanded)) {
                    if (this.getNodeStyle(node).shape == 'square') {
                        node.setCircleRadius(Math.SQRT1_2 * Math.max(width, height)) // Is the only shape that has a coord. shift
                    } else {
                        node.setCircleRadius(0.5 * Math.max(width, height))
                    }
                }
            })
        }

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
            textAnchorPosition: style?.textAnchorPosition ?? this.rendererOptions.defaultNodeStyle.textAnchorPosition,
            textHorizontalShift: style?.textHorizontalShift ?? this.rendererOptions.defaultNodeStyle.textHorizontalShift,
            textVerticalShift: style?.textVerticalShift ?? this.rendererOptions.defaultNodeStyle.textVerticalShift,
            textRotateDegree: style?.textRotateDegree ?? this.rendererOptions.defaultNodeStyle.textRotateDegree,
            iconUnicode: style?.iconUnicode ?? this.rendererOptions.defaultNodeStyle.iconUnicode,
            iconClass: style?.iconClass ?? this.rendererOptions.defaultNodeStyle.iconClass,
            svgIcon: style?.svgIcon ?? this.rendererOptions.defaultNodeStyle.svgIcon,
            imagePath: style?.imagePath ?? this.rendererOptions.defaultNodeStyle.imagePath,
            text: style?.text ?? this.rendererOptions.defaultNodeStyle.text,
            html: style?.html ?? this.rendererOptions.defaultNodeStyle.html,
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
                textAnchorPosition: style?.textAnchorPosition ?? styleFromStyleMap?.textAnchorPosition,
                textHorizontalShift: style?.textHorizontalShift ?? styleFromStyleMap?.textHorizontalShift,
                textVerticalShift: style?.textVerticalShift ?? styleFromStyleMap?.textVerticalShift,
                textRotateDegree: style?.textRotateDegree ?? styleFromStyleMap?.textRotateDegree,
                iconUnicode: style?.iconUnicode ?? styleFromStyleMap?.iconUnicode,
                iconClass: style?.iconClass ?? styleFromStyleMap?.iconClass,
                svgIcon: style?.svgIcon ?? styleFromStyleMap?.svgIcon,
                imagePath: style?.imagePath ?? styleFromStyleMap?.imagePath,
                text: style?.text ?? styleFromStyleMap?.text,
                html: style?.html ?? styleFromStyleMap?.html,
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
        nodeStyle.textAnchorPosition = nodeStyle.textAnchorPosition !== undefined ? tryResolveString(nodeStyle.textAnchorPosition, node) as ('start' | 'middle' | 'end') : 'middle'
        nodeStyle.textHorizontalShift = nodeStyle.textHorizontalShift !== undefined ? (tryResolveNumber(nodeStyle.textHorizontalShift, node) ?? 0) : 0
        nodeStyle.textVerticalShift = nodeStyle.textVerticalShift !== undefined ? (tryResolveNumber(nodeStyle.textVerticalShift, node) ?? 0) : 0
        nodeStyle.textRotateDegree = nodeStyle.textRotateDegree !== undefined ? (tryResolveNumber(nodeStyle.textRotateDegree, node) ?? 0) : 0
        nodeStyle.text = nodeStyle.text !== undefined ? tryResolveString(nodeStyle.text, node) : undefined

        nodeStyle.iconUnicode = nodeStyle.iconUnicode !== undefined ? tryResolveString(nodeStyle.iconUnicode, node) : undefined
        nodeStyle.iconClass = nodeStyle.iconClass !== undefined ? tryResolveString(nodeStyle.iconClass, node) : undefined
        nodeStyle.svgIcon = nodeStyle.svgIcon !== undefined ? tryResolveString(nodeStyle.svgIcon, node) : undefined
        nodeStyle.imagePath = nodeStyle.imagePath !== undefined ? tryResolveString(nodeStyle.imagePath, node) : undefined

        return nodeStyle
    }

    private isCustomShape(shape: NodeShape): shape is CustomNodeShape {
        return typeof shape === 'object' && shape !== null && 'd' in shape
    }

    private genericNodeRender(nodeSelection: Selection<SVGGElement, Node, null, undefined>, style: NodeStyle, node: Node): void {
        style.size = style.size as number
        style.shape = style.shape as NodeShape
        style.text = style.text as string
        style.textAnchorPosition = style.textAnchorPosition as 'start' | 'middle' | 'end'
        style.textHorizontalShift = style.textHorizontalShift as number
        style.textVerticalShift = style.textVerticalShift as number
        style.textRotateDegree = style.textRotateDegree as number

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
            .classed('node', true)

        switch (style.shape) {
            case 'circle':
                renderedNode.attr('r', style.size)
                node.setCircleRadius(style.size)
                break
            case 'square':
                renderedNode
                    .attr('width', style.size * 2)
                    .attr('height', style.size * 2)
                    .attr('x', -style.size)
                    .attr('y', -style.size)
                node.setCircleRadius(Math.SQRT1_2 * style.size)
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
                    node.setCircleRadius(style.size)
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
                    node.setCircleRadius(style.size)
                    break
                }
            default:
                if (this.isCustomShape(style.shape)) {
                    renderedNode.attr('d', style.shape.d)
                    node.setCircleRadius(15) // Just guessing for now. Actual size is assigned on the next frame
                } else {
                    renderedNode.attr('r', style.size)
                    node.setCircleRadius(style.size)
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
        } else if (style.html) {
            const fo = nodeSelection.append('foreignObject')
            const rendered = style.html(node)
            fo.attr('width', style.size * 2)
                .attr('height', style.size * 2)
                .attr('x', -style.size)
                .attr('y', -style.size)

            if (typeof rendered === 'string') {
                fo.text(rendered)
            } else if (rendered instanceof HTMLElement) {
                fo.node()?.append(rendered)
            }
        }
        // Do not have text dislay be mutually exclusive with icons
        if (style.text) {
            // label and background group to allow for rotating together
            const labelG = nodeSelection.append('g')

            const isOusideNode = Math.abs(style.textVerticalShift) >= 1 || Math.abs(style.textHorizontalShift) >= 1
            const [fontSize, text] = this.computeTextLayout(style.text, style.size, isOusideNode)

            const x_pos = style.textHorizontalShift * (style.size + fontSize/2*1.2)
            const y_pos = - style.textVerticalShift * (style.size + fontSize/2*1.2)

            const textSelection = labelG
                .append('text')
                .attr('text-anchor', style.textAnchorPosition)
                .attr('x', x_pos)
                .attr('y', y_pos)
                .attr('dominant-baseline', 'central')
                .attr('font-size', fontSize)
                .attr('font-family', style.fontFamily)
                .attr('fill', style.textColor)
                .text(text)

            const bbox = textSelection.node()?.getBBox()
            if (isOusideNode && bbox) {
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
            
            labelG.attr('transform', `rotate(${style.textRotateDegree}, ${x_pos}, ${y_pos})`)

        }
    }

    public checkForHighlight(nodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
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
    private deHighlightSelection(nodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
        nodeSelection.classed('pvt-node-selected-highlight', false)
        if (this.rendererOptions.enableFocusMode) {
            this.graph.getMutableNodes().forEach((node) => {
                const nodeElem = node.getGraphElement()
                nodeElem?.classList.toggle('pvt-node-selected-highlight-shadow', false)
            })
            this.graph.getMutableEdges().forEach((edge) => {
                const edgeElem = edge.getGraphElement()
                edgeElem?.classList.toggle('pvt-edge-selected-highlight-shadow', false)
            })
        }
    }

     
    private highlightSelection(nodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
        if (this.rendererOptions.enableFocusMode) {
            this.graph.getMutableNodes().forEach((node) => {
                const nodeElem = node.getGraphElement()
                nodeElem?.classList.toggle('pvt-node-selected-highlight-shadow', true)
            })
            this.graph.getMutableEdges().forEach((edge) => {
                const edgeElem = edge.getGraphElement()
                edgeElem?.classList.toggle('pvt-edge-selected-highlight-shadow', true)
            })
            nodeSelection
                .classed('pvt-node-selected-highlight-shadow', false)
        }

        nodeSelection
            .classed('pvt-node-selected-highlight', true)

        if (this.rendererOptions.enableFocusMode) {
            node.getEdgesOut().forEach((edge) => {
                const edgeElem = edge.getGraphElement()
                edgeElem?.classList.toggle('pvt-edge-selected-highlight-shadow', false)
                const nodeElem = edge.to.getGraphElement()
                nodeElem?.classList.toggle('pvt-node-selected-highlight-shadow', false)
            })
            node.getEdgesIn().forEach((edge) => {
                const edgeElem = edge.getGraphElement()
                edgeElem?.classList.toggle('pvt-edge-selected-highlight-shadow', false)
                const nodeElem = edge.from.getGraphElement()
                nodeElem?.classList.toggle('pvt-node-selected-highlight-shadow', false)
            })
        }
    }

    private computeTextLayout(label: string, nodeSize: number, isOusideNode: boolean = false): [number, string] {
        const base = nodeSize * 0.9
        // Allow wider strings when text is outside the node
        const maxWidth = isOusideNode ? base * 5 : base * 2
        // Scale font to node size, ensuring readability with 12px
        const fontSize = Math.max(12, base * 0.5)
 
        // Approximate width: ~0.55em per character
        const charWidth = fontSize * 0.55
        const maxChars = Math.floor(maxWidth / charWidth) - 1

        if (label.length > maxChars && label.length > 7) {
            // Since text is too long, add ellipsis
            const charsToKeep = Math.max(6, maxWidth / charWidth) - 1 // Reserve 1 space for "…"

            const tailChars = 3
            const headChars = charsToKeep - tailChars
            label = label.slice(0, headChars) + '…' + label.slice(label.length - tailChars)
        }

        return [fontSize, label]
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private addExpandCollapseIcons(theNodeSelection: Selection<SVGGElement, Node, null, undefined>, _node: Node): void {
        const iconRadius = 8      // radius of the small circle
        const padding = 2         // distance from node bounds

        const toggleExpand = (node: Node, expand: boolean) => {
            if (this.graph.UIManager.tooltip) this.graph.UIManager.tooltip.hide(node)
            this.graph.toggleExpandNode(node)
            if (!expand) { // reheating the simulation is done after the opening transition completes
                this.graph.simulation.reheat(0.05)
                this.graph.renderer.fitAndCenter()
            }
        }

        // Ensure we have a group to contain icons
        theNodeSelection.each((node, i, nodes) => {
            const group = d3Select<SVGGElement, Node>(nodes[i])

            // Remove existing icons if any
            group.selectAll<SVGGElement, unknown>(':scope > .node-icon').remove()

            const offset = (node.getCircleRadius() + padding) / Math.sqrt(2)

            const svgG = group.append('g')
                .classed('node-icon', true)
                .classed(!node.expanded ? 'expand-icon' : 'collapse-icon', true)
                .attr('transform', !node.expanded ? `translate(${offset}, ${-(offset)})` : `translate(${offset}, ${offset})`)
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
        const padding = 2         // distance from node bounds
        const offset = (clusterRadius + padding) / Math.sqrt(2)

        // Get the main node element (whatever shape it is: circle, rect, path, etc.)
        const origNode = node.getGraphElement()?.querySelector('& > .node')
        if (origNode) {
            d3Select(origNode)
                .transition()
                .duration(250)
                .on('end', () => {
                    graph.renderer.fitAndCenter()
                })
                .attr('transform', `translate(${-offset}, ${-offset})`)
        }

        // Reposition the expand/collapse icon
        const origIcons: SVGGElement | undefined | null = node.getGraphElement()?.querySelector('& > .node-icon')
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
