import type { Graph } from '../Graph'
import type {
    NodeCreateContext,
    NodeCreateDecision,
    NodeCreateOrigin,
    NodePromptDataOptions,
} from '../interfaces/InterractionCallbacks'
import type { NodeStyle } from '../interfaces/RendererOptions'
import { Node, type NodeData } from '../Node'
import { generateSafeDomId } from '../utils/ElementCreation'
import { promptData } from './PromptModal'

/** What an affordance asks the library to create. */
export interface NodeCreateRequest {
    /** Graph-space position the node is placed at. */
    position: { x: number, y: number }
    origin: NodeCreateOrigin
}

/** Normalised form of an {@link InterractionCallbacks.onBeforeNodeCreate} return value. */
interface ResolvedDecision {
    accept: boolean
    id?: string
    data?: NodeData
    style?: Partial<NodeStyle>
    persisted?: boolean
}

/** What a node with no consumer-supplied data carries, so it is at least addressable. */
const DEFAULT_NODE_DATA: NodeData = { label: 'New node' }

/**
 * Run a user-initiated node create: ask
 * {@link InterractionCallbacks.onBeforeNodeCreate} for a decision, then place the node
 * at the requested graph-space position. Absent the hook a default node is created —
 * the affordance works out of the box, the hook is what makes it carry real data.
 *
 * @returns the new node, or `null` when the hook vetoed.
 */
export async function runNodeCreateRequest(graph: Graph, request: NodeCreateRequest): Promise<Node | null> {

    const hook = graph.getOptions().callbacks?.onBeforeNodeCreate

    const decision = hook
        ? normalise(await hook(buildContext(graph, request)))
        : { accept: true }

    if (!decision.accept) return null

    const id = decision.id ?? generateSafeDomId(8, 'node-')
    if (graph.getMutableNode(id)) {
        console.warn(`Pivotick: a node with id ${id} already exists; the create was skipped.`)
        return null
    }

    const node = new Node(id, decision.data ?? { ...DEFAULT_NODE_DATA }, decision.style ?? {}, id)
    node.x = request.position.x
    node.y = request.position.y

    graph.addNode(node)
    // A hand-drawn node is vouched for by `manual`, not by the seed data it would
    // otherwise be indistinguishable from. A consumer that wrote it through to its
    // own backend says so, and the entry seals.
    graph.history.recordCreate({ node }, decision.persisted === true)

    // Select it so the selection-gated affordances (Edit node, the bulk row) can act
    // on the node the user just placed.
    graph.selectElement(node)

    return node
}

function buildContext(graph: Graph, request: NodeCreateRequest): NodeCreateContext {
    return {
        position: request.position,
        origin: request.origin,
        promptData: (options: NodePromptDataOptions) =>
            promptData<NodeData>(graph, options, { title: 'Node details' }),
    }
}

function normalise(decision: NodeCreateDecision): ResolvedDecision {
    if (decision === true) return { accept: true }
    if (!decision) return { accept: false }
    return {
        accept: decision.accept,
        id: decision.id,
        data: decision.data,
        style: decision.style,
        persisted: decision.persisted,
    }
}
