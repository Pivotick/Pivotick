import type { Graph } from '../Graph'
import type { Node } from '../Node'
import type { GraphUIMode } from '../interfaces/GraphUI'
import type {
    GraphView, GroupInfo, SimplifyOptions, SimplifyRule, SimplifyRuleStatus,
} from '../interfaces/Simplify'
import { GroupNode } from './GroupNode'
import { defaultGroupStyle, groupRadius } from './groupStyle'
import { chainsPartition, degreePartition, kCorePartition, neighboursPartition } from './rules'

export const MIN_GROUP_SIZE = 2
export const MAX_GROUP_SIZE = 50
export const MIN_THRESHOLD = 1
export const MAX_THRESHOLD = 10
const DEFAULT_BUILTIN_MIN = 5
const DEFAULT_CUSTOM_MIN = 2
const DEFAULT_THRESHOLD = 2
const DEFAULT_OPEN_CONFIRM_ABOVE = 100
const FALLBACK_COLOR = 'var(--pvt-node-color, #007acc)'

type BuiltinKind = Exclude<SimplifyRule['kind'], 'custom'>

/** What a built-in rule says about itself on its card, in the order they are offered. */
const BUILTIN_TEXT: Record<BuiltinKind, { label: string, description: string }> = {
    neighbours: { label: 'Same neighbours', description: 'Nodes of one type linked to exactly the same nodes.' },
    chains: { label: 'Chains', description: 'Nodes leading chains of the same shape, folded level by level.' },
    degree: { label: 'Few links', description: 'Nodes with fewer links than this fold into the nodes they hang from.' },
    kcore: { label: 'Outside the core', description: 'Peels off nodes with fewer links than this, again and again, into the core.' },
}

/** The rules that fold nodes below a threshold, and what their setting is called. */
const THRESHOLD_LABEL: Partial<Record<BuiltinKind, string>> = { degree: 'Fewest links', kcore: 'Core strength' }

interface RuleState {
    rule: SimplifyRule
    id: string
    enabled: boolean
    /** Fewer parts than this stay plain nodes; 1 for a threshold rule, which folds any group. */
    minSize: number
    /** A threshold rule's fewest links or core strength. */
    threshold?: number
    failed: boolean
    groups: number
    folded: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)))

type GroupRef = GroupInfo | GroupNode | string

/**
 * Folds nodes that play the same role into one group drawn in their place — `graph.simplify`.
 *
 * Groups are view state. They live here, never in `graph.nodes`; a folded member stays in
 * the data with its `visible` flag, and only its `foldedInto` says the canvas draws it as a
 * group. So edges reroute through `canvasRepresentative()` as they do for a closed cluster.
 *
 * Rules run in order on the drawn graph, after the node filters: each one sees the groups
 * the ones above it made as ordinary nodes. Recomputed before every redraw.
 */
export class Simplification {
    private readonly graph: Graph
    private rules: RuleState[] = []
    private groups: GroupNode[] = []
    private readonly pulledOut = new Set<string>()
    /** Where each folded node sat relative to its group, to put it back there. */
    private readonly offsets = new Map<Node, { dx: number, dy: number }>()
    private readonly listeners = new Set<() => void>()
    private nextGroupId = 1
    private readonly featureEnabled: boolean
    private readonly typeLabelFn?: SimplifyOptions['typeLabel']
    private readonly openConfirmAboveValue: number
    /** What the last run produced, to tell listeners only about a real change. */
    private signature = ''

    constructor(graph: Graph, options: SimplifyOptions | undefined, mode: GraphUIMode | undefined) {
        this.graph = graph
        this.featureEnabled = options?.enabled !== false
        this.typeLabelFn = options?.typeLabel
        this.openConfirmAboveValue = options?.openConfirmAbove ?? DEFAULT_OPEN_CONFIRM_ABOVE
        if (!this.featureEnabled) return
        const offered = (Object.keys(BUILTIN_TEXT) as BuiltinKind[]).map(kind => ({ kind, enabled: false }))
        const declared = options?.rules ?? (mode === 'full' ? offered : [])
        this.rules = this.buildRules(declared)
    }

    /* ---------- rules ---------- */

    /** Whether the feature is on at all (`UI.simplify.enabled`). */
    isEnabled(): boolean {
        return this.featureEnabled
    }

