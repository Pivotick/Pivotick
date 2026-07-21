import { createHtmlElement, createHtmlTemplate, createIcon } from '../../../utils/ElementCreation'
import { Node, type NodeData } from '../../../Node'
import { Edge } from '../../../Edge'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import './properties.scss'
import type { EdgeSelection, NodeSelection } from '../../../interfaces/GraphInteractions'
import { tryResolveHTMLElement } from '../../../utils/Getters'
import { createTabs } from '../../components/Tabs'
import type { GraphOptions, RawEdge, RawNode, RelaxedGraphData } from '../../../interfaces/GraphOptions'
import { Graph } from '../../../Graph'
import { edgeNameGetter, nodeNameGetter } from '../../../utils/GraphGetters'
import { arrowLeft, arrowRight, dash, edgeIncoming, edgeOutgoing, filterAdd, filterRemove, graphMultiSelectNode } from '../../icons'
import { createTableForAggregatedProperties } from '../../../utils/ElementCreationAggregatedProperties'
import type { NodeStyle } from '../../../interfaces/RendererOptions'
import { createNodePreview } from '../../../utils/NodePreview'


export class SidebarNeighbors extends UIComponent {

    // Cap the neighbour graph: a very high-degree node otherwise builds an ego
    // graph of thousands of SVG elements that re-lays-out on every main-graph
    // frame (drag/zoom), dominating frame time. Stats/List tabs still show all.
    private static readonly MAX_EGO_NEIGHBORS = 50

    private panel?: HTMLDivElement
    private header?: HTMLDivElement
    private body?: HTMLDivElement
    private neighborCount?: HTMLDivElement

    private egographContainer?: HTMLDivElement
    private statContainer?: HTMLDivElement
    private listContainer?: HTMLDivElement
    private tabContainer?: HTMLDivElement

    private egoGraph?: Graph

    private renderCb?: ((element: Node | Edge | Node[] | Edge[] | null) => HTMLElement | string) | HTMLElement | string

    constructor(uiManager: UIManager) {
        super(uiManager)
        this.renderCb = typeof this.uiManager.getOptions().neighborsPanel.render === 'function' ? this.uiManager.getOptions().neighborsPanel.render : undefined
    }

    protected onMount(rootContainer: HTMLElement | undefined) {
        if (!rootContainer) return

        const template = `
<div class="enter-ready">
    <div class="pvt-neighbors-header-panel pvt-sidebar-header-panel"></div>
    <div class="pvt-neighbors-body-panel pvt-sidebar-body-panel"></div>
</div>`
        this.panel = createHtmlTemplate(template) as HTMLDivElement
        this.header = this.panel.querySelector('.pvt-neighbors-header-panel') as HTMLDivElement
        this.body = this.panel.querySelector('.pvt-neighbors-body-panel') as HTMLDivElement
        this.neighborCount = createHtmlElement('div', { class: 'pvt-neighbors-count' })

        rootContainer.appendChild(this.panel)

        this.egographContainer = createHtmlElement('div', {class: 'main-egograph-container'}, ['Egograph here'])
        this.statContainer = createHtmlElement('div', {class: 'main-stats-container'}, ['Stats here'])
        this.listContainer = createHtmlElement('div', {class: 'main-list-container'}, ['List here'])

        this.tabContainer = createTabs([
                {
                    id: 'egograph',
                    label: 'Neighbor Graph',
                    content: this.egographContainer,
                    onShown: () => {
                        requestAnimationFrame(async () => {
                            if (this.egoGraph) {
                                await this.egoGraph.simulation.start()
                                await this.egoGraph.simulation.waitForSimulationStop()
                                this.egoGraph.renderer.fitAndCenter()
                            }
                        })
                    }
                },
                {
                    id: 'stats',
                    label: 'Stats',
                    content: this.statContainer,
                },
                {
                    id: 'list',
                    label: 'List',
                    content: this.listContainer,
                },
            ],
            undefined,
            this.body,
            this.header
        )

        this.body.insertBefore(this.neighborCount, this.body.firstChild)
    }

    protected onDestroy() {
        // Tear down the nested ego graph (its own UIManager/renderer) too.
        this.egoGraph?.destroy()
        this.egoGraph = undefined
        this.panel?.remove()
        this.panel = undefined
    }

