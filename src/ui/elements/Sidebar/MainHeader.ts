import { createHtmlTemplate } from '../../../utils/ElementCreation'
import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { GraphUI } from '../../../GraphOptions'
import { tryResolveString } from '../../../utils/Getters'
import type { EdgeSelection, NodeSelection } from '../../../GraphInteractions'


function nodeNameGetter(node: Node, options: GraphUI): string {
    if (options.mainHeader.nodeHeaderMap.title) {
        return tryResolveString(options.mainHeader.nodeHeaderMap.title, node) || 'Could not resolve title'
    }
    return node.getData().label ?? 'Optional name or label'
}

function nodeDescriptionGetter(node: Node, options: GraphUI): string {
    if (options.mainHeader.nodeHeaderMap.subtitle) {
        return tryResolveString(options.mainHeader.nodeHeaderMap.subtitle, node) || 'Could not resolve subtitle'
    }
    return node.getData().description ?? 'Optional subtitle or description'
}

function edgeNameGetter(edge: Edge, options: GraphUI): string {
    if (options.mainHeader.edgeHeaderMap.title) {
        return tryResolveString(options.mainHeader.nodeHeaderMap.title, edge) || 'Could not resolve title'
    }
    return edge.getData().label ?? 'Optional name or label'
}

function edgeDescriptionGetter(edge: Edge, options: GraphUI): string {
    if (options.mainHeader.edgeHeaderMap.subtitle) {
        return tryResolveString(options.mainHeader.nodeHeaderMap.subtitle, edge) || 'Could not resolve subtitle'
    }
    return edge.getData().description ?? 'Optional subtitle or description'
}

export function injectNodeOverview(mainHeaderPanel: HTMLDivElement | undefined, node: Node, element: unknown, options: GraphUI): void {
    if (!mainHeaderPanel) return

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
        nameElem.innerHTML = nodeNameGetter(node, options)
    }
    if (subtitleElem) {
        subtitleElem.innerHTML = nodeDescriptionGetter(node, options)
    }

    mainHeaderPanel.innerHTML = mainheaderContent.outerHTML
    requestAnimationFrame(() => {
        mainHeaderPanel?.firstElementChild?.classList.add('enter-active')
    })
}

export function injectEdgeOverview(mainHeaderPanel: HTMLDivElement | undefined, edge: Edge, element: unknown, options: GraphUI): void {
    if (!mainHeaderPanel) return

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
        nameElem.innerHTML = edgeNameGetter(edge, options)
    }
    if (subtitleElem) {
        subtitleElem.innerHTML = edgeDescriptionGetter(edge, options)
    }

    mainHeaderPanel.innerHTML = mainheaderContent.outerHTML
    requestAnimationFrame(() => {
        mainHeaderPanel?.firstElementChild?.classList.add('enter-active')
    })
}

export function clearHeader(mainHeaderPanel: HTMLDivElement | undefined): void {
    if (!mainHeaderPanel) return

    mainHeaderPanel.innerHTML = ''
    showSelectedNodeCount(mainHeaderPanel)
}

export function showSelectedNodeCount(mainHeaderPanel: HTMLDivElement | undefined): void {
    if (!mainHeaderPanel) return
    const selectedNodeCount = 0
    mainHeaderPanel.innerHTML = `Total selected nodes ${selectedNodeCount}`
}


export function injectNodesOverview(mainHeaderPanel: HTMLDivElement | undefined, nodes: NodeSelection<unknown>[], options: GraphUI, nodeCount: number): void {
    if (!mainHeaderPanel) return

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
        subtitleElem.innerHTML = `Out of ${nodeCount} total`
    }

    mainHeaderPanel.innerHTML = mainheaderContent.outerHTML
    requestAnimationFrame(() => {
        mainHeaderPanel?.firstElementChild?.classList.add('enter-active')
    })
}

export function injectEdgesOverview(mainHeaderPanel: HTMLDivElement | undefined, edges: EdgeSelection<unknown>[], options: GraphUI, edgeCount: number): void {
    if (!mainHeaderPanel) return

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
        subtitleElem.innerHTML = `Out of ${edgeCount} total`
    }

    mainHeaderPanel.innerHTML = mainheaderContent.outerHTML
    requestAnimationFrame(() => {
        mainHeaderPanel?.firstElementChild?.classList.add('enter-active')
    })
}