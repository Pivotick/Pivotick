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
import { createCopyButton } from './PropertyList'

// Title auto-fit bounds: shrink a long title from MAX down to MIN px, wrapped
// over at most MAX_LINES lines, before giving up and switching to the
// type-aware fallback.
const TITLE_MAX_PX = 16
const TITLE_MIN_PX = 12
const TITLE_LINE_HEIGHT = 1.3
const TITLE_MAX_LINES = 2

// A single hidden canvas reused to measure text width for middle-truncation.
let textMeasurer: CanvasRenderingContext2D | null = null
function measureTextWidth(text: string, font: string): number {
    if (!textMeasurer) textMeasurer = document.createElement('canvas').getContext('2d')
    if (!textMeasurer) return text.length * 8
    textMeasurer.font = font
    return textMeasurer.measureText(text).width
}

function elementFont(el: HTMLElement): string {
    const s = getComputedStyle(el)
    return `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
}

/** A title with no whitespace reads as an identifier (id, URL, hash, onion…). */
function looksLikeIdentifier(text: string): boolean {
    return !/\s/.test(text.trim())
}

/** Keep the head and tail of a too-long string, eliding the middle: `abcd…wxyz`. */
function middleTruncate(text: string, availPx: number, font: string): string {
    if (availPx <= 0 || measureTextWidth(text, font) <= availPx) return text
    const ellipsis = '…'
    let lo = 1, hi = text.length - 1, best = ellipsis
    while (lo <= hi) {
        const keep = (lo + hi) >> 1
        const head = Math.ceil(keep / 2)
        const tail = Math.floor(keep / 2)
        const candidate = text.slice(0, head) + ellipsis + text.slice(text.length - tail)
        if (measureTextWidth(candidate, font) <= availPx) { best = candidate; lo = keep + 1 }
        else hi = keep - 1
    }
    return best
}


export class SidebarMainHeader extends UIComponent {

    private panel?: HTMLDivElement
    private renderCb?: ((element: Node | Edge | Node[] | Edge[] | null) => HTMLElement | string) | HTMLElement | string

    // Re-fit the current title whenever the sidebar width changes.
    private titleObserver?: ResizeObserver
    private fitCurrentTitle?: () => void
    private titleLastWidth = -1

    constructor(uiManager: UIManager) {
        super(uiManager)
        this.renderCb = typeof this.uiManager.getOptions().mainHeader.render === 'function' ? this.uiManager.getOptions().mainHeader.render : undefined
    }

    protected onMount(rootContainer: HTMLElement | undefined) {
        if (!rootContainer) return

        this.panel = rootContainer as HTMLDivElement

        // The title fit depends on the panel width; recompute it on resize
        // (sidebar collapse/expand, responsive layout) rather than only on select.
        if (typeof ResizeObserver !== 'undefined') {
            this.titleObserver = new ResizeObserver(() => this.refitTitle())
            this.titleObserver.observe(this.panel)
            this.track(() => this.titleObserver?.disconnect())
        }
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

        this.fitCurrentTitle = undefined

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

        this.fitCurrentTitle = undefined

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

        this.fitCurrentTitle = undefined

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
        this.fitCurrentTitle = () => this.fitTitle(nameElem, actionElem, text)
        this.titleLastWidth = -1
        requestAnimationFrame(() => this.refitTitle())
    }

    private refitTitle(): void {
        if (!this.panel || !this.fitCurrentTitle) return
        // Guard on width only: fitting changes the title's height, so reacting to
        // height too would loop. Width is driven solely by the sidebar.
        const width = this.panel.clientWidth
        if (width === this.titleLastWidth) return
        this.titleLastWidth = width
        this.fitCurrentTitle()
    }

    private fitTitle(nameElem: HTMLElement, actionElem: HTMLElement | null, text: string): void {
        // Reset to the auto-fit base state (normal wrap, no clamp, full text).
        nameElem.className = 'pvt-mainheader-nodeinfo-name'
        nameElem.style.fontSize = ''
        nameElem.removeAttribute('title')
        nameElem.textContent = text
        actionElem?.replaceChildren()

        const avail = nameElem.clientWidth
        if (avail <= 0) return // collapsed / not yet laid out — the observer refits later

        // 1) Auto-fit: the whole title, shrunk just enough to fit two lines.
        for (let size = TITLE_MAX_PX; size >= TITLE_MIN_PX; size--) {
            nameElem.style.fontSize = `${size}px`
            if (nameElem.scrollHeight <= Math.ceil(size * TITLE_LINE_HEIGHT * TITLE_MAX_LINES) + 1) return
        }

        // 2) Too large even at the floor size → type-aware fallback.
        nameElem.style.fontSize = ''
        nameElem.title = text
        if (looksLikeIdentifier(text)) {
            nameElem.classList.add('is-identifier')
            nameElem.textContent = middleTruncate(text, avail, elementFont(nameElem))
            actionElem?.appendChild(createCopyButton(text))
        } else {
            nameElem.classList.add('is-clamp')
        }
    }

    /* Private methods */
    private showTotalNodeCount(): void {
        if (!this.panel) return
        const totalNodeCount = this.uiManager.graph.getMutableVisibleNodes().length
        const totalEdgeCount = this.uiManager.graph.getMutableVisibleEdges().length
        this.panel.textContent = `Showing ${totalNodeCount} nodes and ${totalEdgeCount} edges`
    }

}
