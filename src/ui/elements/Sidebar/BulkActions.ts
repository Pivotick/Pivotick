import type { Node } from '../../../Node'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import type { NodeSelection } from '../../../interfaces/GraphInteractions'
import { pin, unpin, hide, focusElement, groupNodes, ungroupNodes, bulkEdit, trash } from '../../icons'
import { groupSelection, manualGroupsIn } from '../../groupActions'
import { clearNodeSelection, deleteNodes, hideNodes, pinNodes, unpinNodes } from '../../selectionActions'

type BulkActionKind = 'action' | 'danger' | 'soon'

interface BulkActionSpec {
    id: string
    label: string
    icon: string
    kind: BulkActionKind
    /** Apply the action to the current node selection. */
    run?: () => void
    /** Whether it can act on the current selection; asked each time the row shows. */
    enabled?: () => boolean
    /** Draw a divider immediately before this action. */
    divider?: boolean
}

/**
 * The sidebar bulk-action row, shown while a node selection is active. Each
 * functional action (Pin / Unpin / Hide / Group / Ungroup / Delete) applies to
 * *every* selected node; Isolate / Bulk-edit render disabled with a "SOON"
 * affordance. Node-only — the Sidebar hides the row for edge selections.
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
        if (!this.row) return
        this.row.style.display = 'flex'
        this.refresh()
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
            // Dropped with the feature: no simplify, no groups to make.
            ...(this.uiManager.graph.simplify.isEnabled() ? [
                {
                    id: 'group', label: 'Group', icon: groupNodes, kind: 'action', divider: true,
                    run: () => void this.groupSelected(),
                    enabled: () => this.uiManager.graph.simplify.groupableIds(this.selectedNodes()).length >= 2,
                },
                {
                    id: 'ungroup', label: 'Ungroup', icon: ungroupNodes, kind: 'action',
                    run: () => this.ungroupSelected(),
                    enabled: () => manualGroupsIn(this.uiManager, this.selectedNodes()).length > 0,
                },
            ] as BulkActionSpec[] : []),
            { id: 'bulk-edit', label: 'Bulk edit', icon: bulkEdit, kind: 'soon' },
            // Dropped entirely when deletion is disabled — a read-only integration
            // wants no Delete button, not one that always refuses.
            ...(this.uiManager.isEditorEnabled('deletion')
                ? [{ id: 'delete', label: 'Delete', icon: trash, kind: 'danger', divider: true, run: () => void this.deleteSelection() } as BulkActionSpec]
                : []),
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

    /** Enable each action that can act on the selection now. */
    private refresh(): void {
        if (!this.row) return
        for (const spec of this.specs()) {
            if (!spec.enabled) continue
            const button = this.row.querySelector<HTMLButtonElement>(`[data-action="${spec.id}"]`)
            if (button) button.disabled = !spec.enabled()
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
        pinNodes(this.selectedNodes())
    }

    private unpinSelection(): void {
        unpinNodes(this.uiManager, this.selectedNodes())
    }

    private hideSelection(): void {
        hideNodes(this.uiManager, this.selectedNodes())
        this.clearSelection()
    }

    /**
     * Route the selection through the before-delete hook. A veto keeps the selection
     * (and the row) exactly as it was, so the user can act on it again; only a delete
     * that actually happened clears it.
     */
    private async deleteSelection(): Promise<void> {
        if (await deleteNodes(this.uiManager, this.selectedNodes(), 'bulk-action')) this.clearSelection()
    }

    private async groupSelected(): Promise<void> {
        await groupSelection(this.uiManager, this.selectedNodes())
    }

    /** Remove the hand-made groups the selection holds or sits in. */
    private ungroupSelected(): void {
        this.uiManager.graph.simplify.ungroup(manualGroupsIn(this.uiManager, this.selectedNodes()))
        this.refresh()
    }

    private clearSelection(): void {
        clearNodeSelection(this.uiManager)
    }
}
