import { UIComponent } from '../../UIComponent'
import type { DockTabChange, UIManager } from '../../UIManager'
import type { DockOptions, DockTabHandle, RegisteredDockTab } from '../../../interfaces/GraphUI'
import './dock.scss'

/**
 * How much canvas the dock must leave behind, in px. Below this the graph stops
 * being a graph — and a canvas that reaches zero height would make the physics
 * divide by zero (see `Simulation.measureContainer`), so this is a correctness
 * floor as much as a usability one.
 */
const MIN_CANVAS_HEIGHT = 200

/** The dock never shrinks below its header bar plus one usable row. */
const MIN_DOCK_HEIGHT = 120

/** Fraction of the canvas the dock opens to when nothing else is asked for. */
const DEFAULT_HEIGHT_RATIO = 0.35

/**
 * `collapsed: 'auto'` thresholds, as a multiple of {@link MIN_DOCK_HEIGHT}: the dock
 * stays expanded while the layout can spare that much room *and* the canvas floor, and
 * folds away below the lower figure. Two thresholds rather than one so a layout sitting
 * on the boundary — or being dragged across it — doesn't flap the dock open and shut.
 */
const EXPAND_ROOM_RATIO = 2.4
const COLLAPSE_ROOM_RATIO = 2.1

/** Chevron that flips to read as both "fold this away" and "bring it back". */
const COLLAPSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M2.5 7.5L6 4l3.5 3.5"/></svg>'

/**
 * What the dock is constructed with: the public {@link DockOptions} it resolves out of
 * `UI.dock` / `UI.table`, plus the name it puts on its own controls.
 */
export interface DockConfig extends DockOptions {
    /**
     * What the region is called on the controls it draws itself ("Resize the dock").
     * @default 'dock'
     */
    label?: string,
}

/**
 * The bottom dock: a grid row under the canvas that other panes fill.
 *
 * It owns the **region** — the row and its height, the resize divider, the collapse
 * state and the chevron that drives it, the tab strip, and a header bar whose toolbar
 * slot it fills on the active tab's behalf but never with anything of its own. It knows
 * nothing about what is inside it: occupants are {@link DockTab}s in the `UIManager`'s
 * registry, and this class only draws whatever is there.
 *
 * One region rather than a row per pane, so two panes cannot each stand up a resizable
 * strip and fight over the canvas's height. One height, one fold, one strip.
 *
 * The registry is the source of truth and **outlives any particular dock**: tabs can be
 * registered before the region is built — indeed a tab is what builds it, when the table
 * is switched off — and survive it being torn down.
 */
export class Dock extends UIComponent {
    private readonly options: DockConfig

    private root?: HTMLDivElement
    private divider?: HTMLDivElement
    private header?: HTMLDivElement
    private tabStrip?: HTMLDivElement
    private toolbar?: HTMLDivElement
    /** The rule between the tab strip and the active tab's own controls. */
    private separator?: HTMLSpanElement
    private body?: HTMLDivElement
    private toggle?: HTMLButtonElement

    /** The tab on show, or `null` while the registry is empty. */
    private activeId: string | null = null
    /**
     * Each tab's body, built on first activation and kept — so a tab holds its own
     * state (its scroll position included) across a detour through another one.
     */
    private readonly bodies = new Map<string, HTMLElement>()
    /** One handle per tab, so a tab that stashed its handle keeps a live one. */
    private readonly handles = new Map<string, DockTabHandle>()
    /**
     * What the *active tab* put in the toolbar, so a swap takes back only what it
     * added. Anything else in the slot belongs to someone else and is left alone.
     */
    private toolbarItems: HTMLElement[] = []
    /**
     * Tab ids in the order they were last on show, newest first.
     *
     * What a tab that goes away hands over to. Falling back to the first tab instead
     * would send an analyst closing one review pane back to the data table, past the
     * three other review panes they still have open.
     */
    private readonly recent: string[] = []

