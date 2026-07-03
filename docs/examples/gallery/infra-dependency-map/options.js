import { ColorPaletteMapper } from '../../../../src/index'

// #region data
// A service dependency map. The app tier is a flat set of services with directed
// dependencies; the two backend subsystems (Data stores, Observability) are
// *clusters* — nodes with `children` — that the app services depend on. Collapse a
// subsystem and every service's links into it fold into a single arrow to the box,
// so the map stays readable; expand it to see what's inside.
const data = {
    nodes: [
        // Ingress + app tier (flat, always visible).
        { id: 'cdn', data: { label: 'CDN', tier: 'Ingress' } },
        { id: 'lb', data: { label: 'Load balancer', tier: 'Ingress' } },
        { id: 'web', data: { label: 'Web app', tier: 'App' } },
        { id: 'gateway', data: { label: 'API gateway', tier: 'App' } },
        { id: 'admin', data: { label: 'Admin', tier: 'App' } },
        { id: 'auth', data: { label: 'Auth', tier: 'Core' } },
        { id: 'orders', data: { label: 'Orders', tier: 'Core' } },
        { id: 'payments', data: { label: 'Payments', tier: 'Core' } },

        // Backend subsystems, collapsed into boxes by default.
        {
            id: 'datastores', data: { label: 'Data stores', tier: 'Data' }, expanded: false,
            children: [
                { id: 'postgres', data: { label: 'Postgres', tier: 'Data' } },
                { id: 'redis', data: { label: 'Redis', tier: 'Data' } },
                { id: 'kafka', data: { label: 'Kafka', tier: 'Data' } },
                { id: 'blob', data: { label: 'Blob store', tier: 'Data' } }
            ]
        },
        {
            id: 'observability', data: { label: 'Observability', tier: 'Observability' }, expanded: false,
            children: [
                { id: 'metrics', data: { label: 'Metrics', tier: 'Observability' } },
                { id: 'logs', data: { label: 'Logs', tier: 'Observability' } },
                { id: 'traces', data: { label: 'Traces', tier: 'Observability' } }
            ]
        }
    ],
    edges: [
        // App tier (always visible). `weight` thickens the link.
        { from: 'cdn', to: 'web', data: { weight: 3 } },
        { from: 'lb', to: 'web', data: { weight: 3 } },
        { from: 'lb', to: 'gateway', data: { weight: 2 } },
        { from: 'web', to: 'auth', data: { weight: 2 } },
        { from: 'web', to: 'orders', data: { weight: 3 } },
        { from: 'admin', to: 'auth', data: { weight: 1 } },
        { from: 'gateway', to: 'orders', data: { weight: 2 } },
        { from: 'gateway', to: 'payments', data: { weight: 2 } },
        { from: 'orders', to: 'payments', data: { weight: 3 } },
        // Into the Data stores subsystem — these fold into one arrow when collapsed.
        { from: 'orders', to: 'postgres', data: { weight: 3 } },
        { from: 'payments', to: 'postgres', data: { weight: 2 } },
        { from: 'auth', to: 'redis', data: { weight: 2 } },
        { from: 'web', to: 'blob', data: { weight: 1 } },
        { from: 'payments', to: 'kafka', data: { weight: 2, async: true } },
        { from: 'orders', to: 'kafka', data: { weight: 1, async: true } },
        // Into the Observability subsystem.
        { from: 'orders', to: 'metrics', data: { weight: 1, async: true } },
        { from: 'payments', to: 'logs', data: { weight: 1, async: true } },
        { from: 'gateway', to: 'traces', data: { weight: 1, async: true } }
    ]
}
// #endregion data

// #region options
// import { ColorPaletteMapper } from 'pivotick'

// Colourblind-safe palette, one hue per tier (a subsystem and its children share it).
const palette = new ColorPaletteMapper('okabe-ito')

const options = {
    render: {
        // Subsystems are expandable out of the box: a +/- badge appears on each and
        // a click toggles it (see the Expand/collapse tab for the programmatic path).
        enableNodeExpansion: true,
        defaultNodeStyle: {
            size: 13,
            strokeColor: '#ffffff',
            textColor: '#1e293b',
            text: (node) => node.getData()?.label,
            textVerticalShift: -1.8,
            color: (node) => palette.getColor(node.getData()?.tier)
        },
        defaultEdgeStyle: {
            curveStyle: 'straight',
            markerEnd: 'arrow',
            // Async links (to the queue / telemetry) flow as dashed amber.
            strokeColor: (edge) => (edge.getData()?.async ? '#E69F00' : '#94a3b8'),
            strokeWidth: (edge) => 1 + (edge.getData()?.weight ?? 1) * 0.6,
            dashed: (edge) => !!edge.getData()?.async,
            animateDash: true,
            opacity: 0.85
        }
    },
    simulation: {
        // Gentle repulsion so the tiers spread a little without the weakly-linked
        // subsystems drifting off.
        d3ManyBodyStrength: -140,
        d3LinkDistance: 55
    }
}
// #endregion options

// #region expand
// Expand or collapse both subsystems at once. toggleExpandNode takes a Node
// instance, so resolve the id first; node.expanded tells you the current state.
function setAllExpanded(graph, expanded) {
    ['datastores', 'observability'].forEach((id) => {
        const node = graph.getMutableNode(id)
        if (node && !!node.expanded !== expanded) graph.toggleExpandNode(node)
    })
}
// #endregion expand

// Demo plumbing (not part of the API you copy): seed a tidy top-down starting
// layout — ingress at the top, the app tier below it, the two subsystems at the
// bottom — so the force layout settles into a clean, readable map. In your app the
// layout does this for you from any starting point.
const positions = {
    cdn: [-100, -150], lb: [60, -150],
    web: [-90, -60], gateway: [60, -60], admin: [190, -100],
    auth: [160, 20], orders: [-20, 30], payments: [-190, 0],
    datastores: [-120, 150], observability: [150, 150]
}

async function onLoaded(graph) {
    Object.entries(positions).forEach(([id, [x, y]]) => {
        const node = graph.getMutableNode(id)
        if (node) {
            node.x = x
            node.y = y
        }
    })
    graph.simulation.reheat()
    await graph.simulation.waitForSimulationStop()
    // Cluster nodes draw their badges/radius over the next few frames; wait for
    // that to settle before framing so fitAndCenter measures the final layout.
    await new Promise((resolve) => setTimeout(resolve, 800))
    graph.renderer.fitAndCenter()
}

export { data, options, setAllExpanded, onLoaded }