    /** Replace the rules. Their order is the order they run in. */
    setRules(rules: SimplifyRule[]): void {
        if (!this.featureEnabled) return
        this.rules = this.buildRules(rules)
        this.regroup()
    }

    /** Every rule, in run order, with what it did on the last run. */
    getRules(): SimplifyRuleStatus[] {
        return this.rules.map((state) => {
            const builtin = state.rule.kind === 'custom' ? undefined : BUILTIN_TEXT[state.rule.kind]
            const custom = state.rule.kind === 'custom' ? state.rule : undefined
            const minSize = state.threshold !== undefined || (custom && custom.minSize === undefined) ? undefined : state.minSize
            const setting = state.threshold !== undefined
                ? { label: THRESHOLD_LABEL[state.rule.kind as BuiltinKind]!, value: state.threshold, min: MIN_THRESHOLD, max: MAX_THRESHOLD }
                : minSize !== undefined ? { label: 'Smallest group', value: minSize, min: MIN_GROUP_SIZE, max: MAX_GROUP_SIZE } : undefined
            return {
                id: state.id,
                kind: state.rule.kind,
                label: builtin?.label ?? custom?.label ?? state.id,
                description: builtin?.description ?? custom?.description ?? '',
                enabled: state.enabled,
                minSize,
                setting,
                custom: state.rule.kind === 'custom',
                groups: state.groups,
                folded: state.folded,
                failed: state.failed,
            }
        })
    }

    /** Switch one rule on or off. Switching a failed rule back on tries it again. */
    setRuleEnabled(id: string, enabled: boolean): void {
        const state = this.rules.find(candidate => candidate.id === id)
        if (!state || (state.enabled === enabled && !state.failed)) return
        state.enabled = enabled
        state.failed = false
        this.regroup()
    }

    /** Set a rule's smallest group, clamped to 2–50. A threshold rule has none. */
    setRuleMinSize(id: string, minSize: number): void {
        const state = this.rules.find(candidate => candidate.id === id)
        if (!state || state.threshold !== undefined || !Number.isFinite(minSize)) return
        const clamped = clamp(minSize, MIN_GROUP_SIZE, MAX_GROUP_SIZE)
        if (state.minSize === clamped) return
        state.minSize = clamped
        this.regroup()
    }

    /**
     * Set a rule's one setting, what its stepper does: the smallest group (2–50), or the
     * fewest links / core strength of a threshold rule (1–10).
     */
    setRuleSetting(id: string, value: number): void {
        const state = this.rules.find(candidate => candidate.id === id)
        if (!state || state.threshold === undefined) {
            this.setRuleMinSize(id, value)
            return
        }
        if (!Number.isFinite(value)) return
        const clamped = clamp(value, MIN_THRESHOLD, MAX_THRESHOLD)
        if (state.threshold === clamped) return
        state.threshold = clamped
        this.regroup()
    }

    /* ---------- groups ---------- */

    /** Every group from the last run, open ones included. */
    getGroups(): GroupInfo[] {
        return this.groups.map(group => group.info)
    }

    /** The group the first rule to fold this node put it in. */
    groupOf(node: Node | string): GroupInfo | undefined {
        const id = typeof node === 'string' ? node : node.id
        return this.groups.find(group => group.info.members.some(member => member.id === id))?.info
    }

    /** The drawn dot of a group, by id. @private */
    getGroupNode(id: string): GroupNode | undefined {
        return this.groups.find(group => group.id === id)
    }

    /** The closed groups the canvas draws. @private */
    getDrawnGroups(): GroupNode[] {
        return this.groups.filter(group => !group.info.open && !group.foldedInto)
    }

    /** The open groups, whose members are back on the canvas. @private */
    getOpenGroupNodes(): GroupNode[] {
        return this.groups.filter(group => group.info.open)
    }

    /**
     * What the canvas holds: `total` top-level nodes pass the filters, `folded` of them sit
     * in closed groups, and `shown` dots are drawn for them, `groups` of which are groups.
     */
    summary(): { shown: number, total: number, groups: number, folded: number } {
        let total = 0
        let folded = 0
        for (const node of this.graph.getMutableNodes()) {
            if (node.childrenDepth !== 0 || !node.visible) continue
            total++
            if (node.foldedInto) folded++
        }
        const groups = this.getDrawnGroups().length
        return { shown: total - folded + groups, total, groups, folded }
    }

