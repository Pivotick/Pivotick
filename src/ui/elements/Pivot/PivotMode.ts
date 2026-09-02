import type { Node } from '../../../Node'
import { UIComponent } from '../../UIComponent'
import type { UIManager } from '../../UIManager'
import { LassoArm } from '../../lasso'
import { sparkles, selectElement, lassoTool } from '../../icons'
import { PivotPanel } from './PivotPanel'
import './pivot.scss'

/** The rail mode's id — also the `data-mode` on its rail button and its keyboard shortcut. */
export const PIVOT_MODE = 'pivot'

/**
 * Wide enough for an entry to hold its breakdown, its gate and a facet form without
 * any of them wrapping: at 300px the breakdown and the cap line each take two lines,
 * at 420px one. Past 420 nothing else fits on a line that did not already, so the
 * extra width would only be canvas taken for nothing.
 */
const PANEL_WIDTH = 420

/**
 * The Pivot rail mode: where an analyst picks an *origin*, reads what each registered
 * pivot advertises about it, narrows that down and runs it.
 *
 * The mode is the feature's intent boundary. Entering it is what starts `summarize`;
 * leaving it cancels every call in flight. That is the whole of D11 — selection alone
 * costs nothing, because box-selecting fifty nodes to move them is not a question about
 * enrichment.
 *
 * **Gated on the registry.** With `UI.pivotMode: 'auto'` (the default) the rail button
 * exists only while at least one pivot is registered: it appears when the first arrives
 * and goes when the last leaves, so a consumer who registers none sees no trace of the
 * feature. `true` keeps it there regardless — for pivots that arrive asynchronously —
 * and `false` never shows it.
 */
export class PivotMode extends UIComponent {
    private panel?: PivotPanel
    /** The disposer `addRailMode` returned, while the mode is registered. */
    private dispose?: () => void
    private readonly lasso: LassoArm

    constructor(uiManager: UIManager) {
        super(uiManager)
        this.lasso = new LassoArm(uiManager, () => this.finishLasso())
    }

    protected onAfterMount(): void {
        this.sync()
        // 'auto' follows the registry; a forced mode still has to be built once.
        this.track(this.uiManager.graph.pivots.on(change => {
            if (change === 'registry') this.sync()
        }))
    }

    protected onGraphReady(): void {
        // The origin is whatever is selected while the mode is active — Pick origin and
        // Lasso origin are the two ways of building that selection, not a second one.
        const follow = () => this.panel?.setOrigin(this.origin())
        this.trackInteraction('selectNode', follow)
        this.trackInteraction('unselectNode', follow)
        this.trackInteraction('selectNodes', follow)
        this.trackInteraction('unselectNodes', follow)
    }

    protected onDestroy(): void {
        this.lasso.set(false)
        this.dispose?.()
        this.dispose = undefined
        this.panel?.destroy()
        this.panel = undefined
    }

    /** Bring the mode's registration in line with what the options and the registry say. */
    private sync(): void {
        const wanted = this.wanted()
        if (wanted === !!this.dispose) return
        if (wanted) this.register()
        else {
            this.dispose?.()
            this.dispose = undefined
        }
    }

    private wanted(): boolean {
        const declared = this.uiManager.getOptions().pivotMode ?? 'auto'
        if (declared === false) return false
        if (declared === true) return true
        return this.uiManager.graph.pivots.size > 0
    }

    private register(): void {
        this.panel = this.panel ?? new PivotPanel(this.uiManager)
        const panel = this.panel

        this.dispose = this.uiManager.addRailMode({
            id: PIVOT_MODE,
            label: 'Pivot',
            icon: sparkles,
            shortcut: 'P',
            order: -10,
            panelWidth: PANEL_WIDTH,
            // The panel is this mode's workspace, and how much of the canvas it is
            // worth covering is the analyst's call, not a number decided here.
            panelResizable: true,
            // The panel is this mode's workspace: arming a tool says how to feed it, so
            // collapsing it on the way would hide the thing being fed.
            keepPanelOpen: true,
            // Picking is the resting state, so the rail slot keeps saying "Pivot".
            defaultTool: 'pick-origin',
            tools: [
                {
                    id: 'pick-origin',
                    label: 'Pick origin',
                    icon: selectElement,
                    kind: 'default',
                    run: () => this.lasso.set(false),
                },
                {
                    id: 'lasso-origin',
                    label: 'Lasso origin',
                    icon: lassoTool,
                    kind: 'toggle',
                    run: armed => this.lasso.set(armed),
                },
            ],
            render: () => panel.element(),
            onEnter: () => {
                panel.setOrigin(this.origin())
                panel.enter()
            },
            onExit: () => {
                this.lasso.set(false)
                panel.exit()
            },
        })
    }

    /** Bring one pivot's entry into view and mark it — where a badge click lands. */
    public focus(pivotId: string): void {
        this.panel?.focus(pivotId)
    }

    /** The nodes the mode is asking about: whatever is selected right now. */
    private origin(): Node[] {
        return this.uiManager.graph.renderer.getGraphInteraction()
            .getSelectedNodes()
            .map(selection => selection.node)
    }

    /** A lasso is one gesture: it hands over its nodes and disarms itself. */
    private finishLasso(): void {
        if (!this.lasso.isArmed()) return
        this.lasso.set(false)
        this.uiManager.modeStore.armTool(PIVOT_MODE, 'pick-origin')
        this.panel?.setOrigin(this.origin())
    }
}
