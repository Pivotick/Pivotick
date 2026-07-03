import { ColorPaletteMapper } from '../../../../src/index'

// #region data
// A small social graph: people connected by friendships, plus the three
// communities (a gym, a company, a college) they belong to. A few people bridge
// two communities — that's what makes the shape interesting.
//   kind:      'person' | 'venue'  → drives shape + icon
//   community: which crowd they belong to → drives colour
//   icon:      which glyph to draw inside the node
const data = {
    nodes: [
        // The three communities, drawn as larger hexagons.
        { id: 'gym', data: { name: 'Boulder Gym', kind: 'venue', community: 'Climbing', icon: 'mountain' } },
        { id: 'acme', data: { name: 'Acme Inc', kind: 'venue', community: 'Work', icon: 'building' } },
        { id: 'college', data: { name: 'Riverside', kind: 'venue', community: 'College', icon: 'school' } },

        // Climbers.
        { id: 'maya', data: { name: 'Maya', kind: 'person', community: 'Climbing', icon: 'person' } },
        { id: 'leo', data: { name: 'Leo', kind: 'person', community: 'Climbing', icon: 'person' } },
        { id: 'priya', data: { name: 'Priya', kind: 'person', community: 'Climbing', icon: 'person' } },

        // Colleagues.
        { id: 'sam', data: { name: 'Sam', kind: 'person', community: 'Work', icon: 'person' } },
        { id: 'dana', data: { name: 'Dana', kind: 'person', community: 'Work', icon: 'person' } },
        { id: 'raj', data: { name: 'Raj', kind: 'person', community: 'Work', icon: 'person' } },
        { id: 'nora', data: { name: 'Nora', kind: 'person', community: 'Work', icon: 'person' } },

        // Classmates.
        { id: 'kai', data: { name: 'Kai', kind: 'person', community: 'College', icon: 'person' } },
        { id: 'zoe', data: { name: 'Zoe', kind: 'person', community: 'College', icon: 'person' } },
        { id: 'ivy', data: { name: 'Ivy', kind: 'person', community: 'College', icon: 'person' } },
        { id: 'theo', data: { name: 'Theo', kind: 'person', community: 'College', icon: 'person' } }
    ],
    edges: [
        // Membership: who belongs where (dashed, faint). Maya, Kai and Dana each
        // belong to two communities — the bridges in the network.
        { from: 'maya', to: 'gym', data: { rel: 'member' } },
        { from: 'leo', to: 'gym', data: { rel: 'member' } },
        { from: 'priya', to: 'gym', data: { rel: 'member' } },
        { from: 'kai', to: 'gym', data: { rel: 'member' } },
        { from: 'sam', to: 'acme', data: { rel: 'member' } },
        { from: 'dana', to: 'acme', data: { rel: 'member' } },
        { from: 'raj', to: 'acme', data: { rel: 'member' } },
        { from: 'nora', to: 'acme', data: { rel: 'member' } },
        { from: 'maya', to: 'acme', data: { rel: 'member' } },
        { from: 'kai', to: 'college', data: { rel: 'member' } },
        { from: 'zoe', to: 'college', data: { rel: 'member' } },
        { from: 'ivy', to: 'college', data: { rel: 'member' } },
        { from: 'theo', to: 'college', data: { rel: 'member' } },
        { from: 'dana', to: 'college', data: { rel: 'member' } },

        // Friendships (solid); `strength` 1–3 thickens the tie.
        { from: 'maya', to: 'leo', data: { rel: 'friend', strength: 3 } },
        { from: 'leo', to: 'priya', data: { rel: 'friend', strength: 2 } },
        { from: 'maya', to: 'priya', data: { rel: 'friend', strength: 1 } },
        { from: 'sam', to: 'dana', data: { rel: 'friend', strength: 3 } },
        { from: 'dana', to: 'raj', data: { rel: 'friend', strength: 2 } },
        { from: 'raj', to: 'nora', data: { rel: 'friend', strength: 2 } },
        { from: 'sam', to: 'nora', data: { rel: 'friend', strength: 1 } },
        { from: 'kai', to: 'zoe', data: { rel: 'friend', strength: 3 } },
        { from: 'zoe', to: 'ivy', data: { rel: 'friend', strength: 2 } },
        { from: 'ivy', to: 'theo', data: { rel: 'friend', strength: 2 } },
        // Cross-community friendships — the ties that span the crowds.
        { from: 'maya', to: 'sam', data: { rel: 'friend', strength: 2 } },
        { from: 'kai', to: 'priya', data: { rel: 'friend', strength: 1 } }
    ]
}
// #endregion data

// #region options
// import { ColorPaletteMapper } from 'pivotick'

// Colourblind-safe palette; getColor() assigns and remembers a colour per crowd.
const palette = new ColorPaletteMapper('okabe-ito')

// White glyphs (fill="currentColor" resolves to the node's strokeColor).
const icons = {
    person: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z"/></svg>',
    mountain: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3h4a2 2 0 0 1 2 2v11H4zm4-4h2v2H8v-2zm0-4h2v2H8v-2zm0-4h2v2H8V9zm4 8h2v2h-2v-2zm0-4h2v2h-2v-2z"/></svg>',
    school: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>'
}

const options = {
    render: {
        // Shape + size come from the kind; colour comes from the community.
        nodeTypeAccessor: (node) => node.getData()?.kind,
        nodeStyleMap: {
            venue: { shape: 'hexagon', size: 24 },
            person: { shape: 'circle', size: 15 }
        },
        defaultNodeStyle: {
            strokeColor: '#ffffff',
            strokeWidth: 2,
            textColor: '#1e293b',
            // No colour in the map above, so this fallback drives every node —
            // one hue per community, straight from the palette.
            color: (node) => palette.getColor(node.getData()?.community),
            svgIcon: (node) => icons[node.getData()?.icon],
            text: (node) => node.getData()?.name,
            // A shift ≥ 1 floats the name in a pill below the node.
            textVerticalShift: -1.9
        },
        defaultEdgeStyle: {
            curveStyle: 'straight',
            // Friendships and memberships are mutual, so drop the arrowheads.
            markerEnd: 'none',
            // Membership links are faint and dashed; friendships are solid and
            // thicken with the strength of the tie.
            strokeColor: (edge) => (edge.getData()?.rel === 'member' ? '#cbd5e1' : '#64748b'),
            strokeWidth: (edge) =>
                edge.getData()?.rel === 'member' ? 1.2 : 1 + (edge.getData()?.strength ?? 1),
            opacity: (edge) => (edge.getData()?.rel === 'member' ? 0.7 : 0.9),
            dashed: (edge) => edge.getData()?.rel === 'member'
        }
    },
    simulation: {
        // A touch more repulsion so the three crowds breathe apart.
        d3ManyBodyStrength: -320,
        d3LinkDistance: 60
    }
}
// #endregion options

export { data, options }
