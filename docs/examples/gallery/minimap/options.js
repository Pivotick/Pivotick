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
        // The minimap is chrome: `full`, `light` and `viewer` have it, `static` doesn't.
        mode: 'full'
    },
    // A plugin installs itself through the PluginContext it is handed — the core never
    // needs to know it exists. `graph.use(minimap())` works just as well, at any time.
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
