import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import type { ModeState, PointerMode, RailMode } from '../../ModeStore'
import type { RailModeDefinition } from '../../../interfaces/GraphUI'
import { resolveRailTools } from '../../railModes'
import { LassoArm } from '../../lasso'
import type { GraphConnectManager } from '../../../editing/GraphConnectManager'
import { Note } from '../../../Note'
import { createShortcutBadge } from '../../../utils/ElementCreation'
import {
    cursor, lassoTool, pathSelection, selectionInverse,
    addCircle, graphEdgeIcon, stickyNote, edit,
} from '../../icons'
import './toolpanel.scss'

type ToolKind = 'default' | 'toggle' | 'action' | 'soon'

interface ToolSpec {
    id: string
    label: string
    icon: string
    kind: ToolKind
    /** Perform the tool's effect (toggle tools receive the desired armed state). */
    run?: (armed: boolean) => void
    /** Optional predicate: when it returns false the tool is rendered disabled. Re-checked on selection changes. */
    enabled?: () => boolean
}

/** Keyboard shortcut shown in each mode's panel header. */
const MODE_SHORTCUT: Record<PointerMode, string> = { select: 'V', create: 'C' }

/** The narrowest a dragged panel goes: the built-in width, which fits icon + label. */
const MIN_PANEL_WIDTH = 216
/** Canvas kept to the right of a dragged panel — the `max-width` in the stylesheet. */
const PANEL_EDGE_MARGIN = 14

/**
 * The contextual tool panel, anchored beside the mode rail. It subscribes to
 * {@link UIManager.modeStore} and shows the tool-set for the active pointer-mode:
 * Select (Pointer / Lasso / Path-select SOON / Invert) or Create (Add-node SOON /
 * Add-edge / Add-note / Edit). Every tool binds to the pre-existing leaf logic —
 * the panel only re-organises it.
 *
 * Arming a *modal* tool (Pointer / Lasso / Add-edge) collapses the panel and the
 * rail slot morphs to reflect it; one-shot *actions* (Invert / Add-note / Edit)
 * just run. Open/collapsed state is remembered per mode by the store; the armed
 * tool is reset to the mode default when its mode is left. The panel is hidden
 * while a settings flyout (View / Physics) is open.
 */
export class ToolPanel extends UIComponent {
    private panel?: HTMLDivElement
    /** The right-edge grab handle, shown only for a mode that asked to be resizable. */
    private divider?: HTMLDivElement
    /** Pointer id held for the duration of a divider drag. */
    private dragPointer: number | null = null
    /**
     * Widths the analyst dragged to, per mode. A mode's declared `panelWidth` is what
     * it is worth on arrival; this is what this analyst made of it, and it outranks the
     * declaration until the page is reloaded.
     */
    private readonly draggedWidths = new Map<RailMode, number>()
    /** The last mode seen, so disarm-on-leave runs only on real mode changes. */
    private prevMode: RailMode | null = null
    /** Which pointer-mode's tool-set is currently rendered (avoids needless rebuilds). */
    private renderedMode: RailMode | null = null
    /** Select mode's lasso. One-shot: the selection it makes disarms it back to Pointer. */
    private readonly lasso = new LassoArm(this.uiManager, () => this.disarmLasso())

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    protected onMount(container?: HTMLElement) {
        if (!container) return
        this.panel = document.createElement('div')
        this.panel.className = 'pvt-toolpanel-panel'
        container.appendChild(this.panel)

        // Beside the panel rather than inside it: the panel is a scroller, and a handle
        // within one scrolls away from the edge it is supposed to be.
        this.divider = document.createElement('div')
        this.divider.className = 'pvt-toolpanel-divider'
        this.divider.setAttribute('role', 'separator')
        this.divider.setAttribute('aria-orientation', 'vertical')
        this.divider.setAttribute('aria-label', 'Resize the tool panel')
        this.divider.hidden = true
        container.appendChild(this.divider)
    }

