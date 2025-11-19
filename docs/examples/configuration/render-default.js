const options = {
    render: {
        defaultNodeStyle: {
            shape: 'circle',
            color: '#007acc',
            size: 12,
            strokeColor: '#fff',
            strokeWidth: 2,
            fontFamily: 'system-ui',
            textColor: '#fff'
        },
        defaultEdgeStyle: {
            markerStart: (edge: Edge) => edge.getData().mstart,
            markerEnd: 'arrow',
            curveStyle: 'straight',
        },
    }
}