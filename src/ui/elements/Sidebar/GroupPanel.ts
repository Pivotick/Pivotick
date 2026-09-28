import type { Node } from '../../../Node'
import type { GroupNode } from '../../../Simplification/GroupNode'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import { buildGroupSummary } from '../GroupSummary/GroupSummary'
import { TableGrid } from '../Table/TableGrid'
import { DEGREE_COLUMN_KEY, LABEL_COLUMN_KEY } from '../Table/TableColumns'
import { nodeNameGetter } from '../../../utils/GraphGetters'
import { openGroup, renameGroupPrompt, selectGroupMembers, showGroupMembersInTable } from '../../groupActions'
import '../Table/table.scss'

/**
 * The sidebar for a selected group: what it links to, what can be done with its members
 * (open, select, pivot, delete), and the members themselves, each of which can be pulled
 * out of the group.
 */
export class SidebarGroupPanel extends UIComponent {
    private root?: HTMLDivElement
    private group?: GroupNode
    private grid?: TableGrid
    /** The group Open is asking about, while it asks. */
    private asking?: string
    private unsubscribe?: () => void

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    protected onMount(container?: HTMLElement) {
        if (!container) return
        this.root = document.createElement('div')
        this.root.className = 'pvt-sidebar-group'
        this.root.style.display = 'none'
        container.appendChild(this.root)
        this.unsubscribe = this.uiManager.graph.simplify.onChange(() => {
            if (this.group) this.render()
        })
    }

    protected onDestroy() {
        this.unsubscribe?.()
        this.grid?.dispose()
        this.root?.remove()
        this.root = undefined
    }

    public show(group: GroupNode): void {
        if (this.group !== group) this.asking = undefined
        this.group = group
        this.render()
    }

    public hide(): void {
        this.group = undefined
        this.asking = undefined
        this.grid?.dispose()
        this.grid = undefined
        if (this.root) {
            this.root.style.display = 'none'
            this.root.replaceChildren()
        }
    }

    private render(): void {
        const root = this.root
        const group = this.group
        if (!root || !group) return
        const simplify = this.uiManager.graph.simplify
        // The group dissolved under the selection; the selection is dropped with it.
        if (!simplify.getGroupNode(group.id)) return this.hide()

        root.style.display = ''
        this.grid?.dispose()
        root.replaceChildren(
            this.buildActions(group),
            buildGroupSummary(simplify, group.info, { nameOf: node => this.nameOf(node) }),
            this.buildMembers(group),
        )
    }

    private nameOf(node: Node): string {
        return node.isGroup
            ? this.uiManager.graph.simplify.labelOf((node as GroupNode).info)
            : nodeNameGetter(node, this.uiManager.getOptions().mainHeader)
    }

    private button(label: string, onClick: () => void, options: { primary?: boolean, danger?: boolean, disabled?: boolean, action: string, title?: string }): HTMLButtonElement {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'pvt-sidebar-group-action'
        button.dataset.action = options.action
        if (options.primary) button.classList.add('pvt-sidebar-group-action-primary')
        if (options.danger) button.classList.add('pvt-sidebar-group-action-danger')
        button.textContent = label
        if (options.title) button.title = options.title
        button.disabled = !!options.disabled
        if (!options.disabled) this.listen(button, 'click', onClick)
        return button
    }

    private buildActions(group: GroupNode): HTMLElement {
        const row = document.createElement('div')
        row.className = 'pvt-sidebar-group-actions'
        const simplify = this.uiManager.graph.simplify
        const info = group.info

        if (this.asking === group.id) {
            const question = document.createElement('span')
            question.className = 'pvt-sidebar-group-ask'
            question.textContent = `Put ${simplify.labelOf(info)} on the canvas?`
            row.classList.add('pvt-sidebar-group-asking')
            row.append(
                question,
                this.button('Open', () => {
                    this.asking = undefined
                    simplify.open(group)
                }, { primary: true, action: 'confirm-open' }),
                this.button('Cancel', () => {
                    this.asking = undefined
                    this.render()
                }, { action: 'cancel-open' }),
            )
            return row
        }

        if (info.open) {
            row.append(this.button('Close', () => simplify.close(group), { primary: true, action: 'close' }))
        } else {
            row.append(this.button('Open', () => {
                if (openGroup(this.uiManager, group) === 'ask') {
                    this.asking = group.id
                    this.render()
                }
            }, { primary: true, action: 'open' }))
        }
        row.append(this.button('Select members', () => selectGroupMembers(this.uiManager, group), { action: 'select-members' }))
        if (simplify.isManual(group)) {
            row.append(
                this.button('Rename', () => void renameGroupPrompt(this.uiManager, group), { action: 'rename' }),
                this.button('Ungroup', () => simplify.ungroup(group), { action: 'ungroup', title: 'Draw the members as they were before this group' }),
            )
        }
        if (this.uiManager.table) {
            row.append(this.button('View in table', () => showGroupMembersInTable(this.uiManager, group), {
                action: 'view-in-table', title: 'List the members in the data dock, to filter and search them',
            }))
        }

        const pivots = this.uiManager.graph.pivots
        if (this.uiManager.pivotMode && pivots.for(info.members).length > 0) {
            row.append(this.button('Pivot ▸', () => this.uiManager.openPivotMode(info.members), { action: 'pivot' }))
        }
        if (this.uiManager.isEditorEnabled('deletion')) {
            row.append(this.button(`Delete ${info.members.length}`, () => {
                void this.uiManager.graph.editing.requestDelete({ nodes: info.members, origin: 'bulk-action' })
            }, { danger: true, action: 'delete' }))
        }
        if (this.uiManager.isEditorEnabled('nodeEditor')) {
            row.append(this.button('Edit', () => {}, { disabled: true, action: 'edit', title: 'A group has no data of its own to edit' }))
        }
        return row
    }

    private buildMembers(group: GroupNode): HTMLElement {
        const section = document.createElement('div')
        section.className = 'pvt-sidebar-group-members'
        const heading = document.createElement('div')
        heading.className = 'pvt-sidebar-group-heading'
        heading.textContent = 'Members'
        const scroller = document.createElement('div')
        scroller.className = 'pvt-sidebar-group-scroller'
        section.append(heading, scroller)

        const simplify = this.uiManager.graph.simplify
        this.grid = new TableGrid(this.uiManager, 'nodes', undefined, 'select', 200, {
            rows: () => group.info.members,
            shownColumns: [LABEL_COLUMN_KEY, DEGREE_COLUMN_KEY],
            rowAction: { label: 'Pull out', title: 'Keep this node out of the group', run: node => simplify.pullOut(node) },
        })
        scroller.appendChild(this.grid.getRoot())
        // Once in the page: the grid windows its rows against its scroller.
        queueMicrotask(() => this.grid?.rebuild())
        return section
    }
}
