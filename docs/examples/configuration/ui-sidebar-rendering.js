export const data = {
    nodes: [
        { id: 1, data: { label: 'A', type: 'hub' } },
        { id: 2, data: { label: 'B', type: 'spoke' } }
    ],
    edges: [{ from: 1, to: 2, data: { label: 'edge1' } }]
}

export const options = {
    simulation: {
        enabled: false,
        useWorker: false,
    },
    render: {
        zoomEnabled: false,
        selectionBox: {
            enabled: false,
        },
    },
    UI: {
        mode: 'full',  // [!code focus:44]
        sidebar: {
            collapsed: false,
        },
        mainHeader: {
            render: (element) => {
                const div = document.createElement('div')
                div.textContent = 'Main Header'
                div.style.fontWeight = 'bold'
                div.style.color = 'darkred'
                return div
            }
        },
        propertiesPanel: {
            render: (element) => {
                const div = document.createElement('div')
                div.textContent = 'Properties Panel'
                div.style.fontWeight = 'bold'
                div.style.color = 'darkred'
                return div
            }
        },
        extraPanels: [
            {
                title: 'Extra panel #1',
                render: (node) => {
                    const div = document.createElement('div')
                    div.textContent = 'Extra Panel #1'
                    div.style.fontWeight = 'bold'
                    div.style.color = 'darkred'
                    return div
                },
            },
            {
                title: 'Extra panel #2',
                render: (node) => {
                    const div = document.createElement('div')
                    div.textContent = 'Extra Panel #2'
                    div.style.fontWeight = 'bold'
                    div.style.color = 'darkred'
                    return div
                },
            },
        ],
        tooltip: {
            enabled: false,
        },
        contextMenu: {
            enabled: false,
        },
    },
}