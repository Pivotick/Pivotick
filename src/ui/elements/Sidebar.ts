import type { UIElement, UIManager } from "../UIManager";

export class Sidebar implements UIElement {
    private uiManager: UIManager;

    public sidebar?: HTMLDivElement;

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return;


        const template = document.createElement("template");
        template.innerHTML = `
  <div class="pivotick-sidebar">
    <div class="pivotick-mainheader-panel"></div>
    <div class="pivotick-properties-panel">
      <div class="pivotick-header-panel"><h4>Properties</h4></div>
      <div class="pivotick-body-panel">
        No selection
        (should be hidden instead)
      </div>
    </div>
  </div>
`;
        this.sidebar = template.content.firstElementChild as HTMLDivElement;
        /** Other Panels */


        container.appendChild(this.sidebar);
    }

    destroy() {
        this.sidebar?.remove();
        this.sidebar = undefined;
    }

    afterMount() {}

}