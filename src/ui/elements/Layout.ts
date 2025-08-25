import type { UIElement } from "../UIManager";

export class Layout implements UIElement {
    public layout?: HTMLDivElement;
    public canvas?: HTMLDivElement;
    public sidebar?: HTMLDivElement;
    public toolbar?: HTMLDivElement;
    public slidePanel?: HTMLDivElement;
    public graphcontrols?: HTMLDivElement;

    constructor() { }

    mount(container: HTMLElement) {
        this.layout = document.createElement("div")
        this.layout.className = "pivotick-layout"

        this.canvas = document.createElement("div")
        this.canvas.className = "pivotick-canvas-container"
        this.layout.appendChild(this.canvas)

        this.sidebar = document.createElement("div")
        this.sidebar.className = "pivotick-sidebar-container"
        this.layout.appendChild(this.sidebar)

        this.toolbar = document.createElement("div")
        this.toolbar.className = "pivotick-toolbar-container"
        this.layout.appendChild(this.toolbar)

        this.graphcontrols = document.createElement("div")
        this.graphcontrols.className = "pivotick-graphcontrols-container"
        this.layout.appendChild(this.graphcontrols)

        const templateSlidePanel = document.createElement("template");
        templateSlidePanel.innerHTML = `
  <div class="slide-panel" id="side-panel">
    <div class="slide-panel__header">
        My Panel
        <button id="closePanel" style="float:right;">×</button>
    </div>
    <div class="slide-panel__content">
        <p>This is the content of the panel.</p>
    </div>
    </div>
`;
        this.slidePanel = templateSlidePanel.content.firstElementChild as HTMLDivElement;
        this.canvas.appendChild(this.slidePanel)

        container.appendChild(this.layout);
    }

    destroy() {
        this.layout?.remove();
        this.layout = undefined;
    }
}