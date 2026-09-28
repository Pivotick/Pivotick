import { select, type Selection } from 'd3-selection'
import type { Graph } from '../../Graph'
import type { Node } from '../../Node'
import type { GroupNode } from '../../Simplification/GroupNode'
import { convexHull, type Point } from '../../utils/GeometryHelper'

/** How far the wash reaches past its members' rims. */
const PAD = 16
/** Points taken around each member's rim; enough for a round hull. */
const RIM_POINTS = 8
const CHIP_HEIGHT = 24
/** The chip's box; its content is centred in it, so this only has to be wide enough. */
const CHIP_BOX_WIDTH = 480

interface Outline {
    group: GroupNode
    parts: Node[]
}

/**
 * The outline of an open group: a wash in the group's colour around its members, under
 * the edges, and a chip naming the group above the nodes. Dragging the chip moves the
 * members; its × folds them back. Follows the members on every tick.
 */
export class GroupOutlineDrawer {
    private readonly graph: Graph
    private readonly washLayer: Selection<SVGGElement, unknown, null, undefined>
    private readonly chipLayer: Selection<SVGGElement, unknown, null, undefined>
    private outlines: Outline[] = []

    constructor(
        graph: Graph,
        washLayer: Selection<SVGGElement, unknown, null, undefined>,
        chipLayer: Selection<SVGGElement, unknown, null, undefined>,
    ) {
        this.graph = graph
        this.washLayer = washLayer
        this.chipLayer = chipLayer
    }

    /** Rebuild the outlines for the groups open now. */
    update(): void {
        const drawn = new Set(this.graph.getCanvasNodes())
        this.outlines = this.graph.simplify.getOpenGroupNodes()
            .map(group => ({ group, parts: group.parts.filter(part => drawn.has(part)) }))
            .filter(outline => outline.parts.length > 0)

        this.washLayer
            .selectAll<SVGPathElement, Outline>('path.pvt-group-outline')
            .data(this.outlines, outline => outline.group.id)
            .join(enter => enter.append('path').attr('class', 'pvt-group-outline'))
            .attr('data-group', outline => outline.group.id)
            .style('--pvt-group-color', outline => this.colorOf(outline.group))

        this.chipLayer
            .selectAll<SVGForeignObjectElement, Outline>('foreignObject.pvt-group-chip-box')
            .data(this.outlines, outline => outline.group.id)
            .join(
                enter => enter.append('foreignObject')
                    .attr('class', 'pvt-group-chip-box')
                    .attr('width', CHIP_BOX_WIDTH)
                    .attr('height', CHIP_HEIGHT),
            )
            .attr('data-group', outline => outline.group.id)
            .each((outline, i, boxes) => this.renderChip(boxes[i], outline))

        this.tick()
    }

    /** Move the outlines to where their members are now. */
    tick(): void {
        if (this.outlines.length === 0) return
        const shapes = new Map(this.outlines.map(outline => [outline.group.id, this.shapeOf(outline.parts)]))
        this.washLayer
            .selectAll<SVGPathElement, Outline>('path.pvt-group-outline')
            .attr('d', outline => shapes.get(outline.group.id)?.path ?? '')
            .attr('stroke-width', PAD * 2)
        this.chipLayer
            .selectAll<SVGForeignObjectElement, Outline>('foreignObject.pvt-group-chip-box')
            .attr('x', outline => (shapes.get(outline.group.id)?.top.x ?? 0) - CHIP_BOX_WIDTH / 2)
            .attr('y', outline => (shapes.get(outline.group.id)?.top.y ?? 0) - CHIP_HEIGHT / 2)
    }

    private renderChip(box: SVGForeignObjectElement, outline: Outline): void {
        const group = outline.group
        const signature = `${group.styleSignature}|${this.colorOf(group)}`
        if (box.dataset.signature === signature) return
        box.dataset.signature = signature
        box.replaceChildren()

        const shell = document.createElement('div')
        shell.className = 'pvt-group-chip-shell'
        const chip = document.createElement('div')
        chip.className = 'pvt-group-chip'
        chip.style.setProperty('--pvt-group-color', this.colorOf(group))

        const label = document.createElement('span')
        label.className = 'pvt-group-chip-label'
        label.title = `${this.graph.simplify.ruleLabel(group.info.rule)} · drag to move the group`
        const custom = this.graph.getOptions().render?.groupOutline?.(group.info)
        if (custom instanceof HTMLElement) label.append(custom)
        else label.textContent = typeof custom === 'string' && custom !== '' ? custom : this.graph.simplify.labelOf(group.info)
        const members = () => this.outlines.find(candidate => candidate.group.id === group.id)?.parts ?? []
        select(label).call(this.graph.simulation.createMembersDragBehavior<HTMLSpanElement>(members)
            // Measured in the canvas's own units, which the chip's HTML box is not.
            .container(() => this.chipLayer.node()!))

        const close = document.createElement('button')
        close.type = 'button'
        close.className = 'pvt-group-chip-close'
        close.title = 'Fold back into the group'
        close.setAttribute('aria-label', 'Fold back into the group')
        close.textContent = '×'
        close.addEventListener('click', (event) => {
            event.stopPropagation()
            this.graph.simplify.close(group)
        })

        chip.append(label, close)
        // Kept from the canvas: a press here must not start a pan or clear the selection.
        for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick', 'wheel'] as const) {
            chip.addEventListener(type, event => event.stopPropagation())
        }
        shell.append(chip)
        box.append(shell)
    }

    /** The hull around the parts' rims, as a path, and the middle of its top edge. */
    private shapeOf(parts: Node[]): { path: string, top: Point } {
        const points: Point[] = []
        for (const part of parts) {
            const x = part.x ?? 0
            const y = part.y ?? 0
            const r = part.getLayoutRadius()
            for (let i = 0; i < RIM_POINTS; i++) {
                const angle = (i / RIM_POINTS) * 2 * Math.PI
                points.push({ x: x + r * Math.cos(angle), y: y + r * Math.sin(angle) })
            }
        }
        const hull = convexHull(points)
        const path = `M${hull.map(point => `${point.x},${point.y}`).join('L')}Z`
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        for (const point of hull) {
            minX = Math.min(minX, point.x)
            maxX = Math.max(maxX, point.x)
            minY = Math.min(minY, point.y)
        }
        return { path, top: { x: (minX + maxX) / 2, y: minY - PAD } }
    }

    private colorOf(group: GroupNode): string {
        return this.graph.simplify.colorOf(group)
    }
}
