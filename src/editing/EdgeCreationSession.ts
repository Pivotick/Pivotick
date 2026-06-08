import type { Graph } from '../Graph'
import { Node } from '../Node'
import { Note } from '../Note'
import { GraphConnectManager } from './GraphConnectManager'


type InteractionState =
    | 'idle'
    | 'click-connect'
    | 'pending-drag'
    | 'dragging'

type Connectable = Node | Note

export class EdgeCreationSession {

    private graph: Graph
    private connectManager: GraphConnectManager

    private canvas: HTMLDivElement

    private sourceElement: Connectable | null = null
    private hoveredNode: Node | null = null
    private pointerPosition: { x: number, y: number } | null = null

    private dragStartPosition: { x: number, y: number } | null = null

    private state: InteractionState = 'idle'

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

        if (this.sourceElement && this.sourceElement instanceof Node) {
            this.graph.unHighlightElement?.(this.sourceElement)
        }

        this.sourceElement = null
        this.hoveredNode = null
        this.pointerPosition = null
        this.dragStartPosition = null
        this.state = 'idle'

        this.canvas.classList.remove('pvt-connect-mode-active', 'select-first', 'pick-second')

        this.canvas.removeEventListener('pointermove', this.handlePointerMove)
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu)
        this.canvas.removeEventListener('pointerup', this.handlePointerUp)

        this.graph.renderer.hideShadowEdge()
    }

    public handleNodeClick(node: Node): boolean {

        if (!this.sourceElement) {

            this.sourceElement = node as Node
            this.graph.highlightElement(node)
            this.canvas.classList.remove('select-first')
            this.canvas.classList.add('pick-second')

            this.state = 'click-connect'

            this.beginPreview()

            return true
        }

        if (
            this.sourceElement instanceof Node &&
            this.sourceElement.id === node.id
        ) {
            
            this.connectManager.finishInteraction()
            
            return true
        }
        
        
        if (this.sourceElement instanceof Node) {
            this.connectManager.createEdge(this.sourceElement, node)
        }

        if (this.sourceElement instanceof Note) {
            
            this.connectManager.createNoteLink(this.sourceElement, node)
        }

        this.connectManager.finishInteraction()

        return true
    }

    public handleNoteClick(note: Note): boolean {

        if (!this.sourceElement) {

            this.sourceElement = note

            this.canvas.classList.remove('select-first')
            this.canvas.classList.add('pick-second')

            this.beginPreview()

            return true
        }

        return false
    }

    private beginPreview(): void {

        this.canvas.addEventListener('pointermove', this.handlePointerMove)
    }

    private handlePointerMove = (event: PointerEvent): void => {

        if (this.dragStartPosition) {

            const dx = event.clientX - this.dragStartPosition.x
            const dy = event.clientY - this.dragStartPosition.y

            if (
                this.state === 'pending-drag' &&
                Math.hypot(dx, dy) > EdgeCreationSession.DRAG_THRESHOLD
            ) {

                this.state = 'dragging'

                if (this.sourceElement instanceof Node) {
                    this.graph.highlightElement(this.sourceElement)
                }

                this.canvas.classList.remove('select-first')
                this.canvas.classList.add('pick-second')
            }
        }

        if (
            this.state !== 'dragging' &&
            this.state !== 'click-connect'
        ) {
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

        if (!this.sourceElement || !this.pointerPosition) return

        this.graph.renderer.showShadowEdge({
            source: this.sourceElement,
            targetNode: this.hoveredNode ?? undefined,
            targetPosition: this.hoveredNode ? undefined : this.pointerPosition
        })
    }

    private handleContextMenu = (event: MouseEvent): void => {

        event.preventDefault()
        event.stopPropagation()

        if (this.sourceElement) {

            if (this.sourceElement instanceof Node) {
                this.graph.unHighlightElement?.(this.sourceElement)
            }

            this.sourceElement = null
            this.hoveredNode = null

            this.canvas.classList.remove('pick-second')
            this.canvas.classList.add('select-first')

            this.graph.renderer.hideShadowEdge()

            return
        }

        this.connectManager.finishInteraction()
    }

    public beginDragConnection(source: Connectable, event: PointerEvent): void {

        // Don't interrupt existing click-connect flow
        if (this.state === 'dragging' || this.state === 'click-connect') {
            return
        }

        this.state = 'pending-drag'
        this.sourceElement = source

        this.dragStartPosition = {
            x: event.clientX,
            y: event.clientY
        }

        this.beginPreview()

        this.canvas.addEventListener('pointerup', this.handlePointerUp)
    }

    private handlePointerUp = (): void => {

        if (this.state !== 'dragging') {

            this.canvas.removeEventListener('pointerup', this.handlePointerUp)
            
            if (this.state === 'pending-drag') {
                this.sourceElement = null
            }

            this.state = 'idle'
            this.dragStartPosition = null

            return
        }

        const target = this.graph.renderer.getNodeClosestToCursor(30)

        if (target && this.sourceElement) {

            if (this.sourceElement instanceof Node) {
                if (this.sourceElement.id !== target.id) {
                    this.connectManager.createEdge(this.sourceElement, target)
                }
            }

            if (this.sourceElement instanceof Note) {

                this.connectManager.createNoteLink(this.sourceElement, target)
            }
            this.connectManager.restart()
            return
        }

        this.connectManager.finishInteraction()
    }
}
