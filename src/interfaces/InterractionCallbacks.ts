import type { Edge, EdgeData } from '../Edge'
import type { Node, NodeData } from '../Node'
import type { NodeSelection } from './GraphInteractions'
import type { EdgeEditSession } from '../editing/EdgeEditSession'
import type { NodeEditSession } from '../editing/NodeEditSession'
import type { Note } from '../Note'
import type { NodeStyle, PartialEdgeFullStyle } from './RendererOptions'
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
     * Called when a node edit session is about to be committed. Acts as a
     * validation / persistence / veto hook: return `false` (or a promise of it) to
     * refuse, leaving the node's data untouched and the modal open. On success the
     * node's data is replaced and `nodeChange` fires on the data bus.
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

    /**
     * Called when the user asks to delete graph elements, *before* anything is
     * removed. The library resolves the whole target set first — including the edges
     * that removing a node would take with it
     * ({@link DeleteContext.cascadingEdges}) — so a consumer can persist the full
     * consequence of the gesture without re-deriving the cascade.
     *
     * - Return `false` / `{ accept: false }` to veto: nothing is removed, no
     *   `nodeRemove`/`edgeRemove`/`noteRemove` fires, and the selection is left intact.
     * - Return `true` to delete exactly what was requested.
     * - Return `{ accept: true, nodes?, edges?, notes? }` to **narrow** the delete to
     *   a subset — e.g. keep only what the backend actually deleted. An omitted key
     *   means "as requested", so `{ accept: true }` is equivalent to `true`; pass an
     *   empty array to spare that kind entirely. Elements that weren't part of the
     *   request are ignored.
     *
     * May be async (persist the delete, then decide) — a second delete gesture is
     * ignored while a decision is pending. {@link DeleteContext.confirm} opens a
     * confirmation modal so consumers don't rebuild one.
     *
     * Only user-initiated deletes are gated: programmatic `graph.removeNode()` /
     * `graph.removeEdge()` / `noteManager.removeNote()` never invoke this hook, so
     * consumer code driving the model isn't blocked by the consumer's own gate.
     */
    onBeforeDelete?: (context: DeleteContext) => DeleteDecision | Promise<DeleteDecision>

    /**
     * Called when an edge edit session starts. Acts as a UI hook, mirroring
     * {@link onNodeEdit}: return the body to inject into the edit modal. A custom
     * body owns the draft — mutate `session.draft` (or call `session.setDraft`) as
     * the user types, because the library has no form to read on submit.
     * @returns A HTML Div that will be injected in the modal's body
     * @param session The edge edit session
     */
    onEdgeEdit?: (session: EdgeEditSession) => HTMLDivElement

    /**
     * Called when an edge edit session is about to be committed. Acts as a
     * validation / persistence / veto hook, mirroring {@link onBeforeNodeEditCommit}:
     * return `false` (or a promise of it) to refuse, leaving the edge's data
     * untouched and the modal open. On success the edge's data is replaced and
     * `edgeChange` fires on the data bus.
     * @returns whether the commit should proceed
     */
    onBeforeEdgeEditCommit?: (context: EdgeEditCommitContext) => boolean | Promise<boolean>

    /**
     * Called when an edge edit session gets cancelled.
     */
    onEdgeEditCancel?: (edge: Edge) => void

    /**
     * Called when the user creates a node interactively (Create ▸ Add node, or the
     * canvas context-menu's "Add Node Here"), once the graph-space position is known
     * and before the node is added. Mirrors {@link onBeforeEdgeCreate}:
     *
     * - Return `false` / `{ accept: false }` to veto — nothing is added.
     * - Return `true` to accept the library's default node.
     * - Return `{ accept: true, id?, data?, style? }` to accept and supply the new
     *   node's id / payload / style.
     *
     * May be async, and {@link NodeCreateContext.promptData} opens the same
     * declarative-form or custom-HTML modal the edge hook uses. Absent this hook the
     * tool still works — it just creates a default, unnamed node. Programmatic
     * `graph.addNode()` is never gated.
     */
    onBeforeNodeCreate?: (context: NodeCreateContext) => NodeCreateDecision | Promise<NodeCreateDecision>
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
 * Options for a modal that collects a whole data payload (not just a label) —
 * {@link EdgeCreateContext.promptData} and {@link NodeCreateContext.promptData}.
 * Supply **either** `fields` (a declarative form, built with the same field system as
 * the node editor) **or** `render` + `getValues` (arbitrary HTML you populate and read
 * yourself). If both are given, `render` wins.
 */
