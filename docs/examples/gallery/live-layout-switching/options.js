// #region data
const data = {
    nodes: [
        { id: 'ceo', data: { label: 'CEO' } },
        { id: 'cto', data: { label: 'CTO' } },
        { id: 'cfo', data: { label: 'CFO' } },
        { id: 'coo', data: { label: 'COO' } },
        { id: 'eng', data: { label: 'Engineering' } },
        { id: 'platform', data: { label: 'Platform' } },
        { id: 'infra', data: { label: 'Infra' } },
        { id: 'data', data: { label: 'Data' } },
        { id: 'finance', data: { label: 'Finance' } },
        { id: 'billing', data: { label: 'Billing' } },
        { id: 'ops', data: { label: 'Operations' } },
        { id: 'support', data: { label: 'Support' } },
        { id: 'qa', data: { label: 'QA' } }
    ],
    edges: [
        { from: 'ceo', to: 'cto' },
        { from: 'ceo', to: 'cfo' },
        { from: 'ceo', to: 'coo' },
        { from: 'cto', to: 'eng' },
        { from: 'cto', to: 'platform' },
        { from: 'platform', to: 'infra' },
        { from: 'platform', to: 'data' },
        { from: 'eng', to: 'qa' },
        { from: 'cfo', to: 'finance' },
        { from: 'cfo', to: 'billing' },
        { from: 'coo', to: 'ops' },
        { from: 'coo', to: 'support' }
    ]
}
// #endregion data

// #region options
// Start on a vertical tree; the cycle below switches it at runtime.
const options = {
    layout: { type: 'tree', rootId: 'ceo' },
    render: {
        defaultNodeStyle: {
            size: 13,
            color: '#0ea5e9',
            strokeColor: '#ffffff',
            strokeWidth: 2,
            textColor: '#334155',
            text: (node) => node.getData()?.label,
            textVerticalShift: -1.6
        },
        defaultEdgeStyle: {
            markerEnd: 'arrow',
            curveStyle: 'straight'
        }
    }
}
// #endregion options

// #region cycle
// The layouts to rotate through. The initial render is already STATES[0].
const STATES = [
    { label: 'Vertical tree', type: 'tree', options: { layout: { rootId: 'ceo', horizontal: false, radial: false } } },
    { label: 'Horizontal tree', type: 'tree', options: { layout: { rootId: 'ceo', horizontal: true, radial: false } } },
    { label: 'Radial tree', type: 'tree', options: { layout: { rootId: 'ceo', radial: true } } },
    { label: 'Force', type: 'force', options: {} }
]

let timer = null
let stopped = false

// Switch layouts on a timer. `changeLayout` resolves only once the new layout
// has settled and re-centered, so we await it, then pause before the next.
function startCycling(graph, onState) {
    stopped = false
    let i = 0
    const step = async () => {
        if (stopped) return
        i = (i + 1) % STATES.length
        const state = STATES[i]
        onState?.(state.label)
        await graph.simulation.changeLayout(state.type, state.options)
        if (stopped) return
        timer = setTimeout(step, 1800)
    }
    timer = setTimeout(step, 2400)
}

// Cleared from the demo's onUnmountedCallback so the timer can't outlive the graph.
function stopCycling() {
    stopped = true
    if (timer) clearTimeout(timer)
    timer = null
}
// #endregion cycle

export { data, options, startCycling, stopCycling }
