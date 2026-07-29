import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import { createHtmlElement, createHtmlTemplate, createIcon } from '../../../utils/ElementCreation'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import './sidebar.scss'
import { SidebarMainHeader } from './MainHeader'
import { SidebarProperties } from './Properties'
import { SidebarBulkActions } from './BulkActions'
import { ExtraPanelManager } from './ExtraPanelManager'
import { closeIcon, sidebarCollapse, sidebarExpand } from '../../icons'
import type { EdgeSelection, NodeSelection } from '../../../interfaces/GraphInteractions'
import { SidebarNeighbors } from './Neighbors'

export class Sidebar extends UIComponent {
    public sidebar?: HTMLDivElement

    private sidebarOpen: boolean = true

    private sidebarMainHeader: SidebarMainHeader
    private sidebarProperties: SidebarProperties
    private sidebarNeighbors: SidebarNeighbors
    private bulkActions: SidebarBulkActions
    private extraPanelManager: ExtraPanelManager

    private mainHeaderPanel?: HTMLDivElement
    private mainBodyPanel?: HTMLDivElement
    private neighborPanel?: HTMLDivElement
    private extraPanelContainer?: HTMLDivElement
    private collapse?: HTMLSpanElement
    private clearSelectionButton?: HTMLButtonElement

    constructor(uiManager: UIManager) {
        super(uiManager)
        this.sidebarMainHeader = new SidebarMainHeader(this.uiManager)
        this.sidebarProperties = new SidebarProperties(this.uiManager)
        this.sidebarNeighbors = new SidebarNeighbors(this.uiManager)
        this.bulkActions = new SidebarBulkActions(this.uiManager)
        this.extraPanelManager = new ExtraPanelManager(this.uiManager)
    }

    protected onMount(container: HTMLElement | undefined) {
        if (!container) return

        const template = `
<div class="pvt-sidebar-elements">
    <div class="pvt-mainheader-panel"></div>
    <div class="pvt-sidebar-bulkactions-slot"></div>
    <div class="pvt-sidebar-separator"></div>
    <div class="pvt-properties-panel pvt-sidebar-panel"></div>
    <div class="pvt-sidebar-separator"></div>
    <div class="pvt-neighbor-panel pvt-sidebar-panel"></div>
    <div class="pvt-sidebar-separator"></div>
    <div class="pvt-extra-panel pvt-sidebar-panel"></div>
</div>`
        this.sidebar = createHtmlTemplate(template) as HTMLDivElement

        /** Other Panels */

        container.appendChild(this.sidebar)
    }

    protected onDestroy() {
        // child panels are torn down automatically by UIComponent.destroy()
        this.collapse?.remove()
        this.collapse = undefined
        this.sidebar?.remove()
        this.sidebar = undefined
    }

    protected onAfterMount() {
        if (!this.sidebar) return
        this.mainHeaderPanel = this.sidebar.querySelector('.pvt-mainheader-panel') ?? undefined
        this.addChild(this.sidebarMainHeader, this.mainHeaderPanel)
        const bulkActionsSlot = this.sidebar.querySelector<HTMLDivElement>('.pvt-sidebar-bulkactions-slot') ?? undefined
        this.addChild(this.bulkActions, bulkActionsSlot)
        this.mainBodyPanel = this.sidebar.querySelector('.pvt-properties-panel') ?? undefined
        this.addChild(this.sidebarProperties, this.mainBodyPanel)
        this.neighborPanel = this.sidebar.querySelector('.pvt-neighbor-panel') ?? undefined
        this.addChild(this.sidebarNeighbors, this.neighborPanel)
        this.extraPanelContainer = this.sidebar.querySelector('.pvt-extra-panel') ?? undefined
        this.addChild(this.extraPanelManager, this.extraPanelContainer)

        this.collapse = createHtmlElement('span', {
            class: 'pvt-sidebar-collapse-container',
            role: 'button',
            tabindex: '0',
            'aria-label': 'Collapse sidebar',
            'aria-expanded': 'true',
        }, [
            createHtmlElement('span', { class: 'pvt-sidebar-collapse-button pvt-sidebar-collapse-button-collapse' }, [createIcon({ svgIcon: sidebarCollapse })]) as HTMLSpanElement,
            createHtmlElement('span', { class: 'pvt-sidebar-collapse-button pvt-sidebar-collapse-button-expand' }, [createIcon({ svgIcon: sidebarExpand })]) as HTMLSpanElement,
        ]) as HTMLSpanElement
        this.sidebar.parentElement!.appendChild(this.collapse)

        // Header clear-selection X — overlays the header (which the MainHeader
        // rewrites on every selection), so it lives on the sidebar root instead.
        this.clearSelectionButton = createHtmlElement('button', {
            class: 'pvt-sidebar-clear',
            type: 'button',
            title: 'Clear selection',
            'aria-label': 'Clear selection',
        }, [createIcon({ svgIcon: closeIcon })]) as HTMLButtonElement
        this.sidebar.appendChild(this.clearSelectionButton)

        if (this.uiManager.getOptions()?.sidebar?.collapsed === true) {
            this.hideSidebar()
        } else {
            this.showSidebar()
        }
        // child panels' afterMount() is driven by UIComponent
    }

