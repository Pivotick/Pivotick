import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import type { ModeState, PointerMode } from '../../ModeStore'
import type { GraphInteractionContext } from '../../../interfaces/GraphInteractions'
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
}

/** Keyboard shortcut shown in each mode's panel header. */
const MODE_SHORTCUT: Record<PointerMode, string> = { select: 'V', create: 'C' }

/**
 * The B3 contextual tool panel, anchored beside the mode rail. It subscribes to
 * {@link UIManager.modeStore} and shows the tool-set for the active pointer-mode:
 * Select (Pointer / Lasso / Path-select SOON / Invert) or Create (Add-node SOON /
 * Add-edge / Add-note / Edit). Every tool binds to the pre-existing leaf logic —
 * the panel only re-organises it.
 *
 * Arming a *modal* tool (Pointer / Lasso / Add-edge) collapses the panel and the
 * rail slot morphs to reflect it; one-shot *actions* (Invert / Add-note / Edit)
 * just run. Open/collapsed state is remembered per mode by the store; the armed
 * tool is reset to the mode default when its mode is left. The panel is hidden
 * in View mode.
 */
export class ToolPanel extends UIComponent {
    private panel?: HTMLDivElement
    /** Which pointer-mode's tool-set is currently rendered (avoids needless rebuilds). */
    private renderedMode: PointerMode | null = null

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    protected onMount(container?: HTMLElement) {
        if (!container) return
        this.panel = document.createElement('div')
        this.panel.className = 'pvt-toolpanel-panel'
        container.appendChild(this.panel)
    }

    protected onAfterMount() {
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

        // Escape cancels the active armed tool — a running edge-connect session or
        // an armed lasso (previously owned by the classic toolbar).
        this.track(this.uiManager.keyManager.register({
            key: 'Escape',
            callback: () => this.cancelActive(),
        }))
    }

    /** Cancel whatever tool is currently armed (edge-connect / lasso). Panel state is left as-is. */
    private cancelActive() {
        const cm = this.uiManager.graph.editing.connectManager
        if (cm.isActive()) cm.exitClickConnectionMode()
        this.disarmLasso()
    }

    protected onDestroy() {
        this.disarmLasso()
        this.panel?.remove()
        this.panel = undefined
        this.renderedMode = null
    }

    /**
     * React to a store change: disarm the tool of any left mode, then render the
     * active pointer-mode's tool-set and reflect its armed tool + open/collapsed
     * state. View has no pointer tools, so the panel is collapsed in View mode.
     * All operations are idempotent — a re-entrant emit (from disarming) converges.
     */
    private onState(state: Readonly<ModeState>) {
        const mode = state.mode
        if (mode !== 'select') this.disarmLasso()
        if (mode !== 'create') {
            const cm = this.uiManager.graph.editing.connectManager
            if (cm.isActive()) cm.exitClickConnectionMode()
        }
        if (mode === 'view') {
            this.setCollapsed(true)
            return
        }
        if (this.renderedMode !== mode) {
            this.render(mode)
            this.renderedMode = mode
        }
        this.reflectArmed(state.armedTool[mode])
        this.setCollapsed(!state.panelOpen[mode])
    }

    /** Show/hide the panel with a short animation (see `.pvt-collapsed` in scss). */
    private setCollapsed(collapsed: boolean) {
        this.panel?.classList.toggle('pvt-collapsed', collapsed)
    }

    private specsFor(mode: PointerMode): ToolSpec[] {
        if (mode === 'select') {
            return [
                { id: 'pointer', label: 'Pointer', icon: cursor, kind: 'default', run: () => this.disarmLasso() },
                { id: 'lasso', label: 'Lasso', icon: lassoTool, kind: 'toggle', run: (armed) => this.toggleLasso(armed) },
                { id: 'path', label: 'Path select', icon: pathSelection, kind: 'soon' },
                { id: 'invert', label: 'Invert selection', icon: selectionInverse, kind: 'action', run: () => this.invertSelection() },
            ]
        }
        return [
            { id: 'add-node', label: 'Add node', icon: addCircle, kind: 'soon' },
            { id: 'add-edge', label: 'Add edge', icon: graphEdgeIcon(18), kind: 'toggle', run: (armed) => this.toggleAddEdge(armed) },
            { id: 'add-note', label: 'Add note', icon: stickyNote, kind: 'action', run: () => this.addNote() },
            { id: 'edit', label: 'Edit node', icon: edit, kind: 'action', run: () => this.editSelectedNode() },
        ]
    }

