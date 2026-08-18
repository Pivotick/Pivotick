/**
 * The two pointer-modes of the B3 control layout. Basic click-select, pan and
 * zoom work in *every* mode; a pointer-mode only decides what a plain drag / the
 * contextual tool panel does (rubber-band select vs. the armed create tool).
 */
export type PointerMode = 'select' | 'create'

/**
 * Rail modes that open a settings flyout instead of deciding what a drag does:
 * `'view'` (grid + canvas behaviour) and `'physics'` (layout + simulation).
 */
export type FlyoutMode = 'view' | 'physics'

/**
 * Every mode the rail can be in. Pointer-modes and flyout-modes are **mutually
 * exclusive** — opening a flyout deactivates Select/Create (and vice-versa), and
 * only one flyout is open at a time.
 */
export type RailMode = PointerMode | FlyoutMode

/** Narrow a rail mode to a pointer-mode (i.e. not a flyout). */
export function isPointerMode(mode: RailMode): mode is PointerMode {
    return mode === 'select' || mode === 'create'
}

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
 * Initial per-mode panel-open state. Select boots collapsed (the rail alone
 * carries the mode; the panel is one click/keypress away); Create opens on first
 * entry so its tools are discoverable. Internal knob — not a public option yet.
 */
const DEFAULT_PANEL_OPEN: Record<PointerMode, boolean> = { select: false, create: true }

/**
 * A tiny observable holding the mode-rail state. The rail, contextual tool panel
 * and the settings flyouts subscribe to it; clicks / keybindings dispatch to it.
 * Setters are idempotent — they only notify when the value actually changes — and
 * every notification carries a fresh snapshot so a listener can't mutate the
 * store's internal state.
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
    // Last pointer-mode, so closing a flyout returns to Select/Create rather
    // than stranding the rail with nothing active.
    private lastPointerMode: PointerMode = 'select'
    private readonly listeners = new Set<ModeListener>()

    getMode(): RailMode {
        return this.state.mode
    }

    /** Whether a flyout is open (i.e. its mode is the active one). */
    isFlyoutActive(mode: FlyoutMode): boolean {
        return this.state.mode === mode
    }

    /** @deprecated use `isFlyoutActive('view')` — the rail has more than one flyout now. */
    isViewActive(): boolean {
        return this.isFlyoutActive('view')
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
        if (isPointerMode(mode)) this.lastPointerMode = mode
        this.state.mode = mode
        this.emit()
    }

    /** Open a flyout mode, or close it back to the last pointer-mode. */
    toggleFlyout(mode: FlyoutMode): void {
        this.setMode(this.state.mode === mode ? this.lastPointerMode : mode)
    }

    /** @deprecated use `toggleFlyout('view')` — the rail has more than one flyout now. */
    toggleView(): void {
        this.toggleFlyout('view')
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
