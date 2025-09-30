import type { Node } from '../../../Node'
import type { UIElement, UIManager } from '../../UIManager'
import './tooltip.scss'


export class Tooltip implements UIElement {
    private uiManager: UIManager

    public tooltip?: HTMLDivElement
    private parentContainer?: HTMLElement

    private mouseX: number = 0
    private mouseY: number = 0
    private x: number = 0
    private y: number = 0
    private visible: boolean = false
    private showDelay: number = 300
    private tooltipTimeout: ReturnType<typeof setTimeout> | null = null

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    public mount(container: HTMLElement | undefined) {
        if (!container) return

        this.parentContainer = document.querySelector('body')!
        const template = document.createElement('template')
        template.innerHTML = '<div class="pivotick-tooltip"></div>'
        this.tooltip = template.content.firstElementChild as HTMLDivElement

        this.parentContainer.appendChild(this.tooltip)
    }

    public destroy() {
        this.tooltip?.remove()
        this.tooltip = undefined
    }

    public afterMount() {
    }

    public graphReady() {
        if (!this.tooltip) return

        this.uiManager.graph.renderer.getGraphInteraction().on('nodeHoverIn', this.nodeHovered.bind(this))
        this.uiManager.graph.renderer.getGraphInteraction().on('nodeHoverOut', () => { this.hide() })
        this.uiManager.graph.renderer.getGraphInteraction().on('edgeHoverIn', this.edgeHovered.bind(this))
        this.uiManager.graph.renderer.getGraphInteraction().on('edgeHoverOut', () => { this.hide() })
        this.uiManager.graph.renderer.getGraphInteraction().on('canvasMousemove', this.updateMousePosition.bind(this))
    }

    private updateMousePosition(event: MouseEvent) {
        this.mouseX = event.pageX
        this.mouseY = event.pageY
    }

    public nodeHovered(node: Node) {
        if (!this.tooltip) return

        this.show()


    }

    public edgeHovered(node: Node) {
        if (!this.tooltip) return

        this.show()
    }

    private setPosition() {
        if (!this.tooltip) return

        const offset = 10
        this.x = this.mouseX
        this.y = this.mouseY

        // // Adjust horizontal position if overflowing
        // if (this.x + tooltipWidth + offset > parentX + parentWidth) {
        //     this.x = parentX + parentWidth - tooltipWidth - offset
        // }

        // // Adjust vertical position if overflowing
        // if (this.y + tooltipHeight + offset > parentY + parentHeight) {
        //     this.y = parentY + parentHeight - tooltipHeight - offset
        // }

        this.tooltip.style.left = `${this.x + offset}px`
        this.tooltip.style.top = `${this.y + offset}px`
    }

    private hide() {
        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout)
            this.tooltipTimeout = null
        }
        this.visible = false
        this.tooltip?.classList.remove('shown')
    }

    private show() {
        this.tooltipTimeout = setTimeout(() => {
            this.visible = true
            this.tooltip?.classList.add('shown')
            this.setPosition()
        }, this.showDelay)
    }
}