    private render(mode: PointerMode) {
        if (!this.panel) return
        const specs = this.specsFor(mode)
        const title = mode === 'select' ? 'Select' : 'Create'
        const titleIcon = mode === 'select' ? cursor : addCircle
        this.panel.innerHTML =
            '<div class="pvt-toolpanel-header">'
            + `<span class="pvt-toolpanel-icon">${titleIcon}</span>`
            + `<span class="pvt-toolpanel-title">${title}</span>`
            + createShortcutBadge(MODE_SHORTCUT[mode]).outerHTML
            + '</div>'

        for (const spec of specs) {
            const row = document.createElement('button')
            row.type = 'button'
            row.className = 'pvt-toolpanel-tool'
            row.dataset.tool = spec.id
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
    }

    /**
     * Modal picks (Pointer / Lasso / Add-edge) arm the tool and collapse the
     * panel — the rail slot then reflects the choice. One-shot actions just run.
     */
    private onToolClick(mode: PointerMode, spec: ToolSpec) {
        const store = this.uiManager.modeStore
        if (spec.kind === 'toggle') {
            const nowArmed = store.getArmedTool(mode) !== spec.id
            spec.run?.(nowArmed)
            store.armTool(mode, nowArmed ? spec.id : this.defaultTool(mode))
            store.setPanelOpen(mode, false)
        } else if (spec.kind === 'default') {
            spec.run?.(true)
            store.armTool(mode, spec.id)
            store.setPanelOpen(mode, false)
        } else {
            spec.run?.(true) // one-shot action: leave the armed tool + panel as-is
        }
    }

    /** The tool a pointer-mode rests on when nothing special is armed. */
    private defaultTool(mode: PointerMode): string | null {
        return mode === 'select' ? 'pointer' : null
    }

    /** Highlight the armed tool row. */
    private reflectArmed(armed: string | null) {
        if (!this.panel) return
        for (const row of this.panel.querySelectorAll<HTMLElement>('.pvt-toolpanel-tool')) {
            row.classList.toggle('active', row.dataset.tool === armed)
        }
    }

    /* ---------- leaf logic (reused from the classic toolbar) ---------- */

    private toggleLasso(enabled: boolean) {
        const canvas = this.uiManager.layout?.canvas
        const interaction = this.uiManager.graph.renderer.getGraphInteraction()
        canvas?.classList.toggle('canvas--lasso-mode', enabled)
        this.uiManager.graph.renderer.toggleLassoMode(enabled)
        if (enabled) {
            interaction.on('canvasBeforeZoom', this.cancelPan)
            interaction.on('canvasClick', this.cancelClick)
        } else {
            interaction.off('canvasBeforeZoom', this.cancelPan)
            interaction.off('canvasClick', this.cancelClick)
        }
    }

    private disarmLasso() {
        if (this.uiManager.modeStore.getArmedTool('select') === 'lasso') {
            this.toggleLasso(false)
            this.uiManager.modeStore.armTool('select', 'pointer')
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private cancelPan = (event: any, context: GraphInteractionContext) => {
        if (event?.type === 'wheel' || event?.button === 1) return
        context.cancel()
    }
    private cancelClick = (_event: PointerEvent, context: GraphInteractionContext) => context.cancel()

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
        const renderer = this.uiManager.graph.renderer
        const canvas = this.uiManager.layout?.canvas
        if (!canvas) return
        const bcr = canvas.getBoundingClientRect()
        const { x, y } = renderer.screenToGraphCoordinates(bcr.x + bcr.width / 2, bcr.y + bcr.height / 2)
        this.uiManager.graph.noteManager.addNote(new Note({ content: 'This is not a note.', x, y }))
    }

    private editSelectedNode() {
        const selection = this.uiManager.graph.renderer.getGraphInteraction().getSelectedNode()
        if (selection) this.uiManager.graph.editing.openNodeSession(selection.node)
    }
}
