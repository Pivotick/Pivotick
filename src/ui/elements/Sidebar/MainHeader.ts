import { createHtmlTemplate } from '../../../utils/ElementCreation'
import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { EdgeSelection, NodeSelection } from '../../../GraphInteractions'
import type { UIManager } from '../../UIManager'
import './mainHeader.scss'
import { edgeDescriptionGetter, edgeNameGetter, nodeDescriptionGetter, nodeNameGetter } from '../../../utils/GraphGetters'


export class SidebarMainHeader implements UIElement {
    private uiManager: UIManager

    private panel?: HTMLDivElement

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    public mount(rootContainer: HTMLElement | undefined) {
        if (!rootContainer) return

        this.panel = rootContainer as HTMLDivElement
        // const template = '<div></div>'
        // this.panel = createHtmlTemplate(template) as HTMLDivElement

        // rootContainer.appendChild(this.panel)
    }

    public destroy() {
        this.panel?.remove()
        this.panel = undefined
    }

    public afterMount() {
        this.clearOverview()
    }


    public clearOverview(): void {
        if (!this.panel) return

        this.panel.innerHTML = ''
        this.showSelectedNodeCount()
    }

    /* Single selection */
    updateNodeOverview(node: Node, element: unknown): void {
        if (!this.panel) return

        const fixedPreviewSize = 42
        const template = `
<div class="enter-ready">
    <div class="pivotick-mainheader-nodepreview">
        <svg class="pivotick-mainheader-icon" width="${fixedPreviewSize}" height="${fixedPreviewSize}" viewBox="0 0 ${fixedPreviewSize} ${fixedPreviewSize}" preserveAspectRatio="xMidYMid meet"></svg>
    </div>
    <div class="pivotick-mainheader-nodeinfo">
        <div class="pivotick-mainheader-nodeinfo-name"></div>
        <div class="pivotick-mainheader-nodeinfo-subtitle"></div>
    </div>
    <div class="pivotick-mainheader-nodeinfo-action">
    </div>
</div>`
        const mainheaderContent = createHtmlTemplate(template) as HTMLDivElement
        const iconElem = mainheaderContent.querySelector('.pivotick-mainheader-icon')
        const nameElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-name')
        const subtitleElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-subtitle')
        const actionElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-action')

        if (iconElem) {
            if (element && element instanceof SVGGElement) {
                const clonedGroup = element.cloneNode(true) as SVGGElement
                const bbox = element.getBBox()
                const scale = fixedPreviewSize / Math.max(bbox.width, bbox.height)
                clonedGroup.setAttribute(
                    'transform',
                    `translate(${(fixedPreviewSize - bbox.width * scale) / 2 - bbox.x * scale}, ${(fixedPreviewSize - bbox.height * scale) / 2 - bbox.y * scale}) scale(${scale})`
                )
                iconElem.appendChild(clonedGroup)
            }
        }
        if (nameElem) {
            nameElem.innerHTML = nodeNameGetter(node, this.uiManager.getOptions().mainHeader)
        }
        if (subtitleElem) {
            const description = nodeDescriptionGetter(node, this.uiManager.getOptions().mainHeader)
            subtitleElem.innerHTML = description ?? ''
        }

        this.panel.innerHTML = mainheaderContent.outerHTML
        requestAnimationFrame(() => {
            this.panel?.firstElementChild?.classList.add('enter-active')
        })
    }

    updateEdgeOverview(edge: Edge): void {
        if (!this.panel) return

        const fixedPreviewSize = 42
        const template = `<div class="enter-ready">
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
</div>`
        const mainheaderContent = createHtmlTemplate(template) as HTMLDivElement
        const nameElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-name')
        const subtitleElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-subtitle')
        const actionElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-action')

        if (nameElem) {
            nameElem.innerHTML = edgeNameGetter(edge, this.uiManager.getOptions().mainHeader)
        }
        if (subtitleElem) {
            subtitleElem.innerHTML = edgeDescriptionGetter(edge, this.uiManager.getOptions().mainHeader)
        }

        this.panel.innerHTML = mainheaderContent.outerHTML
        requestAnimationFrame(() => {
            this.panel?.firstElementChild?.classList.add('enter-active')
        })
    }

