const data = {
    nodes: [
        { id: 1, data: { label: 'A', type: 'hub' } },
        { id: 2, data: { label: 'B', type: 'spoke' } }
    ],
    edges: [{ from: 1, to: 2, data: { label: 'Right click an element' } }]
}

// #region options
const options = {
    UI: {
        contextMenu: {
            menuNode: {
                topbar: [
                    {
                        text: 'Delete Node',
                        variant: 'danger',
                        onclick: (evt, node) => console.log('Delete', node)
                    }
                ],
                menu: [
                    {
                        text: 'Edit Node',
                        variant: 'success',
                        onclick: (evt, node) => console.log('Edit', node)
                    }
                ]
            },
            menuEdge: {
                menu: [
                    {
                        text: 'Delete Edge',
                        variant: 'danger',
                        onclick: (evt, edge) =>
                            console.log('Delete edge', edge)
                    }
                ]
            },
            menuCanvas: {
                topbar: [
                    {
                        text: 'Add Node',
                        variant: 'primary',
                        onclick: (evt) => console.log('Add Node')
                    }
                ]
            }
        },
        tooltip: {
            enabled: false,
        },
    }
}
// #endregion options

export { data, options }