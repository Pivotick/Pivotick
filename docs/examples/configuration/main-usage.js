const container = document.getElementById('graph-container')
const options = { // [!code focus:20]
    isDirected: true,
    callbacks: {
        onNodeClick: (e, node) => console.log(`nodeClick: ${node.id}`),
    },
    layout: {
        type: 'force',
    },
    render: {
        defaultNodeStyle: {
            shape: 'square',
        },
    },
    simulation: {
        d3ManyBodyStrength: -30
    },
    UI: {
        mode: 'full'
    },
}
const graph = Pivotick(container, options)