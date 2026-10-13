/**
 * The pseudo-locale: the English catalogue with every letter swapped for an accented
 * look-alike, padded about 35% (German runs about 30% longer than English) and wrapped
 * in markers: 'Pin Node' becomes '⟦Ƥîñ Ñöðé ···⟧'.
 *
 * No ASCII letter survives the swap, so any ASCII letter on screen outside the markers
 * is text that never went through the catalogue. Placeholders are kept, so a host
 * label filled into a message lands inside its markers.
 */
import { messagesEn } from '../../../src/i18n/en'
import type { MessageKey, MessageValue, Messages, PluralForms } from '../../../src/interfaces/I18n'

export const PSEUDO_OPEN = '⟦'
export const PSEUDO_CLOSE = '⟧'

const LOWER = 'áƀçðéƒĝĥîĵķļɱñöþǫŕšţûṽŵẋýž'
const UPPER = 'ÅƁÇÐÉƑĜĤÎĴĶĻṀÑÖƤǪŔŠŢÛṼŴẊÝŽ'
const PLACEHOLDER = /(\{\w+\})/

function accent(text: string): string {
    return text.replace(/[A-Za-z]/g, (letter) => {
        const code = letter.charCodeAt(0)
        return code >= 97 ? LOWER[code - 97] : UPPER[code - 65]
    })
}

/** One English string in the pseudo-locale. */
export function pseudo(english: string): string {
    const body = english.split(PLACEHOLDER).map((part) => PLACEHOLDER.test(part) ? part : accent(part)).join('')
    const padding = '·'.repeat(Math.max(1, Math.round(english.length * 0.35) - 1))
    return `${PSEUDO_OPEN}${body} ${padding}${PSEUDO_CLOSE}`
}

function pseudoValue(value: MessageValue): MessageValue {
    if (typeof value === 'string') return pseudo(value)
    if (typeof value === 'function') return (params, i18n) => pseudo(value(params, i18n))
    const forms: PluralForms = { other: pseudo(value.other) }
    for (const form of ['zero', 'one', 'two', 'few', 'many'] as const) {
        const text = value[form]
        if (text !== undefined) forms[form] = pseudo(text)
    }
    return forms
}

/** The whole catalogue in the pseudo-locale, for `i18n.messages`. */
export function pseudoMessages(): Messages {
    const messages = {} as Record<MessageKey, MessageValue>
    for (const key of Object.keys(messagesEn) as MessageKey[]) messages[key] = pseudoValue(messagesEn[key])
    return messages
}
