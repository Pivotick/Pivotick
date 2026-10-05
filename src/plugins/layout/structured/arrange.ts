import { shortestPaths, stressLayout, type Point } from './stress'

/** Which side of its node a floated label is drawn on. */
export type LabelSide = 'top' | 'bottom' | 'left' | 'right'

export interface ArrangeNode {
    id: string
    /** Half the space the node takes up, in graph units. */
    radius: number
    /** What orders the members of a block; the id breaks ties. */
    sortKey: string
}

export interface ArrangeOptions {
    /** Fewest leaves of one fan that line up as a block. */
    groupMin: number
    direction: 'auto' | 'row' | 'column'
    /** Clear space between two nodes. */
    gap: number
    trayPosition: 'bottom' | 'right'
    /** The area the result is meant to fit; only its proportions matter. */
    width: number
    height: number
}

export interface Arrangement {
    positions: Map<string, { x: number, y: number }>
    labelSides: Map<string, LabelSide>
}

/** Members per line of a block; a longer fan wraps onto a second line. */
const MAX_PER_LINE = 12
/** Sweeps of the overlap pass before it settles for what it has. */
const OVERLAP_SWEEPS = 100
/** Which side a label takes when several are equally free: below first, as most graphs read. */
const SIDE_PREFERENCE: LabelSide[] = ['bottom', 'right', 'top', 'left']
const SIDE_ANGLE: Record<LabelSide, number> = { right: 0, bottom: Math.PI / 2, left: Math.PI, top: -Math.PI / 2 }

/** A fan: three or more leaves of one type hanging off the same one or two nodes. */
interface Block {
    members: ArrangeNode[]
    anchors: string[]
    cell: number
    perLine: number
    lines: number
    /** Along the line the members sit on. */
    length: number
    /** Across it: one cell per line. */
    thickness: number
    vertical: boolean
    side: LabelSide
}

/** What the skeleton lays out: a node, or a whole block standing in for its members. */
interface Item {
    node?: ArrangeNode
    block?: Block
    x: number
    y: number
}

interface Component {
    positions: Map<string, Point>
    labelSides: Map<string, LabelSide>
    width: number
    height: number
    area: number
    /** First id, so components of equal size keep a stable order. */
    key: string
}

/**
 * Lay a small graph out as a person would draw it: each connected component on its own,
 * fans of like leaves lined up as blocks, the rest by stress so stars come out round and
 * chains straight, the components packed to the canvas and the loose nodes in a tray.
 *
 * @param links - Directionless pairs of node ids; repeats and self-loops are ignored.
 * @param groupKey - Leaves sharing a key may form a block (same type and same neighbours).
 */
export function arrange(
    nodes: ArrangeNode[],
    links: Array<[string, string]>,
    groupKey: Map<string, string>,
    options: ArrangeOptions,
): Arrangement {
    const sorted = [...nodes].sort((a, b) => compare(a.id, b.id))
    const byId = new Map(sorted.map(node => [node.id, node]))
    const neighbours = new Map<string, Set<string>>(sorted.map(node => [node.id, new Set()]))
    for (const [a, b] of links) {
        if (a === b || !byId.has(a) || !byId.has(b)) continue
        neighbours.get(a)!.add(b)
        neighbours.get(b)!.add(a)
    }

    const loose = sorted.filter(node => neighbours.get(node.id)!.size === 0)
    const components = connectedComponents(sorted, neighbours)
        .map(members => layoutComponent(members, neighbours, groupKey, options))

    return pack(components, loose, options)
}

function connectedComponents(nodes: ArrangeNode[], neighbours: Map<string, Set<string>>): ArrangeNode[][] {
    const byId = new Map(nodes.map(node => [node.id, node]))
    const seen = new Set<string>()
    const components: ArrangeNode[][] = []
    for (const start of nodes) {
        if (seen.has(start.id) || neighbours.get(start.id)!.size === 0) continue
        const queue = [start.id]
        seen.add(start.id)
        for (let i = 0; i < queue.length; i++) {
            for (const next of [...neighbours.get(queue[i])!].sort(compare)) {
                if (seen.has(next)) continue
                seen.add(next)
                queue.push(next)
            }
        }
        components.push(queue.sort(compare).map(id => byId.get(id)!))
    }
    return components
}

