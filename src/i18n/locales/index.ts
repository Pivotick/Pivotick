import { messagesEn } from '../en'
import { messagesAr } from './ar'
import { messagesDe } from './de'
import { messagesEs } from './es'
import { messagesFr } from './fr'
import { messagesJa } from './ja'
import { messagesNl } from './nl'
import { messagesPt } from './pt'
import { messagesZh } from './zh'
import type { Messages } from '../../interfaces/I18n'

/** Complete catalogues shipped with Pivotick. Chinese uses Simplified characters. */
export const bundledMessages: Record<'en' | 'ar' | 'de' | 'es' | 'fr' | 'ja' | 'nl' | 'pt' | 'zh', Messages> = {
    en: messagesEn,
    ar: messagesAr,
    de: messagesDe,
    es: messagesEs,
    fr: messagesFr,
    ja: messagesJa,
    nl: messagesNl,
    pt: messagesPt,
    zh: messagesZh,
}

export { messagesAr, messagesDe, messagesEs, messagesFr, messagesJa, messagesNl, messagesPt, messagesZh }
