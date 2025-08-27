import { type Selection } from 'd3-selection'
import type { ZoomBehavior } from "d3-zoom";
import type { UIElement, UIManager } from "../../UIManager";
import "./graphNavigation.scss"

export class GraphNavigation implements UIElement {
    private uiManager: UIManager;

    public navigation?: HTMLDivElement;

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return;


        const template = document.createElement("template");
        template.innerHTML = `
  <div class="pivotick-graphnavigation">
    <div class="pivotick-graphnavigation-zoom-fit">
        <button id="pivotick-graphnavigation-reset" class="pivotick-graphnavigation-reset-button" title="Fit and center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                <path fill="currentColor" d="M5.655 2.639a.5.5 0 0 0 .69.723l1.313-1.254a.5.5 0 0 1 .691.001l1.305 1.252a.5.5 0 0 0 .692-.721L9.042 1.388a1.5 1.5 0 0 0-2.075-.003zM3.362 6.346a.5.5 0 1 0-.723-.69L1.388 6.963a1.5 1.5 0 0 0 0 2.073l1.251 1.31a.5.5 0 0 0 .723-.691l-1.251-1.31a.5.5 0 0 1 0-.69zm2.984 6.293a.5.5 0 0 0-.691.723l1.314 1.256a1.5 1.5 0 0 0 2.077-.004l1.301-1.254a.5.5 0 1 0-.694-.72l-1.3 1.254a.5.5 0 0 1-.693.001zm7.015-6.985a.5.5 0 1 0-.722.693l1.258 1.31a.5.5 0 0 1 0 .693L12.64 9.654a.5.5 0 1 0 .72.694l1.257-1.304a1.5 1.5 0 0 0 .001-2.08zM5 6.5A1.5 1.5 0 0 1 6.5 5h3A1.5 1.5 0 0 1 11 6.5v3A1.5 1.5 0 0 1 9.5 11h-3A1.5 1.5 0 0 1 5 9.5z" />
            </svg>
        </button>
    </div>
    <div class="pivotick-graphnavigation-zoom-controls">
        <button id="pivotick-graphnavigation-zoom-in" class="pivotick-graphnavigation-zoomin-button" title="Zoom In">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                <path fill="currentColor" d="M18 10h-4V6a2 2 0 0 0-4 0l.071 4H6a2 2 0 0 0 0 4l4.071-.071L10 18a2 2 0 0 0 4 0v-4.071L18 14a2 2 0 0 0 0-4" />
            </svg>
        </button>
        <div class="pivotick-zoom-divider"></div>
        <button id="pivotick-graphnavigation-zoom-out" class="pivotick-graphnavigation-zoomout-button" title="Zoom Out">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                <path fill="currentColor" fill-rule="evenodd" d="M2 8a1 1 0 0 1 1-1h10a1 1 0 0 1 0 2H3a1 1 0 0 1-1-1" clip-rule="evenodd" />
            </svg>
        </button>
    </div>
  </div>
`;
        this.navigation = template.content.firstElementChild as HTMLDivElement;

        container.appendChild(this.navigation);
    }

    destroy() {
        this.navigation?.remove();
        this.navigation = undefined;
    }

    afterMount() {
        if (!this.navigation) return;
        const zoomInButton = this.navigation.querySelector("#pivotick-graphnavigation-zoom-in");
        const zoomOutButton = this.navigation.querySelector("#pivotick-graphnavigation-zoom-out");
        const resetButton = this.navigation.querySelector("#pivotick-graphnavigation-reset");
        
        zoomInButton?.addEventListener("click", () => {
            const zoomBehavior = this.uiManager.graph.renderer.getZoomBehavior()
            const canvas = this.uiManager.graph.renderer.getCanvasSelection()

            if (!zoomBehavior || !canvas) return;
            canvas.transition().duration(300).call(zoomBehavior.scaleBy, 1.5)
        });

        zoomOutButton?.addEventListener("click", () => {
            const zoomBehavior = this.uiManager.graph.renderer.getZoomBehavior()
            const canvas = this.uiManager.graph.renderer.getCanvasSelection()

            if (!zoomBehavior || !canvas) return;
            canvas.transition().duration(300).call(zoomBehavior.scaleBy, 0.667)
        });

        resetButton?.addEventListener("click", () => {
            const zoomBehavior = this.uiManager.graph.renderer.getZoomBehavior()
            const canvas = this.uiManager.graph.renderer.getCanvasSelection()

            if (!zoomBehavior || !canvas) return;
            canvas.transition().duration(300).call(zoomBehavior.scaleBy, 1)
        });
    }
}