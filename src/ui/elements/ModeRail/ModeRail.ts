import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import type { ModeState, PointerMode, RailMode } from '../../ModeStore'
import type { RailModeDefinition } from '../../../interfaces/GraphUI'
import { railModeKind, resolveRailTools } from '../../railModes'
import { cursor, addCircle, show, atom, lassoTool, graphEdgeIcon } from '../../icons'
import './moderail.scss'

/**
 * The left-edge mode rail. Holds the four exclusive built-in modes — the Select and
 * Create pointer-modes plus the View and Physics settings flyouts — followed by any
 * modes registered through {@link UIManager.addRailMode}, below a divider of their own.
 * It owns no logic beyond presentation + dispatching to the {@link UIManager.modeStore};
 * the rail, contextual tool panel and flyouts react to that shared store.
 *
 * The built-in modes are hardcoded here; the registry only ever appends. Registered modes
 * arrive *after* this component has mounted — plugins install once the UI is built — so
 * the rail subscribes to the registry and rebuilds its zone on every change.
 *
 * A pointer-mode slot doubles as a split-button: clicking the *active* mode toggles its
 * tool panel, and the slot's icon + label reflect the armed tool (e.g. `Select` →
 * `Lasso`), for registered modes as much as for the built-ins.
 */
export class ModeRail extends UIComponent {
    private rail?: HTMLDivElement
    private readonly buttons = new Map<string, HTMLButtonElement>()
    /** The zone registered modes render into, below their own divider. */
    private pluginZone?: HTMLDivElement
    /** Button ids owned by the registry, so a rebuild only clears its own. */
    private readonly pluginButtonIds = new Set<string>()
    /** Keybindings registered for the current set of registered modes. */
    private readonly pluginDisposers: Array<() => void> = []

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    protected onMount(container?: HTMLElement) {
        if (!container) return

        this.rail = document.createElement('div')
        this.rail.className = 'pvt-moderail-rail'

        // The four exclusive built-in modes: Select, Create, View, Physics. Select is
        // the guaranteed fallback and always here; the other three answer to their
        // options — Create to whether any of its four tools survived, the two flyouts
        // to their own switches.
        this.rail.appendChild(this.makeButton('select', 'Select', cursor, 'V'))
        if (this.uiManager.hasCreateTools()) {
            this.rail.appendChild(this.makeButton('create', 'Create', addCircle, 'C'))
        }
        if (this.uiManager.isFeatureEnabled('viewFlyout')) {
            this.rail.appendChild(this.makeButton('view', 'View', show))
        }
        if (this.uiManager.isFeatureEnabled('physicsFlyout')) {
            this.rail.appendChild(this.makeButton('physics', 'Physics', atom))
        }

        // Everything registered through `addRailMode` lands here, after the built-ins.
        this.pluginZone = document.createElement('div')
        this.pluginZone.className = 'pvt-moderail-zone'
        this.rail.appendChild(this.pluginZone)

        container.appendChild(this.rail)
    }

    protected onAfterMount() {
        this.buttons.get('select')?.addEventListener('click', () => this.activateOrToggle('select'))
        this.buttons.get('create')?.addEventListener('click', () => this.activateOrToggle('create'))
        this.buttons.get('view')?.addEventListener('click', () => this.uiManager.modeStore.toggleFlyout('view'))
        this.buttons.get('physics')?.addEventListener('click', () => this.uiManager.modeStore.toggleFlyout('physics'))

        // Keyboard mirrors the rail slot: V/C switch to the mode, or toggle its
        // tool panel if that mode is already active. A mode with no slot has no key.
        this.track(this.uiManager.keyManager.register({ key: 'v', callback: () => this.activateOrToggle('select'), description: 'Select mode / toggle its tools' }))
        if (this.buttons.has('create')) {
            this.track(this.uiManager.keyManager.register({ key: 'c', callback: () => this.activateOrToggle('create'), description: 'Create mode / toggle its tools' }))
        }

        // Registered modes can arrive at any point, including before this runs.
        this.rebuildPluginZone()
        this.track(this.uiManager.onRailModesChanged(() => this.rebuildPluginZone()))

        // Reflect the store; render the initial state, then subscribe for changes.
        this.render(this.uiManager.modeStore.getState())
        this.track(this.uiManager.modeStore.subscribe((state) => this.render(state)))

        this.publishHeight()
    }

    protected onDestroy() {
        for (const dispose of this.pluginDisposers.splice(0)) dispose()
        this.layoutRoot()?.style.removeProperty('--pvt-moderail-height')
        this.rail?.remove()
        this.rail = undefined
        this.pluginZone = undefined
        this.pluginButtonIds.clear()
        this.buttons.clear()
    }

