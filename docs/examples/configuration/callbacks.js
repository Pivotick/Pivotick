import Pivotick from './pivotick.es.js'

options = {
    callbacks: { // [!code focus:11]
        onNodeClick: (event, node) => {
            console.log('Node clicked:', node.id)
        },
        onNodeHoverIn: (event, node) => {
            console.log('Mouse entered node:', node.id)
        },
        onSimulationTick: () => {
            console.log('Simulation tick')
        }
    }
}
const graph = new Pivotick(container, data, options)