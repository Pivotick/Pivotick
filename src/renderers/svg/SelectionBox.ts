import type { GraphRenderer } from '../../GraphRenderer'
import type { Node } from '../../Node'

export class SelectionBox {
    private renderer: GraphRenderer
    private svg: SVGSVGElement
    private selectionBoxGroup: SVGGElement | null
    private rect: SVGRectElement | null = null
    private startX = 0
    private startY = 0
    private isSelecting = false

    constructor(renderer: GraphRenderer, svg: SVGSVGElement, selectionBoxGroup: SVGGElement | null) {
        this.renderer = renderer
        this.svg = svg
        this.selectionBoxGroup = selectionBoxGroup
        this.init()
    }

    public selectionInProgress(): boolean {
        return this.isSelecting
    }

    private init() {
        this.svg.addEventListener('mousedown', this.onMouseDown)
        this.svg.addEventListener('mousemove', this.onMouseMove)
        this.svg.addEventListener('mouseup', this.onMouseUp)
    }

    private onSvgMouseLeave = () => {
        if (this.isSelecting) this.onMouseUp()
    }

    private onMouseDown = (e: MouseEvent) => {
        if (!this.selectionBoxGroup) return
        if (!e.shiftKey) return // only with Shift+Click

        this.svg.querySelectorAll('.selection-rectangle').forEach(el => el.remove())

        this.isSelecting = true
        const { x, y } = this.getSvgPoint(e)
        this.startX = x
        this.startY = y

        this.rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        this.rect.setAttribute('x', x.toString())
        this.rect.setAttribute('y', y.toString())
        this.rect.setAttribute('width', '0')
        this.rect.setAttribute('height', '0')
        this.rect.setAttribute('class', 'selection-rectangle')

        this.selectionBoxGroup.appendChild(this.rect)

        this.svg.addEventListener('mouseleave', this.onSvgMouseLeave)
    }

    private onMouseMove = (e: MouseEvent) => {
        if (!this.isSelecting || !this.rect) return

        if (!this.rect) return

        const { x, y } = this.getSvgPoint(e)
        const minX = Math.min(this.startX, x)
        const minY = Math.min(this.startY, y)
        const width = Math.abs(x - this.startX)
        const height = Math.abs(y - this.startY)

        this.rect.setAttribute('x', minX.toString())
        this.rect.setAttribute('y', minY.toString())
        this.rect.setAttribute('width', width.toString())
        this.rect.setAttribute('height', height.toString())
    }

    private onMouseUp = () => {
        if (!this.selectionBoxGroup) return
        if (!this.isSelecting || !this.rect) return

        this.isSelecting = false
        const bbox = this.rect.getBoundingClientRect()
        const selectedNodes = this.getNodesInRect(bbox)

        this.renderer.getGraphInteraction().selectNodes(selectedNodes)

        this.selectionBoxGroup.removeChild(this.rect)
        this.rect = null
        this.svg.removeEventListener('mouseleave', this.onSvgMouseLeave)
    }

    private getSvgPoint(evt: MouseEvent) {
        const pt = this.svg.createSVGPoint()
        pt.x = evt.clientX
        pt.y = evt.clientY
        return pt.matrixTransform(this.svg.getScreenCTM()?.inverse())
    }

    private getNodesInRect(rect: DOMRect): Array<[Node, SVGGElement]> {
        const nodes: Node[] = this.renderer.getGraphInteraction().getGraph().getMutableNodes()

        const nodesWithElem: Array<[Node, SVGGElement]> = []
        nodes.forEach((node: Node) => {
            if (!node.x || !node.y) return

            const nodeEl = node.getGraphElement()
            if (!nodeEl || !(nodeEl instanceof SVGGElement)) return
            const nodeBox = nodeEl.getBoundingClientRect()

            const inside =
                nodeBox.x < rect.x + rect.width &&
                nodeBox.x + nodeBox.width > rect.x &&
                nodeBox.y < rect.y + rect.height &&
                nodeBox.y + nodeBox.height > rect.y

            if (inside) {
                nodesWithElem.push([node, nodeEl])
            }
        })
        return nodesWithElem
    }
}
