import { SearchBox } from '../elements/Mainheader/SearchBox'
import type { UIManager } from '../UIManager'
import { Node } from '../../Node'

export function pickNode(uiManager: UIManager, title?: string): Promise<Node | null> {

    return new Promise(resolve => {

        const modal = uiManager.createModal({
            body: '',
            buttons: null,
            position: 'top',
            size: 'xl',
            noBodyPadding: true,
        })

        if (!modal) {
            resolve(null)
            return
        }

        modal.modal?.addEventListener('pvt-modal-show', () => {

            const searchBox = new SearchBox(uiManager, title)

            modal.setBody(searchBox.build())

            searchBox.searchInput?.focus()

            searchBox.searchBox?.addEventListener(
                'pvt-searchbox-select',
                (evt: Event) => {

                    const custom = evt as CustomEvent<Node>

                    resolve(custom.detail)

                    modal.destroy()
                }
            )

            searchBox.searchBox?.addEventListener(
                'pvt-searchbox-close',
                () => {
                    resolve(null)
                    modal.destroy()
                }
            )
        })

        modal.modal?.addEventListener(
            'pvt-modal-hidden',
            () => {
                resolve(null)
            }
        )
    })
}