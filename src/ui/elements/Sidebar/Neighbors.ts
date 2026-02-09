import { createHtmlElement, createHtmlTemplate } from '../../../utils/ElementCreation'
import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { UIElement, UIManager } from '../../UIManager'
import './properties.scss'
import type { EdgeSelection, NodeSelection } from '../../../interfaces/GraphInteractions'
import { tryResolveHTMLElement } from '../../../utils/Getters'
import { createTabs } from '../../components/Tabs'
import type { GraphOptions, RawEdge, RawNode, RelaxedGraphData } from '../../../interfaces/GraphOptions'
import { Graph } from '../../../Graph'


export class SidebarNeighbors implements UIElement {
    private uiManager: UIManager

    private panel?: HTMLDivElement
    private header?: HTMLDivElement
    private body?: HTMLDivElement

    private egographContainer?: HTMLDivElement
    private statContainer?: HTMLDivElement
    private listContainer?: HTMLDivElement

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

        rootContainer.appendChild(this.panel)

        this.egographContainer = createHtmlElement('div', {}, ['Egograph here'])
        this.statContainer = createHtmlElement('div', {}, ['Stats here'])
        this.listContainer = createHtmlElement('div', {}, ['List here'])

        const tabContainer: HTMLDivElement = createTabs([
                {
                    id: 'egograph',
                    label: 'Graph',
                    content: this.egographContainer,
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
        if (!this.egographContainer) return

        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(egoNode)
            return
        }

        this.egographContainer.style.visibility = 'hidden'

        // Might contain duplicates
        const connectedNodes = new Map<string, Node>()
        for (const node of [
            egoNode,
            ...egoNode.getConnectedNodes(),
            ...egoNode.getConnectingNodes(),
        ]) {
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


        const egoGraphData: RelaxedGraphData = {
            nodes: [...connectedNodes.values()].map((n) => n.toDict(true) as RawNode),
            edges: [...egoEdges.values()].map(e => e.toDict() as RawEdge)
        }
        const egoGraphOptions: GraphOptions = {
            UI: {
                mode: 'viewer',
                tooltip: {
                    enabled: true,
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
                interactionEnabled: true,
                zoomEnabled: false,
                zoomAnimationDuration: 100,
            },
            simulation: {
                useWorker: false,
                warmupTicks: 0,
                cooldownTime: 0,
            },
        }

        const egoGraph = new Graph(this.egographContainer, egoGraphData, egoGraphOptions)
        egoGraph.on('ready', () => {
            setTimeout(() => {
                this.egographContainer!.style.visibility = 'visible'
            }, 20)
            egoGraph.selectElement(egoGraph.getMutableNode(egoNode.id)!)
        })
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

        if (this.renderCb) {
            this.renderCustomContent(nodes.map((nodeS: NodeSelection<unknown>) => nodeS.node))
            return
        }
    }

    public updateEdgesNeighbors(edges: EdgeSelection<unknown>[]): void {
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(edges.map((nodeS: EdgeSelection<unknown>) => nodeS.edge))
            return
        }
    }

}
