// #region data
const data = {
  'nodes': [
    { 'id': 'A1', 'data': {'label': 'Alice', 'group': 'A' }},
    { 'id': 'A2', 'data': {'label': 'Bob', 'group': 'A' }},
    { 'id': 'A3', 'data': {'label': 'Charlie', 'group': 'A' }},
    { 'id': 'A4', 'data': {'label': 'Diana', 'group': 'A' }},
    { 'id': 'A5', 'data': {'label': 'Eve', 'group': 'A' }},
    { 'id': 'A6', 'data': {'label': 'Frank', 'group': 'A' }},
    { 'id': 'B1', 'data': {'label': 'Grace', 'group': 'B' }},
    { 'id': 'B2', 'data': {'label': 'Heidi', 'group': 'B' }},
    { 'id': 'B3', 'data': {'label': 'Ivan', 'group': 'B' }},
    { 'id': 'B4', 'data': {'label': 'Judy', 'group': 'B' }},
    { 'id': 'B5', 'data': {'label': 'Karl', 'group': 'B' }},
    { 'id': 'B6', 'data': {'label': 'Leo', 'group': 'B' }},
    { 'id': 'C1', 'data': {'label': 'Mallory', 'group': 'C' }},
    { 'id': 'C2', 'data': {'label': 'Niaj', 'group': 'C' }},
    { 'id': 'C3', 'data': {'label': 'Olivia', 'group': 'C' }},
    { 'id': 'C4', 'data': {'label': 'Peggy', 'group': 'C' }},
    { 'id': 'C5', 'data': {'label': 'Quentin', 'group': 'C' }},
    { 'id': 'C6', 'data': {'label': 'Ruth', 'group': 'C' }},
    { 'id': 'D1', 'data': {'label': 'Sybil', 'group': 'D' }},
    { 'id': 'D2', 'data': {'label': 'Trent', 'group': 'D' }},
    { 'id': 'D3', 'data': {'label': 'Uma', 'group': 'D' }},
    { 'id': 'D4', 'data': {'label': 'Victor', 'group': 'D' }},
    { 'id': 'D5', 'data': {'label': 'Walter', 'group': 'D' }},
    { 'id': 'D6', 'data': {'label': 'Xavier', 'group': 'D' }}
  ],
  'edges': [
    { 'from': 'A1', 'to': 'A2' },
    { 'from': 'A2', 'to': 'A3' },
    { 'from': 'A3', 'to': 'A4' },
    { 'from': 'A4', 'to': 'A5' },
    { 'from': 'A5', 'to': 'A6' },
    { 'from': 'A6', 'to': 'A1' },

    { 'from': 'B1', 'to': 'B2' },
    { 'from': 'B2', 'to': 'B3' },
    { 'from': 'B3', 'to': 'B4' },
    { 'from': 'B4', 'to': 'B5' },
    { 'from': 'B5', 'to': 'B6' },
    { 'from': 'B6', 'to': 'B1' },

    { 'from': 'C1', 'to': 'C2' },
    { 'from': 'C2', 'to': 'C3' },
    { 'from': 'C3', 'to': 'C4' },
    { 'from': 'C4', 'to': 'C5' },
    { 'from': 'C5', 'to': 'C6' },
    { 'from': 'C6', 'to': 'C1' },

    { 'from': 'D1', 'to': 'D2' },
    { 'from': 'D2', 'to': 'D3' },
    { 'from': 'D3', 'to': 'D4' },
    { 'from': 'D4', 'to': 'D5' },
    { 'from': 'D5', 'to': 'D6' },
    { 'from': 'D6', 'to': 'D1' },

    { 'from': 'A2', 'to': 'B3' },
    { 'from': 'A4', 'to': 'C1' },
    { 'from': 'B5', 'to': 'C4' },
    { 'from': 'C3', 'to': 'D2' },
    { 'from': 'D4', 'to': 'A6' }
  ]
}

// #endregion data

// #region options
const options = {
    render: {
        nodeTypeAccessor: (node) => node.getData()?.group,
        nodeStyleMap: {
            'A': { shape: 'hexagon', color: '#f90', size: 38, text: (node) => node.getData()?.label },
            'B': { shape: 'circle', color: '#09f' },
            'C': { shape: 'triangle', color: '#f00', size: 18 },
            'D': { shape: 'square', color: '#73ff00', size: 22 },
        },
    },
}
// #endregion options

export { data, options }