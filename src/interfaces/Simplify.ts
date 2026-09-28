import type { Node } from '../Node'

/**
 * A group drawn by {@link SimplifyOptions | simplification}: nodes folded into one dot on
 * the canvas. View state only — `graph.getNodes()`, the table, export and history see
 * the members, never the group.
 */
export interface GroupInfo {
    /** Stable while the group keeps its key or most of its members. */
    id: string
    /** The id of the rule that made it: `'neighbours'`, `'chains'`, `'degree'`, `'kcore'`, `'communities'`, `'landings'`, `'manual'`, or a custom rule's own id. */
    rule: string
    /** The real nodes it stands for. */
    members: Node[]
    /** How many members of each type; the key is `''` for nodes with no type. */
    typeCounts: Record<string, number>
    /** The drawn neighbours that define it. */
    anchors: Node[]
    /** Whether its members are back on the canvas. */
    open: boolean
    /** The Communities level it was found at. */
    level?: number
    /** A hand-made group's title, shown in place of its type breakdown. */
    title?: string
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

/**
 * Fold chains that hang off a node alone: a node whose only link is from its parent, and
 * so on down. Nodes leading chains of the same shape fold together, and so does each level
 * of their chains. An event with thirty files, each holding its own hash, becomes one group
 * of files linked to one group of hashes. Links count downstream only.
 */
export interface ChainsRule {
    kind: 'chains'
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

/**
 * Fold nodes with few links into the nodes they hang from: a hub's leaves become one
 * "N more" on the hub. A group may mix types and may hold a single node.
 */
export interface DegreeRule {
    kind: 'degree'
    /** @default true */
    enabled?: boolean
    /**
     * Nodes with fewer drawn links than this fold. Between 1 and 10.
     * @default 2
     */
    minDegree?: number
}

/**
 * Fold everything outside the k-core into it: nodes with fewer than `k` links are peeled
 * off again and again, so whole trees hanging off the core fold, not only their leaves.
 * A group may mix types and may hold a single node.
 */
export interface KCoreRule {
    kind: 'kcore'
    /** @default true */
    enabled?: boolean
    /**
     * The links a node needs, among the nodes still standing, to stay. Between 1 and 10.
     * @default 2
     */
    k?: number
}

/**
 * Fold whole neighbourhoods into a few groups: communities of densely linked nodes, found
 * with the Leiden algorithm, at a level from fine (1) to coarse (7). Only offered when
 * declared. Computed off the page in the compute worker when one can start; meanwhile the
 * previous grouping stays. A group may mix types.
 */
export interface CommunitiesRule {
    kind: 'communities'
    /** @default true */
    enabled?: boolean
    /**
     * From 1, many small communities, to 7, a handful of large ones.
     * @default 4
     */
    level?: number
    /**
     * `false` finds the communities on the page instead of in a worker.
     * @default true
     */
    useWorker?: boolean
}

/**
 * Fold what a pivot brought in: the nodes an ingest added, one group per type, when that
 * ingest was asked to land in a group (`graph.simplify.groupLanding`). A member stays
 * whatever links it gains. Added at the top of the rules, on, the first time a landing is
 * grouped; declare it to place it elsewhere or preset its smallest group.
 */
export interface LandingsRule {
    kind: 'landings'
    /** @default true */
    enabled?: boolean
    /**
     * Fewer nodes of one type than this land as plain nodes. Between 2 and 50.
     * @default 2
     */
    minSize?: number
    /** Overrides `render.nodeTypeAccessor` for this rule. */
    typeOf?: (node: Node) => string | undefined
}

/**
 * The groups made by hand from a selection (`graph.simplify.groupNodes`). Runs before every
 * other rule, so a node picked into one leaves any other group. Added at the top of the
 * rules, on, the first time a group is made; declare it to switch it off by default.
 */
export interface ManualRule {
    kind: 'manual'
    /** @default true */
    enabled?: boolean
}

/** A group made by hand: what `getManualGroups` returns and `setManualGroups` takes. */
export interface ManualGroupRecord {
    /** Also the id of the group drawn for it. */
    id: string
    /** Shown in place of the type breakdown. Unset, the group is labelled by its types. */
    title?: string
    /** Every member, including ones deleted or filtered out since; only those present are drawn. */
    members: string[]
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

export type SimplifyRule = NeighboursRule | ChainsRule | DegreeRule | KCoreRule | CommunitiesRule | LandingsRule | ManualRule | CustomRule

/** `UI.simplify`: which rules fold the graph, and how groups are named. */
export interface SimplifyOptions {
    /**
     * `false` removes the feature: no rules run and the Simplify rail mode is gone.
     * @default true
     */
    enabled?: boolean
    /**
     * The rules, in the order they run; each one sees the groups the ones above it made.
     * Left out, `full` mode offers the built-in rules switched off, and the other modes
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

/** A rule's one whole-number setting: smallest group, fewest links, core strength or level. */
export interface SimplifyRuleSetting {
    /** Its name on the rule's card. */
    label: string
    value: number
    min: number
    max: number
    /** A stepper, or a slider applied on release. */
    control: 'stepper' | 'slider'
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
    /** The rule's whole-number setting, what its stepper shows. */
    setting?: SimplifyRuleSetting
    /** Declared by the app rather than shipped with the library. */
    custom: boolean
    /** Groups this rule made in the last run. */
    groups: number
    /** Nodes those groups hold. */
    folded: number
    /** The rule threw on its last run and was switched off. */
    failed: boolean
    /** Still finding its groups; the previous ones stay on the canvas meanwhile. */
    computing: boolean
}
