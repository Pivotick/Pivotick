import type { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import { createHtmlDL, createHtmlElement, createHtmlTemplate, makeDraggable } from '../../../utils/ElementCreation'
import { tryResolveHTMLElement } from '../../../utils/Getters'
import { edgeDescriptionGetter, edgeNameGetter, edgePropertiesGetter, nodeDescriptionGetter, nodeNameGetter, nodePropertiesGetter } from '../../../utils/GraphGetters'
import { createButton } from '../../components/Button'
import { graphEdgeIcon, pin, closeIcon, selectElement, focusElement } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './tooltip.scss'
import type { Tooltip as TooltipOptions } from '../../../interfaces/GraphUI'
import { deepMerge } from '../../../utils/utils'
import { ShadowLinkManager } from '../ShadowLinkManager'
import { createNodePreview } from '../../../utils/NodePreview'


const defaultTooltipOptions = {
    enabled: true,
    allowPinning: true,
} as Partial<TooltipOptions>

export class Tooltip implements UIElement {
    private uiManager: UIManager
    private options: TooltipOptions
    public shadowLinkManager: ShadowLinkManager | null = null

    public tooltip?: HTMLDivElement
    private parentContainer?: HTMLElement
    private shadowLinkContainer?: SVGSVGElement

    private mouseX: number = 0
    private mouseY: number = 0
    private x: number = 0
    private y: number = 0
    private triggerX: number = 0
    private triggerY: number = 0
    private hoveredElementID: string | null = null
    private hoveredElement: Node | Edge | null = null
    private showDelay: number = 400
    private hideDelay: number = 100
    private tooltipTimeout: ReturnType<typeof setTimeout> | null = null
    private hideTimeout: ReturnType<typeof setTimeout> | null = null

    private tooltipDataMap = new Map<HTMLElement, Node | Edge>()

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.options = deepMerge(defaultTooltipOptions, this.uiManager.getOptions().tooltip) as TooltipOptions
    }

    public mount(container: HTMLElement | undefined) {
        if (!container) return

        this.parentContainer = document.querySelector('body')!
        const tooltipContainer: HTMLDivElement | null = this.parentContainer.querySelector('.pvt-tooltip')
        const shadowlinkContainer: SVGSVGElement | null = this.parentContainer.querySelector('.pivotick-shadowlink-container')
        if (tooltipContainer && shadowlinkContainer) {
            this.tooltip = tooltipContainer
            this.shadowLinkContainer = shadowlinkContainer
            return
        }
        const template = document.createElement('template')
        template.innerHTML = '<div class="pvt-tooltip"></div>'
        this.tooltip = template.content.firstElementChild as HTMLDivElement

        this.shadowLinkContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        this.shadowLinkContainer.setAttribute('class', 'pivotick-shadowlink-container')

        this.parentContainer.appendChild(this.tooltip)
        this.parentContainer.appendChild(this.shadowLinkContainer)

        this.shadowLinkManager = new ShadowLinkManager(this.shadowLinkContainer)
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
        this.uiManager.graph.renderer.getGraphInteraction().on('nodeHoverOut', this.delayedHide.bind(this))
        // this.uiManager.graph.renderer.getGraphInteraction().on('nodeHoverOut', () => { this.delayedHide() })
        // this.uiManager.graph.renderer.getGraphInteraction().on('edgeHoverIn', this.edgeHovered.bind(this))
        // this.uiManager.graph.renderer.getGraphInteraction().on('edgeHoverOut', () => { this.delayedHide() })
        this.uiManager.graph.renderer.getGraphInteraction().on('canvasMousemove', this.updateMousePosition.bind(this))
        this.uiManager.graph.renderer.getGraphInteraction().on('dragging', (_event: MouseEvent, node: Node) => {
            if (this.hoveredElementID === node.id) {
                this.hide(node)
            }
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('canvasZoom', this.canvasZoomed.bind(this))
        this.uiManager.graph.renderer.getGraphInteraction().on('simulationSlowTick', this.simulationSlowTick.bind(this))

        this.tooltip.addEventListener('mouseenter', () => {
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout)
                this.hideTimeout = null
            }
        })
        this.tooltip.addEventListener('mouseleave', () => this.hide())
    }

    private updateMousePosition(event: MouseEvent) {
        this.mouseX = event.pageX
        this.mouseY = event.pageY
    }

    private tooltipCanBeShown(): boolean {
        if (!this.tooltip) return false
        if (this.uiManager.graph.simulation.isDragging()) return false
        const selectionBox = this.uiManager.graph.renderer.getSelectionBox()
        if (selectionBox !== null && selectionBox.selectionInProgress()) return false
        if (
            Math.abs(this.triggerX - this.mouseX) >= 50 ||
            Math.abs(this.triggerY - this.mouseY) >= 50
        ) {
            return false  // Since tooltip display is delayed, make sure the pointer is still close to where it should be
        }
        return true
    }

    public openForNodeOnElement(event: MouseEvent, node: Node) {
        this.triggerX = event.pageX
        this.triggerY = event.pageY

        this.mouseY = event.pageY // Mouse X might not be over the canvas
        this.mouseX = event.pageX

        this.hoveredElementID = node.id
        this.hoveredElement = node

        if (!this.tooltipCanBeShown()) return
        this.show(() => {
            this.createNodeTooltip(node)
        })
    }

    public nodeHovered(event: MouseEvent, node: Node) {
        if (this.hoveredElementID === node.id) return

        this.triggerX = event.pageX
        this.triggerY = event.pageY
        this.hoveredElementID = node.id
        this.hoveredElement = node

        if (!this.tooltipCanBeShown()) return
        this.show(() => {
            this.createNodeTooltip(node)
        })
    }

    public edgeHovered(event: MouseEvent, edge: Edge) {
        if (this.hoveredElementID === edge.id) return

        this.triggerX = event.pageX
        this.triggerY = event.pageY
        this.hoveredElementID = edge.id
        this.hoveredElement = edge

        if (!this.tooltipCanBeShown()) return
        this.show(() => {
            if (this.uiManager.graph.simulation.isDragging()) {
                this.hide()
                return
            }

            this.createEdgeTooltip(edge)
        })
    }

    private canvasZoomed() {
        this.updateShadowLinks(true)
    }

    private simulationSlowTick() {
        this.updateShadowLinks(true)
    }

    public buildNodeTooltip(node: Node): HTMLDivElement {
        const fixedPreviewSize = 32
        const template = `
<div class="pvt-tooltip-container">
    <div class="pvt-mainheader-container">
        <div class="pvt-mainheader-nodepreview">
            <span class="pvt-mainheader-topright"></span>
        </div>
        <div class="pvt-mainheader-nodeinfo">
            <div class="pvt-mainheader-nodeinfo-name"></div>
            <div class="pvt-mainheader-nodeinfo-subtitle"></div>
        </div>
        <div class="pvt-mainheader-nodeinfo-action">
        </div>
    </div>
</div>`
        const tooltipContainer = createHtmlTemplate(template) as HTMLDivElement
        const mainheaderContent = tooltipContainer.querySelector('.pvt-mainheader-container')!
        const previewElem = tooltipContainer.querySelector('.pvt-mainheader-nodepreview')!
        const nameElem = tooltipContainer.querySelector('.pvt-mainheader-nodeinfo-name')!
        const subtitleElem = tooltipContainer.querySelector('.pvt-mainheader-nodeinfo-subtitle')!
        const toprightElem = tooltipContainer.querySelector('.pvt-mainheader-topright')!
        // const actionElem = tooltipContainer.querySelector('.pvt-mainheader-nodeinfo-action')!

        const properties = nodePropertiesGetter(node, this.uiManager.getOptions().propertiesPanel)

        previewElem.prepend(createNodePreview(node, { size: fixedPreviewSize, removeSelectionHighlight: true }))

        nameElem.textContent = nodeNameGetter(node, this.uiManager.getOptions().mainHeader)
        subtitleElem.textContent = nodeDescriptionGetter(node, this.uiManager.getOptions().mainHeader)

        if (this.options.allowPinning) {
            const pinButton = createButton({
                title: 'Pin Tooltip',
                variant: 'outline-primary',
                size: 'sm',
                class: 'pin-button',
                svgIcon: pin,
                onClick: () => {
                    this.pinTooltip()
                    this.hide()
                },
            })
            toprightElem.appendChild(pinButton)
        }

        const renderCb = this.uiManager.getOptions().tooltip.render
        if (renderCb && typeof renderCb === 'function') {
            const tooltipContent = tryResolveHTMLElement(renderCb, node)
            if (tooltipContent) {
                const tooltipContentWrapped = createHtmlElement('div', { class: 'pivotick-extra-content-container' }, [
                    tooltipContent
                ]) as HTMLDivElement
                tooltipContainer.appendChild(tooltipContentWrapped)
            }
            return tooltipContainer
        }

        const propertiesContainer = createHtmlElement('div', { class: 'pvt-properties-container' }, [
            createHtmlDL(properties, node)
        ]) as HTMLDivElement

        tooltipContainer.appendChild(mainheaderContent)
        tooltipContainer.appendChild(propertiesContainer)

        const nodeRenderCb = this.uiManager.getOptions().tooltip.renderNodeExtra
        if (nodeRenderCb && typeof nodeRenderCb === 'function') {
            const extraContent = tryResolveHTMLElement(nodeRenderCb, node)
            if (extraContent) {
                const extraContentWrapped = createHtmlElement('div', { class: 'pivotick-extra-content-container' }, [
                    extraContent
                ]) as HTMLDivElement
                tooltipContainer.appendChild(extraContentWrapped)
            }
        }
        return tooltipContainer
    }

    private createNodeTooltip(node: Node) {
        if (!this.tooltip) return false

        this.tooltip.innerHTML = ''

        const tooltipContainer = this.buildNodeTooltip(node)
        this.tooltip.appendChild(tooltipContainer)
    }

    private createEdgeTooltip(edge: Edge) {
        if (!this.tooltip) return false

        this.tooltip.innerHTML = ''

        const fixedPreviewSize = 32
        const template = `
<div class="pvt-tooltip-container">
    <div class="pvt-mainheader-container">
        <div class="pvt-mainheader-nodepreview">
            ${graphEdgeIcon(fixedPreviewSize)}
            <span class="pvt-mainheader-topright"></span>
        </div>
        <div class="pvt-mainheader-nodeinfo">
            <div class="pvt-mainheader-nodeinfo-name"></div>
            <div class="pvt-mainheader-nodeinfo-subtitle"></div>
        </div>
        <div class="pvt-mainheader-nodeinfo-action">
        </div>
    </div>
</div>`
        const tooltipContainer = createHtmlTemplate(template) as HTMLDivElement
        const mainheaderContent = tooltipContainer.querySelector('.pvt-mainheader-container')!
        const nameElem = tooltipContainer.querySelector('.pvt-mainheader-nodeinfo-name')!
        const subtitleElem = tooltipContainer.querySelector('.pvt-mainheader-nodeinfo-subtitle')!
        const toprightElem = tooltipContainer.querySelector('.pvt-mainheader-topright')!
        // const actionElem = tooltipContainer.querySelector('.pvt-mainheader-nodeinfo-action')!

        const pinButton = createButton({
            title: 'Pin Tooltip',
            variant: 'outline-primary',
            size: 'sm',
            class: 'pin-button',
            svgIcon: pin,
            onClick: () => {
                this.pinTooltip()
            },
        })
        toprightElem.appendChild(pinButton)

        const renderCb = this.uiManager.getOptions().tooltip.render
        if (renderCb && typeof renderCb === 'function') {
            const tooltipContent = tryResolveHTMLElement(renderCb, edge)
            if (tooltipContent) {
                const tooltipContentWrapped = createHtmlElement('div', { class: 'pivotick-extra-content-container' }, [
                    tooltipContent
                ]) as HTMLDivElement
                tooltipContainer.appendChild(tooltipContentWrapped)
            }
            this.tooltip.appendChild(tooltipContainer)
            return
        }

        const properties = edgePropertiesGetter(edge, this.uiManager.getOptions().propertiesPanel)

        nameElem.textContent = edgeNameGetter(edge, this.uiManager.getOptions().mainHeader)
        subtitleElem.textContent = edgeDescriptionGetter(edge, this.uiManager.getOptions().mainHeader)

        const propertiesContainer = createHtmlElement('div', { class: 'pvt-properties-container' }, [createHtmlDL(properties, edge)]) as HTMLDivElement

        tooltipContainer.appendChild(mainheaderContent)
        tooltipContainer.appendChild(propertiesContainer)

        const edgeRenderCb = this.uiManager.getOptions().tooltip.renderEdgeExtra
        if (edgeRenderCb && typeof edgeRenderCb === 'function') {
            const extraContent = tryResolveHTMLElement(edgeRenderCb, edge)
            if (extraContent) {
                const extraContentWrapped = createHtmlElement('div', { class: 'pivotick-extra-content-container' }, [
                    extraContent
                ]) as HTMLDivElement
                tooltipContainer.appendChild(extraContentWrapped)
            }
        }
        this.tooltip.appendChild(tooltipContainer)
    }

    private setPosition() {
        if (!this.tooltip) return
        const hoveredBCR = this.hoveredElement?.getGraphElement()?.getBoundingClientRect()
        if (!hoveredBCR) return
        const canvasBbox = this.uiManager.layout?.canvas?.getBoundingClientRect()
        if (!canvasBbox) return

        const setPositionCb = this.uiManager.getOptions().tooltip.setPosition
        if (setPositionCb && typeof setPositionCb === 'function') {
            setPositionCb(this.tooltip, hoveredBCR, canvasBbox)
            return
        }

        const offset = 20 // Extra offset to give more space around the tooltip
        const offsetX = 15 // Offset between the tooltip and the hovered element on the X axis

        const parentX = canvasBbox.left + window.scrollX
        const parentY = canvasBbox.top + window.scrollY
        const parentWidth = canvasBbox.width
        const parentHeight = canvasBbox.height
        const tooltipWidth = this.tooltip.offsetWidth
        const tooltipHeight = this.tooltip.offsetHeight

        this.x = hoveredBCR.x + hoveredBCR.width + offsetX
        this.y = hoveredBCR.y

        // Adjust horizontal position if overflowing
        if (this.x + tooltipWidth + offset > parentX + parentWidth) {
            this.x = hoveredBCR.x - tooltipWidth - offsetX
        }

        // Left overflow
        if (this.x < parentX + offsetX) {
            this.x = parentX + offsetX
        }


        // Adjust vertical position if overflowing
        if (this.y + tooltipHeight + offset > parentY + parentHeight) {
            this.y -= tooltipHeight
        }
        // Adjust vertical position if overflowing top
        if (this.y < parentY + offset) {
            this.y = parentY + offset
        }

        this.tooltip.style.left = `${this.x}px`
        this.tooltip.style.top = `${this.y}px`
    }

    private delayedHide(_event: MouseEvent, node: Node) {
        if (this.hideTimeout) clearTimeout(this.hideTimeout)
        this.hideTimeout = setTimeout(() => this.hide(node), this.hideDelay)
    }

    public hide(node?: Node) {
        if (!this.tooltip) return

        if (this.hideTimeout) clearTimeout(this.hideTimeout)

        if (this.hoveredElement === node || node === undefined) {
            if (this.tooltipTimeout) {
                clearTimeout(this.tooltipTimeout)
                this.tooltipTimeout = null
            }
            this.hoveredElementID = null
            this.hoveredElement = null
            this.triggerX = -2000
            this.triggerY = -2000
            this.tooltip.classList.remove('shown')
            this.tooltip.style.left = '-10000px'
        }
    }

    private show(cb: { (): void; (): void } | undefined) {
        if (this.uiManager.contextMenu?.visible)
            return

        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout)
        }
        this.tooltipTimeout = setTimeout(() => {
            if (cb) cb()
            this.tooltip?.classList.add('shown')
            requestAnimationFrame(() => {
                this.setPosition()
            })
        }, this.showDelay)
    }

    private pinTooltip(): void {
        if (!this.tooltip || !this.parentContainer || !this.hoveredElement) return

        const clonedTooltip = this.tooltip.cloneNode(true) as HTMLDivElement
        this.tooltipDataMap.set(clonedTooltip, this.hoveredElement)

        clonedTooltip.classList.add('pvt-tooltip-floating')

        clonedTooltip.querySelector('.pin-button')?.remove()
        const closeButton = createButton({
            title: 'Close Tooltip',
            variant: 'outline-danger',
            size: 'sm',
            class: ['close-button'],
            svgIcon: closeIcon,
            onClick: () => {
                this.tooltipDataMap.delete(clonedTooltip)
                // this.removeShadowLink(clonedTooltip)
                this.shadowLinkManager?.removeShadowLink(clonedTooltip)
                clonedTooltip.remove()
            },
        })
        const focusElementButton = createButton({
            title: 'Focus Element in Graph',
            variant: 'outline-primary',
            size: 'sm',
            class: ['focus-element'],
            svgIcon: focusElement,
            onClick: () => {
                const element = this.tooltipDataMap.get(clonedTooltip)
                if (element)
                    this.uiManager.graph.focusElement(element)
            },
        })
        const selectElementButton = createButton({
            title: 'Select Element in Graph',
            variant: 'outline-primary',
            size: 'sm',
            class: ['select-element'],
            svgIcon: selectElement,
            onClick: () => {
                const element = this.tooltipDataMap.get(clonedTooltip)
                if (element)
                    this.uiManager.graph.selectElement(element)
            },
        })

        const topbar = createHtmlElement('div', {
            class: 'pvt-tooltip-topbar'
        }, [
            focusElementButton,
            selectElementButton,
            closeButton,
        ]) as HTMLDivElement
        clonedTooltip.prepend(topbar)


        const appBox = this.uiManager.getAppContainer()
        makeDraggable(clonedTooltip, topbar, appBox, {
            onDragStart: (_e: MouseEvent, pinnedTt: HTMLElement) => {
                this.shadowLinkManager?.setBoundingBox(pinnedTt, {
                    source: pinnedTt.getBoundingClientRect(),
                    target: this.tooltipDataMap.get(pinnedTt)!.getGraphElement()!.getBoundingClientRect(),
                })
            },
            onDrag: (_e: MouseEvent, pinnedTt: HTMLElement) => {
                this.shadowLinkManager?.updateShadowLink(pinnedTt)
            }
        })
        this.parentContainer.appendChild(clonedTooltip)
        this.shadowLinkManager?.addShadowLink(clonedTooltip)
    }

    private updateShadowLinks(recalculateBBoxes = false): void {
        for (const [ pinnedTt, element ] of this.tooltipDataMap.entries()) {
            if (recalculateBBoxes) {
                this.shadowLinkManager?.setBoundingBox(pinnedTt, {
                    source: pinnedTt.getBoundingClientRect(),
                    target: element.getGraphElement()!.getBoundingClientRect(),
                })
            }
            this.shadowLinkManager?.updateShadowLink(pinnedTt)
        }
    }

}
