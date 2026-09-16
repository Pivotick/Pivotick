/**
 * Cost bench for zoom-driven level-of-detail (scratch, not shipped).
 *
 * Boots a grid of N nodes with the simulation off, then swaps every node between
 * two representations the MISP node designs actually use:
 *
 *   'shape' — native circle + `svgIcon` glyph  (the S tier)
 *   'card'  — `shape:'none'` + a 140x44 `html` card (the M tier)
 *
 * and times the swap. `window.__bench` is the whole surface a driver script needs.
 */
import { Pivotick, Node } from './index'
import type { RawEdge, RawNode } from './interfaces/GraphOptions'

type Tier = 'shape' | 'card'

/** Current tier — read by the style callbacks, so a swap is one assignment + a redraw. */
let tier: Tier = 'shape'

const GLYPH = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 9 L22 20 L10 20 Z" fill="currentColor"/></svg>'

/** The M-tier card: a fixed 140x44 box, so measurement is font-independent. */
function buildCard(node: Node): HTMLElement {
    const el = document.createElement('div')
    el.style.cssText = 'display:inline-flex;box-sizing:border-box;align-items:center;gap:6px;'
        + 'width:140px;height:44px;padding:0 8px;border:1px solid #334155;border-radius:6px;background:#fff'
    const dot = document.createElement('span')
    dot.style.cssText = 'flex:0 0 20px;height:20px;border-radius:50%;background:#1892B1'
    const text = document.createElement('span')
    text.style.cssText = 'font:12px/1.2 sans-serif;color:#0f172a;overflow:hidden;white-space:nowrap'
    text.textContent = String(node.getData().label ?? node.id)
    el.append(dot, text)
    return el
}

function buildData(n: number): { nodes: Node[]; edges: never[] } {
    const cols = Math.ceil(Math.sqrt(n))
    const nodes: Node[] = []
    for (let i = 0; i < n; i++) {
        const node = new Node(`n-${i}`, { label: `10.13.${Math.floor(i / 256)}.${i % 256}` }, {}, `n-${i}`)
        node.x = (i % cols) * 180
        node.y = Math.floor(i / cols) * 90
        nodes.push(node)
    }
    return { nodes, edges: [] }
}

/**
 * A connected graph laid out by the simulation rather than placed on a grid —
 * what the spacing question actually applies to. Each node attaches to one
 * earlier node (a spanning tree), plus a few extra edges for structure.
 */
function buildConnected(n: number): { nodes: RawNode[]; edges: RawEdge[] } {
    const nodes: RawNode[] = []
    const edges: RawEdge[] = []
    for (let i = 0; i < n; i++) {
        nodes.push({ id: `n-${i}`, data: { label: `10.13.${Math.floor(i / 256)}.${i % 256}` } })
        if (i > 0) {
            // Deterministic parent, biased towards recent nodes so the tree branches.
            const parent = Math.max(0, i - 1 - ((i * 7919) % Math.min(i, 6)))
            edges.push({ id: `e-${i}`, from: `n-${parent}`, to: `n-${i}` })
        }
    }
    for (let j = 0; j < Math.floor(n / 8); j++) {
        const a = (j * 3571) % n
        const b = (j * 6949 + 13) % n
        if (a !== b) edges.push({ id: `x-${j}`, from: `n-${a}`, to: `n-${b}` })
    }
    return { nodes, edges }
}

const params = new URLSearchParams(location.search)
const N = Number(params.get('n') ?? 500)
/** `?sim=1` leaves physics on, so the bench can see a swap reheat the layout. */
const SIM = params.get('sim') === '1'
/** `?physics=auto` uses the shipped Auto preset — the spacing a real integrator gets. */
const PHYSICS = params.get('physics') === 'auto' ? 'auto' : 'manual'
/** `?graph=connected` lays out a real connected graph instead of a fixed grid. */
const CONNECTED = params.get('graph') === 'connected'

const container = document.getElementById('app') as HTMLElement

const data = CONNECTED ? buildConnected(N) : buildData(N)

