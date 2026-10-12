import type { MessageValue } from '../interfaces/I18n'

/**
 * The library's English text, by key. A translation is a copy of this object with the
 * values replaced, passed as `i18n.messages`.
 *
 * @category I18n
 */
export const messagesEn = {
    // Asynchronous content
    'asyncContent.error': 'Content could not be loaded',

    // Busy indicator, while a host hook is awaited
    'busy.label': 'Waiting…',

    // Confirmation modal
    'confirm.title': 'Confirm',
    'confirm.submit': 'Confirm',

    // Empty canvas
    'emptyState.message': 'Nothing on the canvas yet',

    // Pivots
    'pivot.save.promptTitle': 'Save',
    'pivot.save.promptSubmit': 'Save',

    // Prompt modal
    'prompt.title': 'Details',
    'prompt.submit': 'Add',
    'prompt.cancel': 'Cancel',
    'prompt.nodeTitle': 'Node details',
    'prompt.edgeTitle': 'Edge details',
    'prompt.edgeLabelTitle': 'Edge label',
    'prompt.edgeLabelPlaceholder': 'Label…',

    // Simplify: one part of a group, "12 × ip"
    'simplify.typeLabel': '{count} × {type}',
    'simplify.untyped': 'node',

    // Top bar
    'topBar.promptSubmit': 'OK',
} satisfies Record<string, MessageValue>
