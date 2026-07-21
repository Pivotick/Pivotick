import { Graph } from '../Graph'
import { Node } from  '../Node'
import { Edge } from  '../Edge'
import { GraphControls } from './elements/GraphControls/GraphControls'
import { GraphNavigation } from './elements/GraphNavigation/GraphNavigation'
import { Layout } from './elements/Layout'
import { Sidebar } from './elements/Sidebar/Sidebar'
import { SlidePanel, type SlidepanelOptions } from './elements/SlidePanel/SlidePanel'
import { Mainheader } from './elements/Mainheader/Mainheader'
import { Modal, type ModalOptions } from './components/Modal'
import type { Notification } from './Notifier'
import merge from 'lodash.merge'
import { Tooltip } from './elements/Tooltip/Tooltip'
import { ContextMenu } from './elements/ContextMenu/ContextMenu'
import type { GraphUI, GraphUIMode, PropertyEntry } from '../interfaces/GraphUI'
import { KeybindingManager } from './KeybindingManager'
import { GraphToolbar } from './elements/GraphToolbar/GraphToolbar'
import { createInspectModal } from './elements/modals/InspectNodeModal/InspectNodeModal'
import { Note } from '../Note'
import { UIComponent, type UIPhase } from './UIComponent'
import { ModeStore, isB3ChromeEnabled } from './ModeStore'
import { ModeRail } from './elements/ModeRail/ModeRail'
import { ToolPanel } from './elements/ToolPanel/ToolPanel'
import { ViewFlyout } from './elements/ViewFlyout/ViewFlyout'
import type { PivotickPlugin, PluginContext } from '../interfaces/Plugin'


const basicPropertyGetter = (element: Node | Edge): PropertyEntry[] => {
    const properties = []
    properties.push({
        name: 'id',
        value: element.id,
    } as PropertyEntry)
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
const defaultHeaderMapEdgeTitle = (edge: Edge): string => basicStringGetter(edge, 'label', '')
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
    render: undefined,
}