    /* Multi selection */
    public updateNodesOverview(nodes: NodeSelection<unknown>[]): void {
        if (!this.panel) return

        const fixedPreviewSize = 42
        const template = `<div class="enter-ready">
    <div class="pivotick-mainheader-nodepreview">
        <svg class="pivotick-mainheader-icon" width="${fixedPreviewSize}" height="${fixedPreviewSize}" viewBox="0 0 ${fixedPreviewSize} ${fixedPreviewSize}" preserveAspectRatio="xMidYMid meet"></svg>
    </div>
    <div class="pivotick-mainheader-nodeinfo">
        <div class="pivotick-mainheader-nodeinfo-name"></div>
        <div class="pivotick-mainheader-nodeinfo-subtitle"></div>
    </div>
    <div class="pivotick-mainheader-nodeinfo-action">
    </div>
</div>`
        const mainheaderContent = createHtmlTemplate(template) as HTMLDivElement
        const iconElem = mainheaderContent.querySelector('.pivotick-mainheader-icon')
        const nameElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-name')
        const subtitleElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-subtitle')
        const actionElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-action')

        if (iconElem) {
            const selectionIconTemplate = `<svg xmlns="http://www.w3.org/2000/svg" width="${fixedPreviewSize}" height="${fixedPreviewSize}" viewBox="0 0 256 256" ><g fill="currentColor"><path d="M216 40v176H40V40Z" opacity="0.2"/><path d="M152 40a8 8 0 0 1-8 8h-32a8 8 0 0 1 0-16h32a8 8 0 0 1 8 8m-8 168h-32a8 8 0 0 0 0 16h32a8 8 0 0 0 0-16m64-176h-24a8 8 0 0 0 0 16h24v24a8 8 0 0 0 16 0V48a16 16 0 0 0-16-16m8 72a8 8 0 0 0-8 8v32a8 8 0 0 0 16 0v-32a8 8 0 0 0-8-8m0 72a8 8 0 0 0-8 8v24h-24a8 8 0 0 0 0 16h24a16 16 0 0 0 16-16v-24a8 8 0 0 0-8-8M40 152a8 8 0 0 0 8-8v-32a8 8 0 0 0-16 0v32a8 8 0 0 0 8 8m32 56H48v-24a8 8 0 0 0-16 0v24a16 16 0 0 0 16 16h24a8 8 0 0 0 0-16m0-176H48a16 16 0 0 0-16 16v24a8 8 0 0 0 16 0V48h24a8 8 0 0 0 0-16"/></g></svg>`
            const selectionIcon = createHtmlTemplate(selectionIconTemplate) as HTMLElement
            iconElem.appendChild(selectionIcon)
        }
        if (nameElem) {
            nameElem.innerHTML = `${nodes.length} nodes selected`
        }
        if (subtitleElem) {
            subtitleElem.innerHTML = `Out of ${this.uiManager.graph.getNodeCount()} total`
        }

        this.panel.innerHTML = mainheaderContent.outerHTML
        requestAnimationFrame(() => {
            this.panel?.firstElementChild?.classList.add('enter-active')
        })
    }

    public updateEdgesOverview(edges: EdgeSelection<unknown>[]): void {
        if (!this.panel) return

        const fixedPreviewSize = 42
        const template = `<div class="enter-ready">
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
</div>`
        const mainheaderContent = createHtmlTemplate(template) as HTMLDivElement
        const nameElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-name')
        const subtitleElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-subtitle')
        const actionElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-action')

        if (nameElem) {
            nameElem.innerHTML = `${edges.length} edges selected`
        }
        if (subtitleElem) {
            subtitleElem.innerHTML = `Out of ${this.uiManager.graph.getEdgeCount() } total`
        }

        this.panel.innerHTML = mainheaderContent.outerHTML
        requestAnimationFrame(() => {
            this.panel?.firstElementChild?.classList.add('enter-active')
        })
    }


    /* Private methods */
    private showSelectedNodeCount(): void {
        if (!this.panel) return
        const selectedNodeCount = 0
        this.panel.innerHTML = `Total selected nodes ${selectedNodeCount}`
    }

}
