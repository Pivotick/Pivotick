import type { MessageValue } from '../../interfaces/I18n'
import { commonMessages } from './common'
import { contextMenuMessages } from './contextMenu'
import { coreMessages } from './core'
import { panelsMessages } from './panels'
import { pivotMessages } from './pivot'
import { shellMessages } from './shell'
import { sidebarMessages } from './sidebar'
import { tableMessages } from './table'

/**
 * The library's English text, by key. A translation is a copy of this object with the
 * values replaced, passed as `i18n.messages`.
 *
 * @category I18n
 */
export const messagesEn = {
    ...commonMessages,
    ...shellMessages,
    ...contextMenuMessages,
    ...sidebarMessages,
    ...tableMessages,
    ...panelsMessages,
    ...pivotMessages,
    ...coreMessages,
} satisfies Record<string, MessageValue>
