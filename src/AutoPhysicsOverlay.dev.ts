/**
 * DEVELOPMENT ONLY — the `Auto` physics strategy bake-off rig. Delete this file,
 * and its two call sites in `src/main.ts`, once a strategy has been chosen.
 *
 * Three things live here:
 *
 *  - `?autoStrategy=hybrid|fill|feedback` in the URL, so the candidates can be
 *    swapped on the running dev server rather than by editing and reloading.
 *  - `?physics=auto|manual`, which is what makes an A/B possible at all: this demo
 *    page sets `d3LinkDistance`, so auto is correctly *off* here by default and
 *    there would otherwise be nothing to look at without editing the file.
 *  - A corner readout of what the tuner last decided and what the layout actually
 *    came out as, so the comparison is made against numbers rather than against
 *    an impression of which one "looks better".
 *
 * Nothing here is exported from `src/index.ts`, so it never reaches a bundle.
 */
import type { Pivotick } from './index'
import { isAutoStrategyName, measureLayout } from './AutoPhysics'

/** How often the readout re-measures. Cheap: the overlap scan is a spatial hash. */
const REFRESH_MS = 250

/** Apply `?autoStrategy=` and `?physics=` if present. Returns the strategy in force. */
export function applyAutoStrategyFromUrl(graph: Pivotick): string {
    const params = new URLSearchParams(window.location.search)
    const physics = params.get('physics')
    const strategy = params.get('autoStrategy')

    if (physics === 'auto') graph.simulation.enableAutoPhysics()
    else if (physics === 'manual') graph.simulation.disableAutoPhysics()
    else if (physics) console.warn(`[Pivotick] unknown physics "${physics}" (auto|manual)`)

    if (isAutoStrategyName(strategy)) graph.simulation.setAutoStrategy(strategy)
    else if (strategy) console.warn(`[Pivotick] unknown autoStrategy "${strategy}"`)

    // These flags land *after* the graph has already computed its opening layout from
    // whatever `main.ts` configured, so without a fresh layout pass the comparison
    // would be "auto relaxing a pinned layout" rather than "auto laying it out" —
    // which is the thing being judged. Re-run once the first pass has finished, so
    // the two never race for the same node positions.
    if (physics || strategy) {
        graph.on('ready', () => {
            void graph.simulation.start().then(() => graph.renderer.fitAndCenterWhenSettled())
        })
    }
    return graph.simulation.getAutoStrategy()
}

/** Pin a live metrics readout to the bottom-right of the viewport. */
export function mountAutoMetricsOverlay(graph: Pivotick): () => void {
    const box = document.createElement('pre')
    box.style.cssText = [
        'position:fixed', 'right:12px', 'bottom:12px', 'z-index:99999',
        'margin:0', 'padding:8px 10px', 'border-radius:6px',
        'background:rgba(17,24,39,.88)', 'color:#e5e7eb',
        'font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
        'pointer-events:none', 'white-space:pre', 'letter-spacing:.02em',
    ].join(';')
    document.body.appendChild(box)

    const render = () => {
        const simulation = graph.simulation
        const run = simulation.getAutoRun()
        const knobs = simulation.getPhysicsKnobs()
        const canvasBox = graph.renderer.getCanvas()?.getBoundingClientRect()
        const canvas = { width: canvasBox?.width ?? 0, height: canvasBox?.height ?? 0 }
        const measured = measureLayout(
            graph.getMutableNodes()
                .filter(node => node.visible)
                .map(node => ({ x: node.x, y: node.y, radius: node.getCircleRadius() })),
            canvas,
        )
        const context = run?.context
        const mode = simulation.isAutoPhysicsEnabled() ? simulation.getAutoStrategy() : 'manual (auto off)'

        box.textContent = [
            `auto: ${mode}${run?.skipped ? '  [deadband]' : ''}`,
            `N ${context?.nodeCount ?? '–'}  r̄ ${(context?.radii.mean ?? 0).toFixed(0)}  ` +
                `comp ${context?.componentCount ?? '–'}  canvas ${canvas.width | 0}x${canvas.height | 0}`,
            `rep ${knobs.repulsion}  link ${knobs.linkDistance}  coll ${knobs.collisionRadius}  fric ${knobs.friction}`,
            `cent ${knobs.centering}  settle ${knobs.settleTime}s`,
            `fill ${(measured.fill * 100).toFixed(0)}%  overlaps ${measured.overlaps}`,
            `nn-gap ${measured.nearestNeighbourGap.toFixed(2)}r  ` +
                `bbox ${measured.bbox.width | 0}x${measured.bbox.height | 0}`,
        ].join('\n')
    }

    render()
    const timer = window.setInterval(render, REFRESH_MS)
    return () => {
        window.clearInterval(timer)
        box.remove()
    }
}