function layoutComponent(
    nodes: ArrangeNode[],
    neighbours: Map<string, Set<string>>,
    groupKey: Map<string, string>,
    options: ArrangeOptions,
): Component {
    const { gap } = options
    const linkGap = 2 * gap
    const blocks = findBlocks(nodes, neighbours, groupKey, options)
    const blockOf = new Map<string, Block>()
    for (const block of blocks) for (const member of block.members) blockOf.set(member.id, block)

    const items: Item[] = [
        ...nodes.filter(node => !blockOf.has(node.id)).map(node => ({ node, x: 0, y: 0 })),
        ...blocks.map(block => ({ block, x: 0, y: 0 })),
    ]
    const indexOfNode = new Map(items.flatMap((item, i) => item.node ? [[item.node.id, i] as const] : []))
    const indexOf = (id: string) => indexOfNode.get(id) ?? items.findIndex(item => item.block === blockOf.get(id))

    // An anchor sits beside its block: level with it for one, at its two ends for two.
    const besideBlock = (block: Block, anchor: ArrangeNode) => block.thickness / 2 + linkGap + anchor.radius
    const alongBlock = (block: Block) => block.anchors.length === 2 ? Math.max(block.length / 2 - block.cell / 2, 0) : 0

    const lengths = new Map<string, [number, number, number]>()
    for (const node of nodes) {
        for (const other of neighbours.get(node.id)!) {
            const [i, j] = [indexOf(node.id), indexOf(other)]
            if (i === j) continue
            const key = i < j ? `${i}:${j}` : `${j}:${i}`
            if (lengths.has(key)) continue
            const block = items[i].block ?? items[j].block
            const anchor = items[i].node ?? items[j].node!
            const length = block
                ? Math.hypot(besideBlock(block, anchor), alongBlock(block))
                : items[i].node!.radius + items[j].node!.radius + linkGap
            lengths.set(key, [Math.min(i, j), Math.max(i, j), length])
        }
    }

    const distances = shortestPaths(items.length, [...lengths.values()])
    // A two-parent fan pulls its parents to the same side of it, one at each end.
    for (const block of blocks) {
        if (block.anchors.length !== 2) continue
        const [a, b] = block.anchors.map(indexOf)
        const span = Math.max(2 * alongBlock(block), byIdIn(nodes, block.anchors[0]).radius + byIdIn(nodes, block.anchors[1]).radius + gap)
        distances[a][b] = distances[b][a] = Math.min(distances[a][b], span)
    }

    const points = stressLayout(distances)
    items.forEach((item, i) => { item.x = points[i][0]; item.y = points[i][1] })
    alignToCanvas(items, neighbours, options)

    for (const block of blocks) orientBlock(block, items, indexOf, options)
    separate(items, gap)

    const positions = new Map<string, Point>()
    const labelSides = new Map<string, LabelSide>()
    for (const item of items) {
        if (item.node) positions.set(item.node.id, [item.x, item.y])
        if (item.block) placeMembers(item.block, item.x, item.y, positions, labelSides)
    }
    for (const node of nodes) {
        if (labelSides.has(node.id)) continue
        labelSides.set(node.id, freestSide(positions.get(node.id)!, [...neighbours.get(node.id)!].map(id => positions.get(id)!)))
    }

    // Shifted so the component's box starts at the origin.
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
    for (const node of nodes) {
        const [x, y] = positions.get(node.id)!
        left = Math.min(left, x - node.radius)
        top = Math.min(top, y - node.radius)
        right = Math.max(right, x + node.radius)
        bottom = Math.max(bottom, y + node.radius)
    }
    for (const [id, [x, y]] of positions) positions.set(id, [x - left, y - top])

    const width = right - left
    const height = bottom - top
    return { positions, labelSides, width, height, area: width * height, key: nodes[0].id }
}

