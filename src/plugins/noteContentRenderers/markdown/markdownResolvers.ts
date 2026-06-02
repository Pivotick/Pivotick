import type { Graph } from '../../../Graph'
import type { Node } from '../../../Node'
import { nodeNameGetter } from '../../../utils/GraphGetters'

export function resolveReferences(container: HTMLElement, graph: Graph): void {

    const refs = container.querySelectorAll<HTMLElement>('.pvt-node-reference')

    refs.forEach(ref => {

            const nodeName = ref.dataset.nodeName
            if (!nodeName) return

            const normalizedSearch = nodeName.trim().toLowerCase()
            const node: Node | undefined = graph.getNodes().find(n => {

                // Match by ID
                if (n.id.toLowerCase() === normalizedSearch) {
                    return true
                }

                // Match by main label
                const mainLabel = nodeNameGetter(n, graph.UIManager.getOptions().mainHeader)

                return (
                    typeof mainLabel === 'string'
                    && mainLabel.trim().toLowerCase() === normalizedSearch
                )
            })

            if (!node) {
                ref.classList.add('unresolved')
                ref.title = 'Could not resolve node'
                return
            }

            const mainLabel = nodeNameGetter(node, graph.UIManager.getOptions().mainHeader).trim()
            ref.textContent = mainLabel
            ref.dataset.nodeId = node.id
            ref.classList.add('resolved')
        })
}