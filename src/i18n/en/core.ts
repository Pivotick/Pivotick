import type { MessageValue } from '../../interfaces/I18n'

/** Text written outside the UI elements: history entries, simplify, the renderer, notes, utilities. */
export const coreMessages = {
    // History entries, written once when the entry is recorded; {nodes} and {edges} are count.nodes and count.edges
    'history.entry.hid': { one: 'Hid {count} node', other: 'Hid {count} nodes' },
    'history.entry.showed': { one: 'Showed {count} node', other: 'Showed {count} nodes' },
    'history.entry.deletedNodes': { one: 'Deleted {count} node', other: 'Deleted {count} nodes' },
    'history.entry.deletedEdges': { one: 'Deleted {count} edge', other: 'Deleted {count} edges' },
    'history.entry.deletedBoth': 'Deleted {nodes}, {edges}',
    'history.entry.created': 'Created “{label}”',
    'history.entry.createdNode': 'Created a node',
    'history.entry.createdEdge': 'Created an edge',
    'history.entry.removedSeed': 'Removed the loaded data',
    'history.entry.removedManual': 'Removed hand-drawn work',
    'history.entry.removedSource': 'Removed “{source}”',
    'history.entry.grouped': 'Grouped “{group}”',
    'history.entry.ungrouped': 'Ungrouped “{group}”',
    'history.entry.ungroupedMany': { one: 'Ungrouped {count} group', other: 'Ungrouped {count} groups' },
    'history.entry.renamed': 'Renamed to “{group}”',

    // Simplify: one part of a group, "12 × ip"
    'simplify.typeLabel': '{count} × {type}',
    'simplify.untyped': 'node',

    // Simplify: the built-in rules, as their cards name and describe them
    'simplify.builtin.neighbours.label': 'Same neighbours',
    'simplify.builtin.neighbours.description': 'Nodes of one type linked to exactly the same nodes.',
    'simplify.builtin.chains.label': 'Chains',
    'simplify.builtin.chains.description': 'Nodes leading chains of the same shape, folded level by level.',
    'simplify.builtin.degree.label': 'Few links',
    'simplify.builtin.degree.description': 'Nodes with fewer links than this fold into the nodes they hang from.',
    'simplify.builtin.kcore.label': 'Outside the core',
    'simplify.builtin.kcore.description': 'Peels off nodes with fewer links than this, again and again, into the core.',
    'simplify.builtin.communities.label': 'Communities',
    'simplify.builtin.communities.description': 'Whole neighbourhoods into a few super-nodes.',
    'simplify.builtin.landings.label': 'Pivot landings',
    'simplify.builtin.landings.description': 'What a pivot brought in, one group per type.',
    'simplify.builtin.manual.label': 'By hand',
    'simplify.builtin.manual.description': 'Groups made from a selection.',

    // Simplify: a rule's one setting
    'simplify.setting.level': 'Level',
    'simplify.setting.minSize': 'Smallest group',
    'simplify.setting.fewestLinks': 'Fewest links',
    'simplify.setting.coreStrength': 'Core strength',

    // Layout progress over the canvas
    'renderer.progress.simulating': 'Optimizing node positions...',
    'renderer.progress.rendering': 'Rendering in progress',
    'renderer.progress.elapsed': 'Elapsed time: {seconds} sec',
    'renderer.progress.done': 'All done',

    // Physics
    'simulation.slow.title': 'Physics engine running slow',
    'simulation.slow.message': 'The physic has been disabled.',

    // Nodes on the canvas; the default label is written into the new node's data
    'node.expand.title': 'Expand node',
    'node.collapse.title': 'Collapse nodes',
    'node.defaultLabel': 'New node',

    // Open group outlines
    'groupOutline.drag.title': 'drag to move the group',
    'groupOutline.close.title': 'Fold back into the group',

    // Pivot badges on a node's rim
    'pivotBadge.title': '~{count} · {pivot}',
    'pivotBadge.summary.declared': { one: '~{total} across {count} pivot', other: '~{total} across {count} pivots' },
    'pivotBadge.summary.applies': { one: '{count} pivot applies', other: '{count} pivots apply' },

    // Notes on the canvas
    'noteCard.surfaceToggle.title': 'Toggle terminal look',
    'noteCard.edit.title': 'Edit the note',
    'noteCard.save.title': 'Save changes',
    'noteCard.remove.title': 'Remove the note',
    'noteCard.link.search.title': 'Search for a note',
    'noteCard.link.pickTitle': 'Select a node to link to this note',
    'noteCard.link.empty': 'Link this note to a node',
    'noteCard.link.missing': 'Missing node: {id}',
    'noteCard.reference.unresolved.title': 'Could not resolve node',

    // Minimap
    'minimap.expand.title': 'Show the minimap',
    'minimap.collapse.title': 'Collapse the minimap',
} satisfies Record<string, MessageValue>
