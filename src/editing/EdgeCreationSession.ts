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

export type ConnectionMode = 'node-edge' | 'note-link'

export class EdgeCreationSession {

    private graph: Graph
    private connectManager: GraphConnectManager

    private canvas: HTMLDivElement

    private activateImmediately: boolean

    private mode: ConnectionMode
    private sourceElement: Connectable | null = null
    private hoveredNode: Node | null = null
    private pointerPosition: { x: number, y: number } | null = null

    private dragStartPosition: { x: number, y: number } | null = null

    private state: InteractionState = 'idle'

    private static readonly DRAG_THRESHOLD = 4

    public constructor(
        graph: Graph,
        connectManager: GraphConnectManager,
        mode: ConnectionMode,
        activateImmediately = true
    ) {

        this.graph = graph
        this.connectManager = connectManager
        this.canvas = this.graph.UIManager.layout!.canvas!
        this.mode = mode
        this.activateImmediately = activateImmediately
    }

    public start(): void {
        if (this.activateImmediately) {
            this.activateInteractionUI()
        }

        window.addEventListener('contextmenu', this.handleContextMenu)
        window.addEventListener('pointermove', this.handlePointerMove)
        window.addEventListener('pointerup', this.handlePointerUp)
    }

    private activateInteractionUI(): void {

        this.canvas.classList.add('pvt-connect-mode-active')

        this.updateCanvasState()
    }

    private deactivateInteractionUI(): void {

        this.canvas.classList.remove('pvt-connect-mode-active', 'select-first', 'pick-second')
    }

    public cancel(): void {

        this.clearSource()

        this.hoveredNode = null
        this.pointerPosition = null
        this.dragStartPosition = null
        this.state = 'idle'

        this.updateCanvasState()

        this.deactivateInteractionUI()

        window.removeEventListener('pointermove', this.handlePointerMove)
        window.removeEventListener('contextmenu', this.handleContextMenu)
        window.removeEventListener('pointerup', this.handlePointerUp)

        this.graph.renderer.hideShadowEdge()
    }

    public selectOrConnectNode(node: Node): boolean {

        if (this.state === 'idle') {

            this.sourceElement = node
            this.graph.highlightElement(node)

            this.state = 'click-connect'
            this.activateInteractionUI()

            return true
        }

        if (this.sourceElement === node) {
            
            this.connectManager.finishInteraction()
            
            return true
        }

        if (this.sourceElement) {
            this.createConnection(this.sourceElement, node)
        }

        this.connectManager.finishInteraction(true)

        return true
    }

    public handleNoteClick(note: Note): boolean {

        if (this.state === 'idle') {

            this.sourceElement = note

            this.state = 'click-connect'
            this.activateInteractionUI()
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
            this.activateInteractionUI()

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
                this.connectManager.finishInteraction()
                return
            }

            this.createConnection(this.sourceElement, target)

            this.connectManager.restart()
            return
        }

        const continueInteraction = this.sourceElement instanceof Node
        this.connectManager.finishInteraction(continueInteraction)
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
