import { createHtmlTemplate } from '../../../utils/ElementCreation'
import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import './mainHeader.scss'
import { edgeDescriptionGetter, edgeNameGetter, nodeDescriptionGetter, nodeNameGetter } from '../../../utils/GraphGetters'
import { graphEdgeIcon, graphMultiSelectNode } from '../../icons'
import type { EdgeSelection, NodeSelection } from '../../../interfaces/GraphInteractions'
import { tryResolveHTMLElement } from '../../../utils/Getters'
import { createNodePreview } from '../../../utils/NodePreview'
import { TitleFitController } from './titleFit'


export class SidebarMainHeader extends UIComponent {

    private panel?: HTMLDivElement
    private renderCb?: ((element: Node | Edge | Node[] | Edge[] | null) => HTMLElement | string) | HTMLElement | string

    // Re-fits the current title whenever the sidebar width changes.
    private titleFit?: TitleFitController

    constructor(uiManager: UIManager) {
        super(uiManager)
        this.renderCb = typeof this.uiManager.getOptions().mainHeader.render === 'function' ? this.uiManager.getOptions().mainHeader.render : undefined
    }

    protected onMount(rootContainer: HTMLElement | undefined) {
        if (!rootContainer) return

        this.panel = rootContainer as HTMLDivElement

        // The title fit depends on the panel width; recompute it on resize
        // (sidebar collapse/expand, responsive layout) rather than only on select.
        this.titleFit = new TitleFitController(this.panel)
        this.track(() => this.titleFit?.destroy())
    }

    protected onDestroy() {
        this.panel?.remove()
        this.panel = undefined
    }

    protected onAfterMount() {
        this.clearOverview()
    }

    protected onGraphReady() {
        this.clearOverview()
    }

    private renderCustomContent(element: Node | Edge | Node[] | Edge[] | null) {
        if (!this.panel || !this.renderCb) return

        this.panel.innerHTML = ''
        const content = tryResolveHTMLElement(this.renderCb, element)
        if (content) {
            this.panel?.appendChild(content)
        }
    }

    public clearOverview(): void {
        if (!this.panel) return

        this.titleFit?.clear()

        if (this.renderCb) {
            this.renderCustomContent(null)
            return
        }

        this.panel.innerHTML = ''
        this.showTotalNodeCount()
    }