    private open: boolean
    private collapsed: boolean
    /** Whether the collapsed state follows the available room (`collapsed: 'auto'`). */
    private readonly autoCollapse: boolean
    /** Latched by the first explicit collapse/expand, which ends {@link autoCollapse}. */
    private userChose = false
    /** Occupants watching the fold, via {@link onCollapsedChange}. */
    private readonly collapseWatchers = new Set<(collapsed: boolean) => void>()

    /** Expanded height in px, resolved from `options.height` once the layout is measured. */
    private height: number | null = null
    private observer?: ResizeObserver
    /** Pointer id held for the duration of a divider drag. */
    private dragPointer: number | null = null

    constructor(uiManager: UIManager, options: DockConfig = {}) {
        super(uiManager)
        this.options = options
        // Three states, because the collapsed bar is the affordance that opens the dock —
        // so it has to be on screen by default, or nothing points at it:
        //   `open: false` → not present at all (the zero-footprint opt-out)
        //   `open: true`  → present and expanded
        //   unset         → present, folded to its bar
        this.open = options.open !== false
        const startFolded = options.open === undefined
        // Deliberately folded, so there is no room question to answer yet; the first
        // expand latches `userChose` and takes over from here anyway.
        this.autoCollapse = !startFolded && (options.collapsed === undefined || options.collapsed === 'auto')
        this.collapsed = startFolded || options.collapsed === true
    }

    /** What the region is called on the controls it draws itself. */
    private get label(): string {
        return this.options.label ?? 'dock'
    }

    /* ---------- lifecycle ---------- */

    protected onMount(container?: HTMLElement) {
        if (!container) return

        this.root = document.createElement('div')
        this.root.className = 'pvt-dock'

        this.divider = document.createElement('div')
        this.divider.className = 'pvt-dock-divider'
        this.divider.setAttribute('role', 'separator')
        this.divider.setAttribute('aria-orientation', 'horizontal')
        this.divider.setAttribute('aria-label', `Resize the ${this.label}`)
        this.root.appendChild(this.divider)

        this.header = document.createElement('div')
        this.header.className = 'pvt-dock-header'
        this.root.appendChild(this.header)

        this.toggle = document.createElement('button')
        this.toggle.type = 'button'
        this.toggle.className = 'pvt-dock-toggle'
        this.toggle.innerHTML = COLLAPSE_ICON
        this.listen(this.toggle, 'click', () => {
            this.userChose = true
            this.setCollapsed(!this.collapsed)
        })
        this.header.appendChild(this.toggle)

        // The tab strip sits between the chevron and the toolbar — which is exactly
        // where the table drew its own Nodes / Edges strip before the dock took the job,
        // so nothing moved when it did.
        this.tabStrip = document.createElement('div')
        this.tabStrip.className = 'pvt-dock-tabs'
        this.tabStrip.setAttribute('role', 'tablist')
        // Delegated, so the strip can be redrawn on every registry change without
        // accumulating a listener per button behind it.
        this.listen(this.tabStrip, 'click', (event) => {
            const target = event.target as HTMLElement | null
            const id = target?.closest<HTMLElement>('.pvt-dock-tab')?.dataset.tab
            if (id) this.setActive(id, false)
        })
        this.header.appendChild(this.tabStrip)

        // A rule between which pane you are looking at and what that pane offers. The
        // two are different kinds of control and sit adjacent in one row, so without it
        // a tab and a filter read as neighbours in the same list.
        this.separator = document.createElement('span')
        this.separator.className = 'pvt-dock-sep'
        this.separator.setAttribute('aria-hidden', 'true')
        this.separator.hidden = true
        this.header.appendChild(this.separator)

        // `display: contents`, so what the occupant puts here lays out as if it sat in
        // the header itself — and an occupant with nothing to add leaves no gap.
        this.toolbar = document.createElement('div')
        this.toolbar.className = 'pvt-dock-toolbar'
        this.header.appendChild(this.toolbar)

        // The active tab's body goes straight in here, as a *direct* child: this is also
        // the scroll container, so content taller or wider than the region scrolls rather
        // than stretching the layout — and a `TableGrid` windows its rows against
        // `root.parentElement`, which only works if nothing is wrapped around it.
        this.body = document.createElement('div')
        this.body.className = 'pvt-dock-body'
        this.root.appendChild(this.body)

        container.appendChild(this.root)

        this.wireDivider()
        this.observeRoom()
        // The registry is the source of truth and it predates this dock — tabs may
        // already be waiting, and one of them may be why the region exists at all.
        this.track(this.uiManager.onDockTabsChanged(change => this.onTabsChanged(change)))
        this.syncTabs()
        this.apply()
    }

