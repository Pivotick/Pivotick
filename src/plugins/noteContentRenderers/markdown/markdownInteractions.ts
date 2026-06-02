import type { Graph } from '../../../Graph'

export function bindInteractions(container: HTMLElement, graph: Graph): void {
    container.addEventListener('click', evt => {
        const target = evt.target as HTMLElement

        const ref: HTMLElement | null = target.closest('.pvt-node-reference.resolved')
        if (!ref) return
        
        const nodeId = ref.dataset.nodeId
        if (!nodeId) return

        const node = graph.getMutableNode(nodeId)
        if (!node) return

        graph.selectElement(node)
    })
}