export interface PromptDataOptions<TData> {
    /** Modal header. */
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
    getValues?: () => TData
}

/** Options for {@link EdgeCreateContext.promptData}. @default title 'Edge details' */
export type EdgePromptDataOptions = PromptDataOptions<EdgeData>

/** Options for {@link NodeCreateContext.promptData}. @default title 'Node details' */
export type NodePromptDataOptions = PromptDataOptions<NodeData>

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

export interface EdgeEditCommitContext {
    edge: Edge
    previousData: EdgeData
    nextData: EdgeData
    session: EdgeEditSession
}

/** Which affordance asked for a delete. */
export type DeleteOrigin = 'bulk-action' | 'context-menu'

/** Options for the confirmation modal handed to {@link DeleteContext.confirm}. */
export interface ConfirmOptions {
    /** Modal header. @default 'Confirm' */
    title?: string
    /** Body copy. A `string` renders as plain text; pass an element to render HTML. */
    body?: string | HTMLElement
    /** Confirm button label. @default 'Confirm' */
    confirmLabel?: string
    /** Cancel button label. @default 'Cancel' */
    cancelLabel?: string
    /** Confirm button styling. @default 'danger' */
    variant?: 'danger' | 'primary'
}

/** Context passed to {@link InterractionCallbacks.onBeforeDelete}. */
export interface DeleteContext {
    /** Nodes the user asked to delete. */
    nodes: Node[]
    /** Edges the user asked to delete (never overlapping {@link cascadingEdges}). */
    edges: Edge[]
    /** Notes the user asked to delete. */
    notes: Note[]
    /**
     * Edges that will also be destroyed as a consequence of removing `nodes` —
     * `graph.removeNode` cascades into every incident edge. Resolved by the library,
     * not the consumer. They follow whichever nodes survive a narrowed decision, so
     * they can't be narrowed on their own.
     */
    cascadingEdges: Edge[]
    /** Which affordance initiated the delete. */
    origin: DeleteOrigin
    /**
     * Open a confirmation modal, resolving `true` on confirm and `false` on any
     * cancel path (Cancel, ×, overlay, Esc) — so `if (!await confirm(…)) return false`
     * is the whole guard. Resolves `false` in UI modes with no modal slot.
     */
    confirm: (options?: ConfirmOptions) => Promise<boolean>
}

/**
 * The decision returned by {@link InterractionCallbacks.onBeforeDelete}.
 *
 * `true` deletes the whole request, `false` vetoes it. The object form (with
 * `accept: true`) narrows the delete: each supplied array replaces that kind's
 * requested set, and an omitted key leaves it as requested — so `{ accept: true }`
 * matches `true`, and `{ accept: true, nodes: [] }` deletes no nodes.
 */
export type DeleteDecision =
    | boolean
    | {
        accept: boolean
        nodes?: Node[]
        edges?: Edge[]
        notes?: Note[]
    }

/** What a resolved delete actually removed — the return of `graph.editing.requestDelete`. */
export interface DeleteOutcome {
    /** False when the hook vetoed (or there was nothing left to delete). */
    accepted: boolean
    /** Nodes removed from the graph. */
    nodes: Node[]
    /** Edges removed, including the ones a node removal cascaded into. */
    edges: Edge[]
    /** Notes removed. */
    notes: Note[]
}

/** Whether an interactive node create came from the tool panel or the canvas menu. */
export type NodeCreateOrigin = 'tool' | 'context-menu'

/** Context passed to {@link InterractionCallbacks.onBeforeNodeCreate}. */
export interface NodeCreateContext {
    /** Graph-space position the node will be placed at (correct under any zoom/pan). */
    position: { x: number, y: number }
    /** Which affordance initiated the create. */
    origin: NodeCreateOrigin
    /**
     * Prompt the user for the new node's data payload via a modal — a declarative
     * form ({@link PromptDataOptions.fields}) or custom HTML (`render` + `getValues`).
     * Resolves to the collected object, or `null` if the user cancelled. Feed it
     * straight into the decision — e.g. `return { accept: true, data: values }`.
     */
    promptData: (options: NodePromptDataOptions) => Promise<NodeData | null>
}

/**
 * The decision returned by {@link InterractionCallbacks.onBeforeNodeCreate}.
 *
 * `true` accepts the library's default node, `false` vetoes. The object form accepts
 * (when `accept` is true) and lets the consumer supply the new node's id / data / style.
 */
export type NodeCreateDecision =
    | boolean
    | {
        accept: boolean
        id?: string
        data?: NodeData
        style?: Partial<NodeStyle>
    }