    protected onAfterMount() {
        // The region's own shortcut, alongside Shift+J/K/N. It lives here rather than on
        // a header pill: collapsed, the dock already shows a chevron, so a second control
        // in the top bar was pointing at something that was pointing at itself. One
        // meaning: show the dock's content, or fold it away again. (The letter is the
        // table's, which is what the region held first.)
        this.track(this.uiManager.keyManager.register({
            key: 'Shift+T',
            callback: () => {
                this.userChose = true
                const wasShowingContent = this.open && !this.collapsed
                if (!this.open) this.setOpen(true)
                this.setCollapsed(wasShowingContent)
            },
        }))
    }

    protected onDestroy() {
        this.observer?.disconnect()
        this.observer = undefined
        this.collapseWatchers.clear()
        // The tabs themselves are the registry's, and outlive this dock — only what was
        // built for them is ours to drop.
        this.clearToolbar()
        for (const element of this.bodies.values()) element.remove()
        this.bodies.clear()
        this.handles.clear()
        this.activeId = null
        // Give the grid row back before losing the handle that can find it.
        this.writeHeight(0)
        this.root?.remove()
        this.root = undefined
        this.divider = undefined
        this.header = undefined
        this.separator = undefined
        this.tabStrip = undefined
        this.toolbar = undefined
        this.body = undefined
        this.toggle = undefined
    }

    /* ---------- what the occupant gets ---------- */

    /**
     * Watch the fold. `pvt-dock-collapsed` on the root is what hides the chrome, so an
     * occupant only needs this for what CSS cannot do — dismissing a popover, say.
     * Returns an unsubscribe.
     */
    public onCollapsedChange(watcher: (collapsed: boolean) => void): () => void {
        this.collapseWatchers.add(watcher)
        return () => this.collapseWatchers.delete(watcher)
    }

    /* ---------- tabs ---------- */

    /** The registry is the truth; the dock only draws it. */
    private tabs(): ReadonlyArray<RegisteredDockTab> {
        return this.uiManager.getDockTabs()
    }

    /** Which tab is on show, if any. */
    public getActiveTabId(): string | null {
        return this.activeId
    }

    private onTabsChanged(change: DockTabChange): void {
        if (change.type === 'activate') return this.setActive(change.id, true)
        if (change.type === 'refresh') return this.refreshTab(change.id)
        // The label lives in the strip and nowhere else, so nothing else has to move.
        if (change.type === 'relabel') return this.renderStrip()
        if (change.type === 'remove') this.forgetTab(change.tab)
        this.syncTabs()
    }

    /**
     * Rebuild a tab from its `render` **and** its `toolbar`. This is what lets a pane
     * switch between views of its own — the table's `Nodes` / `Edges` — without the dock
     * being left holding a stale element to re-attach on the next activation.
     *
     * The toolbar goes with it because a pane's controls usually *are* the switch:
     * rebuilding only the body leaves the control showing the view you just left. Same
     * reasoning as `refreshPanel`, which re-resolves a panel's title as well as its body.
     *
     * A tab that is not on show just loses its cached body; it will be rebuilt when it
     * next comes to the front, which is the same work either way.
     */
    private refreshTab(id: string): void {
        const tab = this.tabs().find(t => t.id === id)
        if (!tab) return

        const previous = this.bodies.get(id)
        this.bodies.delete(id)
        if (this.activeId !== id) return void previous?.remove()

        const element = tab.render(this.handleFor(tab))
        this.bodies.set(id, element)
        previous?.remove()
        this.body?.appendChild(element)

        this.clearToolbar()
        this.fillToolbar(tab)
    }

