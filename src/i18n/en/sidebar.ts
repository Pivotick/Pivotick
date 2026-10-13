import type { MessageValue } from '../../interfaces/I18n'

/** The sidebar panels, the tooltip, the group summary and the notes sidebar. */
export const sidebarMessages = {
    // Sidebar
    'sidebar.collapse.aria': 'Collapse sidebar',
    'sidebar.expand.aria': 'Expand sidebar',
    'sidebar.clearSelection': 'Clear selection',

    // Sidebar header
    'sidebar.header.representedEdges': { one: 'Stands for {count} edge', other: 'Stands for {count} edges' },
    'sidebar.header.nodesSelected': { one: '{count} node selected', other: '{count} nodes selected' },
    'sidebar.header.edgesSelected': { one: '{count} edge selected', other: '{count} edges selected' },
    'sidebar.header.nodesTotal': 'Out of {count} total',
    'sidebar.header.edgesTotal': 'Out of {count} total',
    'sidebar.header.showing': 'Showing {nodes} and {edges}',

    // Names and descriptions the data does not give
    'headerMap.untitled': 'Could not resolve title',
    'headerMap.nameFallback': 'Optional name or label',
    'headerMap.descriptionFallback': 'Optional subtitle or description',

    // Bulk actions
    'sidebar.bulk.pin': 'Pin',
    'sidebar.bulk.unpin': 'Unpin',
    'sidebar.bulk.hide': 'Hide',
    'sidebar.bulk.isolate': 'Isolate',
    'sidebar.bulk.group': 'Group',
    'sidebar.bulk.ungroup': 'Ungroup',
    'sidebar.bulk.bulkEdit': 'Bulk edit',
    'sidebar.bulk.delete': 'Delete',
    'sidebar.bulk.soon.title': '{action} — coming soon',

    // Properties panel
    'sidebar.properties.nodeHeading': 'Basic Node Properties',
    'sidebar.properties.edgeHeading': 'Basic Edge Properties',
    'sidebar.properties.nodesHeading': 'Aggregated Node Properties',
    'sidebar.properties.edgesHeading': 'Aggregated Edge Properties',
    'sidebar.properties.keep.title': 'Keep only nodes with this value',
    'sidebar.properties.exclude.title': 'Exclude nodes with this value',

    // Facet cards: a multi-selection's properties, and the neighbours' edge labels
    'sidebar.facets.unique': '{count} unique',
    'sidebar.facets.values': { one: '{count} value', other: '{count} values' },
    'sidebar.facets.shared': 'shared',
    'sidebar.facets.empty': '— empty —',
    'sidebar.facets.allNodes': { one: 'all {count} node', other: 'all {count} nodes' },
    'sidebar.facets.someNodes': '{count} of {total}',
    'sidebar.facets.percent': '{count}%',
    'sidebar.facets.segment.title': '{value} — {count} ({percent}%)',
    'sidebar.facets.otherValues': { one: '{count} other value', other: '{count} other values' },
    'sidebar.facets.other.title': '{values} — {count} ({percent}%)',
    'sidebar.facets.moreValues': { one: '+{count} more value', other: '+{count} more values' },
    'sidebar.facets.moreChips': '+{count} more',
    'sidebar.facets.noRepeats': 'no repeated values',
    'sidebar.facets.filterHint': 'Click to keep only · Alt-click to exclude',

    // Property list, in the sidebar, the tooltip and the inspector
    'propertyList.label': 'PROPERTIES',
    'propertyList.fields': { one: '{count} field', other: '{count} fields' },
    'propertyList.items': { one: '{count} item', other: '{count} items' },
    'propertyList.keys': { one: '{count} key', other: '{count} keys' },
    'propertyList.copy.title': 'Copy',

    // Neighbours panel
    'sidebar.neighbors.tab.graph': 'Neighbor Graph',
    'sidebar.neighbors.tab.stats': 'Stats',
    'sidebar.neighbors.tab.list': 'List',
    'sidebar.neighbors.connections': { one: '{count} connection', other: '{count} connections' },
    'sidebar.neighbors.moreNode': '{count} more',
    'sidebar.neighbors.aggregate.count': '+{count}',
    'sidebar.neighbors.aggregate.group': 'Group',
    'sidebar.neighbors.row.outgoing': 'Outgoing connection — {node}',
    'sidebar.neighbors.row.incoming': 'Incoming connection — {node}',
    'sidebar.neighbors.row.undirected': 'Connection — {node}',
    'sidebar.neighbors.stats.degree': 'Degree',
    'sidebar.neighbors.stats.degree.title': 'Total connections',
    'sidebar.neighbors.stats.outgoing.title': 'Outgoing edges',
    'sidebar.neighbors.stats.incoming.title': 'Incoming edges',
    'sidebar.neighbors.stats.label': 'Label',
    'sidebar.neighbors.stats.select.title': 'Select nodes linked with this label',
    'sidebar.neighbors.stats.exclude.title': 'Exclude nodes linked with this label',

    // Group panel
    'sidebar.group.open': 'Open',
    'sidebar.group.cancel': 'Cancel',
    'sidebar.group.close': 'Close',
    'sidebar.group.selectMembers': 'Select members',
    'sidebar.group.rename': 'Rename',
    'sidebar.group.ungroup': 'Ungroup',
    'sidebar.group.ungroup.title': 'Draw the members as they were before this group',
    'sidebar.group.viewInTable': 'View in table',
    'sidebar.group.viewInTable.title': 'List the members in the data dock, to filter and search them',
    'sidebar.group.pivot': 'Pivot ▸',
    'sidebar.group.delete': 'Delete {count}',
    'sidebar.group.edit': 'Edit',
    'sidebar.group.edit.title': 'A group has no data of its own to edit',
    'sidebar.group.members': 'Members',
    'sidebar.group.pullOut': 'Pull out',
    'sidebar.group.pullOut.title': 'Keep this node out of the group',

    // Group summary, in the tooltip and the group panel
    'groupSummary.subtitle': 'Group · {rule}',
    'groupSummary.match': '{count} of {total} match',
    'groupSummary.matchQuery': '{count} of {total} match "{query}"',
    'groupSummary.members': 'Members',
    'groupSummary.linkedTo': 'Linked to',
    'groupSummary.more': '{count} more',

    // Opening, grouping and renaming groups
    'groupActions.openAsk': 'Put {group} on the canvas?',
    'groupActions.open': 'Open',
    'groupActions.titleField.aria': 'Group title',
    'groupActions.group.heading': 'Group nodes',
    'groupActions.group.submit': 'Group',
    'groupActions.group.left': {
        one: '{count} of the selected node stays out: annotated, or an open cluster.',
        other: '{count} of the selected nodes stay out: annotated, or an open cluster.',
    },
    'groupActions.rename.heading': 'Rename group',
    'groupActions.rename.submit': 'Rename',
    'groupActions.tableScope': 'Members of {group}',

    // Tooltip
    'tooltip.pin': 'Pin Tooltip',
    'tooltip.close': 'Close Tooltip',
    'tooltip.focus': 'Focus Element in Graph',
    'tooltip.select': 'Select Element in Graph',
    'tooltip.image.title': 'Click to view full size',
    'tooltip.groupHint': 'Double-click to open · Select for the member list',

    // Notes sidebar
    'noteSidebar.empty': 'No notes yet',
    'noteSidebar.untitled': 'Untitled note',
    'noteSidebar.hide.title': 'Hide note',
    'noteSidebar.restore.title': 'Restore hidden note',
    'noteSidebar.remove.title': 'Remove note',
    'noteSidebar.add': 'Add Note',
    'noteSidebar.hideAll': 'Hide all',
    'noteSidebar.hideAll.title': 'Hide all notes',
    'noteSidebar.hidden.heading': 'Hidden notes',
    'noteSidebar.showAll': 'Show all notes',
    'noteSidebar.showAll.title': 'Restore hidden notes',

    // Node preview
    'nodePreview.imageUnavailable': 'Image unavailable',
} satisfies Record<string, MessageValue>
