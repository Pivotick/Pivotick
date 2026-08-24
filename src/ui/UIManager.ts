import { Graph } from '../Graph'
import { Node } from  '../Node'
import { Edge } from  '../Edge'
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
import type { DockTab, Editors, ExtraPanel, GraphUI, GraphUIMode, LegendOptions, PropertyEntry, RegisteredDockTab, RegisteredExtraPanel, TableOptions } from '../interfaces/GraphUI'
import { KeybindingManager } from './KeybindingManager'
import { createInspectModal } from './elements/modals/InspectNodeModal/InspectNodeModal'
import { Note } from '../Note'
import { UIComponent, type UIPhase } from './UIComponent'
import { ModeStore } from './ModeStore'
import { ModeRail } from './elements/ModeRail/ModeRail'
import { ToolPanel } from './elements/ToolPanel/ToolPanel'
import { ViewFlyout } from './elements/ViewFlyout/ViewFlyout'
import { PhysicsFlyout } from './elements/PhysicsFlyout/PhysicsFlyout'
import { Legend } from './elements/Legend/Legend'
import { Dock, type DockOptions } from './elements/Dock/Dock'
import { Table } from './elements/Table/Table'
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
        menuNote: {
            topbar: [],
            menu: [],
        },
        menuCanvas: {
            topbar: [],
            menu: [],
        },
    },
    extraPanels: [],
    filter: {},
    editors: {
        nodeEditor: {
            enabled: true
        }
    },
    // Coming-soon rail modes are hidden unless the integrator opts in.
    modeRail: {
        explore: false,
        enrich: false,
    }
}

export interface UIElement {
    mount(container?: HTMLElement): void;
    destroy(): void;
    afterMount(): void;
    graphReady(): void;
}

/**
 * A change to the sidebar's extra-panel registry, broadcast to whatever is
 * currently hosting the panels (the sidebar's `ExtraPanelManager`). The host
 * owns the DOM; the registry is the single source of truth for *which* panels
 * exist and in what order.
 */
export type ExtraPanelChange =
    | { type: 'add', panel: RegisteredExtraPanel, index: number }
    | { type: 'remove', id: string }
    /** Re-render one panel, or every panel when `id` is omitted. */
    | { type: 'refresh', id?: string }

/**
 * A change to the dock's tab registry, broadcast to the {@link Dock} when one is
 * mounted. Same division of labour as {@link ExtraPanelChange}: the registry is the
 * single source of truth for which tabs exist and in what order, and the dock owns
 * the strip's DOM.
 *
 * The registry outlives any particular dock — tabs can be registered before the
 * region is built, and survive it being torn down and rebuilt.
 */
export type DockTabChange =
    | { type: 'add', tab: RegisteredDockTab, index: number }
    /** Carries the tab, not just its id: it is already out of the registry by now, and
     *  the dock still owes a departing tab its `onDeactivate`. */
    | { type: 'remove', tab: RegisteredDockTab }
    /** Bring one tab to the front. */
    | { type: 'activate', id: string }

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

/**
 * Is a legend wanted at all? Only `false` (or `enabled: false`) says no — with no
 * declaration the legend decides for itself whether the graph's colours warrant
 * one, which it can only judge once the renderer and the data exist.
 */
function legendWanted(legend?: LegendOptions | boolean): boolean {
    if (legend === false) return false
    if (typeof legend === 'object' && legend.enabled === false) return false
    return true
}

/**
 * Is a data table wanted? `full` mode offers one unless it is explicitly turned off.
 * It gates the bottom dock too: the region exists for its occupant, and must not
 * outlive it. The mode gate itself lives in the {@link UI_ELEMENTS} entry.
 */
function tableWanted(table?: TableOptions | boolean): boolean {
    if (table === false) return false
    if (typeof table === 'object' && table.enabled === false) return false
    return true
}

/** The declared table options, normalised — `true` and omitted both mean "defaults". */
function tableOptions(table?: TableOptions | boolean): TableOptions {
    return typeof table === 'object' ? table : {}
}

/**
 * The region's share of `UI.table`. The dock has no options of its own — one occupant,
 * so its settings are still declared where the occupant is — but it is the dock that
 * reads these, so they are pulled out here rather than handed the whole table config.
 */
