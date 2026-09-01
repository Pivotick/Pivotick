// Everything the library would ship for D26, assembled as an ordinary plugin: the gated
// Pivot rail mode, the triage dock tabs, and the post-ingest toast.
//
// It is deliberately built on the real extension points — addRailMode, addDockTab,
// getGraphInteraction — so the prototype answers "does the plugin API actually support this
// design?" rather than merely illustrating the design.

import type { PivotickPlugin, PluginContext } from '../../src/interfaces/Plugin'
import type { Node } from '../../src/Node'
import type { PivotDefinition, PivotNarrowing } from './types'
import { PivotManager } from './manager'
import { buildPanel } from './panel'
import { buildTriage } from './triage'
import { showToast } from './toast'
import type { ToastHandle } from './toast'

const MODE_ID = 'pivot'
const tabId = (pivotId: string) => `pivot-triage-${pivotId}`

const pivotIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`
const targetIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>`
const lassoIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6c4-4 12-4 16 0s0 12-8 14C6 18 0 10 4 6z"/></svg>`

export interface PivotPluginOptions {
    pivots: PivotDefinition[]
    /**
     * `'auto'` (default) shows the rail button only while a pivot is registered; `true` always;
     * `false` never. This is the gate that keeps the mode from existing for a consumer who
     * registered none.
     */
    pivotMode?: boolean | 'auto'
}

