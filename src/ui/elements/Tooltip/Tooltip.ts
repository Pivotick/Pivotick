import type { Edge } from '../../../Edge'
import type { PropertyEntry } from '../../../GraphOptions'
import type { Node } from '../../../Node'
import { createHtmlDL, createHtmlElement, createHtmlTemplate, createSvgElement, generateDomId, makeDraggable } from '../../../utils/ElementCreation'
import { tryResolveHTMLElement } from '../../../utils/Getters'
import { edgeDescriptionGetter, edgeNameGetter, edgePropertiesGetter, nodeDescriptionGetter, nodeNameGetter, nodePropertiesGetter } from '../../../utils/GraphGetters'
import { createButton } from '../../components/Button'
import { graphEdgeIcon, pin, closeIcon, selectElement, focusElement } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './tooltip.scss'


export class Tooltip implements UIElement {
    private uiManager: UIManager

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
    private showDelay: number = 350
    private hideDelay: number = 200
    private tooltipTimeout: ReturnType<typeof setTimeout> | null = null
    private hideTimeout: ReturnType<typeof setTimeout> | null = null

    private tooltipDataMap = new Map<HTMLElement, Node | Edge>()
    private shadowlinkMap = new WeakMap<HTMLElement, SVGPathElement>()

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    public mount(container: HTMLElement | undefined) {
        if (!container) return

        this.parentContainer = document.querySelector('body')!
        const template = document.createElement('template')
        template.innerHTML = '<div class="pivotick-tooltip"></div>'
        this.tooltip = template.content.firstElementChild as HTMLDivElement

        this.shadowLinkContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        this.shadowLinkContainer.setAttribute('class', 'pivotick-shadowlink-container')

        this.parentContainer.appendChild(this.tooltip)
        this.parentContainer.appendChild(this.shadowLinkContainer)
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
        this.uiManager.graph.renderer.getGraphInteraction().on('nodeHoverOut', () => { this.delayedHide() })
        // this.uiManager.graph.renderer.getGraphInteraction().on('edgeHoverIn', this.edgeHovered.bind(this))
        // this.uiManager.graph.renderer.getGraphInteraction().on('edgeHoverOut', () => { this.delayedHide() })
        this.uiManager.graph.renderer.getGraphInteraction().on('canvasMousemove', this.updateMousePosition.bind(this))
        this.uiManager.graph.renderer.getGraphInteraction().on('dragging', (_event: MouseEvent, node: Node) => {
            if (this.hoveredElementID === node.id) {
                this.hide()
            }
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('canvasZoom', this.canvasZoomed.bind(this))

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
        if (this.uiManager.graph.renderer.getSelectionBox().selectionInProgress()) return false
        if (
            Math.abs(this.triggerX - this.mouseX) >= 50 &&
            Math.abs(this.triggerY - this.mouseY) >= 50
        ) {
            console.log('here');
            
            return false  // Since tooltip display is delayed, make sure the pointer is still close to where it should be
        }
        return true
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
        this.updateShadowLinks()
    }

    private createNodeTooltip(node: Node) {
        if (!this.tooltip) return false

        this.tooltip.innerHTML = ''

        const fixedPreviewSize = 32
        const template = `
<div class="pivotick-tooltip-container">
    <div class="pivotick-mainheader-container">
        <div class="pivotick-mainheader-nodepreview">
            <svg class="pivotick-mainheader-icon" width="${fixedPreviewSize}" height="${fixedPreviewSize}" viewBox="0 0 ${fixedPreviewSize} ${fixedPreviewSize}" preserveAspectRatio="xMidYMid meet"></svg>
            <span class="pivotick-mainheader-topright"></span>
        </div>
        <div class="pivotick-mainheader-nodeinfo">
            <div class="pivotick-mainheader-nodeinfo-name"></div>
            <div class="pivotick-mainheader-nodeinfo-subtitle"></div>
        </div>
        <div class="pivotick-mainheader-nodeinfo-action">
        </div>
    </div>
</div>`
        const tooltipContainer = createHtmlTemplate(template) as HTMLDivElement
        const mainheaderContent = tooltipContainer.querySelector('.pivotick-mainheader-container')!
        const iconElem = tooltipContainer.querySelector('.pivotick-mainheader-icon')!
        const nameElem = tooltipContainer.querySelector('.pivotick-mainheader-nodeinfo-name')!
        const subtitleElem = tooltipContainer.querySelector('.pivotick-mainheader-nodeinfo-subtitle')!
        const toprightElem = tooltipContainer.querySelector('.pivotick-mainheader-topright')!
        const actionElem = tooltipContainer.querySelector('.pivotick-mainheader-nodeinfo-action')!

        const properties = nodePropertiesGetter(node, this.uiManager.getOptions().propertiesPanel)

        const element = node.getGraphElement()
        if (element && element instanceof SVGGElement) {
            const clonedGroup = element.cloneNode(true) as SVGGElement
            clonedGroup.querySelector('circle.pivotick-node-selected-highlight')?.remove()
            const bbox = element.getBBox()
            const scale = fixedPreviewSize / Math.max(bbox.width, bbox.height)
            clonedGroup.setAttribute(
                'transform',
                `translate(${(fixedPreviewSize - bbox.width * scale) / 2 - bbox.x * scale}, ${(fixedPreviewSize - bbox.height * scale) / 2 - bbox.y * scale}) scale(${scale})`
            )
            iconElem.appendChild(clonedGroup)
        }

        nameElem.textContent = nodeNameGetter(node, this.uiManager.getOptions().mainHeader)
        subtitleElem.textContent = nodeDescriptionGetter(node, this.uiManager.getOptions().mainHeader)

        const pinButton = createButton({
            title: 'Pin Tooltip',
            variant: 'outline-primary',
            size: 'sm',
            class: 'pin-button',
            svgIcon: pin,
            onClick: (evt) => {
                this.pinTooltip()
            },
        })
        toprightElem.appendChild(pinButton)

        const renderCb = this.uiManager.getOptions().tooltip.render
        if (renderCb && typeof renderCb === 'function') {
            const tooltipContent = tryResolveHTMLElement(renderCb, node)
            if (tooltipContent) {
                const tooltipContentWrapped = createHtmlElement('div', { class: 'pivotick-extra-content-container' }, [
                    tooltipContent
                ]) as HTMLDivElement
                tooltipContainer.appendChild(tooltipContentWrapped)
            }
            this.tooltip.appendChild(tooltipContainer)
            return
        }

        const propertiesContainer = createHtmlElement('div', { class: 'pivotick-properties-container'}, [
            createHtmlDL(properties, node)
        ]) as HTMLDivElement

        tooltipContainer.appendChild(mainheaderContent)
        tooltipContainer.appendChild(propertiesContainer)

        const nodeRenderCb = this.uiManager.getOptions().tooltip.node
        if (nodeRenderCb && typeof nodeRenderCb === 'function') {
            const extraContent = tryResolveHTMLElement(nodeRenderCb, node)
            if (extraContent) {
                const extraContentWrapped = createHtmlElement('div', { class: 'pivotick-extra-content-container' }, [
                    extraContent
                ]) as HTMLDivElement
                tooltipContainer.appendChild(extraContentWrapped)
            }
        }
        this.tooltip.appendChild(tooltipContainer)
    }

    private createEdgeTooltip(edge: Edge) {
        if (!this.tooltip) return false

        this.tooltip.innerHTML = ''

        const fixedPreviewSize = 32
        const template = `
<div class="pivotick-tooltip-container">
    <div class="pivotick-mainheader-container">
        <div class="pivotick-mainheader-nodepreview">
            ${graphEdgeIcon(fixedPreviewSize)}
            <span class="pivotick-mainheader-topright"></span>
        </div>
        <div class="pivotick-mainheader-nodeinfo">
            <div class="pivotick-mainheader-nodeinfo-name"></div>
            <div class="pivotick-mainheader-nodeinfo-subtitle"></div>
        </div>
        <div class="pivotick-mainheader-nodeinfo-action">
        </div>
    </div>
</div>`
        const tooltipContainer = createHtmlTemplate(template) as HTMLDivElement
        const mainheaderContent = tooltipContainer.querySelector('.pivotick-mainheader-container')!
        const nameElem = tooltipContainer.querySelector('.pivotick-mainheader-nodeinfo-name')!
        const subtitleElem = tooltipContainer.querySelector('.pivotick-mainheader-nodeinfo-subtitle')!
        const toprightElem = tooltipContainer.querySelector('.pivotick-mainheader-topright')!
        const actionElem = tooltipContainer.querySelector('.pivotick-mainheader-nodeinfo-action')!

        const pinButton = createButton({
            title: 'Pin Tooltip',
            variant: 'outline-primary',
            size: 'sm',
            class: 'pin-button',
            svgIcon: pin,
            onClick: (evt) => {
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

        const propertiesContainer = createHtmlElement('div', { class: 'pivotick-properties-container' }, [createHtmlDL(properties, edge)]) as HTMLDivElement

        tooltipContainer.appendChild(mainheaderContent)
        tooltipContainer.appendChild(propertiesContainer)

        const edgeRenderCb = this.uiManager.getOptions().tooltip.edge
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

        const mouseOffset = 0
        const offset =  mouseOffset + 20 // Extra offset to give more space around the tooltip
        this.x = this.triggerX
        this.y = this.triggerY

        const bbox = this.parentContainer?.getBoundingClientRect()
        if (!bbox) return
        const parentX = bbox.left + window.scrollX
        const parentY = bbox.top + window.scrollY
        const parentWidth = bbox.width
        const parentHeight = bbox.height
        const tooltipWidth = this.tooltip.offsetWidth
        const tooltipHeight = this.tooltip.offsetHeight

        // Adjust horizontal position if overflowing
        if (this.x + tooltipWidth + offset > parentX + parentWidth) {
            this.x -= tooltipWidth + mouseOffset
        }

        // Adjust vertical position if overflowing
        if (this.y + tooltipHeight + offset > parentY + parentHeight) {
            this.y -= tooltipHeight + mouseOffset
        }

        this.tooltip.style.left = `${this.x + mouseOffset}px`
        this.tooltip.style.top = `${this.y + mouseOffset}px`
    }

    private delayedHide() {
        if (this.hideTimeout) clearTimeout(this.hideTimeout)
        this.hideTimeout = setTimeout(() => this.hide(), this.hideDelay)
    }

    public hide() {
        if (!this.tooltip) return

        if (this.hideTimeout) clearTimeout(this.hideTimeout)
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

    public show(cb: { (): void; (): void } | undefined) {
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

        clonedTooltip.classList.add('pivotick-tooltip-floating')

        clonedTooltip.querySelector('.pin-button')?.remove()
        const closeButton = createButton({
            title: 'Close Tooltip',
            variant: 'outline-danger',
            size: 'sm',
            class: ['close-button'],
            svgIcon: closeIcon,
            onClick: () => {
                this.tooltipDataMap.delete(clonedTooltip)
                this.reomveShadowLink(clonedTooltip)
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
            class: 'pivotick-tooltip-topbar'
        }, [
            focusElementButton,
            selectElementButton,
            closeButton,
        ]) as HTMLDivElement
        clonedTooltip.prepend(topbar)


        makeDraggable(clonedTooltip, topbar, () => {
            this.updateShadowLinks()
        })
        this.parentContainer.appendChild(clonedTooltip)
        this.addShadowLink(clonedTooltip)
    }

    private addShadowLink(pinnedTt: HTMLElement) {
        const shadowLink = createSvgElement('path', {
            class: 'pivotick-shadowlink',
        })
        this.shadowlinkMap.set(pinnedTt, shadowLink)
        this.shadowLinkContainer?.appendChild(shadowLink)
    }

    private updateShadowLinks(): void {
        for (const [ pinnedTt, element ] of this.tooltipDataMap.entries()) {
            this.updateShadowLink(pinnedTt, element)
        }
    }

    private updateShadowLink(pinnedTt: HTMLElement, element: Node | Edge) {
        const { x: ttx, y: tty, width: ttWidth, height: ttHeight } = pinnedTt.getBoundingClientRect()
        const { x: nx, y: ny, width: nWidth, height: nHeight } = element.getGraphElement()!.getBoundingClientRect()
        const shadowLink = this.shadowlinkMap.get(pinnedTt)

        if (!shadowLink) return
        shadowLink.setAttribute('d', `M ${ttx + ttWidth / 2} ${tty + ttHeight / 2} L ${nx + nWidth / 2} ${ny + nHeight / 2}`)
    }

    private reomveShadowLink(pinnedTt: HTMLElement) {
        const shadowLink = this.shadowlinkMap.get(pinnedTt)
        if (!shadowLink) return
        shadowLink.remove()
    }
}