function dockOptions(table?: TableOptions | boolean): DockOptions {
    const { open, collapsed, height } = tableOptions(table)
    return { open, collapsed, height, label: 'table' }
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
        key: 'modeRail', modes: ['full', 'light'],
        make: ui => new ModeRail(ui), slot: ui => ui.layout?.moderail
    },
    {
        key: 'toolPanel', modes: ['full', 'light'],
        make: ui => new ToolPanel(ui), slot: ui => ui.layout?.toolpanel
    },
    {
        // viewer-mode flyouts are an open question (§9.4); full/light for now.
        key: 'viewFlyout', modes: ['full', 'light'],
        make: ui => new ViewFlyout(ui), slot: ui => ui.layout?.flyout
    },
    {
        key: 'physicsFlyout', modes: ['full', 'light'],
        make: ui => new PhysicsFlyout(ui), slot: ui => ui.layout?.flyout
    },
    {
        // Built unless suppressed: with no `UI.legend` the component tries to derive
        // one from `render.nodeTypeAccessor` and renders nothing if that doesn't
        // explain the colours. `setLegend` builds it later if it was suppressed.
        key: 'legend', modes: ['full', 'light'],
        enabled: o => legendWanted(o.legend),
        make: ui => new Legend(ui), slot: ui => ui.layout?.legend
    },
    {
        // `full` only: the dock is a grid row beside the sidebar, and the other modes
        // promise a canvas without that much chrome. It owns its own toggle and shortcut,
        // so nothing else has to exist first — but it must come before the table, whose
        // tabs it has to be there to receive.
        //
        // A dock is *also* built on demand by `addDockTab` when a tab arrives without one
        // (see `ensureDock`), which is the only way a plugin can get in: plugins install
        // after this whole catalogue has run.
        key: 'dock', modes: ['full'],
        enabled: o => tableWanted(o.table),
        make: ui => new Dock(ui, dockOptions(ui.getOptions().table)), slot: ui => ui.layout?.dock
    },
    {
        // Not an occupant of the dock so much as a contributor to it: the table registers
        // one dock tab per `TableTab` and owns no region of its own, which is why it asks
        // for no slot.
        key: 'table', modes: ['full'],
        enabled: o => tableWanted(o.table),
        make: ui => new Table(ui, tableOptions(ui.getOptions().table), ui.dock),
        slot: () => undefined
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
     * Mode-rail state (Select / Create pointer-modes + the View / Physics
     * flyouts). The rail, contextual panels, both flyouts and the canvas cursor
     * subscribe to it. Lives on
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
    /**
     * Sidebar extra panels, in display order. Lives here rather than on the
     * sidebar so registration works in any mode and at any point in the graph's
     * life — including before the sidebar is built, or in a mode that has none.
     */
    private panels: RegisteredExtraPanel[] = []
    /** Monotonic counter behind auto-generated panel ids (never reset, so stale disposers can't collide). */
    private panelSeq = 0
    /** Hosts subscribed to registry changes (the sidebar's panel manager). */
    private panelSubscribers: Array<(change: ExtraPanelChange) => void> = []
    /**
     * Dock tabs, in display order. Here rather than on the dock for the same reason the
     * panels are here rather than on the sidebar — and for one more: a tab may be the
     * *reason* the region gets built, so the registry has to exist before the dock does.
     */
    private dockTabs: RegisteredDockTab[] = []
    /** Monotonic counter behind auto-generated tab ids (never reset, so stale disposers can't collide). */
    private dockTabSeq = 0
    /** The mounted dock, subscribed to registry changes. At most one. */
    private dockTabSubscribers: Array<(change: DockTabChange) => void> = []
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
    public get graphNavigation(): GraphNavigation | undefined { return this.byKey.get('navigation') as GraphNavigation | undefined }
    public get modeRail(): ModeRail | undefined { return this.byKey.get('modeRail') as ModeRail | undefined }
    public get toolPanel(): ToolPanel | undefined { return this.byKey.get('toolPanel') as ToolPanel | undefined }
    public get viewFlyout(): ViewFlyout | undefined { return this.byKey.get('viewFlyout') as ViewFlyout | undefined }
    public get physicsFlyout(): PhysicsFlyout | undefined { return this.byKey.get('physicsFlyout') as PhysicsFlyout | undefined }
    public get legend(): Legend | undefined { return this.byKey.get('legend') as Legend | undefined }
    public get dock(): Dock | undefined { return this.byKey.get('dock') as Dock | undefined }
    public get table(): Table | undefined { return this.byKey.get('table') as Table | undefined }
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
        // `UI.extraPanels` is sugar for addPanel(): seeding before build() means
        // the sidebar finds them already registered when it mounts.
        for (const panel of this.options.extraPanels ?? []) this.addPanel(panel)
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
     * Whether a plugin of that name is already installed. Lets a mode's default
     * plugins stand aside for a consumer's own configured copy.
     */
    public hasPlugin(name: string): boolean {
        return this.installedPlugins.has(name)
    }

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
            addPanel: (panel) => this.addPanel(panel),
            removePanel: (id) => this.removePanel(id),
            refreshPanel: (id) => this.refreshPanel(id),
            addDockTab: (tab) => this.addDockTab(tab),
            removeDockTab: (id) => this.removeDockTab(id),
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

    /* ---------- canvas legend ---------- */

    /**
     * Replace `UI.legend` at runtime. The element is built on first need, so a graph
     * that started without a legend can be given one; an `undefined` config empties
     * the legend and drops its filter.
     */
    public setLegend(config?: LegendOptions | boolean) {
        if (this.destroyed) {
            console.warn('Cannot set the legend after the UI is destroyed.')
            return
        }
        this.options.legend = config

        const existing = this.legend
        if (existing) {
            existing.refresh()
            return
        }
        // Nothing to build: the legend is suppressed, or this mode has no slot for it.
        if (!legendWanted(config) || !this.layout?.legend) return

        const legend = new Legend(this)
        this.byKey.set('legend', legend)
        this.addElement(legend, this.layout.legend)
    }

    /* ---------- sidebar extra panels ---------- */

    /**
     * Register a sidebar panel at any point in the graph's life — before or
     * after `graphReady`, and from a plugin's `install`. A panel added late
     * mounts immediately and is rendered against the current selection.
     *
     * Registration succeeds in every mode; the panel is only *shown* in the
     * modes that have a sidebar (`full`), and mounts as soon as one exists.
     *
     * @param panel - The panel. `id` is auto-generated when omitted.
     * @returns A disposer that removes the panel. Calling it twice is a no-op.
     */
    public addPanel(panel: ExtraPanel): () => void {
        if (this.destroyed) {
            console.warn('Cannot add a sidebar panel after the UI is destroyed.')
            return () => {}
        }
        const id = panel.id ?? `pvt-panel-${++this.panelSeq}`
        if (this.panels.some(p => p.id === id)) {
            console.warn(`A sidebar panel with id "${id}" is already registered; skipping the duplicate.`)
            return () => {}
        }

        const registered: RegisteredExtraPanel = { ...panel, id }
        const index = this.panelInsertIndex(registered.order ?? 0)
        this.panels.splice(index, 0, registered)
        this.emitPanelChange({ type: 'add', panel: registered, index })

        let disposed = false
        return () => {
            if (disposed) return
            disposed = true
            this.removePanel(id)
        }
    }

    /** Remove a registered panel by id: its DOM goes and it stops re-rendering. */
    public removePanel(id: string): void {
        const index = this.panels.findIndex(p => p.id === id)
        if (index === -1) {
            // Silent after teardown: a disposer held across destroy() is a no-op, not a mistake.
            if (!this.destroyed) console.warn(`No sidebar panel with id "${id}" to remove.`)
            return
        }
        this.panels.splice(index, 1)
        this.emitPanelChange({ type: 'remove', id })
    }

    /**
     * Re-resolve a panel's `title` and `render` against the current selection —
     * for when the panel's *own* data changed rather than the selection. Omit
     * `id` to refresh every panel. Refreshes a `reactive: false` panel too.
     */
    public refreshPanel(id?: string): void {
        if (id !== undefined && !this.panels.some(p => p.id === id)) {
            console.warn(`No sidebar panel with id "${id}" to refresh.`)
            return
        }
        this.emitPanelChange({ type: 'refresh', id })
    }

    /** The registered panels, in display order (a copy — mutate through addPanel / removePanel). */
    public getPanels(): ReadonlyArray<RegisteredExtraPanel> {
        return [...this.panels]
    }

    /**
     * Subscribe to registry changes. Used by the sidebar's panel host to keep
     * its DOM in step; returns an unsubscribe function.
     */
    public onPanelsChanged(callback: (change: ExtraPanelChange) => void): () => void {
        this.panelSubscribers.push(callback)
        return () => {
            this.panelSubscribers = this.panelSubscribers.filter(s => s !== callback)
        }
    }

    /** First index whose `order` sorts after `order` — so equal orders keep registration order. */
    private panelInsertIndex(order: number): number {
        const index = this.panels.findIndex(p => (p.order ?? 0) > order)
        return index === -1 ? this.panels.length : index
    }

    private emitPanelChange(change: ExtraPanelChange): void {
        // Snapshot: a subscriber that registers/removes a panel while reacting
        // shouldn't mutate the list being iterated.
        for (const subscriber of [...this.panelSubscribers]) subscriber(change)
    }

    /* ---------- dock tabs ---------- */

    /**
     * Register a pane in the bottom dock, at any point in the graph's life — before or
     * after `graphReady`, and from a plugin's `install`.
     *
     * **The first tab brings the region with it.** Plugins install after the UI is
     * built (`Graph` constructs the UIManager before it runs `options.plugins`), so a
     * tab always arrives too late for the dock's `UI_ELEMENTS` gate to have said yes on
     * its behalf. Rather than make every consumer turn the dock on separately,
     * registering a tab builds it — the same on-first-need construction
     * {@link setLegend} uses.
     *
     * Registration succeeds in every mode; the tab is only *shown* in the modes that
     * have a dock (`full`).
     *
     * @param tab - The tab. `id` is auto-generated when omitted.
     * @returns A disposer that removes the tab. Calling it twice is a no-op.
     */
    public addDockTab(tab: DockTab): () => void {
        if (this.destroyed) {
            console.warn('Cannot add a dock tab after the UI is destroyed.')
            return () => {}
        }
        const id = tab.id ?? `pvt-dock-tab-${++this.dockTabSeq}`
        if (this.dockTabs.some(t => t.id === id)) {
            console.warn(`A dock tab with id "${id}" is already registered; skipping the duplicate.`)
            return () => {}
        }

        const registered: RegisteredDockTab = { ...tab, id }
        const index = this.dockTabInsertIndex(registered.order ?? 0)
        this.dockTabs.splice(index, 0, registered)
        this.emitDockTabChange({ type: 'add', tab: registered, index })
        // After the broadcast: a dock that already exists has taken the tab, and one that
        // doesn't gets built holding it. Either way the registry is the truth first.
        this.ensureDock()

        let disposed = false
        return () => {
            if (disposed) return
            disposed = true
            this.removeDockTab(id)
        }
    }

    /** Remove a registered dock tab by id: its DOM goes, and the strip closes over it. */
    public removeDockTab(id: string): void {
        const index = this.dockTabs.findIndex(t => t.id === id)
        if (index === -1) {
            // Silent after teardown: a disposer held across destroy() is a no-op, not a mistake.
            if (!this.destroyed) console.warn(`No dock tab with id "${id}" to remove.`)
            return
        }
        const [removed] = this.dockTabs.splice(index, 1)
        this.emitDockTabChange({ type: 'remove', tab: removed })
    }

    /** Bring a registered tab to the front, unfolding the dock if it is folded. */
    public activateDockTab(id: string): void {
        if (!this.dockTabs.some(t => t.id === id)) {
            console.warn(`No dock tab with id "${id}" to activate.`)
            return
        }
        this.emitDockTabChange({ type: 'activate', id })
    }

    /** The registered tabs, in display order (a copy — mutate through addDockTab / removeDockTab). */
    public getDockTabs(): ReadonlyArray<RegisteredDockTab> {
        return [...this.dockTabs]
    }

    /**
     * Subscribe to registry changes. Used by the dock to keep its strip in step;
     * returns an unsubscribe function.
     */
    public onDockTabsChanged(callback: (change: DockTabChange) => void): () => void {
        this.dockTabSubscribers.push(callback)
        return () => {
            this.dockTabSubscribers = this.dockTabSubscribers.filter(s => s !== callback)
        }
    }

    /** First index whose `order` sorts after `order` — so equal orders keep registration order. */
    private dockTabInsertIndex(order: number): number {
        const index = this.dockTabs.findIndex(t => (t.order ?? 0) > order)
        return index === -1 ? this.dockTabs.length : index
    }

    private emitDockTabChange(change: DockTabChange): void {
        for (const subscriber of [...this.dockTabSubscribers]) subscriber(change)
    }

    /**
     * Build the dock if tabs want one and this mode has a slot for it. A no-op once it
     * exists, so it is safe to call on every registration.
     */
    private ensureDock(): void {
        if (this.dock || !this.dockTabs.length || !this.layout?.dock) return
        const dock = new Dock(this, dockOptions(this.options.table))
        this.byKey.set('dock', dock)
        this.addElement(dock, this.layout.dock)
    }

    public destroy() {
        this.destroyed = true
        this.emitPhase('destroy')
        this.elements = []
        this.byKey.clear()
        this.phaseHandlers = { afterMount: [], graphReady: [], destroy: [] }
        this.emittedPhases.clear()
        this.installedPlugins.clear()
        this.panels = []
        this.panelSubscribers = []
        this.dockTabs = []
        this.dockTabSubscribers = []
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

    /**
     * Whether one of the write-path editors is offered at all, per its
     * `editors.<editor>.enabled` flag (on unless explicitly `false`). Affordances ask
     * this before rendering themselves, so an integration whose backend forbids an
     * operation *removes* the button instead of vetoing every click.
     */
    public isEditorEnabled(editor: keyof Editors): boolean {
        return this.options.editors?.[editor]?.enabled !== false
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
