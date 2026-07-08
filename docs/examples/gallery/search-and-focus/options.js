// #region data
// A dozen cities wired into a route network — enough that finding one by eye is
// annoying, which is the whole point of search + focus.
const data = {
    nodes: [
        { id: 'paris', data: { label: 'Paris' } },
        { id: 'london', data: { label: 'London' } },
        { id: 'berlin', data: { label: 'Berlin' } },
        { id: 'madrid', data: { label: 'Madrid' } },
        { id: 'rome', data: { label: 'Rome' } },
        { id: 'vienna', data: { label: 'Vienna' } },
        { id: 'prague', data: { label: 'Prague' } },
        { id: 'lisbon', data: { label: 'Lisbon' } },
        { id: 'warsaw', data: { label: 'Warsaw' } },
        { id: 'oslo', data: { label: 'Oslo' } },
        { id: 'dublin', data: { label: 'Dublin' } },
        { id: 'athens', data: { label: 'Athens' } }
    ],
    edges: [
        { from: 'london', to: 'paris' },
        { from: 'london', to: 'dublin' },
        { from: 'paris', to: 'madrid' },
        { from: 'madrid', to: 'lisbon' },
        { from: 'paris', to: 'berlin' },
        { from: 'berlin', to: 'prague' },
        { from: 'prague', to: 'vienna' },
        { from: 'vienna', to: 'rome' },
        { from: 'berlin', to: 'warsaw' },
        { from: 'warsaw', to: 'oslo' },
        { from: 'vienna', to: 'athens' }
    ]
}
// #endregion data

// #region options
// Full mode ships the built-in search box in the header (the magnifier, or
// Shift+J). Typing fuzzy-matches node labels; picking a result focuses it.
const options = {
    UI: { mode: 'full' }
}
// #endregion options

// #region focus
// Programmatic camera control. focusElement pans and zooms to an element;
// highlightElement adds a visual emphasis class (clearHighlightedElements removes
// it). Fetch the live node with getMutableNode so it resolves to the rendered one.
function focusNode(graph, id) {
    const node = graph.getMutableNode(id)
    if (!node) return
    graph.clearHighlightedElements()
    graph.focusElement(node)
    graph.highlightElement(node)
}

// Drop the highlight and zoom back out to the whole graph.
function showAll(graph) {
    graph.clearHighlightedElements()
    graph.renderer.fitAndCenter()
}
// #endregion focus

export { data, options, focusNode, showAll }
