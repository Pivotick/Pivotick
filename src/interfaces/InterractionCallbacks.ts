import type { Edge, EdgeData } from '../Edge'
import type { Node, NodeData } from '../Node'
import type { NodeSelection } from './GraphInteractions'
import type { NodeEditSession } from '../editing/NodeEditSession'
import type { Note } from '../Note'
import type { PartialEdgeFullStyle } from './RendererOptions'
import type { FieldConfig } from '../utils/FormFactory'

export interface InterractionCallbacks<TElement = unknown> {
    /**
     * Called when a node is clicked.
     */
    onNodeClick?: (event: PointerEvent, node: Node, element: TElement) => void

    /**
     * Called when a node is double clicked.
     */
    onNodeDbclick?: (event: PointerEvent, node: Node, element: TElement) => void

    /**
     * Called when a node is right clicked.
     */
    onNodeContextmenu?: (event: PointerEvent, node: Node, element: TElement) => void

    /**
     * Called when a user hovers over a node.
    */
    onNodeHoverIn?: (event: PointerEvent, node: Node, element: TElement) => void
    /**
     * Called when a user hovers out of a node.
    */
    onNodeHoverOut?: (event: PointerEvent, node: Node, element: TElement) => void

    /**
     * Called when a user pointer down a node.
    */
    onNodePointerDown?: (event: PointerEvent, node: Node, element: TElement) => void
    /**
     * Called when a user pointer up a node.
    */
    onNodePointerUp?: (event: PointerEvent, node: Node, element: TElement) => void

    /**
    * Called when a node is selected by the user.
    */
    onNodeSelect?: (node: Node, element: TElement) => void

    /**
    * Called when nodes are selected by the user.
    */
    onNodesSelect?: (selection: NodeSelection<TElement>[]) => void

    /**
    * Called when a node is unselected by the user.
    */
    onNodeBlur?: (node: Node, element: TElement) => void

    /**
     * Called when a node is expanded (e.g., drilled down or pivoted).
     */
    onNodeExpansion?: (event: PointerEvent, edge: Edge, element: TElement) => void

    /**
     * Called when a node is dragged.
     */
    onNodeDragging?: (event: MouseEvent, node: Node) => void

    /**
     * Called when a node drag ends.
     */
    onNodeDragended?: (event: MouseEvent, node: Node) => void

    /**
     * Called when an edge is selected by the user.
     */
    onEdgeClick?: (event: PointerEvent, edge: Edge, element: TElement) => void
    /**
     * Called when an edge is selected by the user.
     */
    onEdgeDbclick?: (event: PointerEvent, edge: Edge, element: TElement) => void
    /**
     * Called when an edge is right clicked.
     */
    onEdgeContextmenu?: (event: PointerEvent, edge: Edge, element: TElement) => void

    /**
     * Called when an edge is selected by the user.
    */
    onEdgeSelect?: (edge: Edge, element: TElement) => void

    /**
    * Called when an edge is unselected by the user.
    */
    onEdgeBlur?: (edge: Edge, element: TElement) => void

    /**
     * Called when a user hovers over an edge.
     */
    onEdgeHoverIn?: (event: PointerEvent, edge: Edge, element: TElement) => void
    /**
     * Called when a user hovers over an edge.
     */
    onEdgeHoverOut?: (event: PointerEvent, edge: Edge, element: TElement) => void

    /**
     * Called when a note is clicked.
     */
    onNoteClick?: (event: PointerEvent, note: Note, element: TElement) => void

    /**
     * Called when a note is double clicked.
     */
    onNoteDbclick?: (event: PointerEvent, note: Note, element: TElement) => void

    /**
     * Called when a note is right clicked.
     */
    onNoteContextmenu?: (event: PointerEvent, note: Note, element: TElement) => void

    /**
     * Called when a user hovers over a note.
    */
    onNoteHoverIn?: (event: PointerEvent, note: Note, element: TElement) => void
    /**
     * Called when a user hovers out of a note.
    */
    onNoteHoverOut?: (event: PointerEvent, note: Note, element: TElement) => void