    /* Single selection */
    updateNodeOverview(node: Node, element: unknown): void {
        if (!this.panel) return

        if (this.renderCb) {
            this.renderCustomContent(node)
            return
        }

        this.panel.innerHTML = ''
        const fixedPreviewSize = 42
        const template = `
<div class="enter-ready">
    <div class="pvt-mainheader-nodepreview"></div>
    <div class="pvt-mainheader-nodeinfo">
        <div class="pvt-mainheader-nodeinfo-name"></div>
        <div class="pvt-mainheader-nodeinfo-subtitle"></div>
    </div>
    <div class="pvt-mainheader-nodeinfo-action">
    </div>
</div>`
        const mainheaderContent = createHtmlTemplate(template) as HTMLDivElement
        const previewElem = mainheaderContent.querySelector('.pvt-mainheader-nodepreview')
        const nameElem = mainheaderContent.querySelector('.pvt-mainheader-nodeinfo-name')
        const subtitleElem = mainheaderContent.querySelector('.pvt-mainheader-nodeinfo-subtitle')
        const actionElem = mainheaderContent.querySelector('.pvt-mainheader-nodeinfo-action')

        previewElem?.appendChild(createNodePreview(element instanceof SVGGElement ? element : node, { size: fixedPreviewSize }))
        if (nameElem) {
            this.renderTitle(
                nameElem as HTMLElement,
                actionElem as HTMLElement | null,
                nodeNameGetter(node, this.uiManager.getOptions().mainHeader)
            )
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

        if (this.renderCb) {
            this.renderCustomContent(edge)
            return
        }

        this.panel.innerHTML = ''
        const fixedPreviewSize = 42
        const template = `<div class="enter-ready">
<div class="pvt-mainheader-nodepreview">
    ${graphEdgeIcon(fixedPreviewSize)}
</div>
<div class="pvt-mainheader-nodeinfo">
    <div class="pvt-mainheader-nodeinfo-name"></div>
    <div class="pvt-mainheader-nodeinfo-subtitle"></div>
</div>
<div class="pvt-mainheader-nodeinfo-action">
</div>
</div>`
        const mainheaderContent = createHtmlTemplate(template) as HTMLDivElement
        const nameElem = mainheaderContent.querySelector('.pvt-mainheader-nodeinfo-name')
        const subtitleElem = mainheaderContent.querySelector('.pvt-mainheader-nodeinfo-subtitle')
        const actionElem = mainheaderContent.querySelector('.pvt-mainheader-nodeinfo-action')

        if (nameElem) {
            this.renderTitle(
                nameElem as HTMLElement,
                actionElem as HTMLElement | null,
                edgeNameGetter(edge, this.uiManager.getOptions().mainHeader)
            )
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

        this.titleFit?.clear()

        if (this.renderCb) {
            this.renderCustomContent(nodes.map((nodeS: NodeSelection<unknown>) => nodeS.node))
            return
        }

        this.panel.innerHTML = ''
        const fixedPreviewSize = 42
        const template = `<div class="enter-ready">
    <div class="pvt-mainheader-nodepreview">
        <svg class="pvt-node-preview-icon" width="${fixedPreviewSize}" height="${fixedPreviewSize}" viewBox="0 0 ${fixedPreviewSize} ${fixedPreviewSize}" preserveAspectRatio="xMidYMid meet"></svg>
    </div>
    <div class="pvt-mainheader-nodeinfo">
        <div class="pvt-mainheader-nodeinfo-name"></div>
        <div class="pvt-mainheader-nodeinfo-subtitle"></div>
    </div>
    <div class="pvt-mainheader-nodeinfo-action">
    </div>
</div>`
        const mainheaderContent = createHtmlTemplate(template) as HTMLDivElement
        const iconElem = mainheaderContent.querySelector('.pvt-node-preview-icon')
        const nameElem = mainheaderContent.querySelector('.pvt-mainheader-nodeinfo-name')
        const subtitleElem = mainheaderContent.querySelector('.pvt-mainheader-nodeinfo-subtitle')
        // const actionElem = mainheaderContent.querySelector('.pvt-mainheader-nodeinfo-action')

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

        this.titleFit?.clear()

        if (this.renderCb) {
            this.renderCustomContent(edges.map((nodeS: EdgeSelection<unknown>) => nodeS.edge))
            return
        }

        this.panel.innerHTML = ''
        const fixedPreviewSize = 42
        const template = `<div class="enter-ready">
<div class="pvt-mainheader-nodepreview">
    ${graphEdgeIcon(fixedPreviewSize)}
</div>
<div class="pvt-mainheader-nodeinfo">
    <div class="pvt-mainheader-nodeinfo-name"></div>
    <div class="pvt-mainheader-nodeinfo-subtitle"></div>
</div>
<div class="pvt-mainheader-nodeinfo-action">
</div>
</div>`
        const mainheaderContent = createHtmlTemplate(template) as HTMLDivElement
        const nameElem = mainheaderContent.querySelector('.pvt-mainheader-nodeinfo-name')
        const subtitleElem = mainheaderContent.querySelector('.pvt-mainheader-nodeinfo-subtitle')
        // const actionElem = mainheaderContent.querySelector('.pvt-mainheader-nodeinfo-action')

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


    /* Title rendering */

    /**
     * Render a (possibly long) entity title into the header name slot.
     *
     * Strategy: first try to **auto-fit** — shrink the font from 16px down to
     * 12px so the whole title fits across up to two lines. If it still doesn't
     * fit at the floor size, fall back to a **type-aware** treatment: prose
     * titles get a clean two-line clamp with an ellipsis; identifier-like titles
     * (ids, URLs, hashes) get a monospace, middle-elided form (`abc…xyz`, both
     * ends kept) plus a copy button, since middle-elision replaces the text.
     */
    private renderTitle(nameElem: HTMLElement, actionElem: HTMLElement | null, text: string): void {
        this.titleFit?.render(nameElem, actionElem, text)
    }

    /* Private methods */
    private showTotalNodeCount(): void {
        if (!this.panel) return
        const totalNodeCount = this.uiManager.graph.getMutableVisibleNodes().length
        const totalEdgeCount = this.uiManager.graph.getMutableVisibleEdges().length
        this.panel.textContent = `Showing ${totalNodeCount} nodes and ${totalEdgeCount} edges`
    }

}
