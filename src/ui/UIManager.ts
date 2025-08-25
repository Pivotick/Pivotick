import { Graph } from '../Graph';
import type { GraphMode } from '../GraphOptions';
import { Layout } from './elements/Layout'
import { Sidebar } from './elements/Sidebar'
import { Toolbar } from './elements/Toolbar';

export interface UIManagerOptions {
    mode?: GraphMode;
}

export interface UIElement {
    mount(container: HTMLElement): void;
    destroy(): void;
  }

/**
 * Responsible for creating UI elements and registering interactions
 * based on the selected mode.
 */
export class UIManager {
    private graph: Graph;
    protected container: HTMLElement
    private options: UIManagerOptions;

    private layout?: Layout;

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
        this.buildToolbar()
        this.buildSidebar()
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

    private buildToolbar() {
        const toobar = new Toolbar()
        toobar.mount(this.layout?.toolbar)
    }

    private buildSidebar() {
        const sidebar = new Sidebar()
        sidebar.mount(this.layout?.sidebar)
    }
    

    private destroy() {
        if (this.layout) {
            this.layout.destroy();
            this.layout = undefined;
        }
    }
    
}
