const options = {
    render: {
        nodeTypeAccessor: (node) => node.getData()?.type,
        nodeStyleMap: {
            'hub': { shape: 'hexagon', color: '#f90', size: 30 },
            'spoke': { shape: 'triangle', color: '#09f' }
        },
    }
}