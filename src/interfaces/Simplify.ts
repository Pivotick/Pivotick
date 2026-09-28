import type { Node } from '../Node'

/**
 * A group drawn by {@link SimplifyOptions | simplification}: nodes folded into one dot on
 * the canvas. View state only — `graph.getNodes()`, the table, export and history see
 * the members, never the group.
 */
export interface GroupInfo {
    /** Stable while the group keeps its key or most of its members. */
    id: string
    /** The id of the rule that made it: `'neighbours'`, or a custom rule's own id. */
    rule: string
    /** The real nodes it stands for. */
    members: Node[]
    /** How many members of each type; the key is `''` for nodes with no type. */
    typeCounts: Record<string, number>
    /** The drawn neighbours that define it. */
    anchors: Node[]
    /** Whether its members are back on the canvas. */
    open: boolean
}

/**
 * The drawn graph as one rule sees it: what the node filters let through, with the groups
 * made by the rules before it standing in for their members. Read-only.
 */
export interface GraphView {
    /**
     * The nodes this rule may group. Annotated nodes, nodes pulled out of a group and
     * expanded clusters are left out; groups from earlier rules are in.
     */
    nodes: Node[]
    /** The drawn nodes with a line to this one. */
    inNeighbours(node: Node): Node[]
    /** The drawn nodes this one has a line to. */
    outNeighbours(node: Node): Node[]
    /** The type the rule groups by: its own `typeOf`, else `render.nodeTypeAccessor`. */
    typeOf(node: Node): string | undefined
    /** The group behind this node, when it is one made by an earlier rule. */
    groupOf(node: Node): GroupInfo | undefined
}

/**
 * Fold nodes of one type that link to exactly the same nodes, the same way round.
 * The leaves of a hub are the simplest case: they all have the hub as their only neighbour.
 */
export interface NeighboursRule {
    kind: 'neighbours'
    /** @default true */
    enabled?: boolean
    /**
     * Fewer matching nodes than this stay plain nodes. Between 2 and 50.
     * @default 5
     */
    minSize?: number
    /** Overrides `render.nodeTypeAccessor` for this rule. */
    typeOf?: (node: Node) => string | undefined
}

/** A rule of the app's own. */
export interface CustomRule {
    kind: 'custom'
    /** Unique among the rules; also {@link GroupInfo.rule}. */
    id: string
    /** The name on its card in the Simplify flyout. @default the id */
    label?: string
    /** One line on its card saying what it folds. */
    description?: string
    /** @default true */
    enabled?: boolean
    /**
     * Fewer nodes sharing a key than this stay plain nodes.
     * @default 2
     */
    minSize?: number
    /**
     * Give each node to group a key; nodes sharing a key become one group. A node left out
     * stays itself, and ids that are not in `view.nodes` are ignored. A rule that throws is
     * switched off and the others still run.
     */
    partition: (view: GraphView) => Map<string, string>
}

export type SimplifyRule = NeighboursRule | CustomRule

/** `UI.simplify`: which rules fold the graph, and how groups are named. */
export interface SimplifyOptions {
    /**
     * `false` removes the feature: no rules run and the Simplify rail mode is gone.
     * @default true
     */
    enabled?: boolean
    /**
     * The rules, in the order they run; each one sees the groups the ones above it made.
     * Left out, `full` mode offers the neighbour rule switched off, and the other modes
     * run none.
     */
    rules?: SimplifyRule[]
    /**
     * The name of a group's part, e.g. `(type, count) => \`${count} IPs\``. `type` is
     * `undefined` for nodes with no type.
     * @default `${count} × ${type}`
     */
    typeLabel?: (type: string | undefined, count: number) => string
    /**
     * Opening a group with more members than this asks first.
     * @default 100
     */
    openConfirmAbove?: number
}

/** Where a rule stands, for the Simplify flyout. */
export interface SimplifyRuleStatus {
    id: string
    kind: SimplifyRule['kind']
    label: string
    description: string
    enabled: boolean
    /** Set for a rule with a smallest-group setting. */
    minSize?: number
    /** Declared by the app rather than shipped with the library. */
    custom: boolean
    /** Groups this rule made in the last run. */
    groups: number
    /** Nodes those groups hold. */
    folded: number
    /** The rule threw on its last run and was switched off. */
    failed: boolean
}
