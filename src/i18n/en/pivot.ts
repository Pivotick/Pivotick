import type { MessageValue } from '../../interfaces/I18n'

/** The Pivot panel, the triage pane, the Pivot rail mode and pivot toasts. */
export const pivotMessages = {
    // Verbs several pivot surfaces share
    'pivot.retry': 'Retry',
    'pivot.cancel': 'Cancel',
    'pivot.close': 'Close',
    'pivot.dismiss': 'Dismiss',
    'pivot.more': '…and {count} more',

    // Rail mode
    'pivot.mode.label': 'Pivot',
    'pivot.mode.pickOrigin': 'Pick origin',
    'pivot.mode.lassoOrigin': 'Lasso origin',

    // Toasts for a run that was going to land
    'pivot.toast.fetchFailed': 'Couldn\'t fetch {pivot}',
    'pivot.toast.refused.title': '{pivot} returned too much',
    'pivot.toast.refused.message': {
        one: '{count} candidate, over the {limit} limit. Nothing was ingested — narrow and run again.',
        other: '{count} candidates, over the {limit} limit. Nothing was ingested — narrow and run again.',
    },

    // Save: the prompt and the toast; {elements} is a list of count.nodes and count.edges
    'pivot.save.promptTitle': 'Save',
    'pivot.save.promptSubmit': 'Save',
    'pivot.save.saving': 'Saving…',
    'pivot.save.saved': 'Saved {elements}',
    'pivot.save.failed': 'Couldn\'t save {elements}',
    'pivot.save.failedDetail': 'Nothing was written, and nothing left the canvas.',
    'pivot.save.partial': 'Saved {saved} of {total}',
    'pivot.save.partialDetail': '{count} still unsaved.',
    'pivot.save.nothing': 'nothing',

    // Ingest toasts
    'pivot.ingest.failed': 'Ingest failed',
    'pivot.ingest.cancelled': 'Ingest cancelled',
    'pivot.ingest.nothing': 'Nothing was ingested',
    'pivot.ingest.nodes': { one: 'Ingested {count} node', other: 'Ingested {count} nodes' },
    'pivot.ingest.edges': { one: 'Ingested {count} edge', other: 'Ingested {count} edges' },
    'pivot.ingest.someNodes': { one: 'Ingested {landed} of {count} node', other: 'Ingested {landed} of {count} nodes' },
    // {nodes} is count.nodes or pivot.ingest.nodesOfAsked, {edges} is count.edges
    'pivot.ingest.nodesAndEdges': 'Ingested {nodes}, {edges}',
    'pivot.ingest.nodesOfAsked': { one: '{landed} of {count} node', other: '{landed} of {count} nodes' },

    // Panel: filter, bulk selection and the run tray
    'pivot.panel.filter.placeholder': 'Filter pivots',
    'pivot.panel.filter.aria': 'Filter pivots',
    'pivot.panel.filter.clear.title': 'Clear the filter',
    'pivot.panel.hits.selected': 'Showing your {count} selected',
    'pivot.panel.hits.matching': '{count} match',
    'pivot.panel.selectNone': 'Select none',
    'pivot.panel.deselect': 'Deselect {count}',
    'pivot.panel.selectMatching': 'Select {count} matching',
    'pivot.panel.selectAll': 'Select all {count}',
    'pivot.panel.tray.selected': '{count} selected',
    'pivot.panel.tray.hidden': '{count} hidden',
    'pivot.panel.tray.none': 'Nothing selected',
    'pivot.panel.tray.reveal.title': 'Show only what is selected',
    'pivot.panel.tray.unreveal.title': 'Back to the filtered list',
    'pivot.panel.tray.clear': 'Clear',
    'pivot.panel.tray.clear.title': 'Clear the selection',
    'pivot.panel.tray.run': 'Run',
    'pivot.panel.tray.runCount': 'Run {count}',
    'pivot.panel.tray.run.title': 'Run every selected pivot',
    'pivot.panel.tray.caution': {
        one: '{count} pivot is over {limit} — this asks every one of them at once.',
        other: '{count} pivots is over {limit} — this asks every one of them at once.',
    },
    'pivot.panel.noMatch': 'No pivot matches “{query}”.',
    'pivot.panel.noMatch.reveal': 'Nothing selected.',
    'pivot.panel.originless': 'Without an origin ({count})',

    // Panel: the unsaved ledger; {nodes} and {edges} are count.nodes and count.edges
    'pivot.panel.unsaved': '{count} unsaved',
    'pivot.panel.unsaved.title': 'Brought in by a pivot this session, and not written back',
    'pivot.panel.unsaved.titleCounts': '{nodes} and {edges} this session\'s pivots brought in and have not written back',
    'pivot.panel.save': 'Save',
    'pivot.panel.save.saving': 'Saving…',
    'pivot.panel.save.title': 'Write these back to the source system',

    // Panel: the origin
    'pivot.panel.origin': 'Origin',
    'pivot.panel.origin.empty': 'Nothing picked — click a node on the canvas to see what can be run on it',
    'pivot.panel.origin.emptyOriginless': 'Nothing picked — click a node on the canvas, or run one of the pivots below',
    'pivot.panel.origin.more': '+{count}',
    'pivot.panel.origin.clear': 'Clear',
    'pivot.panel.heading': { one: '{count} pivot applies', other: '{count} pivots apply' },
    'pivot.panel.heading.none': 'No pivots apply to this origin',

    // Panel: one pivot's entry
    'pivot.entry.select.aria': 'Select {pivot}',
    'pivot.entry.fetching': 'Fetching…',
    'pivot.entry.fetchingCount': 'Fetching ~{count}…',
    'pivot.entry.ingested': '{count} ingested',
    'pivot.entry.declared': '~{count} declared',
    'pivot.entry.count': '~{count}',
    'pivot.entry.countAcross': { one: '~{total} across {count} node', other: '~{total} across {count} nodes' },
    'pivot.entry.scope': 'Applies to {taken} of the {count} picked',
    // One part of the breakdown line, "12 domains"; the label is the provider's
    'pivot.entry.breakdownItem': '{count} {label}',
    'pivot.entry.error': 'Couldn\'t reach the source.',
    'pivot.entry.gate.over': 'Over the cap of {count} — narrow further to fetch',
    'pivot.entry.gate.within': 'Within the cap of {count}',
    'pivot.entry.gate.refused': {
        one: 'The source returned {count} candidate, over the {limit} limit. Nothing was staged — narrow and run again.',
        other: 'The source returned {count} candidates, over the {limit} limit. Nothing was staged — narrow and run again.',
    },
    'pivot.entry.run': 'Run',
    'pivot.entry.fetch': 'Fetch',
    'pivot.entry.runIngest': 'Run & ingest',
    'pivot.entry.fetchIngest': 'Fetch & ingest',
    'pivot.entry.ingest.title': 'Add every result to the graph without reviewing it first',
    'pivot.entry.clearNarrowing': 'Clear narrowing',
    'pivot.entry.inTriage': '{count} in triage',
    'pivot.entry.rejected': '{count} rejected',
    'pivot.entry.rejected.title': 'What you rejected here this session. It is not offered again until restored.',
    'pivot.entry.rejected.note': 'Not offered again this session. Restoring one brings it back on the next run.',
    'pivot.entry.restore': 'restore',
    'pivot.entry.restore.title': 'Offer this again on the next run',
    'pivot.entry.restoreAll': 'Restore all',
    'pivot.entry.restoreAll.title': 'Take back every rejection this pivot holds',

    // Review tab: the provider strip
    'pivot.review.tab': 'Review',
    'pivot.review.tabLoading': 'Review…',
    'pivot.review.tabWaiting': 'Review ({count})',
    'pivot.review.strip.aria': 'Staged providers',
    'pivot.review.closeFailed': 'Close failed',
    'pivot.review.closeFailed.title': {
        one: 'Drop the one provider whose fetch brought nothing back',
        other: 'Drop the {count} providers whose fetches brought nothing back',
    },
    'pivot.review.closeAll': 'Close all',
    'pivot.review.closeAll.title': {
        one: 'Drop {count} staged provider. Nothing is rejected.',
        other: 'Drop all {count} staged providers. Nothing is rejected.',
    },
    'pivot.review.item.fetching': '{provider} — fetching',
    'pivot.review.item.failed': '{provider} — the fetch failed',
    'pivot.review.item.waiting': '{provider} — {count} waiting for a verdict',
    'pivot.review.item.idle': '{provider} — nothing waiting',
    'pivot.review.item.close.aria': 'Close {provider}',
    'pivot.review.item.close.title': 'Drop these candidates. Nothing is rejected.',

    // Triage pane: toolbar
    'pivot.triage.search.placeholder': 'Search rows…',
    'pivot.triage.search.patternPlaceholder': 'Match rows by pattern…',
    'pivot.triage.search.title': 'Narrow the candidates. Nothing here touches the graph.',
    'pivot.triage.regex': 'regex',
    'pivot.triage.regex.title': 'Read the search box as a regular expression',
    'pivot.triage.rerun': 'Re-run',
    'pivot.triage.rerun.title': 'Fetch again with the same narrowing',

    // Triage pane: states
    'pivot.triage.loading': 'Fetching candidates…',
    'pivot.triage.loading.sub': 'Nothing is on the canvas yet — candidates are staged, not merged.',
    'pivot.triage.error': 'Couldn\'t fetch candidates.',
    'pivot.triage.error.sub': 'Nothing was staged. Retrying runs the same request with the narrowing you already chose.',
    'pivot.triage.refused': {
        one: 'The source returned {count} candidate, over the {limit} limit.',
        other: 'The source returned {count} candidates, over the {limit} limit.',
    },
    'pivot.triage.refused.sub': 'Nothing was staged — narrow and run again.',
    'pivot.triage.empty': 'No candidates came back',
    'pivot.triage.empty.sub': 'The narrowing may be tighter than the data.',
    'pivot.triage.allRejected': {
        one: 'The only candidate was rejected earlier this session',
        other: 'All {count} were rejected earlier this session',
    },
    'pivot.triage.allRejected.sub': 'Nothing new came back. Restoring one offers it again on the next run.',
    'pivot.triage.allOnCanvas': {
        one: 'The only candidate is already on the canvas — nothing to triage',
        other: 'All {count} are already on the canvas — nothing to triage',
    },
    'pivot.triage.allOnCanvas.sub': 'Nothing was changed: an id already here is left exactly as it was.',
    'pivot.triage.done': 'Nothing left to triage',
    'pivot.triage.done.ingested': '{count} ingested',
    'pivot.triage.done.rejected': '{count} rejected',
    'pivot.triage.done.onCanvas': '{count} already on canvas',
    'pivot.triage.showRejected': 'Show the {count} rejected',
    'pivot.triage.hideRejected': 'Hide the rejected',

    // Triage pane: the banner over a re-run
    'pivot.triage.banner.running': 'Running again…',
    'pivot.triage.banner.failed': 'The re-run failed. What is below is untouched.',
    'pivot.triage.banner.ready': {
        one: 'This pivot was run again. {count} new candidate is ready.',
        other: 'This pivot was run again. {count} new candidates are ready.',
    },
    'pivot.triage.banner.show': 'Show new',
    'pivot.triage.banner.keep': 'Keep triaging',

    // Triage pane: the header line
    'pivot.triage.head.fetched': '{count} fetched',
    'pivot.triage.head.deduped': '{count} already on canvas (skipped)',
    'pivot.triage.head.suppressed': '{count} rejected earlier',
    'pivot.triage.head.suppressed.title': 'Suppressed because they were rejected earlier this session',
    'pivot.triage.head.unsaved': '{count} unsaved',
    'pivot.triage.head.save': 'save',
    'pivot.triage.head.saving': 'saving…',
    'pivot.triage.head.save.title': 'Write this provider\'s ingested results back to the source system',
    'pivot.triage.head.origin': { one: '{count} origin node', other: '{count} origin nodes' },
    'pivot.triage.head.noOrigin': 'no origin',
    'pivot.triage.head.narrowed': 'narrowed',

    // Triage pane: what the session rejected earlier
    'pivot.triage.suppressed.note': 'Rejected earlier, so not offered again this session. Restoring one brings it back on the next run.',
    'pivot.triage.restore': 'restore',
    'pivot.triage.restoreAll': 'restore all',

    // Triage pane: the tables
    'pivot.triage.column.candidate': 'Candidate',
    'pivot.triage.column.children': 'Children',
    'pivot.triage.column.from': 'From',
    'pivot.triage.column.to': 'To',
    'pivot.triage.section.nodes': 'Nodes',
    'pivot.triage.section.edges': 'Edges',
    'pivot.triage.section.edges.note': 'both ends are already on the canvas',
    'pivot.triage.edge.endpoints': '{from} → {to}',
    'pivot.triage.row.select.aria': 'Select {row}',
    'pivot.triage.row.onCanvas': 'on canvas',
    'pivot.triage.row.undo': 'undo',
    'pivot.triage.row.willIngest': 'will ingest',
    'pivot.triage.children.show.title': 'Show what this row holds',
    'pivot.triage.children.hide.title': 'Hide what this row holds',
    'pivot.triage.children.summary': {
        one: '{count} child — ingesting this row takes all of them.',
        other: '{count} children — ingesting this row takes all of them.',
    },
    // A child's data value beside its name; the key and the value are the data's own
    'pivot.triage.children.field': '{key}: {value}',
    'pivot.triage.children.nested': '+{count} inside',

    // Triage pane: the footer
    'pivot.triage.foot.ingest': 'Ingest selected ({count})',
    'pivot.triage.foot.ingestLoose': 'Ingest loose ({count})',
    'pivot.triage.foot.ingestLoose.title': 'Land the selected rows as separate nodes',
    'pivot.triage.foot.ingestGrouped': 'Ingest in a group ({count})',
    'pivot.triage.foot.ingestGrouped.title': 'Land the selected rows folded, one group per type',
    'pivot.triage.foot.ingestAll': 'Ingest all {count}',
    'pivot.triage.foot.selectAll': 'Select all {count}',
    'pivot.triage.foot.selectMatching': 'Select all {count} matching',
    'pivot.triage.foot.rejectSelected': 'Reject selected',
    'pivot.triage.foot.rejectRemaining': 'Reject all remaining',
    'pivot.triage.foot.page': '{from}–{to} of {count}',
    'pivot.triage.foot.shown': '{count} shown',
    'pivot.triage.foot.note': 'closing this pane rejects nothing — leftovers are re-offered next run',
} satisfies Record<string, MessageValue>