    protected onAfterMount() {
        this.wireDivider()
        this.onState(this.uiManager.modeStore.getState())
        this.track(this.uiManager.modeStore.subscribe((state) => this.onState(state)))

        // Keep the Add-edge tool in step with the real connect session, whatever
        // starts/stops it (panel click, Escape, programmatic).
        const connectManager = this.uiManager.graph.editing.connectManager
        const onConnectStart = (cm: GraphConnectManager) => { if (cm.getMode() === 'node-edge') this.uiManager.modeStore.armTool('create', 'add-edge') }
        const onConnectStop = (cm: GraphConnectManager) => { if (cm.getMode() === 'node-edge') this.uiManager.modeStore.armTool('create', null) }
        connectManager.on('start', onConnectStart)
        connectManager.on('stop', onConnectStop)
        this.track(() => { connectManager.off('start', onConnectStart); connectManager.off('stop', onConnectStop) })

        // The panel's height moves with its mode's content, not only with which mode is
        // active — a pivot list grows as its summaries land.
        if (this.panel && typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => this.publishHeight())
            observer.observe(this.panel)
            this.track(() => observer.disconnect())
        }

        // Escape cancels the active armed tool — a running edge-connect session or
        // an armed lasso (previously owned by the classic toolbar).
        this.track(this.uiManager.keyManager.register({
            key: 'Escape',
            callback: () => this.cancelActive(),
        }))
    }

    protected onGraphReady() {
        // Selection-gated tools (Edit) follow the selection; re-check on any change.
        const refresh = () => this.refreshOnSelection()
        this.trackInteraction('selectNode', refresh)
        this.trackInteraction('unselectNode', refresh)
        this.trackInteraction('selectNodes', refresh)
        this.trackInteraction('unselectNodes', refresh)
        this.refreshEnabled()
    }

    /** Cancel whatever tool is currently armed (edge-connect / lasso). Panel state is left as-is. */
    private cancelActive() {
        const cm = this.uiManager.graph.editing.connectManager
        if (cm.isActive()) cm.exitClickConnectionMode()
        this.disarmLasso()
    }

    protected onDestroy() {
        (this.panel?.closest('.pvt-layout') as HTMLElement | null)?.style.removeProperty('--pvt-toolpanel-height')
        this.applyWidth(undefined)
        this.disarmLasso()
        this.panel?.remove()
        this.panel = undefined
        this.divider?.remove()
        this.divider = undefined
        this.draggedWidths.clear()
        this.renderedMode = null
        this.prevMode = null
    }

    /**
     * React to a store change: disarm the tool of any left mode, then render the
     * active pointer-mode's tool-set and reflect its armed tool + open/collapsed
     * state. A flyout mode has no pointer tools, so the panel collapses there.
     * All operations are idempotent — a re-entrant emit (from disarming) converges.
     */
    private onState(state: Readonly<ModeState>) {
        const mode = state.mode
        // Disarm a mode's live tool only when we actually LEAVE it. onState now
        // fires on every store emit (armTool / setPanelOpen too), so gating on a
        // real mode change avoids cancelling, say, a drag-connect that runs while
        // Select is active.
        if (mode !== this.prevMode) {
            this.prevMode = mode
            if (mode !== 'select') this.disarmLasso()
            if (mode !== 'create') {
                const cm = this.uiManager.graph.editing.connectManager
                if (cm.isActive()) cm.exitClickConnectionMode()
            }
        }
        // A flyout mode (View / Physics, or a registered one) has no pointer tools —
        // collapse the panel.
        if (!this.uiManager.modeStore.isPointerMode(mode)) {
            this.setCollapsed(true)
            return
        }
        if (this.renderedMode !== mode) {
            this.render(mode)
        }
        this.reflectArmed(state.armedTool[mode])
        this.setCollapsed(!state.panelOpen[mode])
    }

    /** Show/hide the panel with a short animation (see `.pvt-collapsed` in scss). */
    private setCollapsed(collapsed: boolean) {
        this.panel?.classList.toggle('pvt-collapsed', collapsed)
        this.publishHeight()
    }

    /**
     * Publish the panel's height as `--pvt-toolpanel-height`, zero while it is
     * collapsed. The panel shares the canvas's left column with the mode rail and the
     * legend, and a mode with a tall {@link RailModeDefinition.render} slot reaches
     * further down it than the rail ever does — so the legend sizes against both
     * (see `legend.scss`) rather than against the rail alone.
     */
    private publishHeight(): void {
        const panel = this.panel
        const root = panel?.closest('.pvt-layout') as HTMLElement | null
        if (!panel || !root) return
        const collapsed = panel.classList.contains('pvt-collapsed')
        const height = collapsed ? 0 : panel.getBoundingClientRect().height
        root.style.setProperty('--pvt-toolpanel-height', `${height}px`)
    }

    /** The registered mode with this id, or undefined for one of the four built-ins. */
    private registered(mode: RailMode): RailModeDefinition | undefined {
        return this.uiManager.getRailModes().find(m => m.id === mode)
    }

    private specsFor(mode: RailMode): ToolSpec[] {
        // A registered mode brings its own tools; the built-ins keep theirs here.
        const registered = this.registered(mode)
        if (registered) return resolveRailTools(registered)

        if (mode === 'select') {
            // The lasso is region selection like the marquee is, and answers to the
            // same switch — a canvas with no drag-select has no freehand one either.
            const regionSelect = this.uiManager.graph.getOptions().render?.selectionBox?.enabled !== false
            return [
                { id: 'pointer', label: 'Pointer', icon: cursor, kind: 'default', run: () => this.disarmLasso() },
                ...(regionSelect
                    ? [{ id: 'lasso', label: 'Lasso', icon: lassoTool, kind: 'toggle', run: (armed: boolean) => this.toggleLasso(armed) } as ToolSpec]
                    : []),
                { id: 'path', label: 'Path select', icon: pathSelection, kind: 'soon' },
                { id: 'invert', label: 'Invert selection', icon: selectionInverse, kind: 'action', run: () => this.invertSelection() },
            ]
        }
        // Explicit rather than a fallthrough: a mode unregistered mid-render would
        // otherwise be handed Create's tools on its way out.
        if (mode !== 'create') return []
        return [
            // Both write-path tools are dropped entirely when their editor is disabled —
            // a read-only integration gets no affordance rather than one that refuses.
            ...(this.uiManager.isEditorEnabled('nodeCreator')
                ? [{ id: 'add-node', label: 'Add node', icon: addCircle, kind: 'action', run: () => this.addNode() } as ToolSpec]
                : []),
            ...(this.uiManager.isEditorEnabled('edgeCreator')
                ? [{ id: 'add-edge', label: 'Add edge', icon: graphEdgeIcon(18), kind: 'toggle', run: (armed: boolean) => this.toggleAddEdge(armed) } as ToolSpec]
                : []),
            ...(this.uiManager.isFeatureEnabled('notes')
                ? [{ id: 'add-note', label: 'Add note', icon: stickyNote, kind: 'action', run: () => this.addNote() } as ToolSpec]
                : []),
            ...(this.uiManager.isEditorEnabled('nodeEditor')
                ? [{ id: 'edit', label: 'Edit node', icon: edit, kind: 'action', run: () => this.editSelectedNode(), enabled: () => this.hasEditableSelection() } as ToolSpec]
                : []),
        ]
    }

    private render(mode: RailMode) {
        if (!this.panel) return
        this.renderedMode = mode
        const specs = this.specsFor(mode)
        const registered = this.registered(mode)
        const title = registered?.label ?? (mode === 'select' ? 'Select' : 'Create')
        const titleIcon = registered?.icon ?? (mode === 'select' ? cursor : addCircle)
        const shortcut = registered ? registered.shortcut : MODE_SHORTCUT[mode as PointerMode]
        this.panel.innerHTML =
            '<div class="pvt-toolpanel-header">'
            + `<span class="pvt-toolpanel-icon">${titleIcon}</span>`
            + `<span class="pvt-toolpanel-title">${title}</span>`
            + (shortcut ? createShortcutBadge(shortcut.toUpperCase()).outerHTML : '')
            + '</div>'

        for (const spec of specs) {
            const row = document.createElement('button')
            row.type = 'button'
            row.className = 'pvt-toolpanel-tool'
            row.dataset.tool = spec.id
            row.dataset.kind = spec.kind
            // Toggle tools (lasso / add-edge) expose their armed state to AT; reflectArmed keeps it in sync.
            if (spec.kind === 'toggle') row.setAttribute('aria-pressed', 'false')
            row.innerHTML = `<span class="pvt-toolpanel-icon">${spec.icon}</span><span class="pvt-toolpanel-tool-label">${spec.label}</span>`
            if (spec.kind === 'soon') {
                row.disabled = true
                row.classList.add('pvt-toolpanel-soon')
                row.title = `${spec.label} — coming soon`
                row.innerHTML += '<span class="pvt-toolpanel-badge">SOON</span>'
            } else {
                row.addEventListener('click', () => this.onToolClick(mode, spec))
            }
            this.panel.appendChild(row)
        }

        // A registered mode's own content goes below its rows — a slider or a search box,
        // whatever the rows cannot express.
        const extra = registered?.render?.()
        if (extra) this.panel.appendChild(extra)

        this.applyWidth(this.draggedWidths.get(mode) ?? registered?.panelWidth)
        if (this.divider) this.divider.hidden = registered?.panelResizable !== true
        this.refreshEnabled()
    }

    /**
     * Widen the panel for a mode that asked for it. Written onto the wrapper the panel
     * is slotted into, since that is what the stylesheet sizes; clearing the property
     * hands the built-in width back to the next mode.
     */
    private applyWidth(width?: number): void {
        const wrapper = this.panel?.parentElement
        if (!wrapper) return
        if (width) wrapper.style.setProperty('--pvt-toolpanel-width', `${width}px`)
        else wrapper.style.removeProperty('--pvt-toolpanel-width')
    }

    /* ---------- the divider ---------- */

    /**
     * Drag the right edge to resize the panel, for a mode that declared
     * {@link RailModeDefinition.panelResizable}. The width is written the same way a
     * declared one is, so nothing downstream has to know a person chose it.
     */
    private wireDivider(): void {
        const divider = this.divider
        if (!divider) return

        this.listen(divider, 'pointerdown', (event) => {
            const pointer = event as PointerEvent
            this.dragPointer = pointer.pointerId
            divider.setPointerCapture(pointer.pointerId)
            divider.classList.add('pvt-toolpanel-divider-dragging')
            // The panel floats over the canvas, which pans on a drag of its own.
            pointer.preventDefault()
            pointer.stopPropagation()
        })

        this.listen(divider, 'pointermove', (event) => {
            const pointer = event as PointerEvent
            if (this.dragPointer !== pointer.pointerId) return
            const mode = this.renderedMode
            const left = this.panel?.parentElement?.getBoundingClientRect().left
            if (mode === null || left === undefined) return
            const width = this.clampWidth(pointer.clientX - left)
            this.draggedWidths.set(mode, width)
            this.applyWidth(width)
        })

        const end = (event: Event) => {
            const pointer = event as PointerEvent
            if (this.dragPointer !== pointer.pointerId) return
            divider.releasePointerCapture(pointer.pointerId)
            divider.classList.remove('pvt-toolpanel-divider-dragging')
            this.dragPointer = null
        }
        this.listen(divider, 'pointerup', end)
        this.listen(divider, 'pointercancel', end)
    }

    /**
     * Keep a dragged width between the built-in width and the canvas's right edge. The
     * stylesheet caps the drawn panel at the same edge; without the same ceiling here
     * the number would keep growing behind a panel that had stopped moving, and the
     * drag back would do nothing until it caught up.
     */
    private clampWidth(px: number): number {
        const wrapper = this.panel?.parentElement
        const root = this.panel?.closest('.pvt-layout')
        if (!wrapper || !root) return Math.round(Math.max(px, MIN_PANEL_WIDTH))
        const available = root.getBoundingClientRect().right
            - wrapper.getBoundingClientRect().left
            - PANEL_EDGE_MARGIN
        const ceiling = Math.max(available, MIN_PANEL_WIDTH)
        return Math.round(Math.min(Math.max(px, MIN_PANEL_WIDTH), ceiling))
    }

    /**
     * The selection changed. A registered mode that declared `tools` as a *function* may
     * want a different set of rows now — not just different enabled states — so rebuild
     * for those, and only re-check predicates for everyone else.
     */
    private refreshOnSelection() {
        const mode = this.renderedMode
        const registered = mode !== null ? this.registered(mode) : undefined
        if (mode !== null && registered && typeof registered.tools === 'function') {
            this.render(mode)
            this.reflectArmed(this.uiManager.modeStore.getArmedTool(mode))
            return
        }
        this.refreshEnabled()
    }

    /** Apply each tool's `enabled` predicate to its row (disable + dim when false). */
    private refreshEnabled() {
        if (!this.panel || !this.renderedMode) return
        for (const spec of this.specsFor(this.renderedMode)) {
            if (spec.kind === 'soon' || !spec.enabled) continue
            const row = this.panel.querySelector<HTMLButtonElement>(`.pvt-toolpanel-tool[data-tool="${spec.id}"]`)
            if (!row) continue
            const on = spec.enabled()
            row.disabled = !on
            row.classList.toggle('pvt-toolpanel-disabled', !on)
        }
    }

    /** Edit acts on a single selected node, so it's usable only when exactly one is selected. */
    private hasEditableSelection(): boolean {
        return !!this.uiManager.graph.renderer.getGraphInteraction().getSelectedNode()
    }

    /**
     * Modal picks (Pointer / Lasso / Add-edge) arm the tool and collapse the
     * panel — the rail slot then reflects the choice. One-shot actions just run.
     */
    private onToolClick(mode: RailMode, spec: ToolSpec) {
        const store = this.uiManager.modeStore
        // A mode whose panel is its workspace keeps it open — arming there says how to
        // feed the panel, so collapsing it hides the thing being fed.
        const collapse = !this.registered(mode)?.keepPanelOpen
        if (spec.kind === 'toggle') {
            const nowArmed = store.getArmedTool(mode) !== spec.id
            spec.run?.(nowArmed)
            store.armTool(mode, nowArmed ? spec.id : this.defaultTool(mode))
            if (collapse) store.setPanelOpen(mode, false)
        } else if (spec.kind === 'default') {
            spec.run?.(true)
            store.armTool(mode, spec.id)
            if (collapse) store.setPanelOpen(mode, false)
        } else {
            spec.run?.(true) // one-shot action: leave the armed tool + panel as-is
        }
    }

    /**
     * The tool a pointer-mode rests on when nothing special is armed. The store holds it
     * for the built-ins and for every registered mode alike.
     */
    private defaultTool(mode: RailMode): string | null {
        return this.uiManager.modeStore.getDefaultTool(mode)
    }

    /** Highlight the armed tool row. */
    private reflectArmed(armed: string | null) {
        if (!this.panel) return
        for (const row of this.panel.querySelectorAll<HTMLElement>('.pvt-toolpanel-tool')) {
            const active = row.dataset.tool === armed
            row.classList.toggle('active', active)
            if (row.dataset.kind === 'toggle') row.setAttribute('aria-pressed', String(active))
        }
    }

    /* ---------- leaf logic (reused from the classic toolbar) ---------- */

    private toggleLasso(enabled: boolean) {
        this.lasso.set(enabled)
    }

    private disarmLasso() {
        if (this.uiManager.modeStore.getArmedTool('select') === 'lasso') {
            this.lasso.set(false)
            this.uiManager.modeStore.armTool('select', 'pointer')
        }
    }

    private invertSelection() {
        const interaction = this.uiManager.graph.renderer.getGraphInteraction()
        const selected = new Set(interaction.getSelectedNodeIDs())
        const inverted = this.uiManager.graph.getMutableNodes()
            .filter(node => !selected.has(node.id))
            .map(node => ({ node, element: node.getGraphElement() as SVGGElement }))
        interaction.selectNodes(inverted)
    }

    private toggleAddEdge(enabled: boolean) {
        const cm = this.uiManager.graph.editing.connectManager
        if (enabled && !cm.isActive()) cm.startNodeClickConnection()
        else if (!enabled && cm.isActive()) cm.exitClickConnectionMode()
    }

    private addNote() {
        const centre = this.canvasCentre()
        if (!centre) return
        this.uiManager.graph.noteManager.addNote(new Note({ content: 'This is not a note.', ...centre }))
    }

    /**
     * Place a node at the middle of the current view, like Add note — the canvas
     * context-menu's "Add Node Here" covers placing one at a chosen point. The
     * before-create hook owns what it carries.
     */
    private addNode() {
        const position = this.canvasCentre()
        if (!position) return
        void this.uiManager.graph.editing.requestNodeCreate({ position, origin: 'tool' })
    }

    /** The middle of the visible canvas, in graph space (so it survives zoom/pan). */
    private canvasCentre(): { x: number, y: number } | null {
        const canvas = this.uiManager.layout?.canvas
        if (!canvas) return null
        const bcr = canvas.getBoundingClientRect()
        return this.uiManager.graph.renderer.screenToGraphCoordinates(bcr.x + bcr.width / 2, bcr.y + bcr.height / 2)
    }

    private editSelectedNode() {
        const selection = this.uiManager.graph.renderer.getGraphInteraction().getSelectedNode()
        if (selection) this.uiManager.graph.editing.openNodeSession(selection.node)
    }
}
