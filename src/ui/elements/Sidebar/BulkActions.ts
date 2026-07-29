import type { Node } from '../../../Node'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import type { NodeSelection } from '../../../interfaces/GraphInteractions'
import { pin, unpin, hide, focusElement, groupNodes, ungroupNodes, bulkEdit, trash } from '../../icons'

type BulkActionKind = 'action' | 'danger' | 'soon'

interface BulkActionSpec {
    id: string
    label: string
    icon: string
    kind: BulkActionKind
    /** Apply the action to the current node selection. */
    run?: () => void
    /** Draw a divider immediately before this action. */
    divider?: boolean
}

/**
 * The B3 sidebar bulk-action row, shown while a node selection is active. Each
 * functional action (Pin / Unpin / Hide / Delete) applies to *every* selected
 * node; Isolate / Group / Ungroup / Bulk-edit render disabled with a "SOON"
 * affordance (deferred M2–M3 capabilities). Node-only — the Sidebar hides the
 * row for edge selections.
 *
 * Actions that shrink the selection (Hide, Delete) clear it afterwards, which
 * re-fires `unselectNodes` and lets the Sidebar tear the row back down.
 */
export class SidebarBulkActions extends UIComponent {
    private row?: HTMLDivElement

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    protected onMount(container?: HTMLElement) {
        if (!container) return
        this.row = document.createElement('div')
        this.row.className = 'pvt-sidebar-bulkactions'
        this.buildRow()
        this.hide()
        container.appendChild(this.row)
    }

    protected onDestroy() {
        this.row?.remove()
        this.row = undefined
    }

    /** Reveal the row (a node selection is active). */
    public show(): void {
        if (this.row) this.row.style.display = 'flex'
    }

    /** Hide the row (no node selection). */
    public hide(): void {
        if (this.row) this.row.style.display = 'none'
    }

    private specs(): BulkActionSpec[] {
        return [
            { id: 'pin', label: 'Pin', icon: pin, kind: 'action', run: () => this.pinSelection() },
            { id: 'unpin', label: 'Unpin', icon: unpin, kind: 'action', run: () => this.unpinSelection() },
            { id: 'hide', label: 'Hide', icon: hide, kind: 'action', run: () => this.hideSelection() },
            { id: 'isolate', label: 'Isolate', icon: focusElement, kind: 'soon' },
            { id: 'group', label: 'Group', icon: groupNodes, kind: 'soon', divider: true },
            { id: 'ungroup', label: 'Ungroup', icon: ungroupNodes, kind: 'soon' },
            { id: 'bulk-edit', label: 'Bulk edit', icon: bulkEdit, kind: 'soon' },
            { id: 'delete', label: 'Delete', icon: trash, kind: 'danger', divider: true, run: () => this.deleteSelection() },
        ]
    }

    private buildRow(): void {
        if (!this.row) return
        this.row.innerHTML = ''
        for (const spec of this.specs()) {
            if (spec.divider) {
                const divider = document.createElement('span')
                divider.className = 'pvt-sidebar-bulkactions-divider'
                this.row.appendChild(divider)
            }
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'pvt-sidebar-bulkaction'
            button.dataset.action = spec.id
            button.setAttribute('aria-label', spec.label)
            button.title = spec.kind === 'soon' ? `${spec.label} — coming soon` : spec.label
            button.innerHTML = `<span class="pvt-sidebar-bulkaction-icon">${spec.icon}</span>`
            if (spec.kind === 'soon') {
                button.disabled = true
                button.classList.add('pvt-sidebar-bulkaction-soon')
            } else {
                if (spec.kind === 'danger') button.classList.add('pvt-sidebar-bulkaction-danger')
                this.listen(button, 'click', () => spec.run?.())
            }
            this.row.appendChild(button)
        }
    }

    /* ---------- functional actions (operate on the live selection) ---------- */

    private selection(): NodeSelection<unknown>[] {
        return this.uiManager.graph.renderer.getGraphInteraction().getSelectedNodes()
    }

    private selectedNodes(): Node[] {
        return this.selection().map(selection => selection.node)
    }

    private pinSelection(): void {
        // Freeze fixes each node at its current position; no reheat, so the rest
        // of the layout stays put around the pin.
        for (const node of this.selectedNodes()) node.freeze()
    }

    private unpinSelection(): void {
        for (const node of this.selectedNodes()) node.unfreeze()
        // Released nodes only move once the simulation has some energy again —
        // and only when physics is actually running (mirrors reheatIfEnabled).
        const simulation = this.uiManager.graph.simulation
        if (simulation.isEnabled()) simulation.reheat()
    }

    private hideSelection(): void {
        const queryEngine = this.uiManager.graph.queryEngine
        for (const node of this.selectedNodes()) queryEngine.excludeNode(node)
        this.clearSelection()
    }

    private deleteSelection(): void {
        // Snapshot ids first — removeNode mutates the graph as we iterate.
        const ids = this.selectedNodes().map(node => node.id)
        for (const id of ids) this.uiManager.graph.removeNode(id)
        this.clearSelection()
    }

    private clearSelection(): void {
        this.uiManager.graph.renderer.getGraphInteraction().clearNodeSelectionList()
    }
}
