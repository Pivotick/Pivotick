import { createHtmlElement, createHtmlTemplate, createIcon } from '../../../utils/ElementCreation'
import { Node, type NodeData } from '../../../Node'
import { Edge } from '../../../Edge'
import type { UIElement, UIManager } from '../../UIManager'
import './properties.scss'
import type { EdgeSelection, NodeSelection } from '../../../interfaces/GraphInteractions'
import { tryResolveHTMLElement } from '../../../utils/Getters'
import { createTabs } from '../../components/Tabs'
import type { GraphOptions, RawEdge, RawNode, RelaxedGraphData } from '../../../interfaces/GraphOptions'
import { Graph } from '../../../Graph'
import { edgeNameGetter, nodeNameGetter } from '../../../utils/GraphGetters'
import { arrowLeft, arrowRight, edgeIncoming, edgeOutgoing, filterAdd, filterRemove, graphMultiSelectNode } from '../../icons'
import { createBadge } from '../../components/Badge'
import { createTableForAggregatedProperties } from '../../../utils/ElementCreationAggregatedProperties'
import type { NodeStyle } from '../../../interfaces/RendererOptions'


export class SidebarNeighbors implements UIElement {
    private uiManager: UIManager

    private panel?: HTMLDivElement
    private header?: HTMLDivElement
    private body?: HTMLDivElement
    private neighborCount?: HTMLDivElement

    private egographContainer?: HTMLDivElement
    private statContainer?: HTMLDivElement
    private listContainer?: HTMLDivElement

    private egoGraph?: Graph

