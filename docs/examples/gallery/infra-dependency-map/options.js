import { ColorPaletteMapper } from '../../../../src/index'

// #region data
// A service dependency map where *every tier is a cluster* — a node with
// `children`. Collapsed, the map is just the tiers and the dependencies between
// them (box → box); a link between two services in different tiers folds into a
// single arrow between their boxes. Expand a tier to drill into its services and
// see their real edges re-target as the boxes open. All edges are declared once,
// at the top level, between the real services — the boxes are derived.
const data = {
    nodes: [
        {
            id: 'ingress', data: { label: 'Ingress', tier: 'Ingress' }, expanded: false,
            children: [
                { id: 'cdn', data: { label: 'CDN', tier: 'Ingress' } },
                { id: 'lb', data: { label: 'Load balancer', tier: 'Ingress' } }
            ]
        },
        {
            id: 'app', data: { label: 'App tier', tier: 'App' }, expanded: false,
            children: [
                { id: 'web', data: { label: 'Web app', tier: 'App' } },
                { id: 'gateway', data: { label: 'API gateway', tier: 'App' } },
                { id: 'admin', data: { label: 'Admin', tier: 'App' } }
            ]
        },
        {
            id: 'core', data: { label: 'Core services', tier: 'Core' }, expanded: false,
            children: [
                { id: 'auth', data: { label: 'Auth', tier: 'Core' } },
                { id: 'orders', data: { label: 'Orders', tier: 'Core' } },
                { id: 'payments', data: { label: 'Payments', tier: 'Core' } }
            ]
        },
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
        // Ingress → App. `weight` thickens the link once the tiers are open.
        { from: 'cdn', to: 'web', data: { weight: 3 } },
        { from: 'lb', to: 'web', data: { weight: 3 } },
        { from: 'lb', to: 'gateway', data: { weight: 2 } },
        // App → Core.
        { from: 'web', to: 'auth', data: { weight: 2 } },
        { from: 'web', to: 'orders', data: { weight: 3 } },
        { from: 'admin', to: 'auth', data: { weight: 1 } },
        { from: 'gateway', to: 'orders', data: { weight: 2 } },
        { from: 'gateway', to: 'payments', data: { weight: 2 } },
        // Inside Core (only visible once the Core box is open).
        { from: 'orders', to: 'payments', data: { weight: 3 } },
        // Core → Data stores.
        { from: 'orders', to: 'postgres', data: { weight: 3 } },
        { from: 'payments', to: 'postgres', data: { weight: 2 } },
        { from: 'auth', to: 'redis', data: { weight: 2 } },
        { from: 'web', to: 'blob', data: { weight: 1 } }, // App → Data stores
        { from: 'payments', to: 'kafka', data: { weight: 2, async: true } },
        { from: 'orders', to: 'kafka', data: { weight: 1, async: true } },
        // → Observability (async telemetry).
        { from: 'orders', to: 'metrics', data: { weight: 1, async: true } },
        { from: 'payments', to: 'logs', data: { weight: 1, async: true } },
        { from: 'gateway', to: 'traces', data: { weight: 1, async: true } }
    ]
}
// #endregion data

// #region options
// import { ColorPaletteMapper } from 'pivotick'

// Colourblind-safe palette, one hue per tier (a tier box and its children share it).
const palette = new ColorPaletteMapper('okabe-ito')

const options = {
    render: {
        // Tiers are expandable out of the box: a +/- badge appears on each box and a
        // click toggles it (see the Expand/collapse tab for the programmatic path).
        enableNodeExpansion: true,
        defaultNodeStyle: {
            size: 22,
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
        // Gentle repulsion so the tier boxes spread a little without the
        // weakly-linked ones drifting off.
        d3ManyBodyStrength: -140,
        d3LinkDistance: 55
    }
}
// #endregion options

// #region expand
// Expand or collapse every tier at once. toggleExpandNode takes a Node instance,
// so resolve the id first; node.expanded tells you the current state.
const tiers = ['ingress', 'app', 'core', 'datastores', 'observability']
function setAllExpanded(graph, expanded) {
    tiers.forEach((id) => {
        const node = graph.getMutableNode(id)
        if (node && !!node.expanded !== expanded) graph.toggleExpandNode(node)
    })
}
// #endregion expand

// Demo plumbing (not part of the API you copy): seed a tidy top-down starting
// layout — ingress at the top, then app, core, and the two backend tiers at the
// bottom — so the collapsed boxes settle into a clean, readable flow. In your app
// the layout does this for you from any starting point.
const positions = {
    ingress: [0, -180],
    app: [0, -60],
    core: [0, 55],
    datastores: [-120, 180],
    observability: [140, 180]
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
    // Cluster nodes draw their badges/radius over the next few frames; fitAndCenterWhenSettled
    // waits for that layout to stabilise so it frames the final map, not a transient bbox.
    graph.renderer.fitAndCenterWhenSettled()
}

export { data, options, setAllExpanded, onLoaded }
