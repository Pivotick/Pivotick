import type { MessageValue } from '../../interfaces/I18n'

/** Words several areas count with. A sentence holding a count names its own key around these. */
export const commonMessages = {
    'count.nodes': { one: '{count} node', other: '{count} nodes' },
    'count.edges': { one: '{count} edge', other: '{count} edges' },

    // The body a new note starts with; it is saved into the note.
    'note.defaultContent': 'This is not a note.',

    // Key names shown in hints and tooltips; the ⌘ ⇧ ⌥ glyphs stay as they are.
    'keys.ctrlCombo': 'Ctrl+{key}',
    'keys.escape': 'esc',
} satisfies Record<string, MessageValue>