    protected onAfterMount() {
        this.clearNeighbors()
    }

    public clearNeighbors(): void {
        if (!this.body) return

        if (this.renderCb) {
            this.renderCustomContent(null)
            return
        }

        if (this.renderCb) {
            this.body.innerHTML = ''
        } else {
            if (this.egographContainer && this.statContainer && this.listContainer) {
                this.egographContainer.innerHTML = ''
                this.statContainer.innerHTML = ''
                this.listContainer.innerHTML = ''
            }
        }
        this.hidePanel()
    }

    protected onGraphReady(): void { }

    private renderCustomContent(element: Node | Edge | Node[] | Edge[] | null) {
        if (!this.body || !this.renderCb) return

        this.body.innerHTML = ''
        const content = tryResolveHTMLElement(this.renderCb, element)
        if (content) {
            this.body?.appendChild(content)
        }
    }

    private showPanel() {
        this.panel!.classList.add('enter-active')
    }

    private hidePanel() {
        this.panel!.classList.remove('enter-active')
    }

    /* Single selection */
    public updateNodeNeighbors(egoNode: Node): void {
        this.showPanel()

        if (!this.neighborCount) return

        if (this.renderCb) {
            this.renderCustomContent(egoNode)
            return
        }

        this.buildEgoGraph(egoNode)
        this.buildList(egoNode)
        this.buildStats(egoNode)

        const connectionCount = egoNode.degree()
        const connectionCountText = connectionCount > 1 ? `${connectionCount} connections` : '1 connection'
        this.neighborCount.textContent = connectionCountText
    }

