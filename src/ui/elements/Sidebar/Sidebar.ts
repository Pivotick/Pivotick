import type { Node } from "../../../Node";
import { createHtmlTemplate } from "../../../utils/ElementCreation";
import type { UIElement, UIManager } from "../../UIManager";
import "./sidebar.scss"

export class Sidebar implements UIElement {
    private uiManager: UIManager;
    
    public sidebar?: HTMLDivElement;
    
    private mainHeaderPanel?: HTMLDivElement;
    private mainBodyPanel?: HTMLDivElement;
    
    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }
    
    mount(container: HTMLElement | undefined) {
        if (!container) return;

        const template = `
  <div class="pivotick-sidebar">
    <div class="pivotick-mainheader-panel"></div>
    <div class="pivotick-properties-panel">
      <div class="pivotick-header-panel"><h4>Basic Properties</h4></div>
      <div class="pivotick-body-panel">
        No selection
        (should be hidden instead)
      </div>
    </div>
</div>

  </div>`
        this.sidebar = createHtmlTemplate(template) as HTMLDivElement

        /** Other Panels */

        container.appendChild(this.sidebar);
    }

    destroy() {
        this.sidebar?.remove();
        this.sidebar = undefined;
    }

    afterMount() {
        if (!this.sidebar) return;
        this.mainHeaderPanel = this.sidebar.querySelector(".pivotick-mainheader-panel") ?? undefined;
        this.mainBodyPanel = this.sidebar.querySelector(".pivotick-body-panel") ?? undefined
        this.clearNodeOverview()
    }
    
    graphReady() {
        this.uiManager.graph.renderer.getGraphInteraction().on("selectNode", (node: Node, element: any) => {
            this.injectNodeOverview(node, element)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on("unselectNode", (node: Node, element: any) => {
            this.clearNodeOverview()
        })
        this.uiManager.graph.renderer.getGraphInteraction().on("selectEdge", (edge: Edge, element: any) => {
            this.injectEdgeOverview(edge, element)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on("unselectEdge", (edge: Edge, element: any) => {
            this.clearNodeOverview()
        })
    }

    private clearNodeOverview(): void {
        if (this.mainHeaderPanel) {
            this.mainHeaderPanel.innerHTML = ''
        }
        this.showSelectedNodeCount()
    }

    private showSelectedNodeCount(): void {
        const selectedNodeCount = 0
        if (this.mainHeaderPanel) {
            this.mainHeaderPanel.innerHTML = `Total nodes ${selectedNodeCount}`
        }
    }

    private injectNodeOverview(node: Node, element: any): void {
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

        if (this.mainHeaderPanel) {
            this.mainHeaderPanel.innerHTML = mainheaderContent.outerHTML
        }
        requestAnimationFrame(() => {
            this.mainHeaderPanel?.firstElementChild?.classList.add('enter-active')
        })
    }

    private injectEdgeOverview(edge: Edge, element: any): void {
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

        if (this.mainHeaderPanel) {
            this.mainHeaderPanel.innerHTML = mainheaderContent.outerHTML
        }
        requestAnimationFrame(() => {
            this.mainHeaderPanel?.firstElementChild?.classList.add('enter-active')
        })
    }
}