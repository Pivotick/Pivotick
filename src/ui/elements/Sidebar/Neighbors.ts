import { createHtmlElement, createHtmlTemplate } from '../../../utils/ElementCreation'
import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { UIElement, UIManager } from '../../UIManager'
import './properties.scss'
import type { EdgeSelection, NodeSelection } from '../../../interfaces/GraphInteractions'
import { tryResolveHTMLElement } from '../../../utils/Getters'
import { createTabs } from '../../components/Tabs'
import type { GraphData, GraphOptions, RawEdge, RawNode, RelaxedGraphData } from '../../../interfaces/GraphOptions'
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

        this.header.style.display = 'block'

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
    public updateNodeNeighbors(node: Node): void {
        if (!this.egographContainer) return

        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(node)
            return
        }

        // const egoGraphData: GraphData = {
        //     nodes: [
        //         node.clone(),
        //         ...node.getConnectedNodes().map((node) => {
        //             const n = node.clone()
        //             delete n.fx
        //             delete n.fy
        //             delete n.x
        //             delete n.y
        //             delete n.vx
        //             delete n.vy
        //             return n
        //         }),
        //         ...node.getConnectingNodes().map((node) => {
        //             const n = node.clone()
        //             delete n.fx
        //             delete n.fy
        //             delete n.x
        //             delete n.y
        //             delete n.vx
        //             delete n.vy
        //             return n
        //         }),
        //     ],
        //     edges: [
        //         ...node.getEdgesOut().map((e) => e.clone()),
        //         ...node.getEdgesIn().map((e) => e.clone()),
        //     ]
        // }
        const egoGraphData: RelaxedGraphData = {
            nodes: [
                node.toDict(true) as RawNode,
                ...node.getConnectedNodes().map((node) => node.toDict(true) as RawNode),
                ...node.getConnectingNodes().map((node) => node.toDict(true) as RawNode),
            ],
            edges: [
                ...node.getEdgesOut().map((e) => e.toDict() as RawEdge),
                ...node.getEdgesIn().map((e) => e.toDict() as RawEdge),
            ]
        }
        const egoGraphOptions: GraphOptions = {
            UI: {
                mode: 'viewer',
                tooltip: {
                    enabled: false,
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
                radialGap: 100,
                rootId: node.id,
            },
            render: {
                ...this.uiManager.graph.getOptions().render,
                dragEnabled: false,
                zoomEnabled: false,
            },
            simulation: {
                useWorker: false,
            },
        }

        const egoGraph = new Graph(this.egographContainer, egoGraphData, egoGraphOptions)
        // egoGraph.selectElement(egoGraphData.nodes[0])
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
