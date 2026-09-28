import type { Node } from '../Node'
import type { UIManager } from './UIManager'

/**
 * A search's matches lit on the canvas: each match, or the group or closed cluster that
 * draws it, stays as it is while everything else fades, and a group holding matches draws
 * their share over its ring. Ends on Escape, a click on empty canvas, or the next search.
 */
export class SearchHighlight {
    private readonly uiManager: UIManager
    private lit?: { nodes: Node[], query: string }
    private disposers: Array<() => void> = []

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    get active(): boolean {
        return this.lit !== undefined
    }

    show(nodes: Node[], query: string): void {
        this.clear()
        if (nodes.length === 0) return
        this.lit = { nodes, query }
        const graph = this.uiManager.graph
        const interaction = graph.renderer.getGraphInteraction()
        const end = () => this.clear()
        interaction.on('canvasClick', end)
        this.disposers.push(() => interaction.off('canvasClick', end))
        this.disposers.push(this.uiManager.keyManager.register({ key: 'Escape', callback: end, shadows: true }))
        // The search dialog gives focus back to the page, where Escape would not reach the graph.
        this.uiManager.focus()
        // A group opening or closing changes which dots stand for the matches; the redraw
        // it is part of comes first.
        this.disposers.push(graph.simplify.onChange(() => queueMicrotask(() => this.apply())))
        this.apply()
    }

    clear(): void {
        if (!this.lit) return
        this.lit = undefined
        for (const dispose of this.disposers.splice(0)) dispose()
        const graph = this.uiManager.graph
        graph.clearEmphasis()
        graph.simplify.setMatches([])
    }

    private apply(): void {
        if (!this.lit) return
        const graph = this.uiManager.graph
        const drawn = new Set<Node>()
        for (const node of this.lit.nodes) {
            const current = graph.getMutableNode(node.id)
            if (current) drawn.add(current.canvasRepresentative())
        }
        graph.simplify.setMatches(this.lit.nodes, this.lit.query)
        graph.emphasiseElements([...drawn])
    }
}
