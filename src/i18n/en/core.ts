import type { MessageValue } from '../../interfaces/I18n'

/** Text written outside the UI elements: history entries, simplify, the renderer, notes, utilities. */
export const coreMessages = {
    // Simplify: one part of a group, "12 × ip"
    'simplify.typeLabel': '{count} × {type}',
    'simplify.untyped': 'node',
} satisfies Record<string, MessageValue>
