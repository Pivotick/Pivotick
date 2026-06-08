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
        this.canvas.classList.add('pvt-connect-mode-active')
        this.updateCanvasState()

        this.canvas.addEventListener('contextmenu', this.handleContextMenu)
        this.canvas.addEventListener('pointermove', this.handlePointerMove)
        this.canvas.addEventListener('pointerup', this.handlePointerUp)
    }

    public cancel(): void {

        this.clearSource()

        this.hoveredNode = null
        this.pointerPosition = null
        this.dragStartPosition = null
        this.state = 'idle'

        this.updateCanvasState()

        this.canvas.classList.remove('pvt-connect-mode-active', 'select-first', 'pick-second')

        this.canvas.removeEventListener('pointermove', this.handlePointerMove)
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu)
        this.canvas.removeEventListener('pointerup', this.handlePointerUp)

        this.graph.renderer.hideShadowEdge()
    }

    public handleNodeClick(node: Node): boolean {

        if (!this.sourceElement) {

            this.sourceElement = node
            this.graph.highlightElement(node)

            this.state = 'click-connect'
            this.updateCanvasState()

            return true
        }

        if (this.sourceElement === node) {
            
            this.connectManager.finishInteraction()
            
            return true
        }

        this.createConnection(this.sourceElement, node)

        this.connectManager.finishInteraction()

        return true
    }

    public handleNoteClick(note: Note): boolean {

        if (!this.sourceElement) {

            this.sourceElement = note

            this.updateCanvasState()

            return true
        }

        return false
    }

    private handlePointerMove = (event: PointerEvent): void => {

        this.updateDragState(event)

        if (
            this.state !== 'dragging' &&
            this.state !== 'click-connect'
        ) {
            return
        }

        this.updatePointerPosition(event)

        this.updateHoveredNode()

        this.updateShadowEdge()
    }


    private updateDragState(event: PointerEvent): void {

        if (!this.dragStartPosition) {
            return
        }

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

            this.updateCanvasState()
        }
    }

    private updatePointerPosition(event: PointerEvent): void {

        this.pointerPosition = this.graph.renderer.screenToGraphCoordinates(
            event.clientX,
            event.clientY
        )
    }

    private updateHoveredNode(): void {

        this.hoveredNode =
            this.graph.renderer.getNodeClosestToCursor(30)
    }

    private updateShadowEdge(): void {

        if (!this.sourceElement || !this.pointerPosition) return

        this.graph.renderer.showShadowEdge({
            source: this.sourceElement,
            targetNode: this.hoveredNode ?? undefined,
            targetPosition: this.hoveredNode ? undefined : this.pointerPosition
        })
    }

    private createConnection(source: Connectable, target: Node): void {

        if (source instanceof Node) {
            this.connectManager.createEdge(source, target)
            return
        }

        if (source instanceof Note) {
            this.connectManager.createNoteLink(source, target)
            return
        }

    }

    private handleContextMenu = (event: MouseEvent): void => {

        event.preventDefault()
        event.stopPropagation()

        if (this.sourceElement) {

            this.clearSource()

            this.hoveredNode = null

            this.updateCanvasState()

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

    }

    private handlePointerUp = (): void => {

        if (this.state === 'pending-drag') {

            this.clearSource()

            this.state = 'idle'
            this.dragStartPosition = null

            return
        }

        if (this.state !== 'dragging') {
            return
        }

        const target = this.graph.renderer.getNodeClosestToCursor(30)

        if (target && this.sourceElement) {


            if (this.sourceElement === target) {
                return
            }

            this.createConnection(this.sourceElement, target)

            this.connectManager.restart()
            return
        }

        this.connectManager.finishInteraction()
    }

    private clearSource(): void {

        if (this.sourceElement instanceof Node) {
            this.graph.unHighlightElement?.(this.sourceElement)
        }

        this.sourceElement = null
    }

    private updateCanvasState(): void {

        this.canvas.classList.remove('select-first', 'pick-second')

        if (this.state === 'idle') {
            this.canvas.classList.add('select-first')
            return
        }

        this.canvas.classList.add('pick-second')
    }
}
