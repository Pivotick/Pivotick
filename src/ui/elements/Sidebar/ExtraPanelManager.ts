import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import { createHtmlTemplate } from '../../../utils/ElementCreation'
import { tryResolveHTMLElement } from '../../../utils/Getters'
import type { ExtraPanelChange } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import type { ExtraPanelHandle, ExtraPanelSelection, RegisteredExtraPanel } from '../../../interfaces/GraphUI'
import type { EdgeSelection, NodeSelection } from '../../../interfaces/GraphInteractions'

/** Do two selections describe the same elements (same order, same instances)? */
function sameSelection(a: ExtraPanelSelection, b: ExtraPanelSelection): boolean {
    if (a === b) return true
    if (!Array.isArray(a) || !Array.isArray(b)) return false

    return a.length === b.length && a.every((element, i) => element === b[i])
}

/** A registered panel plus the DOM and self-handle backing it. */
interface MountedPanel {
    panel: RegisteredExtraPanel
    root: HTMLDivElement
    header: HTMLDivElement
    body: HTMLDivElement
    /** Passed to the panel's own `title` / `render` so it can refresh or remove itself. */
    handle: ExtraPanelHandle
    /** True once `render` has resolved at least once — what `reactive: false` pins. */
    rendered: boolean
}

/**
 * Host for the sidebar's extra panels.
 *
 * The registry itself lives on the `UIManager` (so panels can be registered
 * before this component exists, or in a mode that has no sidebar); this owns
 * their DOM and keeps it in step by subscribing to registry changes.
 *
 * Panels are a function of the current selection: `title` and `render` are
 * re-resolved on every selection transition — including to `null` when the
 * selection is cleared — unless the panel opted out with `reactive: false`.
 */
export class ExtraPanelManager extends UIComponent {

    private panelContainer?: HTMLDivElement
    /** Mounted panels, in display order (mirrors `UIManager.getPanels()`). */
    private mounted: MountedPanel[] = []
    /** The selection the panels currently describe; replayed onto panels mounted later. */
    private selection: ExtraPanelSelection = null

    protected onMount(rootContainer: HTMLElement | undefined) {
        if (!rootContainer) return

        this.panelContainer = rootContainer as HTMLDivElement
    }

    protected onDestroy() {
        this.mounted = []
        this.panelContainer?.remove()
        this.panelContainer = undefined
    }

    protected onAfterMount() {
        this.track(this.uiManager.onPanelsChanged((change) => this.applyChange(change)))
        // Panels registered before the sidebar was built (UI.extraPanels, or an
        // early addPanel) are already in the registry — mount them now.
        for (const panel of this.uiManager.getPanels()) {
            this.mountPanel(panel, this.mounted.length)
        }
    }

    protected onGraphReady() { }

    /* ---------- selection ---------- */

    public updateNode(node: Node): void {
        this.setSelection(node)
    }

    public updateEdge(edge: Edge): void {
        this.setSelection(edge)
    }

    public updateNodes(nodes: NodeSelection<unknown>[]): void {
        this.setSelection(nodes.map((selected) => selected.node))
    }

    public updateEdges(edges: EdgeSelection<unknown>[]): void {
        this.setSelection(edges.map((selected) => selected.edge))
    }

    public clear(): void {
        this.setSelection(null)
    }

    /** Re-render every panel against the new selection, then re-apply visibility. */
    private setSelection(selection: ExtraPanelSelection): void {
        // An emptied multi-selection is "nothing selected", not an empty array:
        // panels only ever see a non-empty array or `null`.
        const next = Array.isArray(selection) && selection.length === 0 ? null : selection

        // A single click reaches the sidebar through more than one interaction
        // event (selectNode *and* selectNodes, for instance), so the same
        // selection would otherwise re-render a panel several times over. Panels
        // are consumer code — render each transition exactly once, and let
        // `refreshPanel` cover "same selection, changed data".
        if (sameSelection(this.selection, next)) return
        this.selection = next

        for (const mountedPanel of this.mounted) {
            this.renderPanel(mountedPanel)
            this.applyVisibility(mountedPanel)
        }
    }