export function pivotPlugin(options: PivotPluginOptions): PivotickPlugin & { manager?: PivotManager } {
    const narrowing = new Map<string, PivotNarrowing>()
    const openTabs = new Map<string, () => void>()
    let manager: PivotManager
    let ctx: PluginContext
    let origin: Node[] = []
    let undoToast: ToastHandle | undefined
    const panelHost = document.createElement('div')
    panelHost.className = 'pvtp-panel-host'

    const inPivotMode = () => ctx.ui.modeStore.getState().mode === MODE_ID

    const plugin: PivotickPlugin & { manager?: PivotManager } = {
        name: 'pivot-prototype',
        install(context) {
            ctx = context
            manager = new PivotManager(ctx.graph)
            plugin.manager = manager
            for (const def of options.pivots) manager.register(def)

            const gate = options.pivotMode ?? 'auto'
            if (gate === false) return
            if (gate === 'auto' && manager.size === 0) return

            // --- the mode itself -------------------------------------------------------
            ctx.addRailMode({
                id: MODE_ID,
                label: 'Pivot',
                icon: pivotIcon,
                kind: 'pointer',
                shortcut: 'P',
                // Deliberately no defaultTool: ModeRail paints a registered mode's button with
                // the ARMED tool's face (`tool?.label ?? mode.label`), so declaring one would
                // make the rail read "Pick origin" instead of "Pivot". Picking an origin is the
                // mode's resting behaviour, exactly as pointing is Select's.
                defaultTool: null,
                tools: [
                    {
                        id: 'pick-origin',
                        label: 'Pick origin',
                        icon: targetIcon,
                        kind: 'action',
                        run: () => ctx.graph.notifier.info('Pivot', 'Click a node on the canvas to make it the origin.'),
                    },
                    {
                        id: 'lasso-origin',
                        label: 'Lasso origin',
                        icon: lassoIcon,
                        kind: 'toggle',
                        run: (armed) => {
                            // Reuse the real lasso rather than inventing a second one.
                            const interaction = ctx.graph.renderer.getGraphInteraction()
                            ;(interaction as unknown as { setLassoMode?: (on: boolean) => void }).setLassoMode?.(armed)
                        },
                    },
                ],
                // A persistent host we re-render into ourselves. The tool panel only rebuilds
                // on a mode change, so asking it to re-render on every summarize would not work
                // — and owning the element keeps the panel's own state under our control.
                render: () => {
                    rebuildPanel()
                    return panelHost
                },
                // D11: the mode boundary IS the intent boundary.
                onEnter: () => {
                    syncOrigin()
                    summarizeAll()
                },
                onExit: () => manager.cancelAll(),
            })

            // The origin follows the selection while the mode is active. Selection with the
            // mode closed costs nothing — which is the whole point of D11.
            const interaction = ctx.graph.renderer.getGraphInteraction()
            const onSelectionChanged = () => {
                if (!inPivotMode()) return
                syncOrigin()
                summarizeAll()
                refreshPanel()
            }
            for (const event of ['selectNode', 'unselectNode', 'selectNodes', 'unselectNodes'] as const) {
                interaction.on(event, onSelectionChanged)
            }

            manager.on(() => {
                refreshPanel()
                syncTabs()
            })
        },
    }

    function syncOrigin(): void {
        const interaction = ctx.graph.renderer.getGraphInteraction()
        const many = interaction.getSelectedNodes().map((s) => s.node)
        const one = interaction.getSelectedNode()?.node
        origin = many.length ? many : one ? [one] : []
    }

    function summarizeAll(): void {
        // Deduped by id: with an empty origin, `applicable` already returns the origin-less
        // pivots, so a naive concat summarizes each of them twice.
        const seen = new Set<string>()
        for (const def of [...manager.applicable(origin), ...manager.originLess()]) {
            if (seen.has(def.id) || !def.summarize) continue
            seen.add(def.id)
            void manager.summarize(def, origin, narrowing.get(def.id) ?? {})
        }
    }

    function rebuildPanel(): void {
        // Re-rendering loses focus, so put it back where the analyst left it — otherwise a
        // re-summarize triggered by typing would eject the cursor from the box being typed in.
        const active = document.activeElement as HTMLElement | null
        const key = active?.dataset?.focusKey
        const caret = active instanceof HTMLInputElement ? active.selectionStart : null

        panelHost.replaceChildren(buildPanel({
            manager,
            origin: () => origin,
            clearOrigin: () => {
                ctx.graph.renderer.getGraphInteraction().unselectAll()
                origin = []
                rebuildPanel()
            },
            showTriage: (pivotId) => ctx.ui.activateDockTab(tabId(pivotId)),
            narrowing,
            resummarize: (def) => void manager.summarize(def, origin, narrowing.get(def.id) ?? {}),
            run: (def) => void runPivot(def),
        }))

        if (!key) return
        const restored = panelHost.querySelector<HTMLInputElement>(`[data-focus-key="${CSS.escape(key)}"]`)
        if (!restored) return
        restored.focus()
        if (caret != null && typeof restored.setSelectionRange === 'function') {
            restored.setSelectionRange(caret, caret)
        }
    }

    function refreshPanel(): void {
        if (!inPivotMode()) return
        rebuildPanel()
    }

    /** One dock tab per pivot with a live candidate set (PRD §11.4). */
    function syncTabs(): void {
        for (const [pivotId, set] of manager.sets) {
            if (openTabs.has(pivotId)) {
                ctx.refreshDockTab(tabId(pivotId))
                continue
            }
            const dispose = ctx.addDockTab({
                id: tabId(pivotId),
                label: set.label,
                render: () => {
                    const host = document.createElement('div')
                    host.className = 'pvtp-triage-host'
                    const live = manager.sets.get(pivotId)
                    if (live) {
                        host.appendChild(buildTriage(live, {
                            manager,
                            onIngest: (s) => ingest(s),
                            refresh: () => {
                                const def = manager.get(pivotId)
                                if (def) void runPivot(def)
                            },
                        }))
                    }
                    return host
                },
            })
            openTabs.set(pivotId, dispose)
            ctx.ui.activateDockTab?.(tabId(pivotId))
        }

        for (const [pivotId, dispose] of [...openTabs]) {
            if (manager.sets.has(pivotId)) continue
            dispose()
            openTabs.delete(pivotId)
        }
    }

    async function runPivot(def: PivotDefinition): Promise<void> {
        await manager.run(def, def.origin === 'none' ? [] : origin, narrowing.get(def.id) ?? {})
        const set = manager.sets.get(def.id)
        if (!set && def.autoIngest) {
            // Auto-ingest already landed inside run(); the toast is its only surface (D13).
            announceLastRun()
        }
    }

    function ingest(set: ReturnType<PivotManager['sets']['get']> extends infer T ? NonNullable<T> : never): void {
        const run = manager.ingest(set)
        if (!run) return
        announceRun(run.runId)
    }

    function announceLastRun(): void {
        const run = manager.undoStack[manager.undoStack.length - 1]
        if (run) announceRun(run.runId)
    }

    function announceRun(runId: string): void {
        const run = manager.undoStack.find((r) => r.runId === runId)
        if (!run) return
        const host = ctx.layout?.notification
        if (!host) return

        undoToast?.dismiss()
        undoToast = showToast(host, {
            level: 'success',
            title: `Ingested ${run.nodeIds.length.toLocaleString()} nodes, ${run.edgeIds.length.toLocaleString()} edges`,
            message: run.origin.length ? `around ${run.origin[0].id} · tagged ${run.pivotId}` : `at the viewport centre · tagged ${run.pivotId}`,
            action: {
                label: 'Undo',
                onClick: () => {
                    manager.undo(run.runId)
                    // The same toast flips in place rather than stacking a second one (C9).
                    undoToast?.update({
                        level: 'info',
                        title: 'Undone',
                        message: `${run.nodeIds.length} nodes, ${run.edgeIds.length} edges removed`,
                        action: { label: 'Redo', onClick: () => { manager.redo(); undoToast?.dismiss() } },
                    })
                },
            },
        })
    }

    return plugin
}