export const DEFAULT_UI_OPTIONS: GraphUI = {
    mode: 'viewer',
    mainHeader: DEFAULT_HEADERS_MAPS,
    sidebar: {
        collapsed: 'auto'
    },
    propertiesPanel: {
        nodePropertiesMap: defaultPropertiesMapNode,
        edgePropertiesMap: defaultPropertiesMapEdge,
    },
    neighborsPanel: {
    },
    tooltip: {
        enabled: true,
        allowPinning: true,
        nodePropertiesMap: defaultPropertiesMapNode,
        edgePropertiesMap: defaultPropertiesMapEdge,
        ...DEFAULT_HEADERS_MAPS
    },
    navigation: {
        enabled: true,
    },
    contextMenu: {
        enabled: true,
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
    editors: {
        nodeEditor: {
            enabled: true
        }
    }
}

export interface UIElement {
    mount(container?: HTMLElement): void;
    destroy(): void;
    afterMount(): void;
    graphReady(): void;
}

/**
 * Declarative catalog of the built-in UI elements. Each entry says which
 * modes it appears in, an optional `enabled` gate, how to construct it, and
 * which layout slot it mounts into. Adding a new built-in element is a single
 * row here.
 *
 * Order matters: `layout` is first because every other slot getter reads from
 * it.
 */
interface UIElementSpec {
    key: string
    modes: GraphUIMode[] | '*'
    enabled?: (options: GraphUI) => boolean
    make: (ui: UIManager) => UIComponent
    slot: (ui: UIManager) => HTMLElement | undefined
}

const UI_ELEMENTS: UIElementSpec[] = [
    {
        key: 'layout', modes: '*',
        make: ui => new Layout(ui), slot: ui => ui.getRootContainer()
    },
    {
        key: 'navigation', modes: ['viewer', 'full', 'light'],
        enabled: o => !!o.navigation?.enabled,
        make: ui => new GraphNavigation(ui), slot: ui => ui.layout?.graphnavigation
    },
    {
        key: 'tooltip', modes: ['viewer', 'full', 'light'],
        enabled: o => !!o.tooltip?.enabled,
        make: ui => new Tooltip(ui), slot: ui => ui.layout?.canvas
    },
    {
        key: 'contextMenu', modes: ['viewer', 'full', 'light'],
        enabled: o => !!o.contextMenu?.enabled,
        make: ui => new ContextMenu(ui), slot: ui => ui.layout?.canvas
    },
    {
        // Classic left controls — replaced by the B3 mode rail + View flyout.
        key: 'graphControls', modes: ['full', 'light'],
        enabled: o => !isB3ChromeEnabled(o),
        make: ui => new GraphControls(ui), slot: ui => ui.layout?.graphcontrols
    },
    {
        // Classic top toolbar — replaced by the B3 mode rail + contextual panels.
        key: 'graphToolbar', modes: ['full', 'light'],
        enabled: o => !isB3ChromeEnabled(o),
        make: ui => new GraphToolbar(ui), slot: ui => ui.layout?.graphtoolbar
    },
    {
        key: 'modeRail', modes: ['full', 'light'],
        enabled: o => isB3ChromeEnabled(o),
        make: ui => new ModeRail(ui), slot: ui => ui.layout?.moderail
    },
    {
        key: 'toolPanel', modes: ['full', 'light'],
        enabled: o => isB3ChromeEnabled(o),
        make: ui => new ToolPanel(ui), slot: ui => ui.layout?.toolpanel
    },
    {
        // viewer-mode View flyout is an open question (§9.4); full/light for now.
        key: 'viewFlyout', modes: ['full', 'light'],
        enabled: o => isB3ChromeEnabled(o),
        make: ui => new ViewFlyout(ui), slot: ui => ui.layout?.viewflyout
    },
    {
        key: 'mainHeader', modes: ['full', 'light'],
        make: ui => new Mainheader(ui), slot: ui => ui.layout?.mainheader
    },
    {
        key: 'sidebar', modes: ['full'],
        make: ui => new Sidebar(ui), slot: ui => ui.layout?.sidebar
    },
]

/**
 * Responsible for creating UI elements and registering interactions
 * based on the selected mode.
 *
 * Elements are declared once in {@link UI_ELEMENTS} and driven through their
 * lifecycle phases (afterMount / graphReady / destroy) by {@link emitPhase}.
 * Plugins hook the same phases via {@link installPlugin} / {@link onPhase}.
 */
export class UIManager {
    public graph: Graph
    protected container: HTMLElement
    private options: GraphUI

    public keyManager: KeybindingManager

    /**
     * Mode-rail state (Select / Create pointer-mode + View flyout). The rail,
     * contextual panels, View flyout and canvas cursor subscribe to it. Lives on
     * the manager (not per-component) so it survives element rebuilds and is
     * reachable from the interaction layer via `graph.UIManager.modeStore`.
     */
    public readonly modeStore: ModeStore = new ModeStore()

    /** Lifecycle-managed elements, in registration order. */
    private elements: UIComponent[] = []
    private byKey = new Map<string, UIComponent>()
    /** Phase callbacks contributed by plugins / cross-cutting hooks. */
    private phaseHandlers: Record<UIPhase, Array<() => void>> = { afterMount: [], graphReady: [], destroy: [] }
    private emittedPhases = new Set<UIPhase>()
    /** UIManager-level teardown (global keybindings, container listeners). */
    private uiDisposables: Array<() => void> = []
    /** True after `destroy()`; late registrations are refused until `setup()` reruns. */
    private destroyed = false
    /** Names of installed plugins, for de-duplication. Reset on `destroy()`. */
    private installedPlugins = new Set<string>()

    constructor(graph: Graph, container: HTMLElement, options: GraphUI) {
        this.graph = graph
        this.container = container
        this.options = merge({}, DEFAULT_UI_OPTIONS, options)

        this.keyManager = new KeybindingManager(this.container)

        this.setup()
    }

    /* ---------- typed accessors (public API, backed by the registry) ---------- */

    public get layout(): Layout | undefined { return this.byKey.get('layout') as Layout | undefined }
    public get sidebar(): Sidebar | undefined { return this.byKey.get('sidebar') as Sidebar | undefined }
    public get mainHeader(): Mainheader | undefined { return this.byKey.get('mainHeader') as Mainheader | undefined }
    public get graphNaviation(): GraphNavigation | undefined { return this.byKey.get('navigation') as GraphNavigation | undefined }
    public get graphControls(): GraphControls | undefined { return this.byKey.get('graphControls') as GraphControls | undefined }
    public get graphToolbar(): GraphToolbar | undefined { return this.byKey.get('graphToolbar') as GraphToolbar | undefined }
    public get modeRail(): ModeRail | undefined { return this.byKey.get('modeRail') as ModeRail | undefined }
    public get toolPanel(): ToolPanel | undefined { return this.byKey.get('toolPanel') as ToolPanel | undefined }
    public get viewFlyout(): ViewFlyout | undefined { return this.byKey.get('viewFlyout') as ViewFlyout | undefined }
    public get tooltip(): Tooltip | undefined { return this.byKey.get('tooltip') as Tooltip | undefined }
    public get contextMenu(): ContextMenu | undefined { return this.byKey.get('contextMenu') as ContextMenu | undefined }

    public getRootContainer(): HTMLElement {
        return this.container
    }

    private setup() {
        this.destroy()
        this.destroyed = false

        if (this.options.theme) {
            this.container.setAttribute('data-theme', this.options.theme.toString())
        }

        this.resolveMode()
        this.build()
        this.emitPhase('afterMount')
        this.setupGlobalInteractions()
    }

    /** Downgrade / adjust the mode when the container can't fit the chosen UI. */
    private resolveMode() {
        const validModes: GraphUIMode[] = ['viewer', 'full', 'light', 'static']
        if (!validModes.includes(this.options.mode)) {
            console.warn(`Unknown mode: ${this.options.mode}. Defaulting to 'viewer'.`)
            this.options.mode = 'viewer'
        }

        if (this.options.mode === 'light' && !this.hasEnoughSpaceForLightMode()) {
            console.warn('Not enough space for light mode UI. Switching to viewer mode.')
            this.options.mode = 'viewer'
        }

        if (
            this.options.mode === 'full' &&
            this.options?.sidebar?.collapsed === 'auto' &&
            !this.hasEnoughSpaceForFullMode()
        ) {
            console.debug('Not enough space for full mode UI. Collapsing sidebar')
            this.options.sidebar.collapsed = true
        }
    }

    /** Construct + mount every element declared for the current mode. */
    private build() {
        const mode = this.options.mode
        for (const spec of UI_ELEMENTS) {
            if (spec.modes !== '*' && !spec.modes.includes(mode)) continue
            if (spec.enabled && !spec.enabled(this.options)) continue
            this.register(spec)
        }
    }

    private register(spec: UIElementSpec) {
        const element = spec.make(this)
        this.byKey.set(spec.key, element)
        this.elements.push(element)
        element.mount(spec.slot(this))
    }

    private hasEnoughSpaceForFullMode(): boolean {
        const bcr = this.container.getBoundingClientRect()
        return bcr.width > 1200 && bcr.height > 800
    }

    private hasEnoughSpaceForLightMode(): boolean {
        const bcr = this.container.getBoundingClientRect()
        return bcr.width > 600 && bcr.height > 600
    }

    /* ---------- lifecycle phases ---------- */

    /**
     * Broadcast a lifecycle phase to every element (in registration order,
     * reversed for `destroy`) and every phase hook.
     */
    private emitPhase(phase: UIPhase) {
        // Each non-destroy phase fires once; late subscribers catch up via emittedPhases in onPhase()/addElement().
        if (phase !== 'destroy' && this.emittedPhases.has(phase)) return
        this.emittedPhases.add(phase)
        if (phase === 'destroy') {
            for (const callback of [...this.phaseHandlers.destroy].reverse()) callback()
            for (const element of [...this.elements].reverse()) element.destroy()
        } else {
            // Snapshot: a reentrant addElement/onPhase during the broadcast is
            // caught up by emittedPhases; the copy stops the live loop firing it again.
            for (const element of [...this.elements]) element[phase]()
            for (const callback of [...this.phaseHandlers[phase]]) callback()
        }
    }

    /**
     * Subscribe to a lifecycle phase. If the phase has already fired (a late
     * registration, e.g. a plugin installed after the graph is live), the
     * callback runs immediately to catch up. Returns an unsubscribe function.
     */
    public onPhase(phase: UIPhase, callback: () => void): () => void {
        if (this.destroyed) {
            console.warn('Cannot register a phase handler after the UI is destroyed.')
            return () => {}
        }
        this.phaseHandlers[phase].push(callback)
        if (phase !== 'destroy' && this.emittedPhases.has(phase)) callback()
        return () => {
            this.phaseHandlers[phase] = this.phaseHandlers[phase].filter(h => h !== callback)
        }
    }

    private setupGlobalInteractions() {
        const onKeydown = (event: KeyboardEvent) => this.keyManager.handleKeyPress(event)
        this.container.addEventListener('keydown', onKeydown)
        this.uiDisposables.push(() => this.container.removeEventListener('keydown', onKeydown))
        this.container.setAttribute('tabindex', '0') // make it focusable

        this.uiDisposables.push(this.keyManager.register({
            key: 'i',
            callback: () => {
                const node = this.graph.renderer.getNodeClosestToCursor(100)
                if (node) createInspectModal(node, this)
            }
        }))
        this.uiDisposables.push(this.keyManager.register({
            key: 'Shift+E',
            callback: () => {
                const element = this.graph.renderer.getClosestElementToCursor(100)
                if (!element) return

                if (element instanceof Node) {
                    this.graph.renderer.getGraphInteraction().selectNode(element.getGraphElement(), element)
                    requestAnimationFrame(() => {
                        this.graph.editing.openNodeSession(element)
                    })
                } else if (element instanceof Note) {
                    this.graph.renderer.enterNoteEditMode(element)
                }
            }
        }))
        this.uiDisposables.push(this.keyManager.register({
            key: 'n',
            callback: () => {
                const renderer = this.graph.renderer
                const pointerEvent = this.graph.renderer.getGraphInteraction().getLastPointerEvent()
                if (!pointerEvent) return

                const { x, y } = renderer.screenToGraphCoordinates(
                    pointerEvent.clientX,
                    pointerEvent.clientY
                )
                const note: Note = new Note({
                    content: 'This is not a note.',
                    x,
                    y
                })
                this.graph.noteManager.addNote(note)
            }
        }))
    }

    /* ---------- plugins ---------- */

    /**
     * Install a plugin, handing it a {@link PluginContext} to register UI
     * elements, keybindings and lifecycle hooks. Called for each entry in
     * `GraphOptions.plugins` and by {@link Graph.use}.
     */
    public installPlugin(plugin: PivotickPlugin) {
        if (this.destroyed) {
            console.warn(`Cannot install plugin "${plugin.name}" after the UI is destroyed.`)
            return
        }
        if (this.installedPlugins.has(plugin.name)) {
            console.warn(`Plugin "${plugin.name}" is already installed; skipping the duplicate.`)
            return
        }
        this.installedPlugins.add(plugin.name)

        const ctx: PluginContext = {
            graph: this.graph,
            ui: this,
            // Live view, not an install-time snapshot: the layout is rebuilt on
            // setup() and its slots vary by mode, so read it on access.
            get layout() { return this.ui.layout },
            keyManager: this.keyManager,
            addElement: (element, slot) => this.addElement(element, slot),
            onPhase: (phase, callback) => this.onPhase(phase, callback),
            addKeybinding: (binding) => { this.uiDisposables.push(this.keyManager.register(binding)) },
        }
        plugin.install(ctx)
    }

    /**
     * Add a UI element into the lifecycle after the initial build (e.g. from a
     * plugin). The element is mounted, then caught up to whatever phase the UI
     * has already reached.
     */
    public addElement(element: UIComponent, slot?: HTMLElement) {
        if (this.destroyed) {
            console.warn('Cannot add a UI element after the UI is destroyed.')
            return
        }
        this.elements.push(element)
        element.mount(slot)
        if (this.emittedPhases.has('afterMount')) element.afterMount()
        if (this.emittedPhases.has('graphReady')) element.graphReady()
    }

    public destroy() {
        this.destroyed = true
        this.emitPhase('destroy')
        this.elements = []
        this.byKey.clear()
        this.phaseHandlers = { afterMount: [], graphReady: [], destroy: [] }
        this.emittedPhases.clear()
        this.installedPlugins.clear()
        this.modeStore.dispose()
        for (const dispose of this.uiDisposables.splice(0)) dispose()
    }

    public async toggleFullscreen(forcedState?: boolean) {
        const shouldEnable =
            forcedState !== undefined
                ? forcedState
                : !document.fullscreenElement

        if (shouldEnable) {
            if (!document.fullscreenElement) {
                await this.container.requestFullscreen()
            }
        } else {
            if (document.fullscreenElement) {
                await document.exitFullscreen()
            }
        }
    }

    public isFullscreenOn() {
        return !!document.fullscreenElement
    }

    public getOptions() {
        return this.options
    }

    public getAppContainer(): HTMLElement {
        const appID = this.graph.getAppID()
        return document.getElementById(appID)!
    }

    public callGraphReady() {
        this.emitPhase('graphReady')
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

   /**
   * Show a modal in the UI.
   *
   * @param modalOption - The option for the modal
   */
    public createModal(modalOptions: ModalOptions): Modal | undefined {
        const container = this.layout?.modal
        if (!container) return

        const modal = new Modal(this, modalOptions)
        modal.mount(this.layout?.modal)

        requestAnimationFrame(() => {
            modal.show()
        })

        return modal
    }

   /**
   * Show a sidepanel in the UI.
   *
   * @param slidepanelOption - The notification to display
   */
    public createSlidepanel(slidepanelOptions: SlidepanelOptions): SlidePanel | undefined {
        const container = this.layout?.slidePanel
        if (!container) return

        const slidePanel = new SlidePanel(this, slidepanelOptions)
        slidePanel.mount(this.layout?.slidePanel)

        return slidePanel
    }
}