    /**
     * Called when a user pointer down a node.
    */
    onNotePointerDown?: (event: PointerEvent, note: Note, element: TElement) => void
    /**
     * Called when a user pointer up a node.
    */
    onNotePointerUp?: (event: PointerEvent, note: Note, element: TElement) => void

    /**
     * Called when a user pointer down a node.
    */
    onNoteHandleClick?: (event: PointerEvent, note: Note, handle: HTMLElement) => void
    /**
     * Called when a user pointer up a node.
    */
    onNoteHandlePointerDown?: (event: PointerEvent, note: Note, handle: HTMLElement) => void
    /**
     * Called when a user pointer up a node.
    */
    onNoteDragging?: (event: PointerEvent, note: Note) => void

    /**
     * Called when the canvas is clicked.
     */
    onCanvasClick?: (event: PointerEvent) => void

    /**
     * Called when a user pointer down the canvas.
    */
    onCanvasPointerDown?: (event: PointerEvent) => void
    /**
     * Called when a user pointer up the canvas.
    */
    onCanvasPointerUp?: (event: PointerEvent) => void

    /**
     * Called when the canvas is about to be zoomed.
     */
    onCanvasBeforeZoom?: (event: unknown) => void

    /**
     * Called when the canvas is zoomed.
     */
    onCanvasZoom?: (event: unknown) => void

    /**
     * Called when the canvas is right clicked.
     */
    onCanvasContextmenu?: (event: PointerEvent) => void

    /**
     * Called when the mouse move over the canvas.
     */
    onCanvasMousemove?: (event: MouseEvent) => void

    /**
     * Called when the simulation ticks.
     */
    onSimulationTick?: () => void

    /**
     * Called when the every tenth of simulation ticks.
     */
    onSimulationSlowTick?: () => void

    /**
     * Called when a node edit session starts. Act as a UI hook.
     * @returns A HTML Div that will be injected in the modal's body
     * @param session The node edit session
     */
    onNodeEdit?: (session: NodeEditSession) => HTMLDivElement
    /**
     * Called when an node edit session is about to be commited
     * Act as a validation/interception hook.
     * @returns boolean indicating if the commit should proceed or not
     */
    onBeforeNodeEditCommit?: (context: NodeEditCommitContext) => boolean | Promise<boolean>
    /**
     * Called when an node edit session gets cancelled
     */
    onNodeEditCancel?: (node: Node) => void

    /**
     * Called during a connect gesture, after the target node is resolved but
     * *before* the edge (or note-link) is created. Acts as the edge equivalent of
     * {@link onBeforeNodeEditCommit}: a validation / enrichment / veto hook.
     *
     * - Return `false` / `{ accept: false }` to veto: the preview is dropped,
     *   nothing is added, and connect mode stays armed so the user can retry.
     * - Return `true` to accept with defaults.
     * - Return `{ accept: true, data?, style?, id?, directed? }` to accept and
     *   supply the new edge's payload/style/id/direction.
     *
     * May be async (e.g. persist to a backend before deciding); the shadow-edge
     * preview persists until the promise settles, and no new connect gesture is
     * accepted while it is pending. Fires for both click- and drag-to-connect.
     * Also fires for note→node links ({@link EdgeCreateContext.kind} `'note-link'`),
     * where the edge-specific fields of the decision are ignored.
     *
     * @returns whether the connection should be created, optionally with its data.
     */
    onBeforeEdgeCreate?: (context: EdgeCreateContext) => EdgeCreateDecision | Promise<EdgeCreateDecision>

    /**
     * Live validity predicate evaluated *during* the connect gesture as the cursor
     * hovers candidate targets (à la React Flow's `isValidConnection`). Return
     * `false` to mark the hovered target invalid: the shadow edge renders in an
     * invalid style, and releasing / clicking on it creates nothing (in that case
     * {@link onBeforeEdgeCreate} is not consulted). Runs on every pointer move, so
     * it must be synchronous and cheap.
     */
    isValidConnection?: (source: Node | Note, target: Node) => boolean
}

