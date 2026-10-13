import type { MessageValue } from '../../interfaces/I18n'

/** The node, edge, note, selection and canvas context menus. */
export const contextMenuMessages = {
    // Shared by the node, group and selection menus
    'contextMenu.selectNeighbors': 'Select Neighbors',
    'contextMenu.ungroup': 'Ungroup',

    // Node menu
    'contextMenu.node.pin': 'Pin Node',
    'contextMenu.node.unpin': 'Unpin Node',
    'contextMenu.node.focus': 'Focus Node',
    'contextMenu.node.hide': 'Hide Node',
    'contextMenu.node.viewImage': 'View Image',
    'contextMenu.node.hideChildren': 'Hide Children',
    'contextMenu.node.connect': 'Connect to...',
    'contextMenu.node.connect.picker': 'Select the target node to link with',
    'contextMenu.node.connect.pickerNode': '"{node}"',
    'contextMenu.node.expand': 'Expand Node',
    'contextMenu.node.inspect': 'Inspect Properties',
    'contextMenu.node.delete': 'Delete Node',

    // Group menu
    'contextMenu.group.pin': 'Pin Group',
    'contextMenu.group.unpin': 'Unpin Group',
    'contextMenu.group.focus': 'Focus Group',
    'contextMenu.group.selectNeighbors.title': 'Select the nodes this group links to',
    'contextMenu.group.open': 'Open group',
    'contextMenu.group.open.title': 'Put the members back on the canvas',
    'contextMenu.group.selectMembers': 'Select members',
    'contextMenu.group.selectMembers.title': 'Select the nodes in this group',
    'contextMenu.group.viewInTable': 'View members in table',
    'contextMenu.group.viewInTable.title': 'List the members in the data dock, to filter and search them',
    'contextMenu.group.rename': 'Rename group',
    'contextMenu.group.rename.title': 'Give this group a title',
    'contextMenu.group.ungroup.title': 'Draw the members as they were before this group',
    'contextMenu.group.deleteMembers': 'Delete members',
    'contextMenu.group.deleteMembers.title': 'Delete every node in this group',

    // Selection menu
    'contextMenu.selection.count': '{count} selected',
    'contextMenu.selection.pin': 'Pin Selected',
    'contextMenu.selection.unpin': 'Unpin Selected',
    'contextMenu.selection.hide': 'Hide Selected',
    'contextMenu.selection.selectNeighbors.title': 'Select the nodes linked to the selection',
    'contextMenu.selection.group': 'Group selected nodes',
    'contextMenu.selection.group.title': 'Fold the selection into one group with a title',
    'contextMenu.selection.ungroup.title': 'Draw the members of these hand-made groups as they were',
    'contextMenu.selection.delete': 'Delete Selected',
    'contextMenu.selection.delete.title': 'Delete every selected node',

    // Group membership, in the node and selection menus
    'contextMenu.membership.pullOut': 'Pull out of group',
    'contextMenu.membership.pullOut.title': 'Keep these nodes out of their groups',
    'contextMenu.membership.putBack': 'Put back in group',
    'contextMenu.membership.putBack.title': 'Let these nodes be grouped again',

    // Edge menu
    'contextMenu.edge.edit': 'Edit Edge',
    'contextMenu.edge.delete': 'Delete Edge',

    // Note menu
    'contextMenu.note.hide': 'Hide Note',
    'contextMenu.note.remove': 'Remove Note',

    // Canvas menu
    'contextMenu.canvas.pinAll': 'Pin All',
    'contextMenu.canvas.unpinAll': 'Unpin All',
    'contextMenu.canvas.addNode': 'Add Node Here',
    'contextMenu.canvas.addNote': 'Add Note',
    'contextMenu.canvas.releasePinned': 'Release pinned nodes',
    'contextMenu.canvas.releasePinned.title': 'Unpin every pinned node so the layout can move them again',

    // Pivot submenu; the peek is a provider's advisory count beside its row
    'contextMenu.pivot': 'Pivot',
    'contextMenu.pivot.openPanel': 'Open pivot panel…',
    'contextMenu.pivot.openPanel.title': 'Read the counts, narrow, then run',
    'contextMenu.pivot.peek': '~{count}',
    'contextMenu.pivot.peek.title': 'About {count} out there',
    'contextMenu.pivot.peek.titleAcross': 'About {count} across {nodes}',
    'contextMenu.pivot.peek.failed.title': 'This pivot could not say what is out there',
} satisfies Record<string, MessageValue>
