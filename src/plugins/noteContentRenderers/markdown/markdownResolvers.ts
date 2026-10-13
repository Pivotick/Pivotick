import type { Graph } from '../../../Graph'
import type { Node } from '../../../Node'
import { nodeNameGetter, resolveNodeByName } from '../../../utils/GraphGetters'
import { applyNodeReferenceColor } from '../../../utils/NoteReferenceStyle'

export function resolveReferences(container: HTMLElement, graph: Graph): void {

    const refs = container.querySelectorAll<HTMLElement>('.pvt-node-reference')

    refs.forEach(ref => {

            const nodeName = ref.dataset.nodeName
            if (!nodeName) return

            const node: Node | undefined = resolveNodeByName(nodeName, graph.getMutableNodes(), graph.UIManager.getOptions().mainHeader, graph.i18n)
            if (!node) {
                ref.classList.add('unresolved')
                ref.title = graph.i18n.t('noteCard.reference.unresolved.title')
                return
            }

            const mainLabel = nodeNameGetter(node, graph.UIManager.getOptions().mainHeader, graph.i18n).trim()
            ref.textContent = mainLabel
            ref.dataset.nodeId = node.id
            ref.classList.add('resolved')

            const color = graph.renderer.getNodeStyle(node).color as string
            applyNodeReferenceColor(ref, color)
        })
}