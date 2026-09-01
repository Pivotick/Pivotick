import type { PivotCandidateSet, PivotRunOutcome } from '../../../interfaces/Pivot'
import { NotificationLevel } from '../../Notifier'
import type { NotificationHandle } from '../../Notifier'
import { UIComponent } from '../../UIComponent'
import type { UIManager } from '../../UIManager'
import { TriagePane } from './TriagePane'

/** Dock tab ids are namespaced by pivot, so a pivot always reclaims its own pane. */
const TAB_PREFIX = 'pivot-triage:'

/** Triage panes sit after the built-in table rather than in front of it. */
const TAB_ORDER = 10

/**
 * Keeps the dock in step with what is staged for triage: one pane per pivot that has
 * been run and not yet cleared (D27), created the moment its `fetch` starts so a slow
 * fetch and a failed one both have somewhere to live.
 *
 * It owns no candidate state — {@link PivotManager} does — and adds none of its own
 * beyond the tabs themselves. What it does own is the two things a pane cannot: the
 * ingest call, and the toast that follows it with the run's undo on it.
 */
export class PivotTriage extends UIComponent {
    private readonly panes = new Map<string, { pane: TriagePane, dispose: () => void }>()
    /** Runs already announced, so a redo does not toast the same ingest twice. */
    private readonly reported = new Set<string>()

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    protected onAfterMount(): void {
        const pivots = this.uiManager.graph.pivots
        this.track(pivots.on(change => {
            // 'registry' matters too: unregistering a pivot drops its candidates.
            if (change === 'candidates' || change === 'registry') this.sync()
            if (change === 'runs') this.reportUnannounced()
        }))
        this.sync()
    }

    /**
     * An ingest that did not come through this pane still landed nodes on the canvas —
     * an auto-ingest pivot (D13), or a consumer calling `pivots.ingest` itself. It gets
     * the same toast, and the same undo on it, because the analyst has the same problem.
     */
    private reportUnannounced(): void {
        const runs = this.uiManager.graph.pivots.runs()
        const latest = runs[runs.length - 1]
        if (!latest || this.reported.has(latest.runId)) return
        this.reported.add(latest.runId)
        this.toastIngest(latest.runId, latest.nodeIds.length, 0, latest.edgeIds.length)
    }

    protected onDestroy(): void {
        for (const { dispose } of this.panes.values()) dispose()
        this.panes.clear()
    }

    /** One tab per staged set: add what is new, update what is there, drop what is gone. */
    private sync(): void {
        const staged = this.uiManager.graph.pivots.staged()
        const live = new Set(staged.map(set => set.pivotId))

        for (const [pivotId, entry] of [...this.panes]) {
            if (live.has(pivotId)) continue
            entry.dispose()
            this.panes.delete(pivotId)
        }

        for (const set of staged) {
            const existing = this.panes.get(set.pivotId)
            if (existing) {
                existing.pane.update(set)
                continue
            }
            this.open(set)
        }
    }

    private open(set: PivotCandidateSet): void {
        const pane = new TriagePane(set, {
            pivots: this.uiManager.graph.pivots,
            ingest: pivotId => void this.ingest(pivotId),
            rerun: from => void this.uiManager.graph.pivots.run(from.pivotId, from.origin, from.narrowing),
            close: pivotId => this.uiManager.graph.pivots.discard(pivotId),
            relabel: (pivotId, label) => this.uiManager.setDockTabLabel(TAB_PREFIX + pivotId, label),
        })

        const dispose = this.uiManager.addDockTab({
            id: TAB_PREFIX + set.pivotId,
            label: pane.label(),
            order: TAB_ORDER,
            render: () => pane.render(),
            toolbar: () => pane.toolbar(),
            onActivate: () => pane.activate(),
            onDeactivate: () => pane.deactivate(),
        })
        this.panes.set(set.pivotId, { pane, dispose })

        // The analyst asked for this fetch, so its results come to the front — and the
        // dock unfolds if it was away. Only on the pane's first appearance: a later
        // update must not yank them out of whatever they were reading.
        this.uiManager.activateDockTab(TAB_PREFIX + set.pivotId)
    }

    /* ---------- ingest, and the undo that follows it ---------- */

    private async ingest(pivotId: string): Promise<void> {
        const set = this.uiManager.graph.pivots.candidates(pivotId)
        // What was asked for, so a hook that narrowed the batch can be reported as such.
        const asked = set ? set.nodes.filter(c => c.state === 'marked' && !c.deduped).length : 0
        // Claimed before the call, not after: `ingest` announces the run on its way
        // through, and the run listener would otherwise toast it a second time.
        if (set) this.reported.add(set.runId)

        let outcome: PivotRunOutcome
        try {
            outcome = await this.uiManager.graph.pivots.ingest(pivotId)
        } catch (error) {
            this.uiManager.graph.notifier.error('Ingest failed', String((error as Error)?.message ?? error))
            return
        }

        if (outcome.status === 'vetoed') {
            this.uiManager.graph.notifier.info('Ingest cancelled')
            return
        }

        this.reported.add(outcome.runId)
        this.toastIngest(outcome.runId, outcome.nodes.length, asked, outcome.edges.length)
    }

    private toastIngest(runId: string, landed: number, asked: number, edges: number): void {
        if (!landed && !edges) {
            this.uiManager.graph.notifier.info('Nothing was ingested')
            return
        }
        this.uiManager.graph.notifier.success(ingestTitle(landed, asked, edges), undefined, {
            action: { label: 'Undo', onClick: toast => this.undo(runId, toast) },
        })
    }

    private undo(runId: string, toast: NotificationHandle): void {
        const pivots = this.uiManager.graph.pivots
        if (!pivots.undo(runId)) {
            toast.update({ level: NotificationLevel.Warning, title: 'Nothing left to undo', action: null })
            return
        }
        // Redo lives here and nowhere else: a second home for it would imply a history
        // surface this feature deliberately does not build (D25).
        toast.update({
            title: 'Undone',
            action: {
                label: 'Redo',
                onClick: next => {
                    pivots.redo()
                    next.update({ title: 'Redone', action: null })
                },
            },
        })
    }
}

/** `Ingested 12 nodes, 14 edges` — or `9 of 12` when a hook landed fewer than asked. */
function ingestTitle(landed: number, asked: number, edges: number): string {
    const nodes = asked && landed < asked
        ? `Ingested ${landed.toLocaleString()} of ${asked.toLocaleString()} nodes`
        : `Ingested ${landed.toLocaleString()} ${landed === 1 ? 'node' : 'nodes'}`
    if (!edges) return nodes
    return `${nodes}, ${edges.toLocaleString()} ${edges === 1 ? 'edge' : 'edges'}`
}
