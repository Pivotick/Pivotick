// #region data
const data = {
    nodes: [
        // Cards, from a `nodeStyleMap` entry.
        { id: 'design', data: { kind: 'team', name: 'Design', lead: 'Lena', emoji: '🎨', tone: '#8b5cf6' } },
        { id: 'eng', data: { kind: 'team', name: 'Engineering', lead: 'Raj', emoji: '⚙️', tone: '#2563eb' } },
        { id: 'data', data: { kind: 'team', name: 'Data', lead: 'Omar', emoji: '📊', tone: '#0891b2' } },
        // A card on a shape: the disc is still drawn behind it.
        { id: 'oncall', data: { kind: 'rota', name: 'On call', lead: 'Maya' } },
        // Plain shapes, from the same style map.
        { id: 'staging', data: { kind: 'env', name: 'staging' } },
        { id: 'prod', data: { kind: 'env', name: 'prod' } },
        // A label and no shape at all.
        { id: 'q3', data: { kind: 'milestone', name: 'Q3 freeze' } },
        // One node overriding its type's card with its own.
        {
            id: 'ops', data: { kind: 'team', name: 'Operations', lead: 'Theo', emoji: '🧭', tone: '#ea580c' },
            style: {
                shape: 'none',
                html: (node) => {
                    const d = node.getData()
                    const card = document.createElement('div')
                    // `width: 100%` and it still measures its content: the card is
                    // measured inside a shrink-to-fit box, not the placeholder.
                    card.setAttribute('style', [
                        'display: flex',
                        'align-items: center',
                        'gap: 8px',
                        'width: 100%',
                        'padding: 10px 14px',
                        'border-radius: 999px',
                        `background: ${d.tone}`,
                        'color: #fff',
                        'font: 600 13px system-ui, sans-serif',
                        'white-space: nowrap',
                    ].join(';'))
                    card.textContent = `${d.emoji} ${d.name} — always on`
                    return card
                },
            },
        },
    ],
    edges: [
        { from: 'design', to: 'eng' },
        { from: 'eng', to: 'data' },
        { from: 'ops', to: 'eng' },
        { from: 'oncall', to: 'ops' },
        { from: 'eng', to: 'staging' },
        { from: 'staging', to: 'prod' },
        { from: 'q3', to: 'prod' },
        { from: 'data', to: 'prod' },
        { from: 'design', to: 'ops' },
    ],
}
// #endregion data

// #region options
/** A team card. Built with `textContent`, never by interpolating data into markup. */
function teamCard(node) {
    const d = node.getData()
    const card = document.createElement('div')
    card.setAttribute('style', [
        'display: flex',
        'align-items: center',
        'gap: 8px',
        'padding: 8px 12px',
        'border-radius: 12px',
        'background: #ffffff',
        `border: 2px solid ${d.tone}`,
        'box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18)',
        'font-family: system-ui, sans-serif',
        'white-space: nowrap',
    ].join(';'))

    const emoji = document.createElement('span')
    emoji.style.fontSize = '20px'
    emoji.textContent = d.emoji

    const stack = document.createElement('span')
    stack.setAttribute('style', 'display: flex; flex-direction: column; line-height: 1.2')
    const title = document.createElement('strong')
    title.setAttribute('style', 'font-size: 13px; color: #0f172a')
    title.textContent = d.name
    const lead = document.createElement('span')
    lead.setAttribute('style', `font-size: 11px; color: ${d.tone}`)
    lead.textContent = d.lead
    stack.append(title, lead)

    card.append(emoji, stack)
    return card
}

/** A small pill, drawn on top of the shape it is given rather than replacing it. */
function rotaPill(node) {
    const pill = document.createElement('div')
    pill.setAttribute('style', [
        'display: inline-flex',
        'padding: 2px 8px',
        'border-radius: 999px',
        'background: #0f172a',
        'color: #fff',
        'font: 600 10px system-ui, sans-serif',
        'white-space: nowrap',
    ].join(';'))
    pill.textContent = node.getData().lead
    return pill
}

const options = {
    render: {
        nodeTypeAccessor: (node) => node.getData()?.kind,
        nodeStyleMap: {
            // A card and nothing else. `shape: 'none'` is what makes it the whole node:
            // no disc behind it, and the node's radius and edge anchors come from the
            // measured card instead of from `size`.
            team: {
                shape: 'none',
                html: teamCard,
                // The card carries its own title, so switch the SVG label off. `undefined`
                // would fall through to whatever the chain said; `''` is how you clear it.
                text: '',
            },
            // The other way round: the shape is still drawn, and `size` is still the
            // smallest the node may be, so the pill rides on a coloured disc.
            rota: {
                shape: 'circle',
                size: 30,
                color: '#f59e0b',
                html: rotaPill,
                text: (node) => node.getData()?.name,
                textVerticalShift: -1.5,
            },
            // No card at all — ordinary shapes, from the same style map.
            env: {
                shape: 'hexagon',
                size: 22,
                color: '#16a34a',
                text: (node) => node.getData()?.name,
                textVerticalShift: -1.4,
            },
            // Shapeless with no card either: a label floating on the canvas. Still
            // draggable and selectable, over `2 × size`.
            milestone: {
                shape: 'none',
                size: 26,
                text: (node) => node.getData()?.name,
                // Nothing behind it to shorten against, so draw it whole.
                textTruncate: false,
            },
        },
        // A global callback can card *some* nodes now: returning nothing hands the node
        // back to the chain above, so everything else is styled as usual. Here it draws
        // the badge on whichever team owns the release.
        renderNode: (node) => {
            if (node.id !== 'eng') return undefined
            const card = teamCard(node)
            card.style.borderWidth = '3px'
            const flag = document.createElement('span')
            flag.setAttribute('style', [
                'margin-left: 8px',
                'padding: 2px 6px',
                'border-radius: 6px',
                'background: #fee2e2',
                'color: #b91c1c',
                'font: 700 10px system-ui, sans-serif',
            ].join(';'))
            flag.textContent = 'RELEASE OWNER'
            card.append(flag)
            return card
        },
        defaultEdgeStyle: { markerEnd: 'arrow', strokeWidth: 1.5 },
    },
    simulation: {
        d3LinkDistance: 110,
        d3ManyBodyStrength: -700,
        d3CollideRadiusMultiplier: 1.15,
    },
    UI: {
        mode: 'full',
        minimap: false,
        table: false,
        // This card is about the nodes, so nothing else competes for the canvas.
        legend: false,
    },
}
// #endregion options

export { data, options }
