import { Graph } from '../Graph'
import { Node } from  '../Node'
import { Edge } from  '../Edge'
import type { GraphUI, PropertyEntry } from '../GraphOptions'
import { GraphControls } from './elements/GraphControls/GraphControls'
import { GraphNavigation } from './elements/GraphNavigation/GraphNavigation'
import { Layout } from './elements/Layout'
import { Sidebar } from './elements/Sidebar/Sidebar'
import { SlidePanel } from './elements/SlidePanel/SlidePanel'
import { Toolbar } from './elements/Toolbar/Toolbar'
import type { Notification } from './Notifier'
import merge from 'lodash.merge'
import { Tooltip } from './elements/Tooltip/Tooltip'
import { ContextMenu } from './elements/ContextMenu/ContextMenu'

const basicPropertyGetter = (element: Node | Edge): PropertyEntry[] => {
    const properties = []
    for (const [key, value] of Object.entries(element.getData())) {
        if (key && value) {
            properties.push({
                name: key,
                value: value,
            } as PropertyEntry)
        }
    }
    return properties
}

const basicStringGetter = (element: Node | Edge, key: string, fallbackStr: string = ''): string => {
    const str = element.getData()?.[key]
    return typeof str === 'string' ? str : fallbackStr
}

const defaultHeaderMapNodeTitle = (node: Node): string => basicStringGetter(node, 'label', 'Could not resolve title')
const defaultHeaderMapNodeSubtitle = (node: Node): string => basicStringGetter(node, 'description')
const defaultHeaderMapEdgeTitle = (edge: Edge): string => basicStringGetter(edge, 'label', 'Could not resolve title')
const defaultHeaderMapEdgeSubtitle = (edge: Edge): string => basicStringGetter(edge, 'description')

const defaultPropertiesMapNode = (node: Node): PropertyEntry[] => basicPropertyGetter(node)
const defaultPropertiesMapEdge = (edge: Edge): PropertyEntry[] => basicPropertyGetter(edge)

const DEFAULT_HEADERS_MAPS = {
    nodeHeaderMap: {
        title: defaultHeaderMapNodeTitle,
        subtitle: defaultHeaderMapNodeSubtitle,
    },
    edgeHeaderMap: {
        title: defaultHeaderMapEdgeTitle,
        subtitle: defaultHeaderMapEdgeSubtitle,
    },
}

export const DEFAULT_UI_OPTIONS: GraphUI = {
    mode: 'viewer',
    mainHeader: DEFAULT_HEADERS_MAPS,
    propertiesPanel: {
        nodePropertiesMap: defaultPropertiesMapNode,
        edgePropertiesMap: defaultPropertiesMapEdge,
    },
    tooltip: {
        enable: true,
        nodePropertiesMap: defaultPropertiesMapNode,
        edgePropertiesMap: defaultPropertiesMapEdge,
        ...DEFAULT_HEADERS_MAPS
    },
    contextMenu: {
        enable: true,
        menuNode: {
            topbar: [],
            menu: [],
        },
        menuEdge: {
            topbar: [],
            menu: [],
        },
        menuCanvas: {
            topbar: [],
            menu: [],
        },
    },
    selectionMenu: {
        menuNode: {
            topbar: [],
            menu: [],
        },
    },
    extraPanels: [],
}

export interface UIElement {
    mount(container: HTMLElement): void;
    destroy(): void;
    afterMount(): void;
    graphReady(): void;
}

/**
 * Responsible for creating UI elements and registering interactions
 * based on the selected mode.
 */
export class UIManager {
    public graph: Graph
    protected container: HTMLElement
    private options: GraphUI

    public layout?: Layout
    public slidePanel?: SlidePanel
    public sidebar?: Sidebar
    public toolbar?: Toolbar
    public graphNaviation?: GraphNavigation
    public graphControls?: GraphControls
    public tooltip?: Tooltip
    public contextMenu?: ContextMenu

    constructor(graph: Graph, container: HTMLElement, options: GraphUI) {
        this.graph = graph
        this.container = container
        this.options = merge({}, DEFAULT_UI_OPTIONS, options)
        this.setup()
    }

    private setup() {
        this.destroy()

        switch (this.options.mode) {
            case 'viewer':
                this.setupViewerMode()
                break
            case 'full':
                this.setupFullMode()
                break
            case 'light':
                this.setupLightMode()
                break
            case 'static':
                this.setupStaticMode()
                break
            default:
                console.warn(`Unknown mode: ${this.options.mode}. Defaulting to 'viewer'.`)
                this.setupViewerMode()
                break
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
            console.warn('Not enough space for full mode UI. Switching to light mode.')
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
            console.warn('Not enough space for light mode UI. Switching to viewer mode.')
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
        if (this.options.tooltip?.enable) {
            this.tooltip = new Tooltip(this)
            this.tooltip.mount(this.layout?.canvas)
        }
        if (this.options.contextMenu?.enable) {
            this.contextMenu = new ContextMenu(this)
            this.contextMenu.mount(this.layout?.canvas)
        }
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
            this.layout.destroy()
            this.layout = undefined
        }
    }

    private callAfterMount() { // TODO: Instead, these should register an afterMount callback
        this.layout?.afterMount()
        this.slidePanel?.afterMount()
        this.toolbar?.afterMount()
        this.sidebar?.afterMount()
        this.graphNaviation?.afterMount()
        this.graphControls?.afterMount()
        if (this.options.tooltip?.enable) {
            this.tooltip?.afterMount()
        }
        if (this.options.contextMenu?.enable) {
            this.contextMenu?.afterMount()
        }
    }

    public getOptions() {
        return this.options
    }

    public callGraphReady() { // TODO: Instead, these should register an afterMount callback
        this.graphControls?.graphReady()
        this.sidebar?.graphReady()
        this.tooltip?.graphReady()
        this.contextMenu?.graphReady()
    }

    /**
   * Show a notification in the UI.
   * 
   * @param notification - The notification to display
   */
    public showNotification(notification: Notification): void {
        const { level, title, message } = notification
        const container = this.layout?.notification
        if (!container) return

        const template = document.createElement('template')
        template.innerHTML = `
  <div class="pivotick-toast pivotick-toast-${level}">
    <div class="pivotick-toast-title">
    </div>
    <div class="pivotick-toast-body">
    </div>
  </div>
`
        const toast = template.content.firstElementChild as HTMLDivElement
        const titleEl = toast.querySelector('.pivotick-toast-title')
        const bodyEl = toast.querySelector('.pivotick-toast-body')

        if (titleEl) titleEl.textContent = title
        if (bodyEl) bodyEl.textContent = message ?? ''

        container.appendChild(toast)
        requestAnimationFrame(() => {
            toast.classList.add('show')
        })

        setTimeout(() => {
            toast.classList.remove('show')
            toast.addEventListener('transitionend', () => {
                toast.remove()
            }, { once: true })
        }, 4000)
    }
}
