import type { Edge } from '../../../Edge'
import type { PropertyEntry } from '../../../GraphOptions'
import type { Node } from '../../../Node'
import { createHtmlDL, createHtmlElement, createHtmlTemplate, generateDomId, makeDraggable } from '../../../utils/ElementCreation'
import { edgeDescriptionGetter, edgeNameGetter, edgePropertiesGetter, nodeDescriptionGetter, nodeNameGetter, nodePropertiesGetter } from '../../../utils/GraphGetters'
import { createButton } from '../../components/Button'
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
    private hoveredElementID: string | null = null
    private hoveredElement: Node | Edge | null = null
    private showDelay: number = 200
    private hideDelay: number = 1
    private tooltipTimeout: ReturnType<typeof setTimeout> | null = null
    private hideTimeout: ReturnType<typeof setTimeout> | null = null

    private tooltipDataMap = new WeakMap<HTMLElement, Node | Edge>()

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
        this.uiManager.graph.renderer.getGraphInteraction().on('nodeHoverOut', () => { this.delayedHide() })
        this.uiManager.graph.renderer.getGraphInteraction().on('edgeHoverIn', this.edgeHovered.bind(this))
        this.uiManager.graph.renderer.getGraphInteraction().on('edgeHoverOut', () => { this.delayedHide() })
        this.uiManager.graph.renderer.getGraphInteraction().on('canvasMousemove', this.updateMousePosition.bind(this))
        this.uiManager.graph.renderer.getGraphInteraction().on('dragging', (_event: MouseEvent, node: Node) => {
            if (this.hoveredElementID === node.id) {
                this.hide()
            }
        })

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

    public nodeHovered(_event: MouseEvent, node: Node) {
        if (!this.tooltip) return
        if (this.uiManager.graph.simulation.isDragging()) return
        if (this.hoveredElementID === node.id) return

        this.hoveredElementID = node.id
        this.hoveredElement = node
        this.show(() => {
            this.createNodeTooltip(node)
        })
    }

    public edgeHovered(_event: MouseEvent, edge: Edge) {
        if (!this.tooltip) return
        if (this.hoveredElementID === edge.id) return

        this.hoveredElementID = edge.id
        this.hoveredElement = edge
        this.show(() => {
            if (this.uiManager.graph.simulation.isDragging()) {
                this.hide()
                return
            }

            this.createEdgeTooltip(edge)
        })
    }

    private createNodeTooltip(node: Node) {
        this.tooltip!.innerHTML = ''

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

        nameElem.innerHTML = nodeNameGetter(node, this.uiManager.getOptions().mainHeader)
        subtitleElem.innerHTML = nodeDescriptionGetter(node, this.uiManager.getOptions().mainHeader)

        const pinButton = createButton({
            title: 'Pin Tooltip',
            variant: 'outline-primary',
            size: 'sm',
            class: 'pin-button',
            svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m15.113 3.21l.094.083l5.5 5.5a1 1 0 0 1-1.175 1.59l-3.172 3.171l-1.424 3.797a1 1 0 0 1-.158.277l-.07.08l-1.5 1.5a1 1 0 0 1-1.32.082l-.095-.083L9 16.415l-3.793 3.792a1 1 0 0 1-1.497-1.32l.083-.094L7.585 15l-2.792-2.793a1 1 0 0 1-.083-1.32l.083-.094l1.5-1.5a1 1 0 0 1 .258-.187l.098-.042l3.796-1.425l3.171-3.17a1 1 0 0 1 1.497-1.26z"/></svg>',
            onClick: (evt) => {
                this.pinTooltip()
            },
        })
        toprightElem.appendChild(pinButton)

        const propertiesContainer = createHtmlElement('div', { class: 'pivotick-properties-container'}, [createHtmlDL(properties)]) as HTMLDivElement

        tooltipContainer.appendChild(mainheaderContent)
        tooltipContainer.appendChild(propertiesContainer)
        this.tooltip!.appendChild(tooltipContainer)
    }

    private createEdgeTooltip(edge: Edge) {
        this.tooltip!.innerHTML = ''

        const fixedPreviewSize = 32
        const template = `
<div class="pivotick-tooltip-container">
    <div class="pivotick-mainheader-container">
        <div class="pivotick-mainheader-nodepreview">
            <svg xmlns="http://www.w3.org/2000/svg" width="${fixedPreviewSize}" height="${fixedPreviewSize}" viewBox="0 0 24 24" style="filter: drop-shadow(0px 2px 1px #00000033);">
                <g fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linejoin="round" d="M8 6h1.78c2.017 0 3.025 0 3.534.241a2.5 2.5 0 0 1 1.211 3.276c-.229.515-.994 1.17-2.525 2.483c-1.53 1.312-2.296 1.968-2.525 2.483a2.5 2.5 0 0 0 1.211 3.276c.51.241 1.517.241 3.534.241H16" />
                    <path d="M2 6a3 3 0 1 0 6 0a3 3 0 0 0-6 0Zm14 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0Z" />
                </g>
            </svg>
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
        const actionElem = tooltipContainer.querySelector('.pivotick-mainheader-nodeinfo-action')!

        const properties = edgePropertiesGetter(edge, this.uiManager.getOptions().propertiesPanel)

        nameElem.innerHTML = edgeNameGetter(edge, this.uiManager.getOptions().mainHeader)
        subtitleElem.innerHTML = edgeDescriptionGetter(edge, this.uiManager.getOptions().mainHeader)

        const propertiesContainer = createHtmlElement('div', { class: 'pivotick-properties-container' }, [createHtmlDL(properties)]) as HTMLDivElement

        tooltipContainer.appendChild(mainheaderContent)
        tooltipContainer.appendChild(propertiesContainer)
        this.tooltip!.appendChild(tooltipContainer)
    }

    private setPosition() {
        if (!this.tooltip) return

        const mouseOffset = 10
        const offset =  mouseOffset + 20 // Extra offset to give more space around the tooltip
        this.x = this.mouseX
        this.y = this.mouseY

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

    private hide() {
        if (!this.tooltip) return

        if (this.hideTimeout) clearTimeout(this.hideTimeout)
        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout)
            this.tooltipTimeout = null
        }
        this.hoveredElementID = null
        this.hoveredElement = null
        this.tooltip.classList.remove('shown')
        this.tooltip.style.left = '-10000px'
    }

    private show(cb: { (): void; (): void } | undefined) {
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
            svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="m7 7l10 10M7 17L17 7"/></svg>',
            onClick: () => {
                clonedTooltip.remove()
            },
        })
        const focusElementButton = createButton({
            title: 'Focus Element in Graph',
            variant: 'outline-primary',
            size: 'sm',
            class: ['focus-element'],
            svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><defs><mask id="SVGhUb5Xdyy"><g fill="none"><path stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M16 6H8a2 2 0 0 0-2 2v8m10 26H8a2 2 0 0 1-2-2v-8m26 10h8a2 2 0 0 0 2-2v-8M32 6h8a2 2 0 0 1 2 2v8"/><rect width="20" height="20" x="14" y="14" fill="#fff" stroke="#fff" stroke-width="4" rx="10"/><circle r="3" fill="#000" transform="matrix(-1 0 0 1 24 24)"/></g></mask></defs><path fill="currentColor" d="M0 0h48v48H0z" mask="url(#SVGhUb5Xdyy)"/></svg>',
            onClick: () => {
                const element = this.tooltipDataMap.get(clonedTooltip)
                if (element)
                    this.uiManager.graph.focusElement(element)
            },
        })
        const selectElementButton = createButton({
            title: 'Focus Element in Graph',
            variant: 'outline-primary',
            size: 'sm',
            class: ['select-element'],
            svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="${fixedPreviewSize}" height="${fixedPreviewSize}" viewBox="0 0 256 256" ><g fill="currentColor"><path d="M216 40v176H40V40Z" opacity="0.2"/><path d="M152 40a8 8 0 0 1-8 8h-32a8 8 0 0 1 0-16h32a8 8 0 0 1 8 8m-8 168h-32a8 8 0 0 0 0 16h32a8 8 0 0 0 0-16m64-176h-24a8 8 0 0 0 0 16h24v24a8 8 0 0 0 16 0V48a16 16 0 0 0-16-16m8 72a8 8 0 0 0-8 8v32a8 8 0 0 0 16 0v-32a8 8 0 0 0-8-8m0 72a8 8 0 0 0-8 8v24h-24a8 8 0 0 0 0 16h24a16 16 0 0 0 16-16v-24a8 8 0 0 0-8-8M40 152a8 8 0 0 0 8-8v-32a8 8 0 0 0-16 0v32a8 8 0 0 0 8 8m32 56H48v-24a8 8 0 0 0-16 0v24a16 16 0 0 0 16 16h24a8 8 0 0 0 0-16m0-176H48a16 16 0 0 0-16 16v24a8 8 0 0 0 16 0V48h24a8 8 0 0 0 0-16"/></g></svg>',
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


        makeDraggable(clonedTooltip, topbar)
        this.parentContainer.appendChild(clonedTooltip)
    }
}
