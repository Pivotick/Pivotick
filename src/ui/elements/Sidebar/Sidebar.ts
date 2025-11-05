import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import { createHtmlElement, createHtmlTemplate, createIcon } from '../../../utils/ElementCreation'
import type { UIElement, UIManager } from '../../UIManager'
import './sidebar.scss'
import { SidebarMainHeader } from './MainHeader'
import { SidebarProperties } from './Properties'
import type { EdgeSelection, NodeSelection } from '../../../GraphInteractions'
import { ExtraPanelManager } from './ExtraPanelManager'
import { sidebarCollapse, sidebarExpand } from '../../icons'

export class Sidebar implements UIElement {
    private uiManager: UIManager

    public sidebar?: HTMLDivElement

    private sidebarOpen: boolean = true

    private sidebarMainHeader: SidebarMainHeader
    private sidebarProperties: SidebarProperties
    private extraPanelManager: ExtraPanelManager
    
    private mainHeaderPanel?: HTMLDivElement
    private mainBodyPanel?: HTMLDivElement
    private extraPanelContainer?: HTMLDivElement
    private collapse?: HTMLSpanElement

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.sidebarMainHeader = new SidebarMainHeader(this.uiManager)
        this.sidebarProperties = new SidebarProperties(this.uiManager)
        this.extraPanelManager = new ExtraPanelManager(this.uiManager)
    }

    public mount(container: HTMLElement | undefined) {
        if (!container) return

        const template = `
<div class="pivotick-sidebar">
    <div class="pivotick-mainheader-panel"></div>
    <div class="pivotick-properties-panel pivotick-sidebar-panel"></div>
    <div class="pivotick-extra-panel pivotick-sidebar-panel"></div>
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
        this.extraPanelContainer = this.sidebar.querySelector('.pivotick-extra-panel') ?? undefined
        this.extraPanelManager.mount(this.extraPanelContainer)

        this.collapse = createHtmlElement('span', { class: 'pivotick-sidebar-collapse-container' }, [
            createHtmlElement('span', { class: 'pivotick-sidebar-collapse-button pivotick-sidebar-collapse-button-collapse' }, [createIcon({ svgIcon: sidebarCollapse })]) as HTMLSpanElement,
            createHtmlElement('span', { class: 'pivotick-sidebar-collapse-button pivotick-sidebar-collapse-button-expand' }, [createIcon({ svgIcon: sidebarExpand })]) as HTMLSpanElement,
        ]) as HTMLSpanElement
        this.sidebar.parentElement!.appendChild(this.collapse)

        this.sidebarMainHeader.afterMount()
        this.sidebarMainHeader.afterMount()
        this.extraPanelManager.afterMount()
    }

    public graphReady() {
        /* Single selection */
        this.uiManager.graph.renderer.getGraphInteraction().on('selectNode', (node: Node, element: unknown) => {
            this.sidebarMainHeader.updateNodeOverview(node, element)
            this.sidebarProperties.updateNodeProperties(node)
            this.extraPanelManager.updateNode(node)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectNode', () => {
            this.sidebarMainHeader.clearOverview()
            this.sidebarProperties.clearProperties()
            this.extraPanelManager.clear()
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('selectEdge', (edge: Edge) => {
            this.sidebarMainHeader.updateEdgeOverview(edge)
            this.sidebarProperties.updateEdgeProperties(edge)
            this.extraPanelManager.updateEdge(edge)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectEdge', () => {
            this.sidebarMainHeader.clearOverview()
            this.sidebarProperties.clearProperties()
            this.extraPanelManager.clear()
        })

        /* Multi selection */
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.uiManager.graph.renderer.getGraphInteraction().on('selectNodes', (_nodes: NodeSelection<unknown>[]) => {
            const fullSelection = this.uiManager.graph.renderer.getGraphInteraction().getSelectedNodes()
            this.sidebarMainHeader.updateNodesOverview(fullSelection)
            this.sidebarProperties.updateNodesProperties(fullSelection)
            this.extraPanelManager.updateNodes(fullSelection)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectNodes', () => {
            const fullSelection = this.uiManager.graph.renderer.getGraphInteraction().getSelectedNodes()
            if (fullSelection.length > 0) {
                this.sidebarMainHeader.updateNodesOverview(fullSelection)
                this.sidebarProperties.updateNodesProperties(fullSelection)
                this.extraPanelManager.updateNodes(fullSelection)
            } else {
                this.sidebarMainHeader.clearOverview()
                this.sidebarProperties.clearProperties()
                this.extraPanelManager.clear()
            }
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('selectEdges', (edges: EdgeSelection<unknown>[]) => {
            this.sidebarMainHeader.updateEdgesOverview(edges)
            this.sidebarProperties.updateEdgesProperties(edges)
            this.extraPanelManager.updateEdges(edges)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectEdges', () => {
            this.sidebarMainHeader.clearOverview()
            this.sidebarProperties.clearProperties()
            this.extraPanelManager.clear()
        })

        this.collapse?.addEventListener('click', () => {
            this.toggleSidebar()
        })
    }

    public toggleSidebar(): void {
        const sidebarContainer = this.sidebar!.closest('.pivotick-sidebar-container') as HTMLElement
        sidebarContainer.classList.toggle('pivotick-sidebar-collapsed', this.sidebarOpen)
        this.sidebarOpen = !this.sidebarOpen
    }

    public showSidebar(): void {
        const sidebarContainer = this.sidebar!.closest('.pivotick-sidebar-container') as HTMLElement
        sidebarContainer.classList.remove('pivotick-sidebar-collapsed')
        this.sidebarOpen = true
    }

    public hideSidebar(): void {
        const sidebarContainer = this.sidebar!.closest('.pivotick-sidebar-container') as HTMLElement
        sidebarContainer.classList.add('pivotick-sidebar-collapsed')
        this.sidebarOpen = false
    }
}