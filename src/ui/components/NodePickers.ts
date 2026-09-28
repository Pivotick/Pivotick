import { SearchBox } from '../elements/Mainheader/SearchBox'
import type { UIManager } from '../UIManager'
import { Node } from '../../Node'

/** What a search ended on: one node picked, or every match to show on the canvas. */
export type SearchOutcome =
    | { kind: 'pick', node: Node }
    | { kind: 'showAll', nodes: Node[], query: string }

export function pickNode(uiManager: UIManager, title?: string | HTMLElement): Promise<Node | null> {
    return openSearch(uiManager, title, false).then(outcome => outcome?.kind === 'pick' ? outcome.node : null)
}

/** The header's search: pick one node, or show every match on the canvas. */
export function searchGraph(uiManager: UIManager): Promise<SearchOutcome | null> {
    return openSearch(uiManager, undefined, true)
}

function openSearch(uiManager: UIManager, title: string | HTMLElement | undefined, showAll: boolean): Promise<SearchOutcome | null> {

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

            const searchBox = new SearchBox(uiManager, title, { showAll })

            modal.setBody(searchBox.build())

            searchBox.searchInput?.focus()

            searchBox.searchBox?.addEventListener(
                'pvt-searchbox-select',
                (evt: Event) => {

                    const custom = evt as CustomEvent<Node>

                    resolve({ kind: 'pick', node: custom.detail })

                    modal.destroy()
                }
            )

            searchBox.searchBox?.addEventListener(
                'pvt-searchbox-showall',
                (evt: Event) => {
                    const { nodes, query } = (evt as CustomEvent<{ nodes: Node[], query: string }>).detail
                    resolve({ kind: 'showAll', nodes, query })
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
