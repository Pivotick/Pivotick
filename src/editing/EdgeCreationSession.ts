import type { EdgeData } from '../Edge'
import type { Graph } from '../Graph'
import type {
    EdgeCreateContext,
    EdgeCreateOrigin,
    EdgeLabelPromptMode,
    EdgeLabelPromptOptions,
    InterractionCallbacks,
} from '../interfaces/InterractionCallbacks'
import type { PartialEdgeFullStyle } from '../interfaces/RendererOptions'
import { Node } from '../Node'
import { Note } from '../Note'
import { promptEdgeData, promptEdgeLabel } from './EdgeLabelPrompt'
import { GraphConnectManager } from './GraphConnectManager'

/** Normalised form of an {@link InterractionCallbacks.onBeforeEdgeCreate} return value. */
type ResolvedDecision = {
    accept: boolean
    data?: EdgeData
    style?: PartialEdgeFullStyle
    id?: string
    directed?: boolean | null
}


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

    /** True while an async `onBeforeEdgeCreate` decision is in flight — locks out new gestures. */
    private deciding = false

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

        if (this.deciding) return true

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
            const source = this.sourceElement
            // Run the (possibly async) decision while the preview stays up, then
            // re-arm connect mode. `deciding` ignores gestures until it settles.
            void this.runDecision(() => this.attemptConnection(source, node, 'click'))
                .then(() => this.connectManager.finishInteraction(true))
            return true
        }

        this.connectManager.finishInteraction(true)

        return true
    }

    public handleNoteClick(note: Note): boolean {

        if (this.deciding) return false

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

        if (this.deciding) return

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

        const invalid = this.isTargetInvalid(this.sourceElement, this.hoveredNode)

        this.graph.renderer.showShadowEdge({
            source: this.sourceElement,
            targetNode: this.hoveredNode ?? undefined,
            targetPosition: this.hoveredNode ? undefined : this.pointerPosition,
            invalid
        })
    }

    /**
     * Attempt to turn a resolved source→target gesture into an edge (or note-link).
     *
     * Order: the live {@link InterractionCallbacks.isValidConnection} predicate is
     * enforced first (an invalid target is refused outright, without consulting the
     * before-create hook); then the async {@link InterractionCallbacks.onBeforeEdgeCreate}
     * decision is awaited; only on acceptance is the edge/note-link created.
     */
    private async attemptConnection(source: Connectable, target: Node, origin: EdgeCreateOrigin): Promise<void> {

        if (this.isTargetInvalid(source, target)) return

        const hook = this.graph.getOptions().callbacks?.onBeforeEdgeCreate
        const staticPromptMode = this.getStaticLabelPromptMode()

        // The hook owns the decision when present; otherwise the static label-prompt
        // option (if set) collects a label and stamps it onto the new edge's data.
        const decision = hook
            ? await this.resolveDecision(hook, source, target, origin)
            : await this.resolveStaticDecision(source, target, staticPromptMode)

        if (!decision.accept) return

        if (source instanceof Node) {
            // Once an edge is enriched (by a hook or a collected label) it can
            // legitimately duplicate an existing pair, so bypass the same-pair dedup.
            const allowDuplicate = Boolean(hook) || Boolean(staticPromptMode)
            this.connectManager.createEdge(source, target, decision, { allowDuplicate })
            return
        }

        if (source instanceof Note) {
            this.connectManager.createNoteLink(source, target)
        }
    }

    /** Invoke the before-create hook (if any) and normalise its return value. */
    private async resolveDecision(
        hook: InterractionCallbacks['onBeforeEdgeCreate'],
        source: Connectable,
        target: Node,
        origin: EdgeCreateOrigin
    ): Promise<ResolvedDecision> {

        if (!hook) return { accept: true }

        const kind = source instanceof Note ? 'note-link' : 'edge'
        const context: EdgeCreateContext = {
            source,
            target,
            origin,
            kind,
            promptLabel: (options?: EdgeLabelPromptOptions) => this.promptEdgeLabel(source, target, options),
            promptData: (options) => promptEdgeData(this.graph, options)
        }
        const decision = await hook(context)

        if (decision === true) return { accept: true }
        if (!decision) return { accept: false }

        return {
            accept: decision.accept,
            data: decision.data,
            style: decision.style,
            id: decision.id,
            directed: decision.directed
        }
    }

    /**
     * Hook-less path for the static `editors.edgeEditor.labelPrompt` option: prompt
     * for a label and stamp it onto the edge's data. A cancel vetoes the create.
     * Note-links carry no data, so they always accept with defaults here.
     */
    private async resolveStaticDecision(
        source: Connectable,
        target: Node,
        mode: EdgeLabelPromptMode | undefined
    ): Promise<ResolvedDecision> {

        if (!mode || !(source instanceof Node)) return { accept: true }

        const label = await this.promptEdgeLabel(source, target, { mode })
        if (label === null) return { accept: false }

        return { accept: true, data: { label } }
    }

    private getStaticLabelPromptMode(): EdgeLabelPromptMode | undefined {
        return this.graph.UIManager.getOptions().editors?.edgeEditor?.labelPrompt
    }

    /** Open the label prompt anchored at the (source→target) edge midpoint. */
    private promptEdgeLabel(source: Connectable, target: Node, options?: EdgeLabelPromptOptions): Promise<string | null> {

        const tx = target.x ?? 0
        const ty = target.y ?? 0
        let gx = tx
        let gy = ty
        if (source instanceof Node && source.x != null && source.y != null) {
            gx = (source.x + tx) / 2
            gy = (source.y + ty) / 2
        }

        const anchor = this.graph.renderer.graphToScreenCoordinates(gx, gy)
        return promptEdgeLabel(this.graph, anchor, options)
    }

    /** True when a live `isValidConnection` predicate rejects the hovered target. */
    private isTargetInvalid(source: Connectable, target: Node | null): boolean {

        if (!target || source === target) return false

        const isValid = this.graph.getOptions().callbacks?.isValidConnection
        if (!isValid) return false

        return !isValid(source, target)
    }

    /** Run an async decision under the `deciding` lock (keeps the preview up, blocks new gestures). */
    private async runDecision(fn: () => Promise<void>): Promise<void> {

        this.deciding = true
        try {
            await fn()
        } finally {
            this.deciding = false
        }
    }

    private handleContextMenu = (event: MouseEvent): void => {

        event.preventDefault()
        event.stopPropagation()

        if (this.deciding) return

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

        if (this.deciding) return

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

        if (this.deciding) return

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

            const source = this.sourceElement
            this.dragStartPosition = null

            // Await the decision (preview persists) before re-arming the next drag.
            void this.runDecision(() => this.attemptConnection(source, target, 'drag'))
                .then(() => this.connectManager.restart())
            return
        }

        this.dragStartPosition = null
        this.connectManager.restart()
        return

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

    public getState(): InteractionState {
        return this.state
    }
}
