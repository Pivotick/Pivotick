import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import { createHtmlTemplate } from '../../../utils/ElementCreation'
import type { UIElement, UIManager } from '../../UIManager'
import './sidebar.scss'
import { SidebarMainHeader } from './MainHeader'
import { SidebarProperties } from './Properties'
import type { EdgeSelection, NodeSelection } from '../../../GraphInteractions'

export class Sidebar implements UIElement {
    private uiManager: UIManager

    public sidebar?: HTMLDivElement

    private sidebarMainHeader: SidebarMainHeader
    private sidebarProperties: SidebarProperties
    
    private mainHeaderPanel?: HTMLDivElement
    private mainBodyPanel?: HTMLDivElement

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.sidebarMainHeader = new SidebarMainHeader(this.uiManager)
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
        this.sidebarMainHeader.destroy()
        this.sidebarProperties.destroy()

        this.sidebar?.remove()
        this.sidebar = undefined
    }

    public afterMount() {
        if (!this.sidebar) return
        this.mainHeaderPanel = this.sidebar.querySelector('.pivotick-mainheader-panel') ?? undefined
        this.sidebarMainHeader.mount(this.mainHeaderPanel)
        this.mainBodyPanel = this.sidebar.querySelector('.pivotick-properties-panel') ?? undefined
        this.sidebarProperties.mount(this.mainBodyPanel)

        this.sidebarMainHeader.afterMount()
        this.sidebarProperties.afterMount()
    }

    public graphReady() {
        /* Single selection */
        this.uiManager.graph.renderer.getGraphInteraction().on('selectNode', (node: Node, element: unknown) => {
            this.sidebarMainHeader.updateNodeOverview(node, element)
            this.sidebarProperties.updateNodeProperties(node)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectNode', () => {
            this.sidebarMainHeader.clearOverview()
            this.sidebarProperties.clearProperties()
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('selectEdge', (edge: Edge) => {
            this.sidebarMainHeader.updateEdgeOverview(edge)
            this.sidebarProperties.updateEdgeProperties(edge)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectEdge', () => {
            this.sidebarMainHeader.clearOverview()
            this.sidebarProperties.clearProperties()
        })

        /* Multi selection */
        this.uiManager.graph.renderer.getGraphInteraction().on('selectNodes', (nodes: NodeSelection<unknown>[]) => {
            this.sidebarMainHeader.updateNodesOverview(nodes)
            this.sidebarProperties.updateNodesProperties(nodes)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectNodes', () => {
            this.sidebarMainHeader.clearOverview()
            this.sidebarProperties.clearProperties()
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('selectEdges', (edges: EdgeSelection<unknown>[]) => {
            this.sidebarMainHeader.updateEdgesOverview(edges)
            this.sidebarProperties.updateEdgesProperties(edges)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectEdges', () => {
            this.sidebarMainHeader.clearOverview()
            this.sidebarProperties.clearProperties()
        })
    }
}