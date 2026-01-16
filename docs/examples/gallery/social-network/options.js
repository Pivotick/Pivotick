// #region data
const data = {
  'nodes': [
    { 'id': 'A1', 'data': {'label': 'Alice', 'group': 'A' }},
    { 'id': 'A2', 'data': {'label': 'Bob', 'group': 'A' }},
    { 'id': 'A3', 'data': {'label': 'Charlie', 'group': 'A' }},
    { 'id': 'A4', 'data': {'label': 'Diana', 'group': 'A' }},
    { 'id': 'A5', 'data': {'label': 'Eve', 'group': 'A' }},
    { 'id': 'A6', 'data': {'label': 'Frank', 'group': 'A' }},
    { 'id': 'B1', 'data': {'label': 'Grace', 'group': 'B', 'icon': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#fff" d="M7 4h2v2h6V4h2V2h2v4h-2v2h2v2h4v6h-2v-4h-1v6h-3v2h2v2h-4v-4H9v4H5v-2h2v-2H4v-6H3v4H1v-6h4V8h2V6H5V2h2zm2 6H7v2H6v4h12v-4h-1v-2h-2V8H9zm2 4H9v-3h2zm4 0h-2v-3h2z"/></svg>' }},
    { 'id': 'B2', 'data': {'label': 'Heidi', 'group': 'B', 'icon': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#fff" d="M7 4h2v2h6V4h2V2h2v4h-2v2h2v2h4v6h-2v-4h-1v6h-3v2h2v2h-4v-4H9v4H5v-2h2v-2H4v-6H3v4H1v-6h4V8h2V6H5V2h2zm2 6H7v2H6v4h12v-4h-1v-2h-2V8H9zm2 4H9v-3h2zm4 0h-2v-3h2z"/></svg>' }},
    { 'id': 'B3', 'data': {'label': 'Ivan', 'group': 'B', 'icon': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#fff" d="M7 4h2v2h6V4h2V2h2v4h-2v2h2v2h4v6h-2v-4h-1v6h-3v2h2v2h-4v-4H9v4H5v-2h2v-2H4v-6H3v4H1v-6h4V8h2V6H5V2h2zm2 6H7v2H6v4h12v-4h-1v-2h-2V8H9zm2 4H9v-3h2zm4 0h-2v-3h2z"/></svg>' }},
    { 'id': 'B4', 'data': {'label': 'Judy', 'group': 'B', 'icon': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#fff" d="M7 4h2v2h6V4h2V2h2v4h-2v2h2v2h4v6h-2v-4h-1v6h-3v2h2v2h-4v-4H9v4H5v-2h2v-2H4v-6H3v4H1v-6h4V8h2V6H5V2h2zm2 6H7v2H6v4h12v-4h-1v-2h-2V8H9zm2 4H9v-3h2zm4 0h-2v-3h2z"/></svg>' }},
    { 'id': 'B5', 'data': {'label': 'Karl', 'group': 'B', 'icon': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#fff" d="M7 4h2v2h6V4h2V2h2v4h-2v2h2v2h4v6h-2v-4h-1v6h-3v2h2v2h-4v-4H9v4H5v-2h2v-2H4v-6H3v4H1v-6h4V8h2V6H5V2h2zm2 6H7v2H6v4h12v-4h-1v-2h-2V8H9zm2 4H9v-3h2zm4 0h-2v-3h2z"/></svg>' }},
    { 'id': 'B6', 'data': {'label': 'Leo', 'group': 'B', 'icon': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#fff" d="M7 4h2v2h6V4h2V2h2v4h-2v2h2v2h4v6h-2v-4h-1v6h-3v2h2v2h-4v-4H9v4H5v-2h2v-2H4v-6H3v4H1v-6h4V8h2V6H5V2h2zm2 6H7v2H6v4h12v-4h-1v-2h-2V8H9zm2 4H9v-3h2zm4 0h-2v-3h2z"/></svg>' }},
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

    { 'from': 'B1', 'to': 'B2', 'data': { 'cool': true } },
    { 'from': 'B2', 'to': 'B3', 'data': { 'cool': true } },
    { 'from': 'B3', 'to': 'B4', 'data': { 'cool': true } },
    { 'from': 'B4', 'to': 'B5', 'data': { 'cool': true } },
    { 'from': 'B5', 'to': 'B6', 'data': { 'cool': true } },
    { 'from': 'B6', 'to': 'B1', 'data': { 'cool': true } },

    { 'from': 'C1', 'to': 'C2', 'data': { 'label': 'Connected' } },
    { 'from': 'C2', 'to': 'C3' },
    { 'from': 'C3', 'to': 'C4' },
    { 'from': 'C4', 'to': 'C5' },
    { 'from': 'C5', 'to': 'C6' },
    { 'from': 'C6', 'to': 'C1' },

    { 'from': 'D1', 'to': 'D2', 'data': { 'score': 12 } },
    { 'from': 'D2', 'to': 'D3', 'data': { 'score': 12 } },
    { 'from': 'D3', 'to': 'D4', 'data': { 'score': 12 } },
    { 'from': 'D4', 'to': 'D5', 'data': { 'score': 12 } },
    { 'from': 'D5', 'to': 'D6', 'data': { 'score': 12 } },
    { 'from': 'D6', 'to': 'D1', 'data': { 'score': 12 } },

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
            'A': { shape: 'hexagon', color: 'var(--pvt-vibrant-lobster)', size: 38, text: (node) => node.getData()?.label },
            'B': { shape: 'circle', color: 'var(--pvt-vibrant-blue)', svgIcon: (node) => node.getData()?.icon },
            'C': { shape: 'triangle', color: 'var(--pvt-vibrant-indigo)', size: 18 },
            'D': { color: 'var(--pvt-vibrant-green)', size: 22 },
        },
        defaultEdgeStyle: {
            dashed: (e) => { return e.getData().cool },
            strokeWidth: (e) => { return e.getData().score ?? 2 },
            markerEnd: (e) => { return e.getData().score ? undefined : 'arrow' },
        }
    },
    UI: {
      tooltip: {
        enabled: false
      }
    }
}
// #endregion options

export { data, options }