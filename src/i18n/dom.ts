import type { MessageKey } from '../interfaces/I18n'
import type { I18n } from './I18n'

type MarkedAttribute = 'title' | 'aria-label' | 'placeholder'

const TEXT_MARK = 'data-pvt-i18n'
const ATTRIBUTES: MarkedAttribute[] = ['title', 'aria-label', 'placeholder']

/** Marks a template element to receive a message as its text: `<span ${i18nText('search.hint.close')}></span>`. */
export function i18nText(key: MessageKey): string {
    return `${TEXT_MARK}="${key}"`
}

/** Marks a template element to receive a message as an attribute: `<input ${i18nAttr('placeholder', 'search.placeholder')}>`. */
export function i18nAttr(attribute: MarkedAttribute, key: MessageKey): string {
    return `${TEXT_MARK}-${attribute}="${key}"`
}

/**
 * Fill every element under `root` (and `root` itself) that a template marked with
 * {@link i18nText} or {@link i18nAttr}, as text, never as markup. The marks are removed,
 * so the result is the markup the template would have held with the words written in.
 */
export function applyMessages(root: Element | DocumentFragment, i18n: I18n): void {
    const marked = (name: string): Element[] => {
        const found = [...root.querySelectorAll(`[${name}]`)]
        return root instanceof Element && root.hasAttribute(name) ? [root, ...found] : found
    }
    for (const element of marked(TEXT_MARK)) {
        element.textContent = i18n.t(element.getAttribute(TEXT_MARK) as MessageKey)
        element.removeAttribute(TEXT_MARK)
    }
    for (const attribute of ATTRIBUTES) {
        const name = `${TEXT_MARK}-${attribute}`
        for (const element of marked(name)) {
            element.setAttribute(attribute, i18n.t(element.getAttribute(name) as MessageKey))
            element.removeAttribute(name)
        }
    }
}
