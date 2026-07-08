// #region data
// A company hierarchy. Edges point manager → report, so the tree layout can read
// the structure straight from them (root is found automatically, or pin it with
// layout.rootId). Each node carries the fields the custom card below renders.
const data = {
    nodes: [
        { id: 'ceo', data: { name: 'Maya Brooks', role: 'CEO', dept: 'Exec' } },
        { id: 'cto', data: { name: 'Leo Chen', role: 'CTO', dept: 'Engineering' } },
        { id: 'cfo', data: { name: 'Dana Ford', role: 'CFO', dept: 'Finance' } },
        { id: 'vpeng', data: { name: 'Priya Nair', role: 'VP Engineering', dept: 'Engineering' } },
        { id: 'vpinfra', data: { name: 'Raj Patel', role: 'VP Infrastructure', dept: 'Engineering' } },
        { id: 'eng1', data: { name: 'Sam Ito', role: 'Engineer', dept: 'Engineering' } },
        { id: 'eng2', data: { name: 'Zoe Kim', role: 'Engineer', dept: 'Engineering' } },
        { id: 'sre1', data: { name: 'Ivy Ross', role: 'SRE', dept: 'Engineering' } },
        { id: 'fin1', data: { name: 'Theo Diaz', role: 'Analyst', dept: 'Finance' } },
        { id: 'fin2', data: { name: 'Nora Vance', role: 'Controller', dept: 'Finance' } }
    ],
    edges: [
        { from: 'ceo', to: 'cto' },
        { from: 'ceo', to: 'cfo' },
        { from: 'cto', to: 'vpeng' },
        { from: 'cto', to: 'vpinfra' },
        { from: 'vpeng', to: 'eng1' },
        { from: 'vpeng', to: 'eng2' },
        { from: 'vpinfra', to: 'sre1' },
        { from: 'cfo', to: 'fin1' },
        { from: 'cfo', to: 'fin2' }
    ]
}
// #endregion data

// #region options
// One colour per department, used for the card's accent bar and avatar.
const deptColor = { Exec: '#6d28d9', Engineering: '#0072B2', Finance: '#009E73' }

// Initials for the avatar chip, e.g. "Maya Brooks" → "MB".
const initials = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2)

// A custom HTML node: return any HTMLElement and it renders inside the node.
// Everything is inline-styled so the card is fully self-contained.
function orgCard(node) {
    const d = node.getData()
    const accent = deptColor[d.dept] ?? '#64748b'

    const card = document.createElement('div')
    card.style.cssText = `box-sizing:border-box;width:100%;height:100%;display:flex;
        flex-direction:column;align-items:center;justify-content:center;gap:2px;
        padding:6px;border-radius:10px;background:#ffffff;
        border:1px solid #e2e8f0;border-top:4px solid ${accent};
        box-shadow:0 1px 3px rgba(15,23,42,0.12);font-family:system-ui,sans-serif;`

    const avatar = document.createElement('div')
    avatar.textContent = initials(d.name)
    avatar.style.cssText = `width:26px;height:26px;border-radius:50%;background:${accent};
        color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;
        justify-content:center;`

    const name = document.createElement('div')
    name.textContent = d.name
    name.style.cssText = 'font-size:11px;font-weight:600;color:#1e293b;text-align:center;line-height:1.1;'

    const role = document.createElement('div')
    role.textContent = d.role
    role.style.cssText = 'font-size:9px;color:#64748b;text-align:center;line-height:1.1;'

    card.append(avatar, name, role)
    return card
}

const options = {
    // Lay the hierarchy out top-down. rootId pins the CEO at the top; drop it and
    // the layout picks the most-reaching node itself.
    layout: { type: 'tree', rootId: 'ceo' },
    render: {
        defaultNodeStyle: {
            // The card is 2×size square; make the base shape invisible so only the
            // custom HTML shows.
            size: 52,
            color: 'transparent',
            strokeWidth: 0,
            html: (node) => orgCard(node)
        },
        defaultEdgeStyle: {
            curveStyle: 'straight',
            strokeColor: '#94a3b8',
            strokeWidth: 1.5
        }
    }
}
// #endregion options

export { data, options }