    /** Redraw the strip, and make sure something is on show if anything can be. */
    private syncTabs(): void {
        const tabs = this.tabs()
        const activeIsGone = this.activeId !== null && !tabs.some(t => t.id === this.activeId)
        if (activeIsGone) this.activeId = null
        // Silently, without revealing: a tab arriving must not unfold a dock the
        // consumer asked to keep folded. Only `activateDockTab` reveals.
        if (this.activeId === null && tabs.length) {
            const back = this.recent.find(id => tabs.some(tab => tab.id === id))
            this.setActive(back ?? tabs[0].id, false)
        }
        this.renderStrip()
        // The registry changing can hand the row back, or ask for it again.
        this.apply()
    }

    /**
     * Put a tab on show: detach the outgoing body, attach the incoming one, and swap the
     * header controls with it.
     *
     * @param reveal - Also bring the region into view (open it, unfold it). Only an
     * explicit `activateDockTab` does this; auto-selection never does.
     */
    private setActive(id: string, reveal: boolean): void {
        const tabs = this.tabs()
        const next = tabs.find(t => t.id === id)

        if (next && this.body && this.activeId !== id) {
            const current = tabs.find(t => t.id === this.activeId)
            if (current) {
                this.clearToolbar()
                // Detached, not hidden. A `TableGrid` measures its scroller as
                // `root.parentElement`, so a body parked inside a hidden wrapper would
                // window its rows against the wrong element.
                this.bodies.get(current.id)?.remove()
                current.onDeactivate?.(this.handleFor(current))
            }

            this.activeId = id
            this.remember(id)
            let element = this.bodies.get(id)
            if (!element) {
                element = next.render(this.handleFor(next))
                this.bodies.set(id, element)
            }
            this.body.appendChild(element)
            this.fillToolbar(next)
            next.onActivate?.(this.handleFor(next))
            this.renderStrip()
        }

        if (reveal) {
            if (!this.open) this.setOpen(true)
            if (this.collapsed) this.setCollapsed(false)
        }
    }

    /** Drop everything held for a tab that has left the registry. */
    private forgetTab(tab: RegisteredDockTab): void {
        if (this.activeId === tab.id) {
            this.clearToolbar()
            this.activeId = null
            tab.onDeactivate?.(this.handleFor(tab))
        }
        this.bodies.get(tab.id)?.remove()
        this.bodies.delete(tab.id)
        this.handles.delete(tab.id)
        this.forget(tab.id)
    }

    /** Move `id` to the front of the hand-over order. */
    private remember(id: string): void {
        this.forget(id)
        this.recent.unshift(id)
    }

    private forget(id: string): void {
        const at = this.recent.indexOf(id)
        if (at >= 0) this.recent.splice(at, 1)
    }

    private fillToolbar(tab: RegisteredDockTab): void {
        const slot = this.toolbar
        if (!slot || !tab.toolbar) return
        const built = tab.toolbar(this.handleFor(tab))
        for (const element of Array.isArray(built) ? built : [built]) {
            slot.appendChild(element)
            this.toolbarItems.push(element)
        }
        this.paintSeparator()
    }

    /** Only worth drawing with a strip on one side of it and controls on the other. */
    private paintSeparator(): void {
        if (!this.separator) return
        const strip = Boolean(this.tabStrip?.childElementCount)
        this.separator.hidden = !strip || this.toolbarItems.length === 0
    }

    /**
     * Take back only what the active tab put in the slot. Anything else there belongs
     * to someone else — and `display: contents` means an emptied slot still costs
     * nothing, not even a flex gap, which is what keeps a swap invisible.
     */
    private clearToolbar(): void {
        for (const item of this.toolbarItems) item.remove()
        this.toolbarItems = []
        this.paintSeparator()
    }