const graph = new Pivotick(container, data as never, {
    isDirected: false,
    UI: { mode: 'light', theme: 'light', sidebar: { collapsed: true } },
    simulation: { enabled: SIM, useWorker: false, physics: PHYSICS },
    render: {
        zoomAnimation: false,
        defaultNodeStyle: {
            shape: () => (tier === 'card' ? 'none' : 'circle'),
            size: 16,
            color: '#97CC04',
            strokeColor: '#4d6b00',
            svgIcon: () => (tier === 'card' ? undefined : GLYPH),
            html: (node: Node) => (tier === 'card' ? buildCard(node) : undefined),
        },
    },
} as never)

/** Resolve on the next frame — one hop of the rAF work `render()` defers. */
const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))

/** Wall-clock until the DOM stops changing, i.e. all deferred measurement has landed. */
async function settle(maxFrames = 240): Promise<number> {
    const start = performance.now()
    let quiet = 0
    for (let i = 0; i < maxFrames && quiet < 3; i++) {
        const before = document.querySelectorAll('#app foreignObject, #app g.pvt-node > *').length
        await frame()
        const after = document.querySelectorAll('#app foreignObject, #app g.pvt-node > *').length
        quiet = before === after ? quiet + 1 : 0
    }
    return performance.now() - start
}

/** Long tasks (>50 ms of blocked main thread) observed since the last reset. */
const longTasks: number[] = []
try {
    new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration)
    }).observe({ entryTypes: ['longtask'] })
} catch { /* not supported — the bench still reports sync + settle time */ }

let zoomEvents = 0

