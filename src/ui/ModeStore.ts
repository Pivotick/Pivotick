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
}

type ModeListener = (state: Readonly<ModeState>) => void

/**
 * A tiny observable holding the mode-rail state. The rail, contextual panels,
 * View flyout and canvas cursor subscribe to it; clicks / keybindings dispatch
 * to it. Setters are idempotent — they only notify when the value actually
 * changes — and every notification carries a fresh snapshot so a listener can't
 * mutate the store's internal state.
 *
 * `subscribe` fires on *changes only*; render initial state from
 * {@link getState} first, then subscribe for updates.
 */
export class ModeStore {
    private state: ModeState = { mode: 'select' }
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

    /** A copy of the current state (safe to read; mutations don't leak back). */
    getState(): Readonly<ModeState> {
        return { ...this.state }
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
