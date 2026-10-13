import type { MessageValue } from '../../interfaces/I18n'

/**
 * The chrome around the canvas: top bar, search, history menu, rail, tool panel,
 * navigation, empty state, notifications, modals and the shared components.
 */
export const shellMessages = {
    // Asynchronous content
    'asyncContent.error': 'Content could not be loaded',

    // Busy indicator, while a host hook is awaited
    'busy.label': 'Waiting…',

    // Confirmation modal
    'confirm.title': 'Confirm',
    'confirm.submit': 'Confirm',

    // Empty canvas
    'emptyState.message': 'Nothing on the canvas yet',

    // Prompt modal
    'prompt.title': 'Details',
    'prompt.submit': 'Add',
    'prompt.cancel': 'Cancel',
    'prompt.nodeTitle': 'Node details',
    'prompt.edgeTitle': 'Edge details',
    'prompt.edgeLabelTitle': 'Edge label',
    'prompt.edgeLabelPlaceholder': 'Label…',

    // History menu
    'history.menu.aria': 'Graph history',
    'history.menu.title': 'History',
    'history.menu.undoSide': 'Undo side',
    'history.menu.redoSide': 'Redo side',
    'history.menu.count': '{count} of {limit}',
    'history.menu.countFull': '{count} of {limit} · oldest evicted',
    'history.menu.empty': 'Nothing has happened yet',
    'history.menu.nothingAhead': 'Nothing ahead — nothing has been undone',
    'history.menu.start': 'The start of the session',
    'history.menu.now': 'NOW',
    'history.menu.nowMeta': '{undone} undone · {done} done',
    'history.menu.jump.title': 'Scroll back to now',
    'history.row.pivotRun': '{label} #{ordinal}',
    'history.row.kept': 'kept',
    'history.row.locked': 'locked',
    'history.row.saved': 'saved',
    'history.row.nothingLeft': 'Nothing left the canvas',
    'history.foot.idle': 'Point at a row to travel there.',
    'history.foot.position': '{ahead} ahead · {behind} behind',
    'history.foot.undoesSteps': { one: 'Undoes {count} step', other: 'Undoes {count} steps' },
    'history.foot.redoesSteps': { one: 'Redoes {count} step', other: 'Redoes {count} steps' },
    'history.foot.undoesSome': 'Undoes {acting} of {total}',
    'history.foot.redoesSome': 'Redoes {acting} of {total}',
    'history.foot.keptSaved': { one: '{count} saved item kept', other: '{count} saved items kept' },
    'history.foot.alreadyApplied': '{count} already applied',
    'history.foot.savedUpstream': { one: '{count} item saved upstream', other: '{count} items saved upstream' },
    'history.foot.nothingToReverse': 'Nothing to reverse',
    'history.delta.nodesAdded': { one: '+{count} node', other: '+{count} nodes' },
    'history.delta.nodesRemoved': { one: '−{count} node', other: '−{count} nodes' },
    'history.delta.edgesAdded': { one: '+{count} edge', other: '+{count} edges' },
    'history.delta.edgesRemoved': { one: '−{count} edge', other: '−{count} edges' },
    'history.delta.shownNodes': { one: '{count} node back in view', other: '{count} nodes back in view' },
    'history.delta.shown': '{count} back in view',
    'history.delta.hiddenNodes': { one: '{count} node hidden', other: '{count} nodes hidden' },
    'history.delta.hidden': '{count} hidden',
    'history.delta.groups': 'groups change',
    'history.delta.none': 'nothing changes',
    'history.time.now': 'now',
    'history.time.minutes': '{count}m',
    'history.time.hours': '{count}h',
    'history.time.hoursMinutes': '{hours}h {minutes}m',

    // JSON viewer
    'jsonViewer.copy': 'Copy JSON',
    'jsonViewer.copied': 'Copied!',

    // Modals
    'modal.ok': 'Ok',
    'modal.close.aria': 'Close',
    'modal.editNode.heading': 'Editing node:',
    'modal.editNode.submit': 'Edit Node',
    'modal.editEdge.heading': 'Editing edge:',
    'modal.editEdge.submit': 'Edit Edge',
    'modal.editEdge.endpoints': '{from} → {to}',
    'modal.editEdge.labelField': 'Label',
    'modal.inspect.properties': 'Properties',
    'modal.inspect.json': 'JSON',

    // Canvas navigation
    'navigation.fit': 'Fit and center',
    'navigation.zoomIn': 'Zoom In',
    'navigation.zoomOut': 'Zoom Out',
    'navigation.fullscreen': 'Toggle Fullscreen',

    // Notifications
    'notification.dismiss.aria': 'Dismiss',

    // Mode rail
    'rail.select': 'Select',
    'rail.create': 'Create',
    'rail.view': 'View',
    'rail.physics': 'Physics',
    'rail.simplify': 'Simplify',
    'rail.lasso': 'Lasso',
    'rail.edge': 'Edge',
    'rail.button.title': '{label} ({shortcut})',
    'rail.simplify.summary': 'Simplify: {groups}, {folded}',
    'rail.simplify.groups': { one: '{count} group', other: '{count} groups' },
    'rail.simplify.folded': { one: '{count} node folded', other: '{count} nodes folded' },

    // Slide panel
    'slidePanel.empty': '- empty panel -',

    // Search
    'search.placeholder': 'Search',
    'search.hint.navigate': 'to navigate',
    'search.hint.select': 'to select',
    'search.hint.showAll': 'to show all',
    'search.hint.close': 'to close',
    'search.result.inGroup': 'in {group}',
    'search.summary.none': 'No results found',
    'search.summary.top': 'Showing top {shown} of {count} results',
    'search.summary.all': { one: '{count} result', other: '{count} results' },
    'search.showAll': 'Show all on the canvas',

    // Tool panel
    'toolPanel.select': 'Select',
    'toolPanel.create': 'Create',
    'toolPanel.pointer': 'Pointer',
    'toolPanel.lasso': 'Lasso',
    'toolPanel.pathSelect': 'Path select',
    'toolPanel.invertSelection': 'Invert selection',
    'toolPanel.addNode': 'Add node',
    'toolPanel.addEdge': 'Add edge',
    'toolPanel.addNote': 'Add note',
    'toolPanel.editNode': 'Edit node',
    'toolPanel.soon': 'SOON',
    'toolPanel.soon.title': '{tool} — coming soon',
    'toolPanel.resize.aria': 'Resize the tool panel',

    // Top bar
    'topBar.search': 'Search',
    'topBar.search.aria': 'Search for a node',
    'topBar.filter': 'Filter Graph',
    'topBar.filter.aria': 'Filter the graph',
    'topBar.filter.panelTitle': 'Graph Filters',
    'topBar.notes': 'Notes',
    'topBar.undo': 'Undo',
    'topBar.undo.title': 'Undo ({shortcut})',
    'topBar.undo.titleNamed': 'Undo — {entry} ({shortcut})',
    'topBar.undo.ariaNamed': 'Undo {entry}',
    'topBar.redo': 'Redo',
    'topBar.redo.title': 'Redo ({shortcut})',
    'topBar.redo.titleNamed': 'Redo — {entry} ({shortcut})',
    'topBar.redo.ariaNamed': 'Redo {entry}',
    'topBar.undoHistory.aria': 'Undo history',
    'topBar.redoHistory.aria': 'Redo history',
    'topBar.action.more.aria': 'More: {action}',
    'topBar.promptSubmit': 'OK',
} satisfies Record<string, MessageValue>