    /**
     * Rebuild the registered-mode zone from the registry. Cheap and idempotent: the zone
     * holds a handful of buttons, so a full rebuild beats diffing, and it keeps ordering
     * correct when a mode is added in the middle.
     */
    private rebuildPluginZone() {
        const zone = this.pluginZone
        if (!zone) return

        for (const dispose of this.pluginDisposers.splice(0)) dispose()
        for (const id of this.pluginButtonIds) this.buttons.delete(id)
        this.pluginButtonIds.clear()
        zone.replaceChildren()

        const modes = this.uiManager.getRailModes()
        if (modes.length) zone.appendChild(this.makeDivider())

        for (const mode of modes) {
            const button = this.makeButton(mode.id, mode.label, mode.icon, mode.shortcut)
            this.pluginButtonIds.add(mode.id)
            zone.appendChild(button)

            const activate = () => this.activateRegistered(mode)
            button.addEventListener('click', activate)
            if (mode.shortcut) {
                this.pluginDisposers.push(this.uiManager.keyManager.register({
                    key: mode.shortcut.toLowerCase(),
                    callback: activate,
                    description: `${mode.label} mode`,
                }))
            }
        }

        // The new buttons have no active state or armed face yet.
        this.render(this.uiManager.modeStore.getState())
    }

    /**
     * Publish the rail's height as `--pvt-moderail-height`. The rail grows down the
     * canvas's left column, so anything else docked there (the legend) can size
     * itself against it instead of guessing — see `legend.scss`. Observed rather
     * than computed: the height moves with whatever modes are registered, and with
     * whatever the label font resolves to.
     */
    private publishHeight(): void {
        const rail = this.rail
        if (!rail) return

        const write = (): void => {
            const height = rail.getBoundingClientRect().height
            this.layoutRoot()?.style.setProperty('--pvt-moderail-height', `${height}px`)
        }
        write()

        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(write)
        observer.observe(rail)
        this.track(() => observer.disconnect())
    }

    private layoutRoot(): HTMLElement | null {
        return (this.rail?.closest('.pvt-layout') as HTMLElement | null) ?? null
    }

    /** Click the active mode to toggle its panel; click another to switch to it. */
    private activateOrToggle(mode: RailMode) {
        const store = this.uiManager.modeStore
        if (store.getMode() === mode) store.toggleToolPanel(mode)
        else store.setMode(mode)
    }

    /** A registered mode's slot: flyout modes toggle their panel, pointer modes behave like Select. */
    private activateRegistered(mode: RailModeDefinition) {
        if (railModeKind(mode) === 'flyout') this.uiManager.modeStore.toggleFlyout(mode.id)
        else this.activateOrToggle(mode.id)
    }

    /** Highlight the active mode and reflect each pointer-mode's armed tool. */
    private render(state: Readonly<ModeState>) {
        for (const [key, button] of this.buttons) {
            const active = key === state.mode
            button.classList.toggle('active', active)
            button.setAttribute('aria-pressed', String(active))
        }
        this.applyFace('select', state.armedTool.select)
        this.applyFace('create', state.armedTool.create)

        for (const mode of this.uiManager.getRailModes()) {
            if (railModeKind(mode) !== 'pointer') continue
            this.applyRegisteredFace(mode, state.armedTool[mode.id] ?? null)
        }
    }

    /** Set a built-in mode slot's icon + label to match its armed tool (mode name at rest). */
    private applyFace(mode: PointerMode, armed: string | null) {
        const { icon, label } = this.railFace(mode, armed)
        this.paintFace(mode, icon, label)
    }

    /**
     * The same treatment for a registered mode, taken straight off the armed tool — a
     * registered mode needs no hook for this, because its tools already carry an icon and
     * a label.
     *
     * The mode's *resting* tool is the exception, and it matches what the built-ins do:
     * Select armed on Pointer still reads `Select`. Otherwise a mode that declares a
     * default tool would be permanently renamed by it.
     */
    private applyRegisteredFace(mode: RailModeDefinition, armed: string | null) {
        const resting = armed === null || armed === (mode.defaultTool ?? null)
        const tool = resting ? undefined : resolveRailTools(mode).find(t => t.id === armed)
        this.paintFace(mode.id, tool?.icon ?? mode.icon, tool?.label ?? mode.label)
    }

    private paintFace(key: string, icon: string, label: string) {
        const button = this.buttons.get(key)
        if (!button) return
        const iconEl = button.querySelector('.pvt-moderail-icon')
        const labelEl = button.querySelector('.pvt-moderail-label')
        if (iconEl) iconEl.innerHTML = icon
        if (labelEl) labelEl.textContent = label
    }

    private railFace(mode: PointerMode, armed: string | null): { icon: string; label: string } {
        if (mode === 'select') {
            return armed === 'lasso' ? { icon: lassoTool, label: 'Lasso' } : { icon: cursor, label: 'Select' }
        }
        return armed === 'add-edge' ? { icon: graphEdgeIcon(20), label: 'Edge' } : { icon: addCircle, label: 'Create' }
    }

    private makeDivider(): HTMLDivElement {
        const divider = document.createElement('div')
        divider.className = 'pvt-moderail-divider'
        return divider
    }

    private makeButton(key: string, label: string, icon: string, shortcut?: string): HTMLButtonElement {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'pvt-moderail-button'
        button.dataset.mode = key
        button.title = shortcut ? `${label} (${shortcut.toUpperCase()})` : label
        button.innerHTML = `<span class="pvt-moderail-icon">${icon}</span><span class="pvt-moderail-label">${label}</span>`
        this.buttons.set(key, button)
        return button
    }

}
