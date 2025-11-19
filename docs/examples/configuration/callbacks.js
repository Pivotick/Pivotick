import Pivotick from './pivotick.es.js'

options = {
    callbacks: { // [!code focus:20]
        onCanvasClick: (event) => {
            console.log('Canvas clicked at', event.clientX, event.clientY)
        },
        onNodeClick: (event, node) => {
            console.log('Node clicked:', node.id)
        },
        onNodeHoverIn: (event, node) => {
            console.log('Mouse entered node:', node.id)
        },
        onNodeHoverOut: (event, node) => {
            console.log('Mouse left node:', node.id)
        },
        onEdgeClick: (event, edge) => {
            console.log('Edge clicked:', edge.from, '→', edge.to)
        },
        onSimulationTick: () => {
            console.log('Simulation tick')
        }
    }
}
const graph = new Pivotick(container, data, options)