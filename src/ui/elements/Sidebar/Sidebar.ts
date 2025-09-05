import type { Node } from "../../../Node";
import type { Edge } from "../../../Edge";
import { createHtmlTemplate } from "../../../utils/ElementCreation";
import type { UIElement, UIManager } from "../../UIManager";
import "./sidebar.scss"
import { injectNodeOverview, injectEdgeOverview, clearHeader } from "./MainHeader";
import { clearProperties, injectEdgeProperties, injectNodeProperties } from "./Properties";

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
      <div class="pivotick-properties-header-panel"><h4>Basic Properties</h4></div>
      <div class="pivotick-properties-body-panel">
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
        this.mainBodyPanel = this.sidebar.querySelector(".pivotick-properties-body-panel") ?? undefined
        clearHeader(this.mainHeaderPanel)
        clearProperties(this.mainBodyPanel)
    }

    graphReady() {
        this.uiManager.graph.renderer.getGraphInteraction().on("selectNode", (node: Node, element: any) => {
            injectNodeOverview(this.mainHeaderPanel, node, element, this.uiManager.getOptions())
            injectNodeProperties(this.mainBodyPanel, node, element, this.uiManager.getOptions())
        })
        this.uiManager.graph.renderer.getGraphInteraction().on("unselectNode", (node: Node, element: any) => {
            clearHeader(this.mainHeaderPanel)
            clearProperties(this.mainBodyPanel)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on("selectEdge", (edge: Edge, element: any) => {
            injectEdgeOverview(this.mainHeaderPanel, edge, element, this.uiManager.getOptions())
            injectEdgeProperties(this.mainBodyPanel, edge, element, this.uiManager.getOptions())
        })
        this.uiManager.graph.renderer.getGraphInteraction().on("unselectEdge", (edge: Edge, element: any) => {
            clearHeader(this.mainHeaderPanel)
            clearProperties(this.mainBodyPanel)
        })
    }
}