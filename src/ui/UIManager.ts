import { Graph } from '../Graph';
import type { GraphMode } from '../GraphOptions';
import { GraphControls } from './elements/GraphControls/GraphControls';
import { GraphNavigation } from './elements/GraphNavigation/GraphNavigation';
import { Layout } from './elements/Layout'
import { Sidebar } from './elements/Sidebar/Sidebar'
import { SlidePanel } from './elements/SlidePanel/SlidePanel';
import { Toolbar } from './elements/Toolbar/Toolbar';

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
    public graph: Graph;
    protected container: HTMLElement
    private options: UIManagerOptions;

    public layout?: Layout;
    public slidePanel?: SlidePanel;
    public sidebar?: Sidebar;
    public toolbar?: Toolbar;
    public graphNaviation?: GraphNavigation;
    public graphControls?: GraphControls;

    constructor(graph: Graph, container: HTMLElement, options: UIManagerOptions = {}) {
        this.graph = graph;
        this.container = container;
        this.options = { mode: options.mode ?? 'viewer' };
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
        this.callAfterMount()
    }

    private hasEnoughSpaceForFullMode(): boolean {
        const bcr = this.container.getBoundingClientRect()
        return bcr.width > 1200 && bcr.height > 800
    }

    private hasEnoughSpaceForLightMode(): boolean {
        const bcr = this.container.getBoundingClientRect()
        return bcr.width > 600 && bcr.height > 600
    }

    private setupViewerMode() {
        this.buildLayout()
        this.buildUIGraphNavigation()
    }

    private setupStaticMode() {
        this.buildLayout()
        this.buildUIGraphNavigation()
    }

    private setupFullMode() {
        if (!this.hasEnoughSpaceForFullMode()) {
            console.warn("Not enough space for full mode UI. Switching to light mode.");
            this.options.mode = 'light'
            this.setupLightMode()
            return
        }

        this.buildLayout()
        this.buildUIGraphNavigation()
        this.buildUIGraphControls()
        this.buildSlidePanel()
        this.buildToolbar()
        this.buildSidebar()
    }

    private setupLightMode() {
        if (!this.hasEnoughSpaceForLightMode()) {
            console.warn("Not enough space for light mode UI. Switching to viewer mode.");
            this.options.mode = 'viewer'
            this.setupViewerMode()
            return
        }

        this.buildLayout()
        this.buildUIGraphNavigation()
        this.buildUIGraphControls()
        this.buildSlidePanel()
        this.buildToolbar()
    }

    private buildLayout() {
        this.layout = new Layout()
        this.layout.mount(this.container, this.options.mode)
    }

    private buildUIGraphNavigation() {
        this.graphNaviation = new GraphNavigation(this)
        this.graphNaviation.mount(this.layout?.graphnavigation)
    }

    private buildUIGraphControls() {
        this.graphControls = new GraphControls(this)
        this.graphControls.mount(this.layout?.graphcontrols)
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
        this.graphNaviation?.afterMount()
        this.graphControls?.afterMount()
    }
}
