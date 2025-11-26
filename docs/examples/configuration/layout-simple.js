import Pivotick from './pivotick.es.js'

const options = {
    layout: {
        type: 'tree',
        radial: true,
    }
}
const graph = new Pivotick(container, data, options)