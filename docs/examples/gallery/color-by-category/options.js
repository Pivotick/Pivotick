import { ColorPaletteMapper } from '../../../../src/index'

// #region data
const data = {
    nodes: [
        { id: 'web', data: { name: 'Web app', group: 'Frontend' } },
        { id: 'mobile', data: { name: 'Mobile', group: 'Frontend' } },
        { id: 'auth', data: { name: 'Auth API', group: 'Backend' } },
        { id: 'orders', data: { name: 'Orders', group: 'Backend' } },
        { id: 'pg', data: { name: 'Postgres', group: 'Data' } },
        { id: 'cache', data: { name: 'Redis', group: 'Data' } },
        { id: 'queue', data: { name: 'Queue', group: 'Infra' } }
    ],
    edges: [
        { from: 'web', to: 'auth' },
        { from: 'web', to: 'orders' },
        { from: 'mobile', to: 'auth' },
        { from: 'orders', to: 'pg' },
        { from: 'orders', to: 'queue' },
        { from: 'auth', to: 'cache' }
    ]
}
// #endregion data

// #region options
// import { ColorPaletteMapper } from 'pivotick'

// A colorblind-safe palette; getColor() assigns and remembers a color per value.
const palette = new ColorPaletteMapper('okabe-ito')

const options = {
    render: {
        defaultNodeStyle: {
            size: 16,
            strokeColor: '#ffffff',
            textColor: '#334155',
            text: (node) => node.getData()?.name,
            textVerticalShift: -1.6,
            // `color` accepts (node) => string — map each node's group to a color.
            color: (node) => palette.getColor(node.getData()?.group)
        }
    }
}
// #endregion options

export { data, options }
