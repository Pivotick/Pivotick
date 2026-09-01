// Phase B prototype — the pivot/enrichment pipeline running against the real library.
//
// The graph, the rail, the tool panel, the dock and the table are all Pivotick's own. What is
// new is the pivot plugin (prototype/pivot/) and the fake provider (prototype/providers.ts),
// so what this page proves is that the design fits the real extension points.

import { Graph } from '../src/Graph'
import type { NodeBadge } from '../src/interfaces/RendererOptions'
import type { Node } from '../src/Node'
import { pivotPlugin } from './pivot/plugin'
import { allPivots, callLog, harness, onCallLog } from './providers'
import './prototype.scss'

// --- seed graph ------------------------------------------------------------------------
// A dozen nodes: one fat AIL paste that declares 2,100 correlations, one MISP event, and
// enough neighbours that ingested nodes have something to land among.

const data = {
    nodes: [
        { id: 'paste-2f9c', expanded: false, x: 0, y: 0, data: { label: 'paste-2f9c', type: 'paste', potential: 2100, first_seen: '2026-08-14', tlp: 'amber', feeder: 'pastebin' } },
        { id: 'event-5f2a', expanded: false, x: 260, y: -120, data: { label: 'event 5f2a', type: 'event', potential: 12 } },
        { id: 'circl.lu', expanded: false, x: -180, y: -90, data: { label: 'circl.lu', type: 'domain' } },
        { id: '185.12.44.3', expanded: false, x: -200, y: 80, data: { label: '185.12.44.3', type: 'ip' } },
        { id: 'paste-77ab', expanded: false, x: 120, y: 140, data: { label: 'paste-77ab', type: 'paste', potential: 18 } },
        { id: 'paste-91de', expanded: false, x: -60, y: 190, data: { label: 'paste-91de', type: 'paste' } },
        { id: 'example.org', expanded: false, x: 220, y: 60, data: { label: 'example.org', type: 'domain' } },
        { id: 'evil.tld', expanded: false, x: -300, y: -10, data: { label: 'evil.tld', type: 'domain' } },
    ],
    edges: [
        { from: 'paste-2f9c', to: 'circl.lu', data: { kind: 'mentions' } },
        { from: 'paste-2f9c', to: '185.12.44.3', data: { kind: 'mentions' } },
        { from: 'paste-2f9c', to: 'paste-77ab', data: { kind: 'same-source' } },
        { from: 'paste-2f9c', to: 'event-5f2a', data: { kind: 'referenced-by' } },
        { from: 'paste-91de', to: 'circl.lu', data: { kind: 'mentions' } },
        { from: 'example.org', to: '185.12.44.3', data: { kind: 'resolves' } },
        { from: 'evil.tld', to: '185.12.44.3', data: { kind: 'resolves' } },
    ],
}

const TYPE_COLOURS: Record<string, string> = {
    paste: '#c9a227',
    domain: '#25B6EB',
    ip: '#a06be0',
    url: '#8fd14f',
    event: '#eb2e53',
    object: '#a06be0',
    container: '#888888',
    bulk: '#999999',
}

/** Declared potential only — never a queried count, and nothing here reacts to selection (D12). */
function badges(node: Node): NodeBadge[] {
    const potential = (node.getData() as { potential?: number })?.potential
    if (!potential) return []
    // Three characters is the library's limit — anything longer renders as `99+`, so "2.1k"
    // silently becomes "99+" and the badge stops advertising anything.
    const text = potential >= 1000 ? `${Math.round(potential / 1000)}k` : String(potential)
    return [{
        text,
        title: `~${potential.toLocaleString()} correlations · AIL`,
        onClick: () => {
            // The badge is a shortcut into the mode, and it consumes the click, so we select
            // the node deliberately rather than by accident (C12).
            graph.renderer.getGraphInteraction().selectNode(node.getGraphElement(), node)
            graph.UIManager.modeStore.setMode('pivot')
        },
    }]
}

const plugin = pivotPlugin({ pivots: allPivots, pivotMode: 'auto' })

const graph = new Graph(document.getElementById('app')!, data, {
    render: {
        nodeTypeAccessor: (node: Node) => (node.getData() as { type?: string })?.type,
        defaultNodeStyle: {
            size: 16,
            text: (node: Node) => (node.getData() as { label?: string })?.label,
            color: (node: Node) => TYPE_COLOURS[(node.getData() as { type?: string })?.type ?? ''] ?? '#999999',
            badges,
        },
        nodeStyleMap: {
            paste: { size: 22 },
            event: { shape: 'hexagon', size: 26 },
        },
    },
    UI: {
        mode: 'full',
        dock: { open: true },
        legend: { enabled: false },
    },
    plugins: [plugin],
} as never)

// --- harness ---------------------------------------------------------------------------
// The call log is how the "selection alone fires zero provider calls" rule is demonstrated
// rather than asserted: select nodes with the mode closed and nothing appears here.

const logBody = document.getElementById('call-log')!
const logCount = document.getElementById('call-log-count')!

function cell(text: string, className: string): HTMLElement {
    const el = document.createElement('span')
    el.className = className
    el.textContent = text
    return el
}

function renderLog(): void {
    logCount.textContent = `${callLog.length} call${callLog.length === 1 ? '' : 's'}`
    logBody.replaceChildren(...callLog.slice(0, 60).map((entry) => {
        const row = document.createElement('div')
        row.className = `log-row log-${entry.outcome}`
        const time = new Date(entry.at).toLocaleTimeString()
        row.append(
            cell(time, 'log-time'),
            cell(entry.call, 'log-call'),
            cell(entry.pivotId, 'log-pivot'),
            cell(entry.args, 'log-args'),
            cell(entry.ms != null ? `${entry.ms}ms` : '', 'log-ms'),
            cell(entry.outcome, 'log-outcome'),
        )
        return row
    }))
    if (callLog.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'log-empty'
        empty.textContent = 'No provider calls yet. Select nodes with Pivot mode closed — this stays empty.'
        logBody.appendChild(empty)
    }
}

onCallLog(renderLog)
renderLog()

const latency = document.getElementById('latency') as HTMLInputElement
const latencyOut = document.getElementById('latency-value')!
latency.addEventListener('input', () => {
    const value = Number(latency.value)
    harness.latencyMin = Math.max(0, value - 200)
    harness.latencyMax = value + 200
    latencyOut.textContent = `${value} ms`
})

const failNext = document.getElementById('fail-next') as HTMLInputElement
failNext.addEventListener('change', () => { harness.failNext = failNext.checked })
setInterval(() => { if (!harness.failNext) failNext.checked = false }, 500)

document.getElementById('clear-log')!.addEventListener('click', () => {
    callLog.length = 0
    renderLog()
})

// Handy for poking at the prototype from the console.
Object.assign(window, { graph, pivots: plugin.manager })
