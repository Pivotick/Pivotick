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

    private isDraggingConnection = false
    private dragStartPosition: { x: number, y: number } | null = null
    private didMove = false

    private pendingDragNode: Node | null = null

    private static readonly DRAG_THRESHOLD = 4

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
        this.hoveredNode = null
        this.pointerPosition = null
        this.pendingDragNode = null
        this.dragStartPosition = null
        this.didMove = false

        this.canvas.classList.remove('pvt-connect-mode-active', 'select-first', 'pick-second')

        this.canvas.removeEventListener('pointermove', this.handlePointerMove)
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu)
        window.removeEventListener('pointerup', this.handlePointerUp)

        this.isDraggingConnection = false
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

            this.connectManager.finishInteraction()

            return true
        }

        this.connectManager.createEdge(this.sourceNode, node)
        this.connectManager.finishInteraction()

        return true
    }

    private beginPreview(): void {

        this.canvas.addEventListener('pointermove', this.handlePointerMove)
    }

    private handlePointerMove = (event: PointerEvent): void => {

        if (
            this.dragStartPosition &&
            !this.didMove
        ) {

            const dx = event.clientX - this.dragStartPosition.x
            const dy = event.clientY - this.dragStartPosition.y

            if (
                Math.hypot(dx, dy) >
                EdgeCreationSession.DRAG_THRESHOLD
            ) {

                this.didMove = true
                this.isDraggingConnection = true

                // Begin connection drag
                this.sourceNode = this.pendingDragNode

                if (this.sourceNode) {
                    this.graph.highlightElement(this.sourceNode)
                }

                this.canvas.classList.remove('select-first')
                this.canvas.classList.add('pick-second')
            }
        }

        // Ignore tiny movements
        if (!this.isDraggingConnection) {
            return
        }

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

        this.connectManager.finishInteraction()
    }

    public beginDragConnection(node: Node, event: PointerEvent): void {

        // Don't interrupt existing click-connect flow
        if (this.isDraggingConnection) {
            return
        }

        this.pendingDragNode = node

        this.dragStartPosition = {
            x: event.clientX,
            y: event.clientY
        }

        this.didMove = false

        this.beginPreview()

        window.addEventListener('pointerup', this.handlePointerUp)
    }

    private handlePointerUp = (): void => {

        if (!this.isDraggingConnection) {
            return
        }

        // If user didn't actually drag, let normal click behavior happen.
        if (!this.didMove) {

            window.removeEventListener('pointerup', this.handlePointerUp)

            this.isDraggingConnection = false
            this.dragStartPosition = null
            this.pendingDragNode = null

            return
        }

        const target = this.graph.renderer.getNodeClosestToCursor(30)

        if (
            target &&
            this.sourceNode &&
            target.id !== this.sourceNode.id
        ) {
            this.connectManager.createEdge(this.sourceNode, target)
            this.connectManager.restart()
        } {
            this.connectManager.finishInteraction()
        }
    }
}
