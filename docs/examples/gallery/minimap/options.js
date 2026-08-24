import { minimap } from '../../../../src/index'

// #region data
// A graph deliberately bigger than the viewport, so the minimap has something to
// navigate: six clusters of satellites around a spine.
const nodes = []
const edges = []
const hubs = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']

hubs.forEach((hub, hubIndex) => {
    const angle = (hubIndex / hubs.length) * Math.PI * 2
    nodes.push({
        id: hub,
        data: { name: hub, kind: 'hub' },
        x: Math.cos(angle) * 420,
        y: Math.sin(angle) * 420
    })
    if (hubIndex > 0) edges.push({ from: hubs[hubIndex - 1], to: hub })

    for (let leafIndex = 0; leafIndex < 9; leafIndex++) {
        const id = `${hub}-${leafIndex}`
        const spread = (leafIndex / 9) * Math.PI * 2
        nodes.push({
            id,
            data: { name: id, kind: 'leaf' },
            x: Math.cos(angle) * 420 + Math.cos(spread) * 130,
            y: Math.sin(angle) * 420 + Math.sin(spread) * 130
        })
        edges.push({ from: hub, to: id })
    }
})

const data = { nodes, edges }
// #endregion data

// #region options
// import { minimap } from 'pivotick'

const options = {
    UI: {
        // `full` mode brings a minimap of its own; `light` and `viewer` need asking
        // (`UI.minimap: true`, or the plugin below). `static` never has one.
        mode: 'full',
        // The other thing full mode brings. Off here: this card is about the minimap.
        table: false
    },
    // A plugin installs itself through the PluginContext it is handed — the core never
    // needs to know it exists. `graph.use(minimap())` works just as well, at any time.
    // Passed here it replaces the one full mode would have mounted, configuration and all.
    plugins: [
        minimap({
            position: 'bottom-right', // the corner the built-in chrome leaves free
            width: 220
            // height: omitted → follows the canvas's aspect ratio
        })
    ],
    render: {
        nodeTypeAccessor: (node) => node.getData()?.kind,
        nodeStyleMap: {
            hub: { color: '#0072B2', size: 13 },
            leaf: { color: '#E69F00', size: 7 }
        }
    },
    simulation: {
        d3LinkDistance: 60
    }
}
// #endregion options

export { data, options }