    /**
     * One handle per tab, kept — so a tab that stashed the handle its `render` was
     * given still holds a live one on its next activation.
     */
    private handleFor(tab: RegisteredDockTab): DockTabHandle {
        const existing = this.handles.get(tab.id)
        if (existing) return existing

        // Read through a closure rather than a captured `this`: `active` has to answer
        // live, and a getter in an object literal has a `this` of its own.
        const isActive = () => this.activeId === tab.id
        const handle: DockTabHandle = {
            id: tab.id,
            get active() { return isActive() },
            // Through the registry rather than straight to `setActive`, so a tab driving
            // itself takes the same path as everyone else.
            activate: () => this.uiManager.activateDockTab(tab.id),
            refresh: () => this.uiManager.refreshDockTab(tab.id),
            setLabel: label => this.uiManager.setDockTabLabel(tab.id, label),
            remove: () => this.uiManager.removeDockTab(tab.id),
        }
        this.handles.set(tab.id, handle)
        return handle
    }

    private renderStrip(): void {
        const strip = this.tabStrip
        if (!strip) return

        strip.innerHTML = ''
        const tabs = this.tabs()
        // One tab is not a choice — nothing should point at a switch with one setting.
        // Same rule the table's own Nodes / Edges strip followed before the dock took it.
        if (tabs.length < 2) return this.paintSeparator()

        for (const tab of tabs) {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'pvt-dock-tab'
            button.dataset.tab = tab.id
            if (tab.icon) {
                const glyph = document.createElement('span')
                glyph.className = 'pvt-dock-tab-icon'
                // Trusted, like every other icon the consumer hands the library.
                glyph.innerHTML = tab.icon
                button.appendChild(glyph)
            }
            const text = document.createElement('span')
            text.textContent = tab.label
            button.appendChild(text)
            const active = tab.id === this.activeId
            button.classList.toggle('active', active)
            button.setAttribute('role', 'tab')
            button.setAttribute('aria-selected', String(active))
            strip.appendChild(button)
        }
        this.paintSeparator()
    }

    /* ---------- open / collapse ---------- */

    /** Whether the dock is showing at all (collapsed still counts as open). */
    public isOpen(): boolean {
        return this.open
    }

    public isCollapsed(): boolean {
        return this.collapsed
    }

    public setOpen(open: boolean): void {
        if (this.open === open) return
        this.open = open
        const wasCollapsed = this.collapsed
        // Opening onto a cramped layout should still fold rather than squeeze the canvas.
        if (open && this.autoCollapse && !this.userChose) this.collapsed = !this.hasRoom(EXPAND_ROOM_RATIO)
        this.apply()
        if (this.collapsed !== wasCollapsed) this.emitCollapsed()
    }

    public toggleOpen(): void {
        this.setOpen(!this.open)
    }

    public setCollapsed(collapsed: boolean): void {
        if (this.collapsed === collapsed) return
        this.collapsed = collapsed
        this.apply()
        this.emitCollapsed()
    }

    private emitCollapsed(): void {
        for (const watcher of [...this.collapseWatchers]) watcher(this.collapsed)
    }

    /* ---------- geometry ---------- */

    /**
     * Push the current state into the layout. One custom property drives the grid row,
     * so opening, collapsing and resizing are all the same operation.
     */
    private apply(): void {
        this.root?.classList.toggle('pvt-dock-collapsed', this.collapsed)
        this.root?.classList.toggle('pvt-dock-open', this.open)
        this.toggle?.setAttribute('aria-expanded', String(!this.collapsed))
        this.toggle?.setAttribute('title', `${this.collapsed ? 'Expand' : 'Collapse'} the ${this.label}`)

        // A region with nothing in it is not a region. The original gate said the dock
        // must not outlive its occupant; with a registry the occupants can come and go,
        // so the rule becomes a state rather than a construction-time verdict — and an
        // empty dock gives the row back instead of showing a bar with nothing behind it.
        const empty = this.tabs().length === 0
        this.root?.classList.toggle('pvt-dock-empty', empty)
        if (empty) return this.writeHeight(0)

        if (!this.open) return this.writeHeight(0)
        if (this.collapsed) return this.writeHeight(this.headerHeight())
        this.writeHeight(this.clampHeight(this.height ?? this.preferredHeight()))
    }

