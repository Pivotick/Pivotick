/**
 * The two built-in pointer-modes of the control layout. Basic click-select, pan and
 * zoom work in *every* mode; a pointer-mode only decides what a plain drag / the
 * contextual tool panel does (rubber-band select vs. the armed create tool).
 */
export type PointerMode = 'select' | 'create'

/**
 * Built-in rail modes that open a settings flyout instead of deciding what a drag does:
 * `'view'` (grid + canvas behaviour) and `'physics'` (layout + simulation).
 */
export type FlyoutMode = 'view' | 'physics'

/** Whether a mode owns the tool panel or a settings flyout. */
export type RailModeKind = 'pointer' | 'flyout'

/**
 * Every mode the rail can be in: the four built-ins, plus the id of any mode registered
 * through `addRailMode`. Modes are **mutually exclusive** — opening a flyout deactivates
 * the active pointer-mode (and vice-versa), and only one flyout is open at a time.
 *
 * The `(string & {})` arm accepts a registered mode's id while keeping editor
 * autocomplete for the four built-in names.
 */
export type RailMode = PointerMode | FlyoutMode | (string & {})

/** Narrow a rail mode to one of the two *built-in* pointer-modes. */
export function isBuiltinPointerMode(mode: RailMode): mode is PointerMode {
    return mode === 'select' || mode === 'create'
}

/** Observable state of the mode rail. */
export interface ModeState {
    /** The active rail mode. Defaults to `'select'`. */
    mode: RailMode
    /**
     * The armed tool per pointer-mode (`'pointer'`/`null` = the mode default), keyed by
     * mode id. The rail slot reflects this: a non-default modal tool morphs the slot's
     * icon + label. Reset to the mode default when its mode is left.
     */
    armedTool: Record<string, string | null>
    /**
     * Whether each pointer-mode's contextual tool panel is expanded, keyed by mode id.
     * Remembered per mode (persists across mode switches); the armed tool does not.
     */
    panelOpen: Record<string, boolean>
}

type ModeListener = (state: Readonly<ModeState>) => void

/** The armed tool each built-in pointer-mode resets to on entry / when left. */
const DEFAULT_ARMED: Record<PointerMode, string | null> = { select: 'pointer', create: null }

/**
 * Initial per-mode panel-open state for the built-ins. Select boots collapsed (the rail
 * alone carries the mode; the panel is one click/keypress away); Create opens on first
 * entry so its tools are discoverable. A registered mode declares its own, defaulting to
 * open for the same reason Create does.
 */
const DEFAULT_PANEL_OPEN: Record<PointerMode, boolean> = { select: false, create: true }

/** What the store needs to know about a mode to hold state for it. */
interface ModeRecord {
    kind: RailModeKind
    defaultTool: string | null
}

/**
 * A tiny observable holding the mode-rail state. The rail, contextual tool panel
 * and the settings flyouts subscribe to it; clicks / keybindings dispatch to it.
 * Setters are idempotent — they only notify when the value actually changes — and
 * every notification carries a fresh snapshot so a listener can't mutate the
 * store's internal state.
 *
 * The four built-in modes are always present. Modes registered through `addRailMode`
 * are added with {@link registerMode} and hold state exactly like a built-in does.
 *
 * `subscribe` fires on *changes only*; render initial state from
 * {@link getState} first, then subscribe for updates.
 */
export class ModeStore {
    private state: ModeState = {
        mode: 'select',
        armedTool: { ...DEFAULT_ARMED },
        panelOpen: { ...DEFAULT_PANEL_OPEN },
    }
    /** Every known mode and its kind. The built-ins are permanent; the rest come and go. */
    private readonly modes = new Map<RailMode, ModeRecord>([
        ['select', { kind: 'pointer', defaultTool: DEFAULT_ARMED.select }],
        ['create', { kind: 'pointer', defaultTool: DEFAULT_ARMED.create }],
        ['view', { kind: 'flyout', defaultTool: null }],
        ['physics', { kind: 'flyout', defaultTool: null }],
    ])
    // Last pointer-mode, so closing a flyout returns to a pointer-mode rather
    // than stranding the rail with nothing active.
    private lastPointerMode: RailMode = 'select'
    private readonly listeners = new Set<ModeListener>()

    getMode(): RailMode {
        return this.state.mode
    }

