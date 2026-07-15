import { UIComponent } from '../../../../src/index'

// #region data
const data = {
    nodes: [
        { id: 'web', data: { label: 'Web' } },
        { id: 'api', data: { label: 'API' } },
        { id: 'db', data: { label: 'Database' } },
        { id: 'cache', data: { label: 'Cache' } },
        { id: 'worker', data: { label: 'Worker' } }
    ],
    edges: [
        { from: 'web', to: 'api', data: { label: 'calls' } },
        { from: 'api', to: 'db', data: { label: 'reads' } },
        { from: 'api', to: 'cache', data: { label: 'reads' } },
        { from: 'worker', to: 'db', data: { label: 'writes' } }
    ]
}
// #endregion data

// #region options
// import { UIComponent } from 'pivotick'

// A plugin bundles UI elements, keybindings and lifecycle hooks and installs
// itself through the PluginContext it is handed — the core never needs to know
// it exists.
//
// Our plugin contributes one custom UI element: a small stats overlay pinned to
// the canvas. Because it extends UIComponent, its lifecycle (mount → afterMount
// → graphReady → destroy) and any tracked listeners are driven for free — the
// same machinery the built-in sidebar/toolbar/tooltip use.
class StatsOverlay extends UIComponent {
    // Build the DOM and drop it into the slot we were mounted into.
    onMount(slot) {
        this.el = document.createElement('div')
        this.el.style.cssText = [
            'position:absolute', 'top:12px', 'left:12px', 'z-index:5',
            'padding:8px 12px', 'border-radius:8px', 'font:12px/1.6 sans-serif',
            'background:rgba(20,24,32,0.85)', 'color:#fff',
            'box-shadow:0 2px 8px rgba(0,0,0,0.25)', 'pointer-events:none'
        ].join(';')
        slot?.appendChild(this.el)
    }

    // Runs once the graph data is ready — read live counts off the graph.
    onGraphReady() {
        this.render()
        const graph = this.uiManager.graph
        const cb = () => this.render()
        graph.on('dataBatchChanged', cb)
        // graph.on lives on the Graph, which outlives the UI — so track the
        // unsubscribe and destroy() tears it down with everything else.
        this.track(() => graph.off('dataBatchChanged', cb))
    }

    render() {
        const graph = this.uiManager.graph
        this.el.innerHTML =
            '<strong>Graph stats</strong><br>' +
            `${graph.getNodes().length} nodes · ${graph.getEdges().length} edges`
    }

    toggle() {
        this.el.style.display = this.el.style.display === 'none' ? '' : 'none'
    }

    // Only DOM cleanup needed here; children and everything registered via
    // track() (including the dataBatchChanged unsubscribe above) are torn down
    // by UIComponent.
    onDestroy() {
        this.el?.remove()
    }
}

const statsPlugin = {
    name: 'stats-overlay',
    install(ctx) {
        const overlay = new StatsOverlay(ctx.ui)
        // Mount the element into the canvas slot; its lifecycle is then managed.
        ctx.addElement(overlay, ctx.layout?.canvas)
        // Bonus: click the graph, then press "B" to toggle the overlay.
        ctx.addKeybinding({ key: 'b', callback: () => overlay.toggle() })
    }
}

// Register plugins declaratively with `plugins`, or imperatively at any time
// with `graph.use(statsPlugin)` (late installs are caught up to the current
// lifecycle phase automatically).
const options = {
    UI: { mode: 'full', sidebar: { collapsed: true } },
    plugins: [statsPlugin]
}
// #endregion options

export { data, options }