    private writeHeight(px: number): void {
        this.layoutRoot()?.style.setProperty('--pvt-dock-height', `${px}px`)
    }

    private layoutRoot(): HTMLElement | null {
        return this.root?.closest('.pvt-layout') as HTMLElement | null
    }

    /** Total height the canvas and the dock share. */
    private availableHeight(): number {
        return this.layoutRoot()?.getBoundingClientRect().height ?? 0
    }

    private headerHeight(): number {
        const measured = this.header?.getBoundingClientRect().height ?? 0
        // Pre-layout the header measures 0; fall back to its CSS height so a collapsed
        // dock still shows its bar on the very first frame.
        return measured > 0 ? measured : 34
    }

    /** `options.height` resolved: a fraction of the shared height, or a pixel count. */
    private preferredHeight(): number {
        const wanted = this.options.height ?? DEFAULT_HEIGHT_RATIO
        return wanted > 0 && wanted <= 1 ? this.availableHeight() * wanted : wanted
    }

    /**
     * Keep the dock between its own minimum and whatever leaves the canvas its floor.
     * On a layout too short for both, the canvas wins — it is the one that breaks.
     */
    private clampHeight(px: number): number {
        const ceiling = this.availableHeight() - MIN_CANVAS_HEIGHT
        if (ceiling <= MIN_DOCK_HEIGHT) return Math.max(0, Math.min(px, Math.max(ceiling, 0)))
        return Math.min(Math.max(px, MIN_DOCK_HEIGHT), ceiling)
    }

    /** Whether the layout can spare `ratio` docks' worth of room on top of the canvas floor. */
    private hasRoom(ratio: number): boolean {
        const available = this.availableHeight()
        // Pre-layout (0×0) is not a verdict — the observer will ask again with a real size.
        if (available === 0) return true
        return available - MIN_CANVAS_HEIGHT >= MIN_DOCK_HEIGHT * ratio
    }

    /**
     * Follow the available room while the collapsed state is still ours to choose. Two
     * thresholds, so a layout hovering on the boundary doesn't flap.
     */
    private observeRoom(): void {
        const layout = this.layoutRoot()
        if (!layout || typeof ResizeObserver === 'undefined') return

        this.observer = new ResizeObserver(() => {
            if (this.autoCollapse && !this.userChose && this.open) {
                if (!this.collapsed && !this.hasRoom(COLLAPSE_ROOM_RATIO)) return this.setCollapsed(true)
                if (this.collapsed && this.hasRoom(EXPAND_ROOM_RATIO)) return this.setCollapsed(false)
            }
            // A shorter layout can invalidate the height even when the state is unchanged.
            if (this.open && !this.collapsed) this.apply()
        })
        this.observer.observe(layout)
    }

    /* ---------- the divider ---------- */

    private wireDivider(): void {
        const divider = this.divider
        if (!divider) return

        this.listen(divider, 'pointerdown', (event) => {
            const pointer = event as PointerEvent
            // Dragging the divider is an explicit choice about the dock's size, so it
            // ends auto-management the same way clicking the toggle does.
            this.userChose = true
            if (this.collapsed) this.setCollapsed(false)
            this.dragPointer = pointer.pointerId
            divider.setPointerCapture(pointer.pointerId)
            divider.classList.add('pvt-dock-divider-dragging')
            pointer.preventDefault()
        })

        this.listen(divider, 'pointermove', (event) => {
            const pointer = event as PointerEvent
            if (this.dragPointer !== pointer.pointerId) return
            const bottom = this.layoutRoot()?.getBoundingClientRect().bottom ?? 0
            this.height = this.clampHeight(bottom - pointer.clientY)
            this.writeHeight(this.height)
        })

        const end = (event: Event) => {
            const pointer = event as PointerEvent
            if (this.dragPointer !== pointer.pointerId) return
            divider.releasePointerCapture(pointer.pointerId)
            divider.classList.remove('pvt-dock-divider-dragging')
            this.dragPointer = null
        }
        this.listen(divider, 'pointerup', end)
        this.listen(divider, 'pointercancel', end)
    }
}
