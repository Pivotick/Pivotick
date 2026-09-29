import { createHtmlTemplate } from '../../../utils/ElementCreation'
import type { GroupNode } from '../../../Simplification/GroupNode'
import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import './mainHeader.scss'
import { edgeDescriptionGetter, edgeNameGetter, nodeDescriptionGetter, nodeNameGetter } from '../../../utils/GraphGetters'
import { graphEdgeIcon, graphMultiSelectNode } from '../../icons'
import type { EdgeSelection, NodeSelection } from '../../../interfaces/GraphInteractions'
import { createNodePreview } from '../../../utils/NodePreview'
import { TitleFitController } from './titleFit'
import { AsyncRenderScope } from '../../../utils/AsyncRender'
import { toRenderedElement } from '../../../utils/Getters'
import type { MainHeader as MainHeaderOptions } from '../../../interfaces/GraphUI'


export class SidebarMainHeader extends UIComponent {

    private panel?: HTMLDivElement
    private renderCb?: MainHeaderOptions['render']

    // Re-fits the current title whenever the sidebar width changes.
    private titleFit?: TitleFitController

    // Placeholder / staleness for an async `render`; superseded on every selection.
    private readonly renderScope: AsyncRenderScope

    constructor(uiManager: UIManager) {
        super(uiManager)
        this.renderCb = typeof this.uiManager.getOptions().mainHeader.render === 'function' ? this.uiManager.getOptions().mainHeader.render : undefined
        this.renderScope = new AsyncRenderScope('mainHeader', () => this.uiManager.getOptions().asyncContent)
        this.track(() => this.renderScope.supersede())
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
        // The count is read when shown, so it has to be read again whenever the canvas changes.
        this.track(this.uiManager.graph.onVisibleChange(() => {
            if (this.panel?.querySelector(':scope > .pvt-mainheader-count')) this.panel.replaceChildren(this.buildTotalNodeCount())
        }))
    }

    /**
     * Replace the header with the selection's content: the consumer's `render`
     * when set (and `useRender`), else `drawDefault`. A `render` returning (or
     * resolving to) `undefined` falls back to `drawDefault`.
     */
    private renderHeader(
        element: Node | Edge | Node[] | Edge[] | null,
        drawDefault: () => HTMLElement,
        useRender = true,
    ): void {
        if (!this.panel) return

        // Abandon the previous selection's render before its slot is wiped, so a
        // late resolution can't paint over the element now selected.
        this.renderScope.supersede()
        this.titleFit?.clear()
        const render = useRender ? this.renderCb : undefined
        const content = render === undefined
            ? drawDefault()
            : this.renderScope.resolve(
                (ctx) => (typeof render === 'function' ? render(element, ctx) : render),
                (value) => (value === undefined ? drawDefault() : toRenderedElement(value)),
            )
        this.panel.replaceChildren(...(content ? [content] : []))
    }

    public clearOverview(): void {
        this.renderHeader(null, () => this.buildTotalNodeCount())
    }

    /* Single selection */
    updateNodeOverview(node: Node, element: unknown): void {
        // A custom header renders one node's data; a group has none, so it keeps this one.
        const group = node.isGroup ? (node as GroupNode).info : undefined
        this.renderHeader(node, () => {
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
                    group ? this.uiManager.graph.simplify.labelOf(group) : nodeNameGetter(node, this.uiManager.getOptions().mainHeader)
                )
            }
            if (subtitleElem) {
                const description = group
                    ? `Group · ${this.uiManager.graph.simplify.ruleLabel(group.rule)}`
                    : nodeDescriptionGetter(node, this.uiManager.getOptions().mainHeader)
                subtitleElem.textContent = description ?? ''
            }
            return enter(mainheaderContent)
        }, !group)
    }

    updateEdgeOverview(edge: Edge): void {
        this.renderHeader(edge, () => {
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
                // A line folded onto a closed cluster for several edges has no data of its own.
                const represented = edge.representedEdges?.length ?? 0
                subtitleElem.textContent = represented > 1
                    ? `Stands for ${represented} edges`
                    : edgeDescriptionGetter(edge, this.uiManager.getOptions().mainHeader)
            }
            return enter(mainheaderContent)
        })
    }

    /* Multi selection */
    public updateNodesOverview(nodes: NodeSelection<unknown>[]): void {
        this.renderHeader(nodes.map((nodeS: NodeSelection<unknown>) => nodeS.node), () => {
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
            return enter(mainheaderContent)
        })
    }

    public updateEdgesOverview(edges: EdgeSelection<unknown>[]): void {
        this.renderHeader(edges.map((edgeS: EdgeSelection<unknown>) => edgeS.edge), () => {
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

            if (nameElem) {
                nameElem.textContent = `${edges.length} edges selected`
            }
            if (subtitleElem) {
                subtitleElem.textContent = `Out of ${this.uiManager.graph.getEdgeCount() } total`
            }
            return enter(mainheaderContent)
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
    private buildTotalNodeCount(): HTMLElement {
        const totalNodeCount = this.uiManager.graph.getMutableVisibleNodes().length
        const totalEdgeCount = this.uiManager.graph.getMutableVisibleEdges().length
        const count = document.createElement('span')
        count.className = 'pvt-mainheader-count'
        count.textContent = `Showing ${totalNodeCount} nodes and ${totalEdgeCount} edges`
        return count
    }

}

/** Plays the header's enter transition once the element has been mounted. */
function enter(element: HTMLElement): HTMLElement {
    requestAnimationFrame(() => element.classList.add('enter-active'))
    return element
}
