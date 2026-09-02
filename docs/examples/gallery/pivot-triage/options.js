// #region data
// One case and the three indicators already attached to it. Everything else in this card
// arrives through a pivot, and most of it gets thrown away again.
const data = {
    nodes: [
        // Declared first because it is the one to pivot from. Every `appliesTo` below
        // excludes the case node, so an origin of `Case 77` finds nothing to offer.
        { id: 'mail.example', data: { label: 'mail.example', type: 'domain' } },
        { id: 'case-77', data: { label: 'Case 77', type: 'case' } },
        { id: '203.0.113.9', data: { label: '203.0.113.9', type: 'ip' } },
        { id: 'a1b2c3d4', data: { label: 'a1b2c3d4…', type: 'hash' } },
    ],
    edges: [
        { from: 'case-77', to: 'mail.example' },
        { from: 'case-77', to: '203.0.113.9' },
        { from: '203.0.113.9', to: 'a1b2c3d4' },
    ],
}
// #endregion data

// #region options
// The other card is about getting a number *down* before you fetch it. This one is about
// everything after the fetch: a triage count moves for three different reasons, and a
// provider that fails is a state you can recover from rather than a dead end.

/**
 * Stable ids matter here. A rejection is remembered as (pivot, candidate id), so a
 * provider that renumbers its results on every call can never be usefully rejected:
 * the same row comes back wearing a new id, and the memory has nothing to match.
 */
const indicators = (count, prefix, type) =>
    Array.from({ length: count }, (_, i) => ({
        id: `${prefix}-${i}`,
        data: { label: `${prefix} ${String(i).padStart(2, '0')}`, type },
    }))

/** Fan a result set out from whichever node the pivot was run on. */
const fanOut = (nodes, found, fallback) => {
    const origin = nodes[0]?.id ?? fallback
    return { nodes: found, edges: found.map((node) => ({ from: origin, to: node.id })) }
}

// 1. The reliable one. Forty candidates, the same forty every time, so rejecting five
// and running again demonstrates something.
const correlations = {
    id: 'correlations',
    label: 'Correlations',
    appliesTo: (nodes) => nodes.every((node) => node.getData()?.type !== 'case'),
    // No facets: narrowing is the other card's subject, and forty rows need none.
    summarize: () => ({ total: 40 }),
    fetch: (nodes) => fanOut(nodes, indicators(40, 'ind', 'indicator'), 'mail.example'),
}

// Both providers below fail on their first call and work on every one after it. The
// failure is deterministic so the card can promise it.
let feedCalls = 0
let reputationCalls = 0

// 2. The fetch fails. `summarize` is fine, so the entry looks healthy and the failure
// only appears once you commit to the expensive call: the pane's own error state.
const feed = {
    id: 'feed',
    label: 'Enrich from feed',
    appliesTo: (nodes) => nodes.every((node) => node.getData()?.type !== 'case'),
    summarize: () => ({ total: 18 }),
    fetch: (nodes) => {
        if (++feedCalls === 1) throw new Error('feed.example timed out (504)')
        return fanOut(nodes, indicators(18, 'feed', 'feed'), 'mail.example')
    },
}

// 3. The summary fails. This one is broken before you touch it, so its entry carries the
// error the moment the mode opens. Retry re-asks, and nothing else on the panel cares.
const reputation = {
    id: 'reputation',
    label: 'Reputation lookup',
    appliesTo: (nodes) => nodes.every((node) => node.getData()?.type !== 'case'),
    summarize: () => {
        if (++reputationCalls === 1) throw new Error('reputation.example refused the connection')
        return { total: 6 }
    },
    fetch: (nodes) => fanOut(nodes, indicators(6, 'rep', 'reputation'), 'mail.example'),
}

const options = {
    pivots: [correlations, feed, reputation],
    UI: {
        mode: 'full',
        sidebar: { collapsed: true },
        // The dock is the subject of this card, but it still starts folded: a staged
        // set unfolds it by itself.
        minimap: false,
        table: { open: false },
    },
    render: {
        defaultNodeStyle: {
            size: 8,
            color: (node) => ({
                case: '#bf616a', domain: '#ebcb8b', ip: '#88c0d0', hash: '#b48ead',
                indicator: '#8fbcbb', feed: '#a3be8c', reputation: '#d08770',
            }[node.getData()?.type] ?? '#8f9aa8'),
        },
    },
}
// #endregion options

export { data, options }