function byIdIn(nodes: ArrangeNode[], id: string): ArrangeNode {
    return nodes.find(node => node.id === id)!
}

/** The fans of a component: leaves (two neighbours at most) sharing a key, enough of them. */
function findBlocks(
    nodes: ArrangeNode[],
    neighbours: Map<string, Set<string>>,
    groupKey: Map<string, string>,
    options: ArrangeOptions,
): Block[] {
    const buckets = new Map<string, ArrangeNode[]>()
    for (const node of nodes) {
        const group = groupKey.get(node.id)
        const around = neighbours.get(node.id)!
        if (group === undefined || around.size > 2) continue
        // The neighbours are part of the key whatever `groupKey` says: a block hangs off them.
        const key = `${group}\u0001${[...around].sort(compare).join(',')}`
        buckets.set(key, [...buckets.get(key) ?? [], node])
    }

    const blocks: Block[] = []
    for (const members of buckets.values()) {
        if (members.length < options.groupMin) continue
        // A block that is the whole component around one node is still a fan; one that
        // leaves nothing to hang from is not.
        const anchors = [...neighbours.get(members[0].id)!].sort(compare)
        if (anchors.length === 0) continue
        members.sort((a, b) => compare(a.sortKey, b.sortKey) || compare(a.id, b.id))
        const cell = 2 * Math.max(...members.map(member => member.radius)) + options.gap
        const perLine = Math.min(members.length, MAX_PER_LINE)
        const lines = Math.ceil(members.length / perLine)
        blocks.push({
            members, anchors, cell, perLine, lines,
            length: perLine * cell,
            thickness: lines * cell,
            vertical: true,
            side: 'right',
        })
    }
    return blocks
}

/**
 * Turn the component so its long axis runs along the canvas's, and mirror it so its
 * busiest node reads first, on the left or at the top.
 */
function alignToCanvas(items: Item[], neighbours: Map<string, Set<string>>, options: ArrangeOptions): void {
    if (items.length < 2) return
    const cx = items.reduce((sum, item) => sum + item.x, 0) / items.length
    const cy = items.reduce((sum, item) => sum + item.y, 0) / items.length
    let xx = 0, yy = 0, xy = 0
    for (const item of items) {
        const dx = item.x - cx, dy = item.y - cy
        xx += dx * dx
        yy += dy * dy
        xy += dx * dy
    }
    const principal = 0.5 * Math.atan2(2 * xy, xx - yy)
    const landscape = options.width >= options.height
    const turn = (landscape ? 0 : Math.PI / 2) - principal
    const [cos, sin] = [Math.cos(turn), Math.sin(turn)]
    for (const item of items) {
        const dx = item.x - cx, dy = item.y - cy
        item.x = dx * cos - dy * sin
        item.y = dx * sin + dy * cos
    }

    const weight = (item: Item) => item.node ? neighbours.get(item.node.id)!.size : 0
    const busiest = items.reduce((best, item) => weight(item) > weight(best) ? item : best, items[0])
    const flip = landscape ? busiest.x > 0 : busiest.y > 0
    if (!flip) return
    for (const item of items) {
        if (landscape) item.x = -item.x
        else item.y = -item.y
    }
}

/** Stand a block across the line to its anchors, and give its members the far side for labels. */
function orientBlock(block: Block, items: Item[], indexOf: (id: string) => number, options: ArrangeOptions): void {
    const self = items.find(item => item.block === block)!
    const anchors = block.anchors.map(id => items[indexOf(id)])
    const ax = anchors.reduce((sum, item) => sum + item.x, 0) / anchors.length - self.x
    const ay = anchors.reduce((sum, item) => sum + item.y, 0) / anchors.length - self.y

    block.vertical = options.direction === 'column'
        || (options.direction === 'auto' && Math.abs(ax) >= Math.abs(ay))
    block.side = block.vertical
        ? (ax <= 0 ? 'right' : 'left')
        : (ay <= 0 ? 'bottom' : 'top')
}

