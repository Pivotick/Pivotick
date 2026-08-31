// #region data
const data = {
    nodes: [
        { id: 'api', data: { label: 'api-gateway', kind: 'service' } },
        { id: 'auth', data: { label: 'auth-service', kind: 'service' } },
        { id: 'billing', data: { label: 'billing-service', kind: 'service' } },
        { id: 'search', data: { label: 'search-service', kind: 'service' } },
        { id: 'users-db', data: { label: 'users-db', kind: 'datastore' } },
        { id: 'orders-db', data: { label: 'orders-db', kind: 'datastore' } },
        { id: 'index', data: { label: 'search-index', kind: 'datastore' } },
        { id: 'cache', data: { label: 'edge-cache', kind: 'datastore' } },
        { id: 'mailer', data: { label: 'mailer', kind: 'worker' } },
        { id: 'reindexer', data: { label: 'reindexer', kind: 'worker' } },
    ],
    edges: [
        { from: 'api', to: 'auth' },
        { from: 'api', to: 'search' },
        { from: 'api', to: 'billing' },
        { from: 'api', to: 'cache' },
        { from: 'auth', to: 'users-db' },
        { from: 'billing', to: 'orders-db' },
        { from: 'billing', to: 'mailer' },
        { from: 'search', to: 'index' },
        { from: 'reindexer', to: 'index' },
        { from: 'reindexer', to: 'orders-db' },
    ],
}
// #endregion data

// #region options
// The rail's four modes — Select, Create, View, Physics — are built in. `addRailMode`
// is how you add a fifth. It renders below a divider, after them, and drives the same
// contextual tool panel the built-ins do: declare `tools`, and the arming, the
// enabled/disabled states and the collapse are handled for you.
//
// This card adds an **Explore** mode for walking the graph: reach the neighbours of what
// is selected, isolate a subgraph, and step back out. Nothing here is privileged — every
// tool is public graph API a consumer could call themselves.

const compass = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z"/><path fill="currentColor" d="M15.5 8.5l-2 5l-5 2l2-5z"/></svg>'
const expandIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M11 13v3a1 1 0 0 0 2 0v-3h3a1 1 0 0 0 0-2h-3V8a1 1 0 0 0-2 0v3H8a1 1 0 0 0 0 2zm1 9a10 10 0 1 1 0-20a10 10 0 0 1 0 20m0-2a8 8 0 1 0 0-16a8 8 0 0 0 0 16"/></svg>'
const isolateIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 6H8a2 2 0 0 0-2 2v8m10 26H8a2 2 0 0 1-2-2v-8m26 10h8a2 2 0 0 0 2-2v-8M32 6h8a2 2 0 0 1 2 2v8"/><circle cx="24" cy="24" r="6"/></svg>'
const resetIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7"/></svg>'

function exploreMode() {
    return {
        name: 'explore-mode',
        install(ctx) {
            const interaction = () => ctx.graph.renderer.getGraphInteraction()
            const selected = () => interaction().getSelectedNode()?.node

            /** Every node one hop from `id`, itself included. */
            const withNeighbours = (id) => {
                const keep = new Set([id])
                for (const edge of ctx.graph.getEdges()) {
                    if (edge.from.id === id) keep.add(edge.to.id)
                    if (edge.to.id === id) keep.add(edge.from.id)
                }
                return keep
            }

            ctx.addRailMode({
                id: 'explore',
                label: 'Explore',
                icon: compass,
                // Pressing E switches to the mode, or toggles its panel when it is
                // already active — exactly what V and C do for Select and Create.
                shortcut: 'E',
                tools: [
                    {
                        // A one-shot action: it runs and leaves the mode as it was.
                        id: 'expand',
                        label: 'Select neighbours',
                        icon: expandIcon,
                        kind: 'action',
                        // Re-checked on every selection change, so the row greys out
                        // when it would do nothing.
                        enabled: () => !!selected(),
                        run: () => {
                            const node = selected()
                            if (!node) return
                            const keep = withNeighbours(node.id)
                            interaction().selectNodes(
                                ctx.graph.getMutableNodes()
                                    .filter(n => keep.has(n.id))
                                    .map(n => ({ node: n, element: n.getGraphElement() }))
                            )
                        },
                    },
                    {
                        id: 'isolate',
                        label: 'Isolate neighbourhood',
                        icon: isolateIcon,
                        kind: 'action',
                        enabled: () => !!selected(),
                        run: () => {
                            const node = selected()
                            if (!node) return
                            const keep = withNeighbours(node.id)
                            ctx.graph.setVisibleNodes(
                                ctx.graph.getMutableNodes().filter(n => keep.has(n.id))
                            )
                        },
                    },
                    {
                        id: 'reset',
                        label: 'Show everything',
                        icon: resetIcon,
                        kind: 'action',
                        run: () => ctx.graph.setVisibleNodes(ctx.graph.getMutableNodes()),
                    },
                ],
            })
        },
    }
}

const options = {
    UI: {
        mode: 'full',
        // Neither is what this card is about, and both crowd a small canvas.
        minimap: false,
        table: false,
    },
    plugins: [exploreMode()],
}
// #endregion options

export { data, options }
