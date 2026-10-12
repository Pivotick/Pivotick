import type { messagesEn } from '../i18n/en'
import type { I18n } from '../i18n/I18n'

/**
 * A message that depends on a count, one entry per CLDR plural category the language
 * uses. The form is picked by `Intl.PluralRules` from the `count` param; `other` is
 * required because every language has it.
 *
 * @example
 * { one: 'Hid {count} node', other: 'Hid {count} nodes' }
 * // Polish needs three forms
 * { one: 'Ukryto {count} węzeł', few: 'Ukryto {count} węzły', many: 'Ukryto {count} węzłów', other: 'Ukryto {count} węzła' }
 *
 * @category I18n
 */
export interface PluralForms {
    zero?: string
    one?: string
    two?: string
    few?: string
    many?: string
    other: string
}

/**
 * The values a message's `{placeholders}` are filled with. A number is formatted for
 * the locale before it is substituted; pass a string to keep it as written.
 *
 * @category I18n
 */
export type MessageParams = Record<string, string | number>

/**
 * One message: plain text with `{name}` placeholders, plural forms, or a function for
 * anything the other two cannot say. A function gets the raw params and the graph's
 * {@link I18n}, to format numbers itself. Messages are text, never HTML.
 *
 * @category I18n
 */
export type MessageValue = string | PluralForms | ((params: MessageParams, i18n: I18n) => string)

/**
 * The id of a message the library writes, such as `'emptyState.message'`.
 *
 * @category I18n
 */
export type MessageKey = keyof typeof messagesEn

/**
 * Every message the library writes, by key. `messagesEn` is the English catalogue
 * and the starting point for a translation.
 *
 * @category I18n
 */
export type Messages = Record<MessageKey, MessageValue>

/**
 * The language the library's own text is written in. Text the host passes in (labels,
 * facets, pivots, menu rows) is drawn as given and never looked up.
 *
 * A string is looked up in this order: the feature's own option when it has one (such
 * as `UI.emptyState.render`), then `messages`, then `translate`, then English.
 *
 * @category I18n
 */
export interface I18nOptions {
    /**
     * A BCP 47 tag such as `'fr'` or `'de-CH'`. It picks the plural rules, how numbers
     * are written and how lists sort. When given, it is also set as the `lang` of the
     * graph's root element.
     * @default 'en'
     */
    locale?: string
    /**
     * Messages that replace the built-in English, by key. A key left out stays English,
     * so a partial catalogue is fine.
     */
    messages?: Partial<Messages>
    /**
     * A bridge to the host's own translation library, asked for every key `messages`
     * does not have. It gets the raw params, so the host's plural rules apply, and the
     * English text. Returning `undefined` keeps the English.
     *
     * @example
     * translate: (key, params, fallback) => i18next.t(`pivotick.${key}`, { ...params, defaultValue: fallback })
     */
    translate?: (key: MessageKey, params: MessageParams, fallback: string) => string | undefined
}
