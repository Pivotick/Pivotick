import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import { createHtmlTemplate } from '../../../utils/ElementCreation'
import type { UIElement, UIManager } from '../../UIManager'
import './sidebar.scss'
import { injectNodeOverview, injectEdgeOverview, clearHeader, injectNodesOverview, injectEdgesOverview } from './MainHeader'
import { SidebarProperties } from './Properties'
import type { EdgeSelection, NodeSelection } from '../../../GraphInteractions'

export class Sidebar implements UIElement {
    private uiManager: UIManager

    public sidebar?: HTMLDivElement

    private sidebarProperties: SidebarProperties
    
    private mainHeaderPanel?: HTMLDivElement
    private mainBodyPanel?: HTMLDivElement

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.sidebarProperties = new SidebarProperties(this.uiManager)
    }

    public mount(container: HTMLElement | undefined) {
        if (!container) return

        const template = `
  <div class="pivotick-sidebar">
    <div class="pivotick-mainheader-panel"></div>
    <div class="pivotick-properties-panel"></div>
</div>

  </div>`
        this.sidebar = createHtmlTemplate(template) as HTMLDivElement

        /** Other Panels */

        container.appendChild(this.sidebar)
    }

    public destroy() {
        this.sidebar?.remove()
        this.sidebar = undefined
    }

    public afterMount() {
        if (!this.sidebar) return
        this.mainHeaderPanel = this.sidebar.querySelector('.pivotick-mainheader-panel') ?? undefined
        clearHeader(this.mainHeaderPanel)
        this.mainBodyPanel = this.sidebar.querySelector('.pivotick-properties-panel') ?? undefined
        this.sidebarProperties.mount(this.mainBodyPanel)
    }

    public graphReady() {
        /* Single selection */
        this.uiManager.graph.renderer.getGraphInteraction().on('selectNode', (node: Node, element: unknown) => {
            injectNodeOverview(this.mainHeaderPanel, node, element, this.uiManager.getOptions())
            this.sidebarProperties.updateNodeProperties(node)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectNode', () => {
            clearHeader(this.mainHeaderPanel)
            this.sidebarProperties.clearProperties()
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('selectEdge', (edge: Edge, element: unknown) => {
            injectEdgeOverview(this.mainHeaderPanel, edge, element, this.uiManager.getOptions())
            this.sidebarProperties.updateEdgeProperties(edge)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectEdge', () => {
            clearHeader(this.mainHeaderPanel)
            this.sidebarProperties.clearProperties()
        })

        /* Multi selection */
        this.uiManager.graph.renderer.getGraphInteraction().on('selectNodes', (nodes: NodeSelection<unknown>[]) => {
            injectNodesOverview(this.mainHeaderPanel, nodes, this.uiManager.getOptions(), this.uiManager.graph.getNodeCount())
            this.sidebarProperties.updateNodesProperties(nodes)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectNodes', () => {
            clearHeader(this.mainHeaderPanel)
            this.sidebarProperties.clearProperties()
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('selectEdges', (edges: EdgeSelection<unknown>[]) => {
            injectEdgesOverview(this.mainHeaderPanel, edges, this.uiManager.getOptions())
            this.sidebarProperties.updateEdgesProperties(edges)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectEdges', () => {
            clearHeader(this.mainHeaderPanel)
            this.sidebarProperties.clearProperties()
        })
    }
}