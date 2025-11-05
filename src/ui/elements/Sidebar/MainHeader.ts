import { createHtmlTemplate } from '../../../utils/ElementCreation'
import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { EdgeSelection, NodeSelection } from '../../../GraphInteractions'
import type { UIElement, UIManager } from '../../UIManager'
import './mainHeader.scss'
import { edgeDescriptionGetter, edgeNameGetter, nodeDescriptionGetter, nodeNameGetter } from '../../../utils/GraphGetters'
import { graphEdgeIcon, graphMultiSelectNode } from '../../icons'


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

    public graphReady(): void { }


    public clearOverview(): void {
        if (!this.panel) return

        this.panel.innerHTML = ''
        this.showSelectedNodeCount()
    }

    /* Single selection */
    updateNodeOverview(node: Node, element: unknown): void {
        if (!this.panel) return

        this.panel.innerHTML = ''
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
        // const _actionElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-action')

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
            nameElem.textContent = nodeNameGetter(node, this.uiManager.getOptions().mainHeader)
        }
        if (subtitleElem) {
            const description = nodeDescriptionGetter(node, this.uiManager.getOptions().mainHeader)
            subtitleElem.textContent = description ?? ''
        }

        this.panel.appendChild(mainheaderContent)
        requestAnimationFrame(() => {
            this.panel?.firstElementChild?.classList.add('enter-active')
        })
    }

    updateEdgeOverview(edge: Edge): void {
        if (!this.panel) return

        this.panel.innerHTML = ''
        const fixedPreviewSize = 42
        const template = `<div class="enter-ready">
<div class="pivotick-mainheader-nodepreview">
    ${graphEdgeIcon(fixedPreviewSize)}
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
        // const actionElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-action')

        if (nameElem) {
            nameElem.textContent = edgeNameGetter(edge, this.uiManager.getOptions().mainHeader)
        }
        if (subtitleElem) {
            subtitleElem.textContent = edgeDescriptionGetter(edge, this.uiManager.getOptions().mainHeader)
        }

        this.panel.appendChild(mainheaderContent)
        requestAnimationFrame(() => {
            this.panel?.firstElementChild?.classList.add('enter-active')
        })
    }

    /* Multi selection */
    public updateNodesOverview(nodes: NodeSelection<unknown>[]): void {
        if (!this.panel) return

        this.panel.innerHTML = ''
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
        // const actionElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-action')

        if (iconElem) {
            const selectionIconTemplate = graphMultiSelectNode(fixedPreviewSize)
            const selectionIcon = createHtmlTemplate(selectionIconTemplate) as HTMLElement
            iconElem.appendChild(selectionIcon)
        }
        if (nameElem) {
            nameElem.textContent = `${nodes.length} nodes selected`
        }
        if (subtitleElem) {
            subtitleElem.textContent = `Out of ${this.uiManager.graph.getNodeCount()} total`
        }

        this.panel.appendChild(mainheaderContent)
        requestAnimationFrame(() => {
            this.panel?.firstElementChild?.classList.add('enter-active')
        })
    }

    public updateEdgesOverview(edges: EdgeSelection<unknown>[]): void {
        if (!this.panel) return

        this.panel.innerHTML = ''
        const fixedPreviewSize = 42
        const template = `<div class="enter-ready">
<div class="pivotick-mainheader-nodepreview">
    ${graphEdgeIcon(fixedPreviewSize)}
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
        // const actionElem = mainheaderContent.querySelector('.pivotick-mainheader-nodeinfo-action')

        if (nameElem) {
            nameElem.textContent = `${edges.length} edges selected`
        }
        if (subtitleElem) {
            subtitleElem.textContent = `Out of ${this.uiManager.graph.getEdgeCount() } total`
        }

        this.panel.appendChild(mainheaderContent)
        requestAnimationFrame(() => {
            this.panel?.firstElementChild?.classList.add('enter-active')
        })
    }


    /* Private methods */
    private showSelectedNodeCount(): void {
        if (!this.panel) return
        const selectedNodeCount = 0
        this.panel.textContent = `Total selected nodes ${selectedNodeCount}`
    }

}
