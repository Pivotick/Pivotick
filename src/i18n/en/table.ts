import type { MessageValue } from '../../interfaces/I18n'

/** The table and the bottom dock. */
export const tableMessages = {
    // The pane and its own Nodes / Edges switch
    'table.tab': 'Table',
    'table.view.nodes': 'Nodes',
    'table.view.edges': 'Edges',

    // Built-in column headings
    'table.column.label': 'Label',
    'table.column.degree': 'Degree',
    'table.column.degreeIn': 'In',
    'table.column.degreeOut': 'Out',
    'table.column.visibility': 'Visibility',
    'table.column.pinned': 'Pinned',
    'table.column.children': 'Children',
    'table.column.cluster': 'Cluster',
    'table.column.group': 'Group',
    'table.column.source': 'Source',
    'table.column.target': 'Target',
    'table.column.sort.title': 'Sort by {column}',

    // What the Visibility column shows for each state
    'table.visibility.visible': 'visible',
    'table.visibility.filtered': 'filtered',
    'table.visibility.excluded': 'excluded',
    'table.visibility.endpoint': 'endpoint',
    'table.visibility.nested': 'nested',
    'table.visibility.grouped': 'grouped',

    // A true / false cell
    'table.value.true': 'true',
    'table.value.false': 'false',

    // Column filters
    'table.filter.title': 'Narrow the rows by {column}',
    'table.filter.placeholder': 'Filter rows…',
    'table.filter.all': 'All',
    'table.filter.min.placeholder': 'Min',
    'table.filter.max.placeholder': 'Max',

    // No rows to list
    'table.empty.filtered': 'No rows match the column filters.',
    'table.empty.scope': '{scope}: none left.',
    'table.empty.nodes': 'This graph has no nodes.',
    'table.empty.edges': 'This graph has no edges.',

    // Row count in the toolbar
    'table.summary.someNodes': { one: '{shown} of {count} node', other: '{shown} of {count} nodes' },
    'table.summary.someEdges': { one: '{shown} of {count} edge', other: '{shown} of {count} edges' },
    'table.summary.hidden': '{count} hidden',
    'table.summary.hiddenNodes.title': {
        one: '{count} node hidden on the canvas by this table\'s column filters',
        other: '{count} nodes hidden on the canvas by this table\'s column filters',
    },
    'table.summary.hiddenEdges.title': {
        one: '{count} relation hidden on the canvas by this table\'s column filters',
        other: '{count} relations hidden on the canvas by this table\'s column filters',
    },

    // Toolbar
    'table.selectAll': 'Select all',
    'table.selectAll.title': 'Select every row currently listed',
    'table.export.title': 'Export the rows and columns currently shown as {format}',
    'table.export.blocked': 'Export blocked',
    'table.export.blocked.message': 'This page will not let the file download. Try the example outside its frame.',
    'table.columns': 'Columns',
    'table.columns.title': 'Choose which columns to show',
    'table.scope.clear.title': 'List every node again',
    'table.nested': 'Nested nodes',
    'table.nested.title': 'List the nodes inside clusters alongside the graph\'s own',

    // Applying the column filters to the graph
    'table.apply': 'Apply to graph',
    'table.apply.clear': 'Clear',
    'table.apply.disabled.title': 'Narrow a column first, then apply it to the graph',
    'table.apply.nodes.title': {
        one: 'Hide the {count} node the column filters leave out',
        other: 'Hide the {count} nodes the column filters leave out',
    },
    'table.apply.edges.title': {
        one: 'Hide the {count} relation the column filters leave out',
        other: 'Hide the {count} relations the column filters leave out',
    },
    'table.apply.clearNodes.title': {
        one: 'Stop filtering the graph from this table — {count} node hidden',
        other: 'Stop filtering the graph from this table — {count} nodes hidden',
    },
    'table.apply.clearEdges.title': {
        one: 'Stop filtering the graph from this table — {count} relation hidden',
        other: 'Stop filtering the graph from this table — {count} relations hidden',
    },
    'table.graphFilter.label': 'From the table',

    // Dock
    'dock.resize.aria': 'Resize the dock',
    'dock.expand.title': 'Expand the dock',
    'dock.collapse.title': 'Collapse the dock',
} satisfies Record<string, MessageValue>