const api = {
    ready: false,
    nodeCount: N,

    /** How many nodes are in the DOM, and how many of them are cards. */
    counts(): { nodes: number; cards: number } {
        return {
            nodes: document.querySelectorAll('#app g.pvt-node').length,
            cards: document.querySelectorAll('#app g.pvt-node foreignObject').length,
        }
    },

    /** `renderer.update()` with nothing dirty: the fixed tax of the redraw pass. */
    noop(runs = 20): { median: number; mean: number } {
        const times: number[] = []
        for (let i = 0; i < runs; i++) {
            const t0 = performance.now()
            graph.renderer.update(false)
            times.push(performance.now() - t0)
        }
        times.sort((a, b) => a - b)
        return {
            median: times[Math.floor(times.length / 2)],
            mean: times.reduce((a, b) => a + b, 0) / times.length,
        }
    },

    /**
     * Swap `count` nodes (all of them by default) to `next` and time it.
     * `sync` is the blocking cost of `update()`; `settled` also covers the rAF
     * measurement pass that cards trigger.
     */
    async swap(next: Tier, count?: number): Promise<{
        sync: number; settled: number; longTasks: number[]; dirtied: number
    }> {
        longTasks.length = 0
        tier = next
        const nodes = graph.getMutableNodes()
        const subset = count === undefined ? nodes : nodes.slice(0, count)
        for (const node of subset) node.markDirty()
        const t0 = performance.now()
        graph.renderer.update(false)
        const sync = performance.now() - t0
        const settled = await settle()
        return { sync, settled, longTasks: [...longTasks], dirtied: subset.length }
    },

    /** Frame intervals while the viewport is panned programmatically, in ms. */
    async panFrames(steps = 60): Promise<number[]> {
        const renderer = graph.renderer as unknown as {
            getZoomTransform(): { k: number; x: number; y: number }
            setViewport(t: { x: number; y: number; scale: number }): void
        }
        const t = renderer.getZoomTransform()
        const deltas: number[] = []
        let last = performance.now()
        for (let i = 0; i < steps; i++) {
            renderer.setViewport({ x: -t.x / t.k + i * 4, y: -t.y / t.k, scale: t.k })
            await frame()
            const now = performance.now()
            deltas.push(now - last)
            last = now
        }
        return deltas
    },

    /**
     * Frame intervals while the viewport is *scaled*, in ms. Separate from
     * {@link panFrames} because a zoom re-rasterises every `foreignObject`,
     * where a pan only re-composites them.
     */
    async zoomFrames(steps = 60): Promise<number[]> {
        const renderer = graph.renderer as unknown as {
            getZoomTransform(): { k: number; x: number; y: number }
            setViewport(t: { x: number; y: number; scale: number }): void
        }
        const t = renderer.getZoomTransform()
        const deltas: number[] = []
        let last = performance.now()
        for (let i = 0; i < steps; i++) {
            // Sweep the scale up and back so the graph stays roughly in frame.
            const scale = t.k * (1 + 0.6 * Math.sin((i / steps) * Math.PI))
            renderer.setViewport({ x: -t.x / t.k, y: -t.y / t.k, scale })
            await frame()
            const now = performance.now()
            deltas.push(now - last)
            last = now
        }
        return deltas
    },

    zoomEventCount(): number { return zoomEvents },
    resetZoomCount(): void { zoomEvents = 0 },

    /** Node positions and collision radii, to see whether a swap disturbs the layout. */
    layout(): { pos: Record<string, [number, number]>; radius: Record<string, number> } {
        const pos: Record<string, [number, number]> = {}
        const radius: Record<string, number> = {}
        for (const node of graph.getMutableNodes()) {
            pos[node.id] = [node.x ?? 0, node.y ?? 0]
            radius[node.id] = node.getCircleRadius()
        }
        return { pos, radius }
    },

    /** Largest distance any node moved between two {@link layout} snapshots. */
    drift(before: Record<string, [number, number]>): number {
        let max = 0
        for (const node of graph.getMutableNodes()) {
            const was = before[node.id]
            if (!was) continue
            const dx = (node.x ?? 0) - was[0]
            const dy = (node.y ?? 0) - was[1]
            max = Math.max(max, Math.hypot(dx, dy))
        }
        return max
    },

    /**
     * What spacing the shipped physics actually produced, and what that means for
     * tier unlocking under rule B. Distances are graph units, which are CSS pixels
     * at zoom 1. `fitZoom` is the zoom the initial fit chose, so the `xFromFit`
     * figures say how far a user has to zoom in from first sight.
     */
    spacing(tierWidths: Record<string, number>): Record<string, unknown> {
        const nodes = graph.getMutableNodes().filter(n => n.visible)
        const nearest: number[] = []
        for (const a of nodes) {
            let best = Infinity
            for (const b of nodes) {
                if (a === b) continue
                const d = Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0))
                if (d < best) best = d
            }
            if (isFinite(best)) nearest.push(best)
        }
        nearest.sort((a, b) => a - b)
        const at = (q: number) => nearest[Math.floor(nearest.length * q)] ?? 0
        const median = at(0.5)

        const fitZoom = (graph.renderer as unknown as {
            getZoomTransform(): { k: number }
        }).getZoomTransform().k

        // Under rule B a tier unlocks when the on-screen gap can hold it:
        // spacing x zoom >= tierWidth.
        const unlock: Record<string, unknown> = {}
        for (const [name, width] of Object.entries(tierWidths)) {
            const zoom = median > 0 ? width / median : Infinity
            unlock[name] = {
                zoom: +zoom.toFixed(2),
                xFromFit: fitZoom > 0 ? +(zoom / fitZoom).toFixed(2) : null,
            }
        }

        return {
            nodes: nodes.length,
            nodeRadius: nodes[0]?.getCircleRadius() ?? 0,
            nearestNeighbour: {
                p10: +at(0.1).toFixed(1),
                median: +median.toFixed(1),
                p90: +at(0.9).toFixed(1),
            },
            fitZoom: +fitZoom.toFixed(3),
            unlock,
        }
    },

    /**
     * Cost of one `nextTick()` — rewriting every node transform and every edge path.
     * A fixed-screen-size mode has to do exactly this on each zoom event, because a
     * counter-scaled node changes both its own transform and where its edges land.
     */
    tickCost(runs = 30): { median: number; mean: number; edges: number } {
        const renderer = graph.renderer as unknown as { nextTick(): void }
        const times: number[] = []
        for (let i = 0; i < runs; i++) {
            const t0 = performance.now()
            renderer.nextTick()
            times.push(performance.now() - t0)
        }
        times.sort((a, b) => a - b)
        return {
            median: times[Math.floor(times.length / 2)],
            mean: times.reduce((a, b) => a + b, 0) / times.length,
            edges: graph.getMutableEdges().filter(e => e.visible).length,
        }
    },

    /** Current simulation temperature — non-zero means the layout is still moving. */
    alpha(): number {
        const sim = graph.simulation as unknown as { simulation?: { alpha(): number } }
        return sim?.simulation?.alpha?.() ?? -1
    },
}

;(window as unknown as { __bench: typeof api }).__bench = api

graph.on('ready', () => {
    graph.renderer.getGraphInteraction().on('canvasZoom', () => { zoomEvents++ })
    api.ready = true
})
