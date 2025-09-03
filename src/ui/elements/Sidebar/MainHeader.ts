import { createHtmlTemplate } from "../../../utils/ElementCreation";
import type { Node } from "../../../Node";
import type { Edge } from "../../../Edge";


export function injectNodeOverview(mainHeaderPanel: HTMLDivElement | undefined, node: Node, element: any): void {
    if (!mainHeaderPanel) return;

    const fixedPreviewSize = 42
    const template = `<div>
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
    const iconElem = mainheaderContent.querySelector(".pivotick-mainheader-icon");
    const nameElem = mainheaderContent.querySelector(".pivotick-mainheader-nodeinfo-name");
    const subtitleElem = mainheaderContent.querySelector(".pivotick-mainheader-nodeinfo-subtitle");
    const actionElem = mainheaderContent.querySelector(".pivotick-mainheader-nodeinfo-action");

    if (iconElem) {
        if (element) {
            const clonedGroup = element.cloneNode(true)
            const bbox = element.getBBox()
            const scale = fixedPreviewSize / Math.max(bbox.width, bbox.height)
            clonedGroup.setAttribute(
                "transform",
                `translate(${(fixedPreviewSize - bbox.width * scale) / 2 - bbox.x * scale}, ${(fixedPreviewSize - bbox.height * scale) / 2 - bbox.y * scale}) scale(${scale})`
                );
            iconElem.appendChild(clonedGroup)
        }
    }
    if (nameElem) {
        nameElem.innerHTML = node.getData().label
    }
    if (subtitleElem) {
        subtitleElem.innerHTML = 'Optional subtitle or description'
    }

    if (mainHeaderPanel) {
        mainHeaderPanel.innerHTML = mainheaderContent.outerHTML
    }
    requestAnimationFrame(() => {
        mainHeaderPanel?.firstElementChild?.classList.add('enter-active')
    })
}


export function injectEdgeOverview(mainHeaderPanel: HTMLDivElement | undefined, edge: Edge, element: any): void {
    if (!mainHeaderPanel) return;

    const fixedPreviewSize = 42
    const template = `<div>
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
    const nameElem = mainheaderContent.querySelector(".pivotick-mainheader-nodeinfo-name");
    const subtitleElem = mainheaderContent.querySelector(".pivotick-mainheader-nodeinfo-subtitle");
    const actionElem = mainheaderContent.querySelector(".pivotick-mainheader-nodeinfo-action");

    if (nameElem) {
        nameElem.innerHTML = edge.getData().label
    }
    if (subtitleElem) {
        subtitleElem.innerHTML = 'Optional subtitle or description'
    }

    if(mainHeaderPanel) {
        mainHeaderPanel.innerHTML = mainheaderContent.outerHTML
    }
    requestAnimationFrame(() => {
        mainHeaderPanel?.firstElementChild?.classList.add('enter-active')
    })
}