import type { Node } from "../../../Node";
import { createHtmlTemplate } from "../../../utils/ElementCreation";
import type { UIElement, UIManager } from "../../UIManager";
import "./sidebar.scss"
import { injectNodeOverview , injectEdgeOverview } from "./MainHeader";

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
            injectNodeOverview(this.mainHeaderPanel, node, element)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on("unselectNode", (node: Node, element: any) => {
            this.clearNodeOverview()
        })
        this.uiManager.graph.renderer.getGraphInteraction().on("selectEdge", (edge: Edge, element: any) => {
            injectEdgeOverview(this.mainHeaderPanel, edge, element)
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
}