/** Whether a connection was drawn by click-to-connect or drag-to-connect. */
export type EdgeCreateOrigin = 'click' | 'drag'

/** Which UI the label prompt uses. */
export type EdgeLabelPromptMode = 'inline' | 'modal'

/** Options for {@link EdgeCreateContext.promptLabel} (and the static `edgeEditor.labelPrompt`). */
export interface EdgeLabelPromptOptions {
    /** `'inline'` = floating input at the edge midpoint, `'modal'` = a modal field. @default 'inline' */
    mode?: EdgeLabelPromptMode
    /** Value the field is pre-filled with. */
    initial?: string
    /** Placeholder shown while empty. */
    placeholder?: string
    /** Modal header (modal mode only). */
    title?: string
}

/**
 * Options for {@link EdgeCreateContext.promptData} — a modal that collects a whole
 * data payload for the new edge (not just a label). Supply **either** `fields`
 * (a declarative form, built with the same field system as the node editor) **or**
 * `render` + `getValues` (arbitrary HTML you populate and read yourself). If both are
 * given, `render` wins.
 */
export interface EdgePromptDataOptions {
    /** Modal header. @default 'Edge details' */
    title?: string
    /** Submit button label. @default 'Add' */
    submitLabel?: string
    /** Cancel button label. @default 'Cancel' */
    cancelLabel?: string
    /** Declarative form fields; the resolved object is keyed by each field's `key`. */
    fields?: FieldConfig[]
    /** Populate the modal body with your own HTML (ignored if fed no `getValues`). */
    render?: (body: HTMLElement) => void
    /** Read the collected values out of your custom `render`ed body on submit. */
    getValues?: () => EdgeData
}

/** Context passed to {@link InterractionCallbacks.onBeforeEdgeCreate}. */
export interface EdgeCreateContext {
    /** The source of the connection — a {@link Node} for an edge, a {@link Note} for a note-link. */
    source: Node | Note
    /** The resolved target node. */
    target: Node
    /** Whether the gesture was click- or drag-to-connect. */
    origin: EdgeCreateOrigin
    /** `'edge'` for a node→node edge, `'note-link'` for a note→node attachment. */
    kind: 'edge' | 'note-link'
    /**
     * Prompt the user for a label while the connect gesture is still pending, using
     * either a floating inline input or a modal (per {@link EdgeLabelPromptOptions.mode}).
     * Resolves to the entered string, or `null` if the user cancelled (Esc / closed).
     * The shadow-edge preview stays up while it is open. Typically fed back into the
     * returned decision's `data` — e.g. `return { accept: true, data: { label } }`.
     */
    promptLabel: (options?: EdgeLabelPromptOptions) => Promise<string | null>
    /**
     * Prompt the user for a whole data payload via a modal — a declarative form
     * ({@link EdgePromptDataOptions.fields}) or custom HTML
     * ({@link EdgePromptDataOptions.render} + `getValues`). Resolves to the collected
     * object, or `null` if the user cancelled. Feed it straight into the decision —
     * e.g. `return { accept: true, data: values }`. Modal only (no inline variant).
     */
    promptData: (options: EdgePromptDataOptions) => Promise<EdgeData | null>
}

/**
 * The decision returned by {@link InterractionCallbacks.onBeforeEdgeCreate}.
 *
 * `true` accepts with defaults, `false` vetoes. The object form accepts (when
 * `accept` is true) and lets the consumer supply the new edge's data/style/id/
 * direction. The `data`/`style`/`id`/`directed` fields apply to edges only and
 * are ignored for note-links.
 */
export type EdgeCreateDecision =
    | boolean
    | {
        accept: boolean
        data?: EdgeData
        style?: PartialEdgeFullStyle
        id?: string
        directed?: boolean | null
    }

export interface NodeEditCommitContext {
    node: Node
    previousData: NodeData
    nextData: NodeData
    session: NodeEditSession
}