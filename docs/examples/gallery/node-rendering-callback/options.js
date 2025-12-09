// #region data
const data = {
    nodes: [
        { id: 1, data: { label: 'A', type: 'hub' } },
        { id: 2, data: { label: 'B', type: 'spoke' } }
    ],
    edges: [{ from: 1, to: 2, data: { label: 'edge1' } }]
}
// #endregion data

// #region options
const options = {
    render: {
        renderNode: (node) => {
            const size = 24
            const color = 'rgba(76, 0, 255, 1)'
            const style = [
                'display: block',
                `width: ${size}px`,
                `height: ${size}px`,
                `background-color: ${color}`,
                'border: 2px solid #fff',
                'border-radius: 50%',
                'opacity: 1',
                'color: #fff',
            ].join(';')
            let span = document.createElement('span')
            span.innerText = node.data.label
            span.setAttribute('style', style)

            return span
        }
    }
}
// #endregion options

export { data, options }