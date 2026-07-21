/**
 * The two real pointer-modes of the B3 control layout. Basic click-select, pan
 * and zoom work in *every* mode; the mode only decides what a plain drag / the
 * contextual tool panel does (rubber-band select vs. the armed create tool).
 * `View` is deliberately **not** a mode — it's an always-available settings
 * flyout tracked here by {@link ModeState.viewFlyoutOpen}.
 */
export type PointerMode = 'select' | 'create'

/**
 * Whether the experimental B3 mode-driven chrome is enabled (see
 * {@link GraphUI.experimentalB3Chrome}). Temporary migration helper — removed
 * once B3 is the default chrome.
 */
export function isB3ChromeEnabled(options: { experimentalB3Chrome?: boolean }): boolean {
    return options.experimentalB3Chrome === true
}

/** Observable state of the mode rail + View flyout. */
export interface ModeState {
    /** Active pointer-mode. Defaults to `'select'`. */
    mode: PointerMode
    /** Whether the View settings flyout is open. Defaults to `false`. */
    viewFlyoutOpen: boolean
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
    private state: ModeState = { mode: 'select', viewFlyoutOpen: false }
    private readonly listeners = new Set<ModeListener>()

    getMode(): PointerMode {
        return this.state.mode
    }

    isViewFlyoutOpen(): boolean {
        return this.state.viewFlyoutOpen
    }

    /** A copy of the current state (safe to read; mutations don't leak back). */
    getState(): Readonly<ModeState> {
        return { ...this.state }
    }

    setMode(mode: PointerMode): void {
        if (this.state.mode === mode) return
        this.state.mode = mode
        this.emit()
    }

    setViewFlyoutOpen(open: boolean): void {
        if (this.state.viewFlyoutOpen === open) return
        this.state.viewFlyoutOpen = open
        this.emit()
    }

    toggleViewFlyout(): void {
        this.setViewFlyoutOpen(!this.state.viewFlyoutOpen)
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
