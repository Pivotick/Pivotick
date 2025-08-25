import { Graph } from '../Graph';
import type { GraphMode } from '../GraphOptions';
import { Layout } from './elements/Layout'
import { Sidebar } from './elements/Sidebar'
import { SlidePanel } from './elements/SlidePanel';
import { Toolbar } from './elements/Toolbar';

export interface UIManagerOptions {
    mode?: GraphMode;
}

export interface UIElement {
    mount(container: HTMLElement): void;
    destroy(): void;
    afterMount(): void;
  }

/**
 * Responsible for creating UI elements and registering interactions
 * based on the selected mode.
 */
export class UIManager {
    private graph: Graph;
    protected container: HTMLElement
    private options: UIManagerOptions;

    public layout?: Layout;
    public slidePanel?: SlidePanel;
    public sidebar?: Sidebar;
    public toolbar?: Toolbar;

    constructor(graph: Graph, container: HTMLElement, options: UIManagerOptions = {}) {
        this.graph = graph;
        this.container = container;
        // this.options = { mode: options.mode ?? 'viewer' };
        this.options = { mode: options.mode ?? 'full' };

        this.setup();
    }

    private setup() {
        this.destroy()

        switch (this.options.mode) {
            case 'viewer':
                this.setupViewerMode();
                break;
            case 'full':
                this.setupFullMode();
                break;
            case 'light':
                this.setupLightMode();
                break;
            case 'static':
                this.setupStaticMode();
                break;
            default:
                console.warn(`Unknown mode: ${this.options.mode}. Defaulting to 'viewer'.`);
                this.setupViewerMode();
                break;
        }
    }

    private setupViewerMode() {
    }

    private setupFullMode() {
        this.buildLayout()
        this.buildUIGraphNavigation()
        this.buildUIGraphControls()
        this.buildSlidePanel()
        this.buildToolbar()
        this.buildSidebar()

        this.callAfterMount()
    }

    private setupLightMode() {
    }

    private setupStaticMode() {
    }

    private buildLayout() {
        this.layout = new Layout()
        this.layout.mount(this.container)
    }

    private buildUIGraphNavigation() {
    }

    private buildUIGraphControls() {
    }

    private buildSlidePanel() {
        this.slidePanel = new SlidePanel(this)
        this.slidePanel.mount(this.layout?.canvas)
    }

    private buildToolbar() {
        this.toolbar = new Toolbar(this)
        this.toolbar.mount(this.layout?.toolbar)
    }

    private buildSidebar() {
        this.sidebar = new Sidebar(this)
        this.sidebar.mount(this.layout?.sidebar)
    }
    

    private destroy() {
        if (this.layout) {
            this.layout.destroy();
            this.layout = undefined;
        }
    }
    
    private callAfterMount() { // TODO: Instead, these should register an afterMount callback
        this.layout?.afterMount()
        this.slidePanel?.afterMount()
        this.toolbar?.afterMount()
        this.sidebar?.afterMount()
    }
}
