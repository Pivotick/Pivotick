import type { I18nOptions, MessageKey, MessageParams, MessageValue, PluralForms } from '../interfaces/I18n'
import { messagesEn } from './en'
import { bundledMessages } from './locales'

const ENGLISH = 'en'
const PLACEHOLDER = /\{(\w+)\}/g

/**
 * The language one graph writes its own text in: message lookup and plurals, and the
 * number, list and sort formats that go with them. Each graph has its own, read from
 * `GraphOptions.i18n`; a nested graph shares its parent's.
 *
 * @category I18n
 */
export class I18n {
    /** The BCP 47 tag in use: the host's, or `'en'`. */
    public readonly locale: string
    /** @private The root's `lang`: only set when the host declared a valid locale. */
    public readonly lang: string | undefined

    private readonly messages: Partial<Record<MessageKey, MessageValue>>
    private readonly bundled: Partial<Record<MessageKey, MessageValue>>
    private readonly translateHook?: I18nOptions['translate']
    private readonly pluralRules = new Map<string, Intl.PluralRules>()
    private readonly numberFormats = new Map<string, Intl.NumberFormat>()
    private readonly collators = new Map<string, Intl.Collator>()

    constructor(options: I18nOptions = {}) {
        this.lang = canonicalLocale(options.locale)
        this.locale = this.lang ?? ENGLISH
        this.messages = options.messages ?? {}
        this.translateHook = options.translate
        const language = this.locale.split('-')[0] as keyof typeof bundledMessages
        this.bundled = Object.prototype.hasOwnProperty.call(bundledMessages, language)
            ? bundledMessages[language] : {}
    }

    /**
     * The text of `key` with its `{placeholders}` filled from `params`. A plural message
     * picks its form from `params.count`.
     */
    public t(key: MessageKey, params: MessageParams = {}): string {
        const own = this.messages[key]
        if (own !== undefined) return this.render(own, params, this.locale)

        // English text keeps English plural rules: French would say "0 node".
        const english = this.render(messagesEn[key] ?? key, params, ENGLISH)
        if (this.translateHook) {
            try {
                const translated = this.translateHook(key, params, english)
                if (typeof translated === 'string') return translated
            } catch (error) {
                console.warn(`[pivotick] i18n.translate threw for "${key}"; using the built-in catalogue.`, error)
            }
        }
        const bundled = this.bundled[key]
        if (bundled !== undefined) return this.render(bundled, params, this.locale)
        return english
    }

    /** A number written the way the locale writes it: `1,234` in English, `1.234` in German. */
    public formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
        const id = options ? JSON.stringify(options) : ''
        let format = this.numberFormats.get(id)
        if (!format) {
            format = new Intl.NumberFormat(this.locale, options)
            this.numberFormats.set(id, format)
        }
        return format.format(value)
    }

    /** Items joined as a sentence: "a, b and c" in English, "a, b et c" in French. */
    public formatList(items: string[], options?: Intl.ListFormatOptions): string {
        if (typeof Intl.ListFormat !== 'function') return items.join(', ')
        return new Intl.ListFormat(this.locale, options).format(items)
    }

    /** A collator for the locale, so "Émile" sorts beside "Emma" and "item 10" after "item 9". */
    public collator(options: Intl.CollatorOptions = { numeric: true }): Intl.Collator {
        const id = JSON.stringify(options)
        let collator = this.collators.get(id)
        if (!collator) {
            collator = new Intl.Collator(this.locale, options)
            this.collators.set(id, collator)
        }
        return collator
    }

    /** Compares two strings for a sort in the locale's order; safe to pass to `sort` as is. */
    public readonly compare = (a: string, b: string): number => this.collator().compare(a, b)

    private render(value: MessageValue, params: MessageParams, pluralLocale: string): string {
        if (typeof value === 'function') return value(params, this)
        const text = typeof value === 'string' ? value : this.pluralForm(value, params.count, pluralLocale)
        return text.replace(PLACEHOLDER, (placeholder, name: string) => {
            const param = params[name]
            if (param === undefined) return placeholder
            return typeof param === 'number' ? this.formatNumber(param) : param
        })
    }

    private pluralForm(forms: PluralForms, count: string | number | undefined, locale: string): string {
        if (typeof count !== 'number') return forms.other
        let rules = this.pluralRules.get(locale)
        if (!rules) {
            rules = new Intl.PluralRules(locale)
            this.pluralRules.set(locale, rules)
        }
        return forms[rules.select(count)] ?? forms.other
    }
}

function canonicalLocale(locale: string | undefined): string | undefined {
    if (!locale) return undefined
    try {
        return Intl.getCanonicalLocales(locale)[0]
    } catch {
        console.warn(`[pivotick] i18n.locale "${locale}" is not a language tag; using "${ENGLISH}".`)
        return undefined
    }
}
