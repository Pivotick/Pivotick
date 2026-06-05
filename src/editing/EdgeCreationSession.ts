import type { Graph } from '../Graph'
import { Node } from '../Node'
import { GraphConnectManager } from './GraphConnectManager'

export class EdgeCreationSession {

    private graph: Graph
    private connectManager: GraphConnectManager

    private canvas: HTMLDivElement

    private sourceNode: Node | null = null
    private hoveredNode: Node | null = null
    private pointerPosition: { x: number, y: number } | null = null

    public constructor(graph: Graph, connectManager: GraphConnectManager) {

        this.graph = graph
        this.connectManager = connectManager
        this.canvas = this.graph.UIManager.layout!.canvas!
    }

    public start(): void {
        this.canvas.classList.add('pvt-connect-mode-active', 'select-first')
        this.canvas.addEventListener('contextmenu', this.handleContextMenu)
    }

    public cancel(): void {

        if (this.sourceNode) {
            this.graph.unHighlightElement?.(this.sourceNode)
        }

        this.sourceNode = null
        this.canvas.classList.remove('pvt-connect-mode-active', 'select-first', 'pick-second')

        this.canvas.removeEventListener('pointermove', this.handlePointerMove)
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu)
        this.graph.renderer.hideShadowEdge()
    }

    public handleNodeClick(node: Node): boolean {

        if (!this.sourceNode) {

            this.sourceNode = node
            this.graph.highlightElement(node)
            this.canvas.classList.remove('select-first')
            this.canvas.classList.add('pick-second')

            this.beginPreview()

            return true
        }

        if (this.sourceNode.id === node.id) {

            this.connectManager.cancel()

            return true
        }

        this.connectManager.createEdge(this.sourceNode, node)
        this.connectManager.cancel()

        return true
    }

    private beginPreview(): void {

        this.canvas.addEventListener('pointermove', this.handlePointerMove)
    }

    private handlePointerMove = (event: PointerEvent): void => {

        const pos = this.graph.renderer.screenToGraphCoordinates(
            event.clientX,
            event.clientY
        )
        this.pointerPosition = pos

        const hovered = this.graph.renderer.getNodeClosestToCursor(30)
        this.hoveredNode = hovered

        this.updateShadowEdge()
    }

    private updateShadowEdge(): void {

        if (!this.sourceNode || !this.pointerPosition) return

        this.graph.renderer.showShadowEdge({
            source: this.sourceNode,
            targetNode: this.hoveredNode ?? undefined,
            targetPosition: this.hoveredNode ? undefined : this.pointerPosition
        })
    }

    private handleContextMenu = (event: MouseEvent): void => {

        event.preventDefault()
        event.stopPropagation()

        if (this.sourceNode) {

            this.graph.unHighlightElement?.(this.sourceNode)

            this.sourceNode = null
            this.hoveredNode = null

            this.canvas.classList.remove('pick-second')
            this.canvas.classList.add('select-first')

            this.graph.renderer.hideShadowEdge()

            return
        }

        this.connectManager.cancel()
    }
}
