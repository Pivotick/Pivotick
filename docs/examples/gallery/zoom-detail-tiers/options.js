// #region data
const SEV = {
    high: { tone: '#dc2626', wash: '#fef2f2' },
    medium: { tone: '#d97706', wash: '#fffbeb' },
    low: { tone: '#0891b2', wash: '#ecfeff' },
}

const data = {
    nodes: [
        { id: 'camp', data: { kind: 'Campaign', name: 'SILENT-QUAY', sev: 'high', first: '2026-02-11', count: 41 } },
        { id: 'actor', data: { kind: 'Threat actor', name: 'UNC-4417', sev: 'high', first: '2025-11-02', count: 63 } },
        { id: 'mal1', data: { kind: 'Malware', name: 'Dropbear', sev: 'high', first: '2026-03-04', count: 22 } },
        { id: 'c2a', data: { kind: 'Host', name: 'cdn-a.example', sev: 'high', first: '2026-03-06', count: 18 } },
        { id: 'ip1', data: { kind: 'IP', name: '203.0.113.44', sev: 'medium', first: '2026-03-09', count: 6 } },
        { id: 'hash', data: { kind: 'File', name: '9f2c…a10e', sev: 'high', first: '2026-03-04', count: 14 } },
        { id: 'mail', data: { kind: 'Email', name: 'ops@parcel.example', sev: 'low', first: '2026-02-27', count: 2 } },
        { id: 'vict', data: { kind: 'Sector', name: 'Maritime logistics', sev: 'low', first: '2026-02-14', count: 5 } },
    ],
    edges: [
        { from: 'actor', to: 'camp' }, { from: 'camp', to: 'mal1' }, { from: 'camp', to: 'mail' },
        { from: 'camp', to: 'vict' }, { from: 'mal1', to: 'c2a' }, { from: 'mal1', to: 'hash' },
        { from: 'c2a', to: 'ip1' }, { from: 'actor', to: 'mal1' },
    ],
}
// #endregion data

// #region options
/** Shared shell for the two card drawings, so they differ only in what they carry. */
function shell(node, width, height) {
    const d = node.getData()
    const box = document.createElement('div')
    box.setAttribute('style', [
        'box-sizing: border-box',
        `width: ${width}px`,
        `height: ${height}px`,
        'padding: 6px 10px',
        'border-radius: 8px',
        `border: 2px solid ${SEV[d.sev].tone}`,
        `background: ${SEV[d.sev].wash}`,
        'font-family: system-ui, sans-serif',
        'overflow: hidden',
    ].join(';'))
    return box
}

function row(label, value, tone) {
    const line = document.createElement('div')
    line.setAttribute('style', 'display: flex; justify-content: space-between; gap: 10px; font-size: 11px; line-height: 1.6')
    const left = document.createElement('span')
    left.setAttribute('style', 'color: #64748b')
    left.textContent = label
    const right = document.createElement('span')
    right.setAttribute('style', `color: ${tone}; font-weight: 600`)
    right.textContent = value
    line.append(left, right)
    return line
}

/** The middle tier: name and kind, and nothing that would not fit 140x44. */
function chip(node) {
    const d = node.getData()
    const box = shell(node, 140, 44)
    const name = document.createElement('div')
    name.setAttribute('style', 'font: 600 12px system-ui, sans-serif; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')
    name.textContent = d.name
    const kind = document.createElement('div')
    kind.setAttribute('style', `font-size: 10px; color: ${SEV[d.sev].tone}`)
    kind.textContent = d.kind
    box.append(name, kind)
    return box
}

/** The focus drawing: everything the node knows, at a size that is readable at any zoom. */
function detailCard(node) {
    const d = node.getData()
    const box = shell(node, 280, 150)
    box.style.padding = '10px 14px'

    const head = document.createElement('div')
    head.setAttribute('style', 'font: 700 14px system-ui, sans-serif; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')
    head.textContent = d.name

    const kind = document.createElement('div')
    kind.setAttribute('style', `font-size: 11px; color: ${SEV[d.sev].tone}; margin-bottom: 6px`)
    kind.textContent = d.kind

    box.append(head, kind,
        row('Severity', d.sev, SEV[d.sev].tone),
        row('First seen', d.first, '#0f172a'),
        row('Sightings', String(d.count), '#0f172a'),
        row('Source', 'internal feed', '#0f172a'))
    return box
}

const options = {
    render: {
        defaultNodeStyle: {
            // The floor: what a node draws when no tier qualifies at all.
            shape: 'circle',
            size: 7,
            color: (node) => SEV[node.getData().sev].tone,

            // Ordered smallest first; the richest one that fits wins. Each tier's `width`
            // is both its design box and, by default, the rendered size at which it takes
            // over — so the chip engages once there is room to draw 140 pixels of node.
            tiers: [
                {
                    width: 32, height: 32,
                    style: { shape: 'circle', size: 16, color: (node) => SEV[node.getData().sev].tone },
                },
                {
                    width: 140, height: 44,
                    style: { shape: 'none', html: chip },
                },
            ],

            // Whatever the zoom, a hovered or singly-selected node draws this instead. It
            // merges over the style above rather than over the active tier, and holds a
            // constant size on screen.
            focusTier: { shape: 'none', html: detailCard },
        },
    },
    simulation: {
        // Tight enough that the graph opens on chips: the collision force already holds the
        // footprints apart, so the links only have to stop it spreading further.
        d3LinkDistance: 60,
    },
}
// #endregion options

export { data, options }