function halfExtent(item: Item, gap: number): [number, number] {
    if (item.node) return [item.node.radius + gap / 2, item.node.radius + gap / 2]
    const block = item.block!
    return block.vertical
        ? [block.thickness / 2, block.length / 2]
        : [block.length / 2, block.thickness / 2]
}

/** Push overlapping boxes apart along whichever axis needs the smaller move. */
function separate(items: Item[], gap: number): void {
    for (let sweep = 0; sweep < OVERLAP_SWEEPS; sweep++) {
        let moved = false
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const [a, b] = [items[i], items[j]]
                const [aw, ah] = halfExtent(a, gap)
                const [bw, bh] = halfExtent(b, gap)
                const dx = b.x - a.x, dy = b.y - a.y
                const overlapX = aw + bw - Math.abs(dx)
                const overlapY = ah + bh - Math.abs(dy)
                if (overlapX <= 0 || overlapY <= 0) continue
                moved = true
                if (overlapX < overlapY) {
                    const push = (dx < 0 ? -1 : 1) * overlapX / 2
                    a.x -= push
                    b.x += push
                } else {
                    const push = (dy < 0 ? -1 : 1) * overlapY / 2
                    a.y -= push
                    b.y += push
                }
            }
        }
        if (!moved) return
    }
}

function placeMembers(block: Block, cx: number, cy: number, positions: Map<string, Point>, labelSides: Map<string, LabelSide>): void {
    const { members, perLine, lines, cell } = block
    members.forEach((member, index) => {
        const line = Math.floor(index / perLine)
        const inLine = line < lines - 1 ? perLine : members.length - perLine * (lines - 1)
        const across = (line - (lines - 1) / 2) * cell
        const along = (index % perLine - (inLine - 1) / 2) * cell
        positions.set(member.id, block.vertical ? [cx + across, cy + along] : [cx + along, cy + across])
        labelSides.set(member.id, block.side)
    })
}

/** The side furthest, by angle, from every line leaving the node. */
function freestSide(at: Point, others: Point[]): LabelSide {
    if (others.length === 0) return SIDE_PREFERENCE[0]
    const angles = others.map(([x, y]) => Math.atan2(y - at[1], x - at[0]))
    let best = SIDE_PREFERENCE[0]
    let bestClearance = -1
    for (const side of SIDE_PREFERENCE) {
        const clearance = Math.min(...angles.map(angle => angularDistance(angle, SIDE_ANGLE[side])))
        if (clearance > bestClearance + 1e-6) {
            best = side
            bestClearance = clearance
        }
    }
    return best
}

function angularDistance(a: number, b: number): number {
    const d = Math.abs(a - b) % (2 * Math.PI)
    return d > Math.PI ? 2 * Math.PI - d : d
}

/**
 * Shelf-pack the components, trying every shelf width that changes where a row breaks and
 * keeping the one that fits the canvas at the largest zoom, then add the tray.
 */
function pack(components: Component[], loose: ArrangeNode[], options: ArrangeOptions): Arrangement {
    const { gap, width: canvasWidth, height: canvasHeight } = options
    const spacing = 3 * gap
    const ordered = [...components].sort((a, b) => b.area - a.area || compare(a.key, b.key))
    const cell = 2 * Math.max(0, ...loose.map(node => node.radius)) + gap

    const candidates = new Set<number>()
    let running = 0
    for (const component of ordered) {
        running += (running > 0 ? spacing : 0) + component.width
        candidates.add(running)
        candidates.add(component.width)
    }
    if (candidates.size === 0) candidates.add(0)

    let best: Packing | undefined
    for (const shelf of [...candidates].sort((a, b) => a - b)) {
        for (const packing of trayVariants(shelve(ordered, shelf, spacing), loose.length, cell, spacing, options.trayPosition)) {
            const scale = Math.min(canvasWidth / Math.max(packing.width, 1), canvasHeight / Math.max(packing.height, 1))
            if (!best || scale > best.scale + 1e-9) best = { ...packing, scale }
        }
    }

    const positions = new Map<string, { x: number, y: number }>()
    const labelSides = new Map<string, LabelSide>()
    const offsetX = canvasWidth / 2 - best!.width / 2
    const offsetY = canvasHeight / 2 - best!.height / 2
    for (const { component, x, y } of best!.placed) {
        for (const [id, [px, py]] of component.positions) positions.set(id, { x: offsetX + x + px, y: offsetY + y + py })
        for (const [id, side] of component.labelSides) labelSides.set(id, side)
    }
    const tray = best!.tray
    loose
        .slice()
        .sort((a, b) => compare(a.sortKey, b.sortKey) || compare(a.id, b.id))
        .forEach((node, index) => {
            const column = tray.perRow > 0 ? index % tray.perRow : 0
            const row = tray.perRow > 0 ? Math.floor(index / tray.perRow) : index
            positions.set(node.id, {
                x: offsetX + tray.x + column * cell + cell / 2,
                y: offsetY + tray.y + row * cell + cell / 2,
            })
            labelSides.set(node.id, 'bottom')
        })
    return { positions, labelSides }
}

