import { Node } from '../Node'
import type { GroupInfo } from '../interfaces/Simplify'

/**
 * The dot a group is drawn as. Held by `graph.simplify`, never in `graph.nodes`, and handed
 * to the renderer, the simulation and the minimap through `graph.getCanvasNodes()`.
 * @private
 */
export class GroupNode extends Node {
    readonly info: GroupInfo
    /** The rule's key the group was made from. */
    key = ''
    /** What it folded in the rule's view: real nodes, or groups made by earlier rules. */
    parts: Node[] = []
    /** What the style was last built from, so an unchanged group is not redrawn. */
    styleSignature = ''

    constructor(id: string, rule: string) {
        super(id)
        this.info = { id, rule, members: [], typeCounts: {}, anchors: [], open: false }
    }

    get isGroup(): boolean {
        return true
    }

    /** Its lines, not its edges: a group registers none, and gravity reads this. */
    degree(): number {
        return this.info.anchors.length
    }
}