    protected onGraphReady() {
        /* Single selection */
        this.trackInteraction('selectNode', (node: Node, element: unknown) => {
            this.renderSingleNodeSelection(node, element)
        })
        this.trackInteraction('unselectNode', () => {
            this.clearSelection()
        })
        this.trackInteraction('selectEdge', (edge: Edge) => {
            this.sidebarMainHeader.updateEdgeOverview(edge)
            this.sidebarProperties.updateEdgeProperties(edge)
            this.sidebarNeighbors.updateEdgeNeighbors(edge)
            this.extraPanelManager.updateEdge(edge)
            this.showSelectionActions('edge')
        })
        this.trackInteraction('unselectEdge', () => {
            this.clearSelection()
        })

        /* Multi selection */
        // A multi-selection narrowed (e.g. via the facet filters) down to a
        // single node is rendered as a single selection, matching a fresh click.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.trackInteraction('selectNodes', (_nodes: NodeSelection<unknown>[]) => {
            this.renderNodeSelection()
        })
        this.trackInteraction('unselectNodes', () => {
            this.renderNodeSelection()
        })
        this.trackInteraction('selectEdges', (edges: EdgeSelection<unknown>[]) => {
            this.sidebarMainHeader.updateEdgesOverview(edges)
            this.sidebarProperties.updateEdgesProperties(edges)
            this.sidebarNeighbors.updateEdgesNeighbors(edges)
            this.extraPanelManager.updateEdges(edges)
            this.showSelectionActions('edge')
        })
        this.trackInteraction('unselectEdges', () => {
            this.clearSelection()
        })

        if (this.collapse) {
            this.listen(this.collapse, 'click', () => this.toggleSidebar())
            // role="button" isn't natively keyboard-operable — activate on Enter/Space.
            this.listen(this.collapse, 'keydown', (e) => {
                const ev = e as KeyboardEvent
                if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault()
                    this.toggleSidebar()
                }
            })
        }
        if (this.clearSelectionButton) {
            this.listen(this.clearSelectionButton, 'click', () => this.clearActiveSelection())
        }
    }

    /**
     * Renders the sidebar for the current node selection, dispatching by size:
     * 0 → cleared, 1 → the single-node view (so a filtered-down selection reads
     * like a fresh click), 2+ → the aggregated multi-selection view.
     */
    private renderNodeSelection(): void {
        const fullSelection = this.uiManager.graph.renderer.getGraphInteraction().getSelectedNodes()
        if (fullSelection.length === 0) {
            this.clearSelection()
        } else if (fullSelection.length === 1) {
            const { node, element } = fullSelection[0]
            this.renderSingleNodeSelection(node, element)
        } else {
            this.renderMultiNodeSelection(fullSelection)
        }
    }

    private renderSingleNodeSelection(node: Node, element: unknown): void {
        this.sidebarMainHeader.updateNodeOverview(node, element)
        this.sidebarProperties.updateNodeProperties(node)
        this.sidebarNeighbors.updateNodeNeighbors(node)
        this.extraPanelManager.updateNode(node)
        // Per-node actions live in the header + right-click ContextMenu; the
        // clear-X and bulk-row are for multi-selection (see showSelectionActions).
        this.hideSelectionActions()
    }

    private renderMultiNodeSelection(fullSelection: NodeSelection<unknown>[]): void {
        this.sidebarMainHeader.updateNodesOverview(fullSelection)
        this.sidebarProperties.updateNodesProperties(fullSelection)
        this.sidebarNeighbors.updateNodesNeighbors(fullSelection)
        this.extraPanelManager.updateNodes(fullSelection)
        this.showSelectionActions('node')
    }

    private clearSelection(): void {
        this.sidebarMainHeader.clearOverview()
        this.sidebarProperties.clearProperties()
        this.sidebarNeighbors.clearNeighbors()
        this.extraPanelManager.clear()
        this.hideSelectionActions()
    }

    /**
     * Reveal the clear-selection X (and, for a multi-node selection, the
     * bulk-action row). Called for 2+ nodes and for edge selections; the bulk row
     * is node-only, so an edge selection shows only the X. Single-node selections
     * show neither (handled by {@link hideSelectionActions}).
     */
    private showSelectionActions(kind: 'node' | 'edge'): void {
        this.clearSelectionButton?.classList.add('pvt-visible')
        if (kind === 'node') this.bulkActions.show()
        else this.bulkActions.hide()
    }

    private hideSelectionActions(): void {
        this.clearSelectionButton?.classList.remove('pvt-visible')
        this.bulkActions.hide()
    }

    /** Clear whatever is currently selected (nodes and/or edges). */
    private clearActiveSelection(): void {
        const interaction = this.uiManager.graph.renderer.getGraphInteraction()
        interaction.clearNodeSelectionList()
        interaction.clearEdgeSelectionList()
    }

    public toggleSidebar(): void {
        const sidebarContainer = this.sidebar!.closest('.pvt-sidebar') as HTMLElement
        sidebarContainer.classList.toggle('pvt-sidebar-collapsed', this.sidebarOpen)
        this.sidebarOpen = !this.sidebarOpen
        this.syncCollapseA11y()
    }

    public showSidebar(): void {
        const sidebarContainer = this.sidebar!.closest('.pvt-sidebar') as HTMLElement
        sidebarContainer.classList.remove('pvt-sidebar-collapsed')
        this.sidebarOpen = true
        this.syncCollapseA11y()
    }

    public hideSidebar(): void {
        const sidebarContainer = this.sidebar!.closest('.pvt-sidebar') as HTMLElement
        sidebarContainer.classList.add('pvt-sidebar-collapsed')
        this.sidebarOpen = false
        this.syncCollapseA11y()
    }

    /** Reflect open/closed state on the collapse control for AT + keyboard users. */
    private syncCollapseA11y(): void {
        if (!this.collapse) return
        this.collapse.setAttribute('aria-expanded', String(this.sidebarOpen))
        this.collapse.setAttribute('aria-label', this.sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar')
    }
}