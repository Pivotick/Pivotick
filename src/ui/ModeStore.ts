/**
 * The two pointer-modes of the B3 control layout. Basic click-select, pan and
 * zoom work in *every* mode; a pointer-mode only decides what a plain drag / the
 * contextual tool panel does (rubber-band select vs. the armed create tool).
 */
export type PointerMode = 'select' | 'create'

/**
 * Every mode the rail can be in. Select/Create are pointer-modes; `'view'` opens
 * the settings flyout and is **mutually exclusive** with them — entering View
 * deactivates Select/Create (and vice-versa).
 */
export type RailMode = PointerMode | 'view'

/** Observable state of the mode rail. */
export interface ModeState {
    /** The active rail mode. Defaults to `'select'`. */
    mode: RailMode
    /**
     * The armed tool per pointer-mode (`'pointer'`/`null` = the mode default).
     * The rail slot reflects this: a non-default modal tool morphs the slot's
     * icon + label. Reset to the mode default when its mode is left.
     */
    armedTool: Record<PointerMode, string | null>
    /**
     * Whether each pointer-mode's contextual tool panel is expanded. Remembered
     * per mode (persists across mode switches); the armed tool does not.
     */
    panelOpen: Record<PointerMode, boolean>
}

type ModeListener = (state: Readonly<ModeState>) => void

/** The armed tool each pointer-mode resets to on entry / when left. */
const DEFAULT_ARMED: Record<PointerMode, string | null> = { select: 'pointer', create: null }

/**
 * Initial per-mode panel-open state. **Internal knob (B3 Q6, undecided):** flip
 * `select` to `false` to preview the collapsed-by-default Select look. Kept a
 * plain constant — not a public option — until the default is set in stone.
 */
const DEFAULT_PANEL_OPEN: Record<PointerMode, boolean> = { select: true, create: true }

/**
 * A tiny observable holding the mode-rail state. The rail, contextual tool panel
 * and View flyout subscribe to it; clicks / keybindings dispatch to it. Setters
 * are idempotent — they only notify when the value actually changes — and every
 * notification carries a fresh snapshot so a listener can't mutate the store's
 * internal state.
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
    // Last pointer-mode, so toggling View off returns to Select/Create rather
    // than stranding the rail with nothing active.
    private lastPointerMode: PointerMode = 'select'
    private readonly listeners = new Set<ModeListener>()

    getMode(): RailMode {
        return this.state.mode
    }

    /** Whether the View flyout is open (i.e. View is the active mode). */
    isViewActive(): boolean {
        return this.state.mode === 'view'
    }

    /** The armed tool for a pointer-mode (`'pointer'`/`null` = default). */
    getArmedTool(mode: PointerMode): string | null {
        return this.state.armedTool[mode]
    }

    /** Whether a pointer-mode's tool panel is currently expanded. */
    isPanelOpen(mode: PointerMode): boolean {
        return this.state.panelOpen[mode]
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
        if (mode !== 'view') this.lastPointerMode = mode
        this.state.mode = mode
        this.emit()
    }

    /** Enter View mode, or leave it back to the last pointer-mode. */
    toggleView(): void {
        this.setMode(this.state.mode === 'view' ? this.lastPointerMode : 'view')
    }

    /** Arm a tool in a pointer-mode (the rail slot reflects it). Idempotent. */
    armTool(mode: PointerMode, tool: string | null): void {
        if (this.state.armedTool[mode] === tool) return
        this.state.armedTool[mode] = tool
        this.emit()
    }

    /** Expand / collapse a pointer-mode's tool panel. Idempotent. */
    setPanelOpen(mode: PointerMode, open: boolean): void {
        if (this.state.panelOpen[mode] === open) return
        this.state.panelOpen[mode] = open
        this.emit()
    }

    /** Toggle a pointer-mode's tool panel open/closed. */
    toggleToolPanel(mode: PointerMode): void {
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
