import type { UIElement, UIManager } from "../UIManager";

export class Toolbar implements UIElement {
    private uiManager: UIManager;

    public toolbar?: HTMLDivElement;
    public searchInput?: HTMLInputElement;
    public filterButton?: HTMLButtonElement;
    public undoButton?: HTMLButtonElement;
    public redoButton?: HTMLButtonElement;

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return;

        this.toolbar = document.createElement("div")
        this.toolbar.className = "pivotick-toolbar"

        /** Searchbox */
        const template = document.createElement("template");
        template.innerHTML = `
  <div class="pivotick-searchbox">
    <div class="input-container">
        <div class="icon-container">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
            </svg>
        </div>
        <input type="search" id="pivotick-search" class="" placeholder="Search" required />
        <button type="submit" class="">Search</button>
    </div>
  </div>
`;
        const searchbox = template.content.firstElementChild as HTMLDivElement;
        this.searchInput = searchbox.querySelector('input') ?? undefined
        this.toolbar.appendChild(searchbox)

        /** Filter */
        const templateFilter = document.createElement("template");
        templateFilter.innerHTML = `
  <div class="pivotick-filter">
    <button id="pivotick-filter-button" class="pivotick-button-filter">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
            <path fill="currentColor" d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5z" />
        </svg>
    </button>
    <div style="border-left: 1px solid color-mix(in srgb, var(--pivotick-border-color) 80%, transparent);"></div>
    <div class="pivotick-undoredo-group">
        <button id="pivotick-undo-button" class="pivotick-button-undo">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48">
                <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4">
                    <path d="M11.272 36.728A17.94 17.94 0 0 0 24 42c9.941 0 18-8.059 18-18S33.941 6 24 6c-4.97 0-9.47 2.015-12.728 5.272C9.614 12.93 6 17 6 17" />
                    <path d="M6 9v8h8" />
                </g>
            </svg>
        </button>
        <button id="pivotick-redo-button" class="pivotick-button-redo">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48" style="transform: scaleX(-1); transform-origin: center;">
                <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4">
                    <path d="M11.272 36.728A17.94 17.94 0 0 0 24 42c9.941 0 18-8.059 18-18S33.941 6 24 6c-4.97 0-9.47 2.015-12.728 5.272C9.614 12.93 6 17 6 17" />
                    <path d="M6 9v8h8" />
                </g>
            </svg>
        </button>
    </div>
  </div>
`
        const filterContainer = templateFilter.content.firstElementChild as HTMLDivElement;
        this.filterButton = filterContainer.querySelector('#pivotick-filter-button') ?? undefined
        this.undoButton = filterContainer.querySelector('#pivotick-undo-button') ?? undefined
        this.redoButton = filterContainer.querySelector('#pivotick-redo-button') ?? undefined
        this.toolbar.appendChild(filterContainer)

        container.appendChild(this.toolbar);
    }

    destroy() {
        this.toolbar?.remove();
        this.toolbar = undefined;
    }

    afterMount() {
        if (!this.filterButton || !this.uiManager.slidePanel?.slidePanel) return;
        this.filterButton.addEventListener("click", () => {
            if (!this.uiManager.slidePanel?.slidePanel) return;
            this.uiManager.slidePanel?.slidePanel.classList.add("open")
        })
    }
}