    /** Put a group's members back on the canvas. It stays open until closed or dissolved. */
    open(group: GroupRef): void {
        this.setOpen(group, true)
    }

    /** Fold an open group's members back into it. */
    close(group: GroupRef): void {
        this.setOpen(group, false)
    }

    /** Take a node out of its group for the session; it stays a plain node until put back. */
    pullOut(node: Node | string): void {
        const id = typeof node === 'string' ? node : node.id
        if (this.pulledOut.has(id)) return
        this.pulledOut.add(id)
        this.regroup()
    }

    /** Let a pulled-out node be grouped again. */
    putBack(node: Node | string): void {
        const id = typeof node === 'string' ? node : node.id
        if (!this.pulledOut.delete(id)) return
        this.regroup()
    }

    /** Whether a node was pulled out of its group. */
    isPulledOut(node: Node | string): boolean {
        return this.pulledOut.has(typeof node === 'string' ? node : node.id)
    }

    /** The members above which Open asks first (`UI.simplify.openConfirmAbove`). */
    get openConfirmAbove(): number {
        return this.openConfirmAboveValue
    }

    /** The name of one part of a group, `12 × ip` unless `UI.simplify.typeLabel` says otherwise. */
    typeLabel(type: string | undefined, count: number): string {
        if (this.typeLabelFn) return this.typeLabelFn(type, count)
        return `${count} × ${type ?? 'node'}`
    }

    /** A group's label: its parts joined, largest first. */
    labelOf(info: GroupInfo): string {
        return Object.entries(info.typeCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => this.typeLabel(type === '' ? undefined : type, count))
            .join(', ')
    }

    /** The name a rule goes by on its card, for a group's subtitle. */
    ruleLabel(id: string): string {
        return this.getRules().find(rule => rule.id === id)?.label ?? id
    }

    /** The colour a member of this type is drawn in; `''` is no type. */
    typeColor(info: GroupInfo, type: string): string {
        const accessor = this.graph.getOptions().render?.nodeTypeAccessor
        const member = info.members.find(candidate => (accessor?.(candidate) ?? '') === type) ?? info.members[0]
        return member ? this.colorOf(member) : FALLBACK_COLOR
    }

    /** The colour a dot is drawn in: a node's style, or a group's own. */
    colorOf(node: Node): string {
        const color = node instanceof GroupNode || !this.graph.renderer
            ? node.getStyle().color
            : this.graph.renderer.getNodeStyle(node).color
        return (typeof color === 'function' ? color(node) : color) ?? FALLBACK_COLOR
    }

    /** Subscribe to changes of the grouping. Returns its own unsubscribe. */
    onChange(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
    }

    /* ---------- the run ---------- */

    /**
     * Recompute every group from the graph as it stands. Returns whether the canvas now
     * holds different dots. Run by the root graph before each redraw.
     * @private
     */
    recompute(): boolean {
        const previous = this.groups
        const previousFold = new Map<Node, GroupNode>()
        for (const node of this.graph.getMutableNodes()) {
            if (node.foldedInto) previousFold.set(node, node.foldedInto as GroupNode)
            node.foldedInto = undefined
        }
        for (const group of previous) {
            if (group.foldedInto) previousFold.set(group, group.foldedInto as GroupNode)
            group.foldedInto = undefined
        }

        const next: GroupNode[] = []
        const claimed = new Set<GroupNode>()
        const active = this.rules.filter(state => state.enabled)
        for (const state of this.rules) {
            state.groups = 0
            state.folded = 0
        }

        if (active.length > 0) {
            const annotated = this.annotatedIds()
            for (const state of active) {
                const view = this.buildView(state, next, annotated)
                let partition: Map<string, string>
                try {
                    partition = this.partitionOf(state, view)
                } catch (error) {
                    console.error(`[Pivotick] Simplify rule "${state.id}" failed and was switched off.`, error)
                    state.enabled = false
                    state.failed = true
                    continue
                }
                for (const group of this.formGroups(state, view, partition, previous, claimed)) {
                    next.push(group)
                    state.groups++
                    state.folded += group.info.members.length
                    if (group.info.open) continue
                    for (const part of group.parts) this.fold(part, group, previousFold.get(part) === group)
                }
            }
        }

        this.groups = next
        this.resolveAnchors()
        this.placeReleased(previousFold)
        for (const node of [...this.offsets.keys()]) {
            if (!node.foldedInto) this.offsets.delete(node)
        }

        const signature = this.describe()
        const changed = signature !== this.signature
        this.signature = signature
        if (changed) {
            for (const listener of [...this.listeners]) listener()
            // After the redraw this run is part of: a selected group that is gone leaves the selection.
            queueMicrotask(() => this.dropDissolvedFromSelection())
        }
        return changed
    }

    private partitionOf(state: RuleState, view: GraphView): Map<string, string> {
        switch (state.rule.kind) {
            case 'custom': return state.rule.partition(view)
            case 'chains': return chainsPartition(view, state.minSize)
            case 'degree': return degreePartition(view, state.threshold!)
            case 'kcore': return kCorePartition(view, state.threshold!)
            default: return neighboursPartition(view)
        }
    }

    private dropDissolvedFromSelection(): void {
        const interaction = this.graph.renderer?.getGraphInteraction()
        if (!interaction) return
        const live = new Set(this.groups)
        const gone = interaction.getSelectedNodes()
            .filter(({ node }) => node instanceof GroupNode && !live.has(node))
        if (gone.length === 0) return
        if (gone.length === interaction.getSelectedNodes().length) interaction.clearNodeSelectionList()
        else interaction.removeNodesFromSelection(gone)
    }

    private buildRules(rules: SimplifyRule[]): RuleState[] {
        const seen = new Set<string>()
        const states: RuleState[] = []
        for (const rule of rules) {
            const id = rule.kind === 'custom' ? rule.id : rule.kind
            if (seen.has(id)) {
                console.warn(`[Pivotick] Simplify rule "${id}" is declared twice; the second is ignored.`)
                continue
            }
            seen.add(id)
            const threshold = rule.kind === 'degree' ? rule.minDegree : rule.kind === 'kcore' ? rule.k : undefined
            const isThreshold = rule.kind === 'degree' || rule.kind === 'kcore'
            const fallbackMin = rule.kind === 'custom' ? DEFAULT_CUSTOM_MIN : DEFAULT_BUILTIN_MIN
            states.push({
                rule,
                id,
                enabled: rule.enabled !== false,
                minSize: isThreshold ? 1 : clamp(rule.minSize ?? fallbackMin, MIN_GROUP_SIZE, MAX_GROUP_SIZE),
                threshold: isThreshold ? clamp(threshold ?? DEFAULT_THRESHOLD, MIN_THRESHOLD, MAX_THRESHOLD) : undefined,
                failed: false,
                groups: 0,
                folded: 0,
            })
        }
        return states
    }

    /** Redraw after a change made here, through the funnel every visible change takes. */
    private regroup(): void {
        this.graph.onChange()
    }

    private setOpen(ref: GroupRef, open: boolean): void {
        const id = typeof ref === 'string' ? ref : ref.id
        const group = this.getGroupNode(id)
        if (!group || group.info.open === open) return
        group.info.open = open
        this.regroup()
    }

    /** Nodes with a note attached, which are never grouped. */
    private annotatedIds(): Set<string> {
        const ids = new Set<string>()
        for (const note of this.graph.noteManager.getNotes()) {
            const attached = note.getAttachedElement()
            if (attached?.type === 'node') ids.add(attached.id)
        }
        return ids
    }

    /**
     * The graph the next rule sees: every dot on the main canvas, with the lines between
     * them. A line counts while both its real ends pass the filters, whatever its layer.
     */
    private buildView(state: RuleState, made: GroupNode[], annotated: Set<string>): GraphView {
        const dots: Node[] = this.graph.getMutableNodes()
            .filter(node => node.childrenDepth === 0 && node.visible && !node.foldedInto)
        for (const group of made) {
            if (!group.info.open && !group.foldedInto) dots.push(group)
        }

        const ins = new Map<Node, Set<Node>>()
        const outs = new Map<Node, Set<Node>>()
        const link = (map: Map<Node, Set<Node>>, key: Node, value: Node) => {
            const set = map.get(key)
            if (set) set.add(value)
            else map.set(key, new Set([value]))
        }
        for (const edge of this.graph.getMutableEdges()) {
            if (!edge.visibleIgnoringLayer || !this.graph.edgeCounts(edge)) continue
            const from = edge.from.canvasRepresentative()
            const to = edge.to.canvasRepresentative()
            if (from === to) continue
            link(outs, from, to)
            link(ins, to, from)
        }

        const accessor = this.graph.getOptions().render?.nodeTypeAccessor
        const ownTypeOf = state.rule.kind === 'neighbours' || state.rule.kind === 'chains' ? state.rule.typeOf : undefined
        const typeOf = ownTypeOf ?? accessor
        const nodes = dots.filter(node =>
            !annotated.has(node.id)
            && !this.pulledOut.has(node.id)
            && !(node.expanded && node.hasChildren()))

        return {
            nodes,
            inNeighbours: (node) => [...ins.get(node) ?? []],
            outNeighbours: (node) => [...outs.get(node) ?? []],
            typeOf: (node) => {
                if (node instanceof GroupNode) {
                    const types = Object.keys(node.info.typeCounts)
                    return types.length === 1 ? (types[0] === '' ? undefined : types[0]) : '\u0000mixed'
                }
                return typeOf?.(node)
            },
            groupOf: (node) => node instanceof GroupNode ? node.info : undefined,
        }
    }

    /** Turn one rule's partition into groups, keeping each one's identity where it can. */
    private formGroups(state: RuleState, view: GraphView, partition: Map<string, string>, previous: GroupNode[], claimed: Set<GroupNode>): GroupNode[] {
        const byId = new Map(view.nodes.map(node => [node.id, node]))
        const buckets = new Map<string, Node[]>()
        for (const [id, key] of partition) {
            const node = byId.get(id)
            if (!node || typeof key !== 'string') continue
            const bucket = buckets.get(key)
            if (bucket) bucket.push(node)
            else buckets.set(key, [node])
        }

        const formed: GroupNode[] = []
        for (const [key, parts] of buckets) {
            if (parts.length < state.minSize) continue
            const members = parts.flatMap(part => part instanceof GroupNode ? part.info.members : [part])
            const inherited = this.inherit(state.id, key, members, previous, claimed)
            const group = inherited ?? this.createGroup(state.id, parts)
            claimed.add(group)
            group.key = key
            group.parts = parts
            group.info.members = members
            group.info.typeCounts = this.countTypes(parts, view)
            group.info.anchors = this.anchorsOf(parts, view)
            if (!inherited) this.keepOffAnchors(group)
            this.applyStyle(group)
            formed.push(group)
        }
        return formed
    }

    /**
     * The previous group this one continues: the same rule and key, else one it holds more
     * than half the members of. That group lends its id, position and open state.
     */
    private inherit(rule: string, key: string, members: Node[], previous: GroupNode[], claimed: Set<GroupNode>): GroupNode | undefined {
        const candidates = previous.filter(group => group.info.rule === rule && !claimed.has(group))
        const sameKey = candidates.find(group => group.key === key)
        if (sameKey) return sameKey
        const ids = new Set(members.map(member => member.id))
        let best: GroupNode | undefined
        let bestOverlap = 0
        for (const group of candidates) {
            const overlap = group.info.members.filter(member => ids.has(member.id)).length
            if (overlap * 2 > group.info.members.length && overlap > bestOverlap) {
                best = group
                bestOverlap = overlap
            }
        }
        return best
    }

    /** A new, closed group, placed at its parts' centroid and never pinned. */
    private createGroup(rule: string, parts: Node[]): GroupNode {
        const group = new GroupNode(`pvt-group-${this.nextGroupId++}`, rule)
        const placed = parts.filter(part => typeof part.x === 'number' && typeof part.y === 'number')
        if (placed.length) {
            group.x = placed.reduce((sum, part) => sum + (part.x as number), 0) / placed.length
            group.y = placed.reduce((sum, part) => sum + (part.y as number), 0) / placed.length
        }
        return group
    }

    /**
     * A hub's leaves are centred on the hub, so their centroid lands on it. Then the group
     * takes the place of the member nearest that centroid instead.
     */
    private keepOffAnchors(group: GroupNode): void {
        if (typeof group.x !== 'number' || typeof group.y !== 'number') return
        const cx = group.x
        const cy = group.y
        const clearance = groupRadius(group.info.members.length)
        const onAnchor = group.info.anchors.some(anchor =>
            typeof anchor.x === 'number' && typeof anchor.y === 'number'
            && Math.hypot(anchor.x - cx, anchor.y - cy) < anchor.getLayoutRadius() + clearance)
        if (!onAnchor) return
        let nearest: Node | undefined
        let best = Infinity
        for (const part of group.parts) {
            if (typeof part.x !== 'number' || typeof part.y !== 'number') continue
            const distance = Math.hypot(part.x - cx, part.y - cy)
            if (distance < best) {
                best = distance
                nearest = part
            }
        }
        if (!nearest) return
        group.x = nearest.x
        group.y = nearest.y
    }

    private countTypes(parts: Node[], view: GraphView): Record<string, number> {
        const counts: Record<string, number> = {}
        for (const part of parts) {
            if (part instanceof GroupNode) {
                for (const [type, n] of Object.entries(part.info.typeCounts)) counts[type] = (counts[type] ?? 0) + n
                continue
            }
            const type = view.typeOf(part) ?? ''
            counts[type] = (counts[type] ?? 0) + 1
        }
        return counts
    }

    private anchorsOf(parts: Node[], view: GraphView): Node[] {
        const inside = new Set(parts)
        const anchors = new Set<Node>()
        for (const part of parts) {
            for (const neighbour of [...view.inNeighbours(part), ...view.outNeighbours(part)]) {
                if (!inside.has(neighbour)) anchors.add(neighbour)
            }
        }
        return [...anchors]
    }

    /**
     * A group's anchors as the canvas draws them: an anchor a rule folded since, into a
     * chain's heads or a later rule's group, reads as that group.
     */
    private resolveAnchors(): void {
        for (const group of this.groups) {
            const drawn = new Set(group.info.anchors.map(anchor => anchor.canvasRepresentative()))
            drawn.delete(group)
            group.info.anchors = [...drawn]
        }
    }

    /** Rebuild a group's style and label when what they show has changed. */
    private applyStyle(group: GroupNode): void {
        const info = group.info
        const label = this.labelOf(info)
        const signature = `${label}|${JSON.stringify(info.typeCounts)}`
        if (signature === group.styleSignature) return
        group.styleSignature = signature
        group.setData({ label, count: info.members.length })

        const colorOf = (type: string) => this.typeColor(info, type)
        const base = defaultGroupStyle(info, label, colorOf)
        const custom = this.graph.getOptions().render?.groupStyle?.(info)
        group.setStyle(custom ? { ...base, ...custom } : base)
        group.markDirty()
    }

    /** Fold a part into its group, remembering where it sat relative to it. */
    private fold(part: Node, group: GroupNode, wasHere: boolean): void {
        part.foldedInto = group
        if (wasHere && this.offsets.has(part)) return
        const placed = typeof part.x === 'number' && typeof part.y === 'number'
            && typeof group.x === 'number' && typeof group.y === 'number'
        this.offsets.set(part, placed
            ? { dx: (part.x as number) - (group.x as number), dy: (part.y as number) - (group.y as number) }
            : { dx: 0, dy: 0 })
    }

    /**
     * A node leaving a group comes back where it sat relative to it, so a group that moved
     * brings its members along. A pinned one returns to its pin, which the simulation holds.
     */
    private placeReleased(previousFold: Map<Node, GroupNode>): void {
        for (const [node, group] of previousFold) {
            if (node.foldedInto) continue
            const offset = this.offsets.get(node)
            if (!offset || typeof group.x !== 'number' || typeof group.y !== 'number') continue
            node.x = group.x + offset.dx
            node.y = group.y + offset.dy
            node.vx = 0
            node.vy = 0
        }
    }

    private describe(): string {
        const groups = this.groups.map(group => `${group.id}:${group.info.members.length}:${group.info.open ? 1 : 0}:${group.foldedInto?.id ?? ''}`)
        const rules = this.rules.map(state => `${state.id}:${state.enabled ? 1 : 0}:${state.minSize}:${state.threshold ?? ''}:${state.failed ? 1 : 0}:${state.groups}:${state.folded}`)
        return `${groups.join(',')}|${rules.join(',')}`
    }
}