    /* ---------- registry changes ---------- */

    private applyChange(change: ExtraPanelChange): void {
        if (change.type === 'add') {
            this.mountPanel(change.panel, change.index)
        } else if (change.type === 'remove') {
            this.unmountPanel(change.id)
        } else {
            this.refresh(change.id)
        }
    }

    /** Forced re-render of one panel (or all): applies to `reactive: false` panels too. */
    private refresh(id?: string): void {
        for (const mountedPanel of this.mounted) {
            if (id !== undefined && mountedPanel.panel.id !== id) continue
            this.renderPanel(mountedPanel, true)
            this.applyVisibility(mountedPanel)
        }
    }

    private mountPanel(panel: RegisteredExtraPanel, index: number): void {
        if (!this.panelContainer) return

        const template = `
            <div class="enter-ready">
                <div class="pivotick-extrapanel-header-panel pvt-sidebar-header-panel"></div>
                <div class="pivotick-extrapanel-body-panel pvt-sidebar-body-panel"></div>
            </div>`
        const root = createHtmlTemplate(template) as HTMLDivElement
        root.dataset.panelId = panel.id
        const header = root.querySelector('.pivotick-extrapanel-header-panel') as HTMLDivElement
        const body = root.querySelector('.pivotick-extrapanel-body-panel') as HTMLDivElement

        const mountedPanel: MountedPanel = {
            panel,
            root,
            header,
            body,
            handle: {
                id: panel.id,
                refresh: () => this.uiManager.refreshPanel(panel.id),
                remove: () => this.uiManager.removePanel(panel.id),
            },
            rendered: false,
        }

        this.mounted.splice(index, 0, mountedPanel)
        // The container holds nothing but panel roots, so the registry index is
        // the DOM index — `order` is honoured for late arrivals too.
        this.panelContainer.insertBefore(root, this.panelContainer.children[index] ?? null)

        // A panel added mid-session is caught up to the live selection.
        this.renderPanel(mountedPanel)
        this.applyVisibility(mountedPanel)
    }

    private unmountPanel(id: string): void {
        const index = this.mounted.findIndex((mountedPanel) => mountedPanel.panel.id === id)
        if (index === -1) return

        const [removed] = this.mounted.splice(index, 1)
        removed.root.remove()
    }

    /* ---------- rendering ---------- */

    private renderPanel(mountedPanel: MountedPanel, force: boolean = false): void {
        const { panel, header, body, handle } = mountedPanel
        if (mountedPanel.rendered && panel.reactive === false && !force) return

        this.setContent(header, this.resolveTitle(mountedPanel))
        this.setContent(body, tryResolveHTMLElement(panel.render, this.selection, handle))
        mountedPanel.rendered = true
    }

    /**
     * A panel with no title — or one that resolved to blank text — leaves its
     * header element empty, which is what keeps the header row collapsed.
     */
    private resolveTitle({ panel, handle }: MountedPanel): HTMLElement | undefined {
        if (panel.title === undefined) return undefined

        const title = tryResolveHTMLElement(panel.title, this.selection, handle)
        if (!title) return undefined

        const blank = title.childElementCount === 0 && (title.textContent ?? '').trim() === ''
        return blank ? undefined : title
    }

    /**
     * Replace a slot's content wholesale — the same contract as the properties
     * panel. A panel that caches and returns *its own* element keeps it in
     * place: detaching and re-appending it would drop focus and scroll position
     * inside it.
     */
    private setContent(slot: HTMLElement, content: HTMLElement | undefined): void {
        if (content && slot.firstChild === content && slot.childNodes.length === 1) return

        slot.replaceChildren()
        if (content) slot.appendChild(content)
    }

    /** Panels are selection-scoped unless `alwaysVisible`; the class drives the CSS. */
    private applyVisibility(mountedPanel: MountedPanel): void {
        const visible = mountedPanel.panel.alwaysVisible === true || this.selection !== null
        mountedPanel.root.classList.toggle('enter-active', visible)
    }
}
