import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import type { PointerMode } from '../../ModeStore'
import type { GraphInteractionContext } from '../../../interfaces/GraphInteractions'
import type { GraphConnectManager } from '../../../editing/GraphConnectManager'
import { Note } from '../../../Note'
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

/**
 * The B3 contextual tool panel, anchored beside the mode rail. It subscribes to
 * {@link UIManager.modeStore} and shows the tool-set for the active pointer-mode:
 * Select (Pointer / Lasso / Path-select SOON / Invert) or Create (Add-node SOON /
 * Add-edge / Add-note / Edit). Every tool binds to the pre-existing leaf logic —
 * the panel only re-organises it.
 */
export class ToolPanel extends UIComponent {
    private panel?: HTMLDivElement
    /** Persistent armed tool per mode (`'pointer'`/`null` = nothing armed). */
    private armed: Record<PointerMode, string | null> = { select: 'pointer', create: null }

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
        this.render(this.uiManager.modeStore.getMode())
        this.track(this.uiManager.modeStore.subscribe((state) => this.onModeChange(state.mode)))

        // Keep the Add-edge tool highlighted in step with the real connect session.
        const connectManager = this.uiManager.graph.editing.connectManager
        const onConnectStart = (cm: GraphConnectManager) => { if (cm.getMode() === 'node-edge') this.setArmed('create', 'add-edge') }
        const onConnectStop = (cm: GraphConnectManager) => { if (cm.getMode() === 'node-edge') this.setArmed('create', null) }
        connectManager.on('start', onConnectStart)
        connectManager.on('stop', onConnectStop)
        this.track(() => { connectManager.off('start', onConnectStart); connectManager.off('stop', onConnectStop) })
    }

    protected onDestroy() {
        this.disarmLasso()
        this.panel?.remove()
        this.panel = undefined
    }

    /** On a mode switch, disarm the leaving mode's tool and render the new tool-set. */
    private onModeChange(mode: PointerMode) {
        if (mode !== 'select') this.disarmLasso()
        if (mode !== 'create') {
            const cm = this.uiManager.graph.editing.connectManager
            if (cm.isActive()) cm.exitClickConnectionMode()
        }
        this.render(mode)
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
            `<div class="pvt-toolpanel-header"><span class="pvt-toolpanel-icon">${titleIcon}</span>${title}</div>`

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
        this.reflectArmed(mode)
    }

    private onToolClick(mode: PointerMode, spec: ToolSpec) {
        if (spec.kind === 'toggle') {
            const nowArmed = this.armed[mode] !== spec.id
            spec.run?.(nowArmed)
            this.setArmed(mode, nowArmed ? spec.id : (mode === 'select' ? 'pointer' : null))
        } else if (spec.kind === 'default') {
            spec.run?.(true)
            this.setArmed(mode, spec.id)
        } else {
            spec.run?.(true) // one-shot action; leave the armed tool as-is
        }
    }

    private setArmed(mode: PointerMode, tool: string | null) {
        this.armed[mode] = tool
        if (this.uiManager.modeStore.getMode() === mode) this.reflectArmed(mode)
    }

    /** Highlight the armed tool row for the given mode. */
    private reflectArmed(mode: PointerMode) {
        if (!this.panel) return
        const armed = this.armed[mode]
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
        if (this.armed.select === 'lasso') {
            this.toggleLasso(false)
            this.armed.select = 'pointer'
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
