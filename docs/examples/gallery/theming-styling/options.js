// #region data
// Short labels sit inside the nodes, so the label colour is themed too.
const data = {
    nodes: [
        { id: 'ada', data: { label: 'Ada' } },
        { id: 'bo', data: { label: 'Bo' } },
        { id: 'cy', data: { label: 'Cy' } },
        { id: 'deb', data: { label: 'Deb' } },
        { id: 'eve', data: { label: 'Eve' } },
        { id: 'fin', data: { label: 'Fin' } },
        { id: 'gil', data: { label: 'Gil' } }
    ],
    edges: [
        { from: 'ada', to: 'bo' },
        { from: 'ada', to: 'cy' },
        { from: 'bo', to: 'deb' },
        { from: 'cy', to: 'deb' },
        { from: 'deb', to: 'eve' },
        { from: 'eve', to: 'fin' },
        { from: 'eve', to: 'gil' },
        { from: 'fin', to: 'gil' }
    ]
}
// #endregion data

// #region options
const options = {
    render: {
        defaultNodeStyle: {
            size: 22,
            // Only set the label. Leaving colour/stroke/text-colour unset keeps the
            // built-in defaults, which resolve to CSS variables (--pvt-node-color,
            // --pvt-node-stroke, --pvt-node-text-color) — that is what makes the
            // graph re-theme purely from CSS. Hard-code a colour here and it would
            // win over the variables.
            text: (node) => node.getData()?.label
        }
    }
}
// #endregion options

// #region theme
// Switch a single graph's theme at runtime by setting data-theme on its root
// (the .pivotick element). 'light' and 'dark' ship with Pivotick; 'brand' is a
// custom theme defined in CSS (theme.css). No re-render — the variables cascade
// in immediately.
function applyTheme(container, theme) {
    container.querySelector('.pivotick')?.setAttribute('data-theme', theme)
}
// #endregion theme

export { data, options, applyTheme }
