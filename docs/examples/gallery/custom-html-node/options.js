// #region data
const data = {
    nodes: [
        { id: 'design', data: { name: 'Design', lead: 'Lena', emoji: '🎨', tone: '#8b5cf6' } },
        { id: 'eng', data: { name: 'Engineering', lead: 'Raj', emoji: '⚙️', tone: '#2563eb' } },
        { id: 'data', data: { name: 'Data', lead: 'Omar', emoji: '📊', tone: '#0891b2' } },
        { id: 'sales', data: { name: 'Sales', lead: 'Maya', emoji: '📈', tone: '#16a34a' } },
        { id: 'ops', data: { name: 'Operations', lead: 'Theo', emoji: '🧭', tone: '#ea580c' } }
    ],
    edges: [
        { from: 'design', to: 'eng' },
        { from: 'eng', to: 'data' },
        { from: 'sales', to: 'eng' },
        { from: 'ops', to: 'sales' },
        { from: 'ops', to: 'data' }
    ]
}
// #endregion data

// #region options
const options = {
    render: {
        // The ultimate escape hatch: return any HTML element (or string) per node.
        // Pivotick measures the card and feeds its real size into the collision
        // force, so the layout spaces the cards without any spacing tweaks — edges,
        // dragging and the force layout all keep working around your markup.
        renderNode: (node) => {
            const d = node.getData()
            const card = document.createElement('div')
            card.setAttribute('style', [
                // inline-flex so the card shrink-wraps its content (a block-level
                // element would stretch to fill the measured foreignObject instead).
                'display: inline-flex',
                'align-items: center',
                'gap: 8px',
                'padding: 8px 12px',
                'border-radius: 12px',
                'background: #ffffff',
                `border: 2px solid ${d.tone}`,
                'box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18)',
                'font-family: system-ui, sans-serif',
                'white-space: nowrap'
            ].join(';'))
            card.innerHTML = `
                <span style="font-size: 20px">${d.emoji}</span>
                <span style="display: flex; flex-direction: column; line-height: 1.2">
                    <strong style="font-size: 13px; color: #0f172a">${d.name}</strong>
                    <span style="font-size: 11px; color: ${d.tone}">${d.lead}</span>
                </span>`
            return card
        }
    }
}
// #endregion options

export { data, options }