    private renderCb?: ((element: Node | Edge | Node[] | Edge[] | null) => HTMLElement | string) | HTMLElement | string

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.renderCb = typeof this.uiManager.getOptions().neighborsPanel.render === 'function' ? this.uiManager.getOptions().neighborsPanel.render : undefined
    }

    public mount(rootContainer: HTMLElement | undefined) {
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

        const tabContainer: HTMLDivElement = createTabs([
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

        tabContainer.style.height = '100%'

        this.body.appendChild(this.neighborCount)
    }

    public destroy() {
        this.panel?.remove()
        this.panel = undefined
    }

    public afterMount() {
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

    public graphReady(): void { }

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
            // n is always the main graph node thanks to event propagation in cluster nodes
            if (n.getSubgraphClone() === undefined) { // not in a cluster
                return true
            }
            return n.getSubgraphClone()?.visible ?? false
        })

        // TODO: If cluster node is expanded, also expand it in the ego graph
        const egoGraphData: RelaxedGraphData = {
            nodes: test.map((n) => n.toDict(true) as RawNode),
            edges: [...egoEdges.values()].map(e => e.toDict() as RawEdge)
        }
        
        const egoGraphOptions: GraphOptions = {
            UI: {
                mode: 'viewer',
                tooltip: {
                    enabled: false,
                    allowPinning: false,
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
                onNodeHoverIn: (_evt, node) => {
                    const mainGraphNode = this.uiManager.graph.getMutableNode(node.id)
                    if (mainGraphNode) {
                        this.uiManager.graph.highlightElement(mainGraphNode)
                    }
                },
                onNodeHoverOut: (_evt, node) => {
                    const mainGraphNode = this.uiManager.graph.getMutableNode(node.id)
                    if (mainGraphNode) {
                        this.uiManager.graph.unHighlightElement(mainGraphNode)
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
    }

    private buildList(node: Node) {
        if (!this.listContainer) return

        this.listContainer.innerHTML = ''

        const fixedPreviewSize = 26

        const connectedEdges = [
            ...node.getEdgesOut(),
            ...node.getEdgesIn(),
        ]

        connectedEdges.sort((a, b) => {
            const aTarget = a.from.id === node.id ? a.to : a.from
            const bTarget = b.from.id === node.id ? b.to : b.from

            const aName = nodeNameGetter(aTarget, this.uiManager.getOptions().mainHeader)
            const bName = nodeNameGetter(bTarget, this.uiManager.getOptions().mainHeader)

            return aName.localeCompare(bName)
        })

        const container = createHtmlElement('div', { class: '' })
        for (const edge of connectedEdges) {
            const isEdgeOut = edge.from.id === node.id
            const targetNode = isEdgeOut ? edge.to : edge.from
            const edgeName = edgeNameGetter(edge, this.uiManager.getOptions().mainHeader) || '' 

            const edgeIcon = isEdgeOut ? createIcon({svgIcon: arrowRight}) : createIcon({svgIcon: arrowLeft})
            edgeIcon.classList.add('edge')
            edgeIcon.classList.add(isEdgeOut ? 'edge-out' : 'edge-in')
            edgeIcon.setAttribute('title', isEdgeOut ? 'Outgoing edge' : 'Incoming edge')

            const targetNodeName = nodeNameGetter(targetNode, this.uiManager.getOptions().mainHeader)
            const targetNodeTemplate = document.createElement('template')
            targetNodeTemplate.innerHTML = `
            <div class="pvt-neighbors-list__nodecontainer">
                <span class="pvt-neighbors-list__nodepreview">
                    <svg class="pvt-mainheader-icon" width="${fixedPreviewSize}" height="${fixedPreviewSize}" viewBox="0 0 ${fixedPreviewSize} ${fixedPreviewSize}" preserveAspectRatio="xMidYMid meet"></svg>
                </span>
                ${targetNodeName}
            </div>`

            const targetNodeDiv = targetNodeTemplate.content.firstElementChild as HTMLDivElement
            const targetNodePreview = targetNodeDiv.querySelector('.pvt-neighbors-list__nodepreview .pvt-mainheader-icon') ?? undefined
            const nodeElement = targetNode.getGraphElement()
            if (targetNodePreview && nodeElement && nodeElement instanceof SVGGElement) {
                const clonedGroup = nodeElement.cloneNode(true) as SVGGElement
                const bbox = nodeElement.getBBox()
                const scale = fixedPreviewSize / Math.max(bbox.width, bbox.height)
                clonedGroup.setAttribute(
                    'transform',
                    `translate(${(fixedPreviewSize - bbox.width * scale) / 2 - bbox.x * scale}, ${(fixedPreviewSize - bbox.height * scale) / 2 - bbox.y * scale}) scale(${scale})`
                )
                targetNodePreview.appendChild(clonedGroup)
            }

            const fullEdgeDesc = createBadge({
                text: edgeName ? edgeName : '- empty -',
                size: 'sm',
                variant: 'secondary',
                class: ['pvt-neighbor-edge-description', edgeName ? edgeName : 'empty-label'],
            })

            const elements = [
                edgeIcon,
                targetNodeDiv,
                fullEdgeDesc,
            ]

            const row = createHtmlElement('div',
                {
                    'class': 'edge-details',
                },
                elements
            )
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
        const aggregatedPropertiesDiv = createTableForAggregatedProperties(aggregatedProperties, node.degree(), this.genActionButtonsSingleSelection.bind(this))
        const aggregatedLabelContainer = createHtmlElement('div', { class: 'aggregated-labels' }, [aggregatedPropertiesDiv])

        this.statContainer.appendChild(coreStatContainer)
        this.statContainer.appendChild(aggregatedLabelContainer)
    }


    private genActionButtonsSingleSelection(_key: string, value: string): HTMLDivElement {
        const buttonKeep = createHtmlElement('button', {
            title: 'Select nodes linked with this label',
        }, [createIcon({ svgIcon: filterAdd }) ])
        buttonKeep.addEventListener('click', () => {
            const matchingNodeSelection = this.getNodesMatchingFilteredEdgeName(value)
            if (!matchingNodeSelection) return

            this.uiManager.graph.renderer.getGraphInteraction().clearNodeSelectionList()
            if (matchingNodeSelection.length > 1) {
                this.uiManager.graph.renderer.getGraphInteraction().selectNodes(matchingNodeSelection)
            } else {
                this.uiManager.graph.renderer.getGraphInteraction().selectNode(matchingNodeSelection[0].element, matchingNodeSelection[0].node)
            }
        })
        
        const buttonExclude = createHtmlElement('button', {
            title: 'Exclude nodes linked with this label',
        }, [createIcon({ svgIcon: filterRemove }) ])
        buttonExclude.addEventListener('click', () => {
            const matchingNodeSelection = this.getNodesMatchingFilteredEdgeName(value, true)
            if (!matchingNodeSelection) return

            this.uiManager.graph.renderer.getGraphInteraction().clearNodeSelectionList()
            if (matchingNodeSelection.length > 1) {
                this.uiManager.graph.renderer.getGraphInteraction().selectNodes(matchingNodeSelection)
            } else {
                this.uiManager.graph.renderer.getGraphInteraction().selectNode(matchingNodeSelection[0].element, matchingNodeSelection[0].node)
            }
        })

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

    private mergeNodesIntoNode(nodes: Node[]): Node {
        const aggregatedNodeStyle: Partial<NodeStyle> = {
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
