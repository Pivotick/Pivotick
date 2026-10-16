import { messagesEn } from '../en'
import { messagesDe } from './de'
import { messagesFr } from './fr'
import { messagesPt } from './pt'
import { messagesZh } from './zh'
import type { Messages } from '../../interfaces/I18n'

/** Complete catalogues shipped with Pivotick. Chinese uses Simplified characters. */
export const bundledMessages: Record<'en' | 'de' | 'fr' | 'pt' | 'zh', Messages> = {
    en: messagesEn,
    de: messagesDe,
    fr: messagesFr,
    pt: messagesPt,
    zh: messagesZh,
}

export { messagesDe, messagesFr, messagesPt, messagesZh }
