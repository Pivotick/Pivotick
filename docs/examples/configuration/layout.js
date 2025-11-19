import Pivotick from './pivotick.es.js'

const options = {
    layout: {
        type: 'tree',
        radial: true,
        flipEdgeDirection: false,
    }
}
const graph = new Pivotick(container, data, options)