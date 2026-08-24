// #region data
const data = {
    nodes: [
        { id: 'api', data: { label: 'api-gateway', kind: 'service', owner: 'Platform' } },
        { id: 'auth', data: { label: 'auth-service', kind: 'service', owner: 'Identity' } },
        { id: 'billing', data: { label: 'billing-service', kind: 'service', owner: 'Payments' } },
        { id: 'search', data: { label: 'search-service', kind: 'service', owner: 'Discovery' } },
        { id: 'users-db', data: { label: 'users-db', kind: 'datastore', owner: 'Identity' } },
        { id: 'orders-db', data: { label: 'orders-db', kind: 'datastore', owner: 'Payments' } },
        { id: 'index', data: { label: 'search-index', kind: 'datastore', owner: 'Discovery' } },
        { id: 'cache', data: { label: 'edge-cache', kind: 'datastore', owner: 'Platform' } },
        { id: 'mailer', data: { label: 'mailer', kind: 'worker', owner: 'Payments' } },
        { id: 'reindexer', data: { label: 'reindexer', kind: 'worker', owner: 'Discovery' } },
    ],
    edges: [
        { from: 'api', to: 'auth', data: { label: 'authenticates' } },
        { from: 'api', to: 'search', data: { label: 'queries' } },
        { from: 'api', to: 'billing', data: { label: 'charges' } },
        { from: 'api', to: 'cache', data: { label: 'reads' } },
        { from: 'auth', to: 'users-db', data: { label: 'reads' } },
        { from: 'billing', to: 'orders-db', data: { label: 'writes' } },
        { from: 'billing', to: 'mailer', data: { label: 'enqueues' } },
        { from: 'search', to: 'index', data: { label: 'reads' } },
        { from: 'reindexer', to: 'index', data: { label: 'writes' } },
        { from: 'reindexer', to: 'orders-db', data: { label: 'reads' } },
    ],
}
// #endregion data

// #region options
// The bottom dock is a shared region: one row, one height, one fold, however many panes
// are in it. `addDockTab` is the door — the same one the built-in data table comes
// through, so a pane you register is its equal rather than its guest.
//
// **One tab is one pane, not one view of one.** This pane rolls the graph up two ways,
// by owner and by kind. Those are two views of *this* pane, so it registers a single
// dock tab and draws its own switch, calling `refresh()` to change body. Registering
// them as two dock tabs would put them in the dock's strip beside `Table`, claiming a
// view of the summary and the whole data table are the same kind of thing.
//
// That is also why the two levels look different: the dock draws panes as full-height
// underlined tabs, and a pane's own views want a lighter, smaller control. The styling
// below is the card's own — the library styles its built-ins, and your pane brings
// whatever look you want.

const VIEWS = [
    { key: 'owner', label: 'By owner' },
    { key: 'kind', label: 'By kind' },
]

/** Count the nodes under each value of `key`, biggest group first. */
function rollUp(graph, key) {
    const counts = new Map()
    for (const node of graph.getNodes()) {
        const value = node.getData()?.[key] ?? '—'
        counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

/**
 * The pane's body. `render` is called once per pane, lazily, the first time it is
 * opened — and again on every `refresh()`, which is how the view switch works.
 */
function renderSummary(graph, key) {
    const rows = rollUp(graph, key)
    const biggest = Math.max(...rows.map(([, count]) => count), 1)

    const body = document.createElement('div')
    body.style.cssText = 'padding: 8px 12px; font: 12px/1.9 sans-serif'

    for (const [value, count] of rows) {
        const row = document.createElement('div')
        row.style.cssText = 'display: grid; grid-template-columns: 130px 1fr 34px; gap: 10px; align-items: center'

        const name = document.createElement('span')
        name.textContent = value

        // A bar rather than a number alone: the shape of the split is the point.
        const track = document.createElement('span')
        track.style.cssText = 'height: 7px; border-radius: 4px; background: var(--pvt-bg-color-4)'
        const fill = document.createElement('span')
        fill.style.cssText = `display: block; height: 100%; border-radius: 4px; background: var(--pvt-vibrant-blue); width: ${(count / biggest) * 100}%`
        track.appendChild(fill)

        const tally = document.createElement('span')
        tally.textContent = String(count)
        tally.style.cssText = 'text-align: right; color: var(--pvt-text-color-3)'

        row.append(name, track, tally)
        body.appendChild(row)
    }
    return body
}

/**
 * The pane's own controls, in the header slot the dock hands it. `toolbar` is re-invoked
 * on every activation, so these always read the pane's current state.
 */
function renderControls(current, pick) {
    const strip = document.createElement('div')
    strip.style.cssText = 'display: flex; gap: 2px'

    for (const view of VIEWS) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = view.label
        const on = view.key === current
        button.style.cssText = [
            'padding: 2px 9px', 'border-radius: 4px', 'font: inherit', 'font-size: 12px',
            'cursor: pointer',
            `border: 1px solid ${on ? 'var(--pvt-chrome-border)' : 'transparent'}`,
            `background: ${on ? 'var(--pvt-bg-color-4)' : 'transparent'}`,
            `color: var(--pvt-text-color-${on ? '6' : '4'})`,
            `font-weight: ${on ? '600' : '400'}`,
        ].join(';')
        button.addEventListener('click', () => pick(view.key))
        strip.appendChild(button)
    }
    return strip
}

/**
 * Ships as a plugin, so it installs itself and the core never needs to know it exists.
 * A plugin's tab also *builds* the dock if there isn't one — plugins install after the
 * UI, so it always arrives after the region's own gate has run.
 */
function summaryPane() {
    return {
        name: 'summaryPane',
        install(ctx) {
            let view = 'owner'
            // Whether the pane is the one on show, and whether the graph moved while it
            // wasn't. `onActivate` / `onDeactivate` are the only signal you get, and this
            // is the shape most panes want: don't work while hidden, catch up on return.
            let visible = false
            let stale = false

            ctx.addDockTab({
                id: 'summary',
                label: 'Summary',
                render: () => renderSummary(ctx.graph, view),
                toolbar: (pane) => renderControls(view, (key) => {
                    view = key
                    // The dock keeps the element `render` gave it, so ask it to rebuild
                    // rather than swapping the DOM behind its back.
                    pane.refresh()
                }),
                onActivate: (pane) => {
                    visible = true
                    if (stale) { stale = false; pane.refresh() }
                },
                onDeactivate: () => { visible = false },
            })

            // The graph outlives nothing here, but a real plugin should keep the
            // unsubscribe — see the Extend with a plugin card.
            ctx.graph.on('dataBatchChanged', () => {
                if (visible) ctx.refreshDockTab('summary')
                else stale = true
            })
        },
    }
}

const options = {
    UI: {
        mode: 'full',
        // The dock is the subject, so it starts expanded; the table is the pane our own
        // one sits beside, and is what makes the strip appear at all.
        dock: { open: true, height: 0.4 },
        table: { columns: [
            { key: 'label', label: 'Service', type: 'text' },
            { key: 'kind', label: 'Kind', type: 'select' },
            { key: 'owner', label: 'Owner', type: 'select' },
        ] },
        // Full mode's minimap isn't what this card is about.
        minimap: false,
    },
    plugins: [summaryPane()],
}
// #endregion options

export { data, options }