interface Shelved {
    placed: Array<{ component: Component, x: number, y: number }>
    width: number
    height: number
}

interface Packing extends Shelved {
    tray: { x: number, y: number, perRow: number }
    scale: number
}

/** Rows left to right, each centred under the widest; a row breaks before it would exceed `shelf`. */
function shelve(components: Component[], shelf: number, spacing: number): Shelved {
    const rows: Component[][] = []
    let row: Component[] = []
    let rowWidth = 0
    for (const component of components) {
        const next = rowWidth + (row.length ? spacing : 0) + component.width
        if (row.length && next > shelf + 1e-6) {
            rows.push(row)
            row = []
            rowWidth = 0
        }
        rowWidth += (row.length ? spacing : 0) + component.width
        row.push(component)
    }
    if (row.length) rows.push(row)

    const widthOf = (r: Component[]) => r.reduce((sum, c) => sum + c.width, 0) + spacing * (r.length - 1)
    const width = Math.max(0, ...rows.map(widthOf))
    const placed: Shelved['placed'] = []
    let y = 0
    for (const r of rows) {
        const height = Math.max(...r.map(c => c.height))
        let x = (width - widthOf(r)) / 2
        for (const component of r) {
            placed.push({ component, x, y: y + (height - component.height) / 2 })
            x += component.width + spacing
        }
        y += height + spacing
    }
    return { placed, width, height: rows.length ? y - spacing : 0 }
}

/** Every way the tray can sit against `shelved`: one, unless there is nothing else to fit it to. */
function trayVariants(shelved: Shelved, count: number, cell: number, spacing: number, position: 'bottom' | 'right'): Array<Omit<Packing, 'scale'>> {
    if (count === 0) return [{ ...shelved, tray: { x: 0, y: 0, perRow: 0 } }]
    if (shelved.placed.length === 0) {
        // Nothing but loose nodes: the tray is the layout, so try every grid it could be.
        return Array.from({ length: count }, (_, i) => {
            const perRow = i + 1
            return { ...shelved, width: perRow * cell, height: Math.ceil(count / perRow) * cell, tray: { x: 0, y: 0, perRow } }
        })
    }
    if (position === 'right') {
        // As many across as it takes to stay within the components' height.
        const columns = Math.ceil(count / Math.max(1, Math.floor(shelved.height / cell)))
        return [{
            ...shelved,
            width: shelved.width + spacing + columns * cell,
            height: Math.max(shelved.height, Math.ceil(count / columns) * cell),
            tray: { x: shelved.width + spacing, y: 0, perRow: columns },
        }]
    }
    const perRow = Math.max(1, Math.floor(shelved.width / cell))
    const across = Math.min(count, perRow)
    return [{
        ...shelved,
        width: Math.max(shelved.width, across * cell),
        height: shelved.height + spacing + Math.ceil(count / perRow) * cell,
        tray: { x: (Math.max(shelved.width, across * cell) - across * cell) / 2, y: shelved.height + spacing, perRow },
    }]
}

function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0
}