    public updateEdgeNeighbors(edge: Edge): void {
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(edge)
            return
        }
    }


    /* Multiple selection */
    public updateNodesNeighbors(nodes: NodeSelection<unknown>[]): void {
        this.showPanel()

        if (!this.neighborCount) return

        if (this.renderCb) {
            this.renderCustomContent(nodes.map((nodeS: NodeSelection<unknown>) => nodeS.node))
            return
        }

        if (nodes.length <= 1) return

        const egoNode = this.mergeNodesIntoNode(nodes.map(n => n.node))
        this.buildEgoGraph(egoNode, false)
        this.buildList(egoNode)
        this.buildStats(egoNode)

        const connectionCount = egoNode.degree()
        const connectionCountText = connectionCount > 1 ? `${connectionCount} connections` : '1 connection'
        this.neighborCount.textContent = connectionCountText
    }

    public updateEdgesNeighbors(edges: EdgeSelection<unknown>[]): void {
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(edges.map((nodeS: EdgeSelection<unknown>) => nodeS.edge))
            return
        }
    }

    private buildEgoGraph(egoNode: Node, selectEgoNode: boolean = true): void {
        if (!this.egographContainer) return

        this.egographContainer.innerHTML = ''
        if (this.egoGraph) this.egoGraph.destroy()

        this.egographContainer.style.visibility = 'hidden'

        // Might contain duplicates
        const connectedNodes = new Map<string, Node>()
        for (const node of [
            egoNode,
            ...egoNode.getConnectedNodes(),
            ...egoNode.getConnectingNodes(),
        ]) {
            // if (node.parentNode && node.parentNode.id === egoNode.id) { // Ignore nested children
            //     continue
            // }
            connectedNodes.set(node.id.toString(), node)
        }

        const connectedEdges = [
            ...egoNode.getEdgesOut(),
            ...egoNode.getEdgesIn(),
        ]
        const egoEdges = new Map<string, Edge>()
        connectedEdges.forEach((edge) => {
            if (!edge || edge.id == null) return
            egoEdges.set(edge.id.toString(), edge)
        })
        connectedNodes.forEach((cNode) => {
            cNode.getEdgesOut().forEach((edge) => {
                const targetNode: Node = edge.to
                if (connectedNodes.has(targetNode.id.toString()) && targetNode.id !== egoNode.id) {
                    egoEdges.set(edge.id.toString(), edge)
                }
            })
        })

        const test = [...connectedNodes.values()].filter((n) => {
            // n is always the orginialObject thanks to event propagation in cluster nodes
            if (n.getDeepestNodeClone() === undefined) { // not in a cluster
                return true
            }
            return n.getDeepestNodeClone()?.visible ?? false
        })

        // Cap the neighbourhood: keep the ego node plus up to MAX_EGO_NEIGHBORS
        // neighbours (in natural order, so a smaller neighbourhood is unchanged)
        // and fold the remainder into a single "+N more" summary node, so a hub
        // node doesn't produce a huge, reflow-heavy ego graph. The Stats and List
        // tabs still report every connection.
        const egoIdStr = egoNode.id.toString()
        const visibleNeighbors = test.filter((n) => n.id.toString() !== egoIdStr)
        const keptNeighbors = visibleNeighbors.slice(0, SidebarNeighbors.MAX_EGO_NEIGHBORS)
        const hiddenCount = visibleNeighbors.length - keptNeighbors.length
        const keptIds = new Set<string>([egoIdStr, ...keptNeighbors.map((n) => n.id.toString())])

        const egoNodes: RawNode[] = [egoNode, ...keptNeighbors].map((n) => n.toDict(true) as RawNode)
        const egoEdgeList: RawEdge[] = [...egoEdges.values()]
            .filter((e) => keptIds.has(e.from.id.toString()) && keptIds.has(e.to.id.toString()))
            .map((e) => e.toDict() as RawEdge)

        if (hiddenCount > 0) {
            // Reuse the multi-selection aggregate look ("+N Group") for the overflow node.
            const moreId = `__ego_more__${egoIdStr}`
            const moreNode = new Node(moreId, { label: `${hiddenCount} more`, aggregated_node_count: hiddenCount }, this.aggregatedNodeStyle())
            moreNode.weight = 10
            egoNodes.push(moreNode.toDict(true) as RawNode)
            egoEdgeList.push({ id: `${moreId}__edge`, from: egoIdStr, to: moreId, data: {} })
        }

        // TODO: If cluster node is expanded, also expand it in the ego graph
        const egoGraphData: RelaxedGraphData = {
            nodes: egoNodes,
            edges: egoEdgeList,
        }
        
        const egoGraphOptions: GraphOptions = {
            isDirected: this.uiManager.graph.getOptions().isDirected,
            UI: {
                mode: 'viewer',
                tooltip: {
                    enabled: true,
                    allowPinning: false,
                    setPosition: (tooltip: HTMLElement, hoveredBCR: DOMRect, canvasBbox: DOMRect) => {
                        tooltip.style.left = `${canvasBbox.x+canvasBbox.width + 15}px`
                        tooltip.style.top = `${canvasBbox.y}px`
                    }
                },
                contextMenu: {
                    enabled: false,
                },
                navigation: {
                    enabled: false,
                }
            },
            layout: {
                type: 'egoTree',
                radial: true,
                radialGap: 120,
                rootId: egoNode.id,
            },
            render: {
                ...this.uiManager.graph.getOptions().render,
                dragEnabled: false,
                enableFocusMode: false,
                enableNodeExpansion: false,
                interactionEnabled: true,
                zoomEnabled: false,
                zoomAnimationDuration: 100,
            },
            simulation: {
                useWorker: false,
                warmupTicks: 0,
                cooldownTime: 0,
            },
            callbacks: {
                onNodeClick: (_evt, node) => {
                    const mainGraphNode = this.uiManager.graph.getMutableNode(node.id)
                    if (mainGraphNode){
                        if (this.uiManager.graph.renderer.getGraphInteraction().getSelectedNode()?.node != mainGraphNode) {
                            this.uiManager.graph.unHighlightElement(mainGraphNode)
                            this.egoGraph?.unHighlightElement(node)
                            this.uiManager.graph.selectElement(mainGraphNode)
                        }
                    }
                },
                onNodeHoverIn: (_evt, node) => {
                    const mainGraphNode = this.uiManager.graph.getMutableNode(node.id)
                    if (mainGraphNode) {
                        this.uiManager.graph.highlightElement(mainGraphNode)
                        this.egoGraph?.highlightElement(node)
                        this.egoGraph?.UIManager.tooltip?.nodeHovered(_evt, node)
                        
                    }
                },
                onNodeHoverOut: (_evt, node) => {
                    const mainGraphNode = this.uiManager.graph.getMutableNode(node.id)
                    if (mainGraphNode) {
                        this.uiManager.graph.unHighlightElement(mainGraphNode)
                        this.egoGraph?.unHighlightElement(node)
                    }
                },
            }
        }

        this.egoGraph = new Graph(this.egographContainer, egoGraphData, egoGraphOptions)
        this.egoGraph.on('ready', () => {
            setTimeout(() => {
                this.egographContainer!.style.visibility = 'visible'
            }, 20)
            if (selectEgoNode) {
                this.egoGraph!.selectElement(this.egoGraph!.getMutableNode(egoNode.id)!)
            }
        })

        // Overwrite the canvasclick so that clicking on the small canvas doesn't deselect the node 
        this.egoGraph.renderer.getGraphInteraction().canvasClick = () => {}
    }

    private buildList(node: Node) {
        if (!this.listContainer) return

        this.listContainer.innerHTML = ''

        const previewSize = 22
        const mainHeader = this.uiManager.getOptions().mainHeader

        const connectedEdges = [
            ...node.getEdgesOut(),
            ...node.getEdgesIn(),
        ]

        connectedEdges.sort((a, b) => {
            const aTarget = a.from.id === node.id ? a.to : a.from
            const bTarget = b.from.id === node.id ? b.to : b.from

            const aName = nodeNameGetter(aTarget, mainHeader)
            const bName = nodeNameGetter(bTarget, mainHeader)

            return aName.localeCompare(bName)
        })

        const container = createHtmlElement('div', { class: 'pvt-neighbor-list' })
        for (const edge of connectedEdges) {
            const isEdgeOut = edge.from.id === node.id
            const targetNode = isEdgeOut ? edge.to : edge.from
            const edgeName = edgeNameGetter(edge, mainHeader) || ''
            const isDirected = this.uiManager.graph.getOptions().isDirected || edge.directed

            const directionIcon = isDirected
                ? (isEdgeOut ? arrowRight : arrowLeft)
                : dash
            const directionClass = isDirected
                ? (isEdgeOut ? 'edge-out' : 'edge-in')
                : 'edge-undirected'
            const directionLabel = isDirected
                ? (isEdgeOut ? 'Outgoing connection' : 'Incoming connection')
                : 'Connection'
            const direction = createHtmlElement('span', {
                class: ['pvt-neighbor-row__dir', directionClass],
            }, [createIcon({ svgIcon: directionIcon })])

            const preview = createHtmlElement('span', { class: 'pvt-neighbor-row__preview' })
            preview.appendChild(createNodePreview(targetNode, { size: previewSize }))

            const targetNodeName = nodeNameGetter(targetNode, mainHeader)
            const name = createHtmlElement('span', { class: 'pvt-neighbor-row__name' }, [targetNodeName])

            const rowChildren: HTMLElement[] = [direction, preview, name]
            if (edgeName) {
                // Only real labels get a chip — unlabeled edges stay quiet rather
                // than each showing a loud "— empty —" pill.
                rowChildren.push(createHtmlElement('span', {
                    class: 'pvt-neighbor-row__label',
                    title: edgeName,
                }, [edgeName]))
            }

            const rowTitle = edgeName
                ? `${directionLabel} — ${targetNodeName} · ${edgeName}`
                : `${directionLabel} — ${targetNodeName}`
            const row = createHtmlElement('div', {
                'class': 'pvt-neighbor-row',
                'data-node-id': targetNode.id,
                'title': rowTitle,
            }, rowChildren)

            // Resolve back to the live main-graph node — in the merged multi-select
            // view `targetNode` is a clone, so look it up by id.
            const resolveMainNode = () => this.uiManager.graph.getMutableNode(targetNode.id)

            row.addEventListener('mouseenter', (evt) => {
                const mainGraphNode = resolveMainNode()
                if (!mainGraphNode) return
                this.uiManager.graph.highlightElement(mainGraphNode)
                this.egoGraph?.highlightElement(node)
                this.egoGraph?.UIManager.tooltip?.nodeHovered(evt, node)
            })
            row.addEventListener('mouseleave', () => {
                const mainGraphNode = resolveMainNode()
                if (!mainGraphNode) return
                this.uiManager.graph.unHighlightElement(mainGraphNode)
                this.egoGraph?.unHighlightElement(node)
            })
            // Click a row to walk to that neighbour: it becomes the selected node
            // and the panel rebuilds around it.
            row.addEventListener('click', () => {
                const mainGraphNode = resolveMainNode()
                if (!mainGraphNode) return
                this.uiManager.graph.unHighlightElement(mainGraphNode)
                this.uiManager.graph.selectElement(mainGraphNode)
            })

            container.appendChild(row)
        }

        this.listContainer.appendChild(container)
    }

    private buildStats(node: Node) {
        if (!this.statContainer) return

        this.statContainer.innerHTML = ''

        const dl = createHtmlElement('dl', { class: 'pvt-property-list' })
        const row = createHtmlElement('dl',
            {
                'class': 'pvt-property-row',
            },
            [
                createHtmlElement('dt', { class: 'pvt-property-name', title: 'Total connections', style: 'font-size: 1em;' }, ['Degree']),
                createHtmlElement('dd', { class: 'pvt-property-value', style: 'display: flex; align-items: center; font-size: 1em;' }, [
                    createHtmlElement('span', { style: 'margin-right: 8px;' }, [node.degree().toString()]),
                    createHtmlElement('span', {
                        style: 'display: inline-flex; align-items: center; margin-right: 8px; color: var(--pvt-text-color-secondary)',
                        title: 'Outgoing edges',
                    }, [createIcon({ svgIcon: edgeOutgoing }), node.getEdgesOut().length.toString()]),
                    createHtmlElement('span', {
                        style: 'display: inline-flex; align-items: center; color: var(--pvt-text-color-secondary)',
                        title: 'Incoming edges',
                    }, [createIcon({ svgIcon: edgeIncoming }), node.getEdgesIn().length.toString()]),
                ]),
            ]
        )
        dl.append(row)
        const coreStatContainer = createHtmlElement('div', {class: 'core-stats'}, [dl])

        const edgeNames: Map<string, number> = new Map()
        const connectedEdges = [
            ...node.getEdgesOut(),
            ...node.getEdgesIn(),
        ]
        connectedEdges.forEach((edge) => {
            const edgeName = edgeNameGetter(edge, this.uiManager.getOptions().mainHeader) || '' 
            const count = edgeNames.get(edgeName) || 0
            edgeNames.set(edgeName, count+1)
        })
        const aggregatedProperties: Map<string, Map<string, number>> = new Map()
        aggregatedProperties.set('Label', edgeNames)
        const aggregatedPropertiesDiv = createTableForAggregatedProperties(
            aggregatedProperties,
            node.degree(),
            this.genActionButtonsSingleSelection.bind(this),
            this.applyEdgeLabelFacetFilter.bind(this)
        )
        const aggregatedLabelContainer = createHtmlElement('div', { class: 'aggregated-labels' }, [aggregatedPropertiesDiv])

        this.statContainer.appendChild(coreStatContainer)
        this.statContainer.appendChild(aggregatedLabelContainer)
    }


    /**
     * Reselects the neighbours reached by a single edge label: `keep` selects the
     * nodes linked through that label, `exclude` selects those linked through any
     * other label. Shared by the row icons and by clicking a distribution bar /
     * value chip, mirroring the node-properties facet filter.
     */
    private applyEdgeLabelFacetFilter(_key: string, value: string, mode: 'keep' | 'exclude'): void {
        const matchingNodeSelection = this.getNodesMatchingFilteredEdgeName(value, mode === 'exclude')
        if (!matchingNodeSelection || matchingNodeSelection.length === 0) return

        const interaction = this.uiManager.graph.renderer.getGraphInteraction()
        interaction.clearNodeSelectionList()
        if (matchingNodeSelection.length > 1) {
            interaction.selectNodes(matchingNodeSelection)
        } else {
            interaction.selectNode(matchingNodeSelection[0].element, matchingNodeSelection[0].node)
        }
    }

    private genActionButtonsSingleSelection(key: string, value: string): HTMLDivElement {
        const buttonKeep = createHtmlElement('button', {
            title: 'Select nodes linked with this label',
            class: 'pvt-facet-action-select',
        }, [createIcon({ svgIcon: filterAdd }) ])
        buttonKeep.addEventListener('click', () => this.applyEdgeLabelFacetFilter(key, value, 'keep'))

        const buttonExclude = createHtmlElement('button', {
            title: 'Exclude nodes linked with this label',
            class: 'pvt-facet-action-exclude',
        }, [createIcon({ svgIcon: filterRemove }) ])
        buttonExclude.addEventListener('click', () => this.applyEdgeLabelFacetFilter(key, value, 'exclude'))

        const container = createHtmlElement('div', { class: 'pvt-aggregated-property-actions' }, [
            buttonKeep,
            buttonExclude
        ])
        return container
    }

    private getNodesMatchingFilteredEdgeName(edgeName: string, reversed: boolean = false): NodeSelection<unknown>[] | void {
        const egoSelection = this.uiManager.graph.renderer.getGraphInteraction().getSelectedNode()
        if (!egoSelection) return

        const egoNode = egoSelection.node
        const edges: Edge[] = [...egoNode.getEdgesOut(), ...egoNode.getEdgesIn()]
        const matchingNodes = new Map<string, Node>()
        edges
            .filter((edge) => {
                const currentEdgeName = edgeNameGetter(edge, this.uiManager.getOptions().mainHeader)
                return reversed ? currentEdgeName !== edgeName : currentEdgeName === edgeName
            })
            .forEach((edge) => {
                const otherNode = egoNode === edge.from ? edge.to : edge.from
                matchingNodes.set(otherNode.id.toString(), otherNode)
            })

        return [...matchingNodes.values()].map((n) => ({
            node: n,
            element: n.getGraphElement(),
        }))
    }

    /**
     * Style for an aggregate "+N Group" node: a transparent square carrying the
     * multi-select icon and a "+N" / "Group" badge, with the count read from the
     * node's `aggregated_node_count` data field. Shared by the multi-selection
     * merge and the capped ego graph's overflow node so both read identically.
     */
    private aggregatedNodeStyle(): Partial<NodeStyle> {
        return {
            size: 50,
            shape: 'square',
            color: 'transparent',
            strokeColor: 'transparent',
            html: (node: Node) => {
                const nodeData = node.getData() as { aggregated_node_count: number }
                const aggregatedCount = nodeData!.aggregated_node_count
                const icon = createIcon({ svgIcon: graphMultiSelectNode(28) })
                icon.style = 'position: absolute;'
                return createHtmlTemplate(`<div style="display: flex; flex-direction: column; position: relative; align-items: center;">
                    ${icon.outerHTML}
                    <div style="
    height: 65%;
    width: 65%;
    margin-top: 18%;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    background-color: var(--pvt-bg-color-5);">
                        <div style="height: auto; font-weight: 600; font-size: 1.5em;">+${aggregatedCount}</div>
                        <div style="height: auto;">Group</div>
                    </div>
                </div>`)
            }
        }
    }

    private mergeNodesIntoNode(nodes: Node[]): Node {
        const aggregatedNodeStyle: Partial<NodeStyle> = this.aggregatedNodeStyle()
        const aggregatedData: NodeData = { label: `${nodes.length} nodes`, aggregated_node_count: nodes.length }
        const aggregatedNodes = new Node('aggregated-node', aggregatedData, aggregatedNodeStyle)
        aggregatedNodes.weight = 10

        const nodeIds = new Set(nodes.map((n) => n.id.toString()))
        const edges: Edge[] = nodes.flatMap((node) => [
            ...node.getEdgesOut(),
            ...node.getEdgesIn(),
        ])

        const outgoing = []
        const incoming = []

        for (const edge of edges) {
            const fromIn = nodeIds.has(edge.from.id)
            const toIn = nodeIds.has(edge.to.id)

            if (fromIn !== toIn) {
                if (fromIn) {
                    outgoing.push(edge)
                } else {
                    incoming.push(edge)
                }
            }
        }

        outgoing.forEach((e, i) => {
            const toNode = e.to.clone()
            new Edge(`outgoing-${i}`, aggregatedNodes, toNode, e.getData(), e.getStyle())
        })

        incoming.forEach((e, i) => {
            const fromNode = e.from.clone()
            new Edge(`incoming-${i}`, fromNode, aggregatedNodes, e.getData(), e.getStyle())
        })

        return aggregatedNodes
    }

}