    /** Whether a mode owns the tool panel. Unknown modes are not pointer-modes. */
    isPointerMode(mode: RailMode): boolean {
        return this.modes.get(mode)?.kind === 'pointer'
    }

    /** Whether a mode is currently registered (the four built-ins always are). */
    hasMode(mode: RailMode): boolean {
        return this.modes.has(mode)
    }

    /** The tool a mode rests on when nothing special is armed. */
    getDefaultTool(mode: RailMode): string | null {
        return this.modes.get(mode)?.defaultTool ?? null
    }

    /**
     * Add a mode's state to the store. Called by the rail-mode registry; the four
     * built-ins are already present. Re-registering an id overwrites its record but keeps
     * whatever tool/panel state it already had.
     */
    registerMode(mode: RailMode, kind: RailModeKind, defaultTool: string | null = null, panelOpen = true): void {
        this.modes.set(mode, { kind, defaultTool })
        if (kind !== 'pointer') return
        if (!(mode in this.state.armedTool)) this.state.armedTool[mode] = defaultTool
        if (!(mode in this.state.panelOpen)) this.state.panelOpen[mode] = panelOpen
    }

    /**
     * Drop a mode's state. The caller is responsible for moving off it first — the store
     * will not decide what to activate instead.
     */
    unregisterMode(mode: RailMode): void {
        if (isBuiltinPointerMode(mode) || mode === 'view' || mode === 'physics') return
        this.modes.delete(mode)
        delete this.state.armedTool[mode]
        delete this.state.panelOpen[mode]
        if (this.lastPointerMode === mode) this.lastPointerMode = 'select'
    }

    /** Whether a flyout is open (i.e. its mode is the active one). */
    isFlyoutActive(mode: RailMode): boolean {
        return this.state.mode === mode
    }

    /** @deprecated use `isFlyoutActive('view')` — the rail has more than one flyout now. */
    isViewActive(): boolean {
        return this.isFlyoutActive('view')
    }

    /** @deprecated use `toggleFlyout('view')` — the rail has more than one flyout now. */
    toggleView(): void {
        this.toggleFlyout('view')
    }

    /** The armed tool for a pointer-mode (`'pointer'`/`null` = default). */
    getArmedTool(mode: RailMode): string | null {
        return this.state.armedTool[mode] ?? null
    }

    /** Whether a pointer-mode's tool panel is currently expanded. */
    isPanelOpen(mode: RailMode): boolean {
        return this.state.panelOpen[mode] ?? false
    }

    /** A copy of the current state (safe to read; mutations don't leak back). */
    getState(): Readonly<ModeState> {
        return {
            mode: this.state.mode,
            armedTool: { ...this.state.armedTool },
            panelOpen: { ...this.state.panelOpen },
        }
    }

    setMode(mode: RailMode): void {
        if (this.state.mode === mode) return
        if (this.isPointerMode(mode)) this.lastPointerMode = mode
        this.state.mode = mode
        this.emit()
    }

    /** Open a flyout mode, or close it back to the last pointer-mode. */
    toggleFlyout(mode: RailMode): void {
        this.setMode(this.state.mode === mode ? this.lastPointerMode : mode)
    }

    /** Arm a tool in a pointer-mode (the rail slot reflects it). Idempotent. */
    armTool(mode: RailMode, tool: string | null): void {
        if (this.state.armedTool[mode] === tool) return
        this.state.armedTool[mode] = tool
        this.emit()
    }

    /** Expand / collapse a pointer-mode's tool panel. Idempotent. */
    setPanelOpen(mode: RailMode, open: boolean): void {
        if (this.state.panelOpen[mode] === open) return
        this.state.panelOpen[mode] = open
        this.emit()
    }

    /** Toggle a pointer-mode's tool panel open/closed. */
    toggleToolPanel(mode: RailMode): void {
        this.setPanelOpen(mode, !this.state.panelOpen[mode])
    }

    /** Subscribe to state changes. Returns an unsubscribe fn (pass to `UIComponent.track`). */
    subscribe(listener: ModeListener): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    /** Drop every subscriber (called on UI teardown). */
    dispose(): void {
        this.listeners.clear()
    }

    private emit(): void {
        const snapshot = this.getState()
        // Snapshot the listener set so an unsubscribe during dispatch is safe.
        for (const listener of [...this.listeners]) listener(snapshot)
    }
}
