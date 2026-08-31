import { UIComponent } from '../../UIComponent'
import type { RailMode } from '../../ModeStore'
import './flyout.scss'

/**
 * Shared scaffolding for the settings flyouts — the overlays opened by the
 * mode rail's flyout modes: {@link ViewFlyout} (grid + canvas behaviour) and
 * {@link PhysicsFlyout} (layout + simulation). The base owns the panel element,
 * the shared `pvt-flyout-*` chrome (header, section labels, switch rows) and the
 * binding to {@link ModeStore} — a panel is `open` exactly while its own mode is
 * the active one, so the flyouts exclude each other for free.
 *
 * A subclass declares the mode it answers to, renders its controls in
 * {@link template} and wires them in {@link wire}. A subclass overriding
 * `onGraphReady` must call `super.onGraphReady()`: that's where switch rows get
 * their initial state (`graph.simulation` only exists by then).
 */
export abstract class Flyout extends UIComponent {
    protected panel?: HTMLDivElement
    /** Closures that push each switch row's live state onto its button. */
    private readonly toggleSync: Array<() => void> = []

    /** The rail mode that opens this flyout. */
    protected abstract readonly mode: RailMode
    /** The panel's inner markup. */
    protected abstract template(): string
    /** Attach listeners to the markup {@link template} produced. */
    protected abstract wire(): void

    /**
     * The rail mode this panel answers to. Public so the rail-mode registry can check a
     * registered flyout against the id its definition declared.
     */
    public getMode(): RailMode {
        return this.mode
    }

    protected get sim() {
        return this.uiManager.graph.simulation
    }

    protected onMount(container?: HTMLElement) {
        if (!container) return
        this.panel = document.createElement('div')
        this.panel.className = `pvt-flyout-panel pvt-flyout-${this.mode}`
        this.panel.innerHTML = this.template()
        container.appendChild(this.panel)
    }

    protected onAfterMount() {
        if (!this.panel) return
        this.wire()
        // Reflect the mode store: open while this flyout's mode is the active one.
        this.applyOpen(this.uiManager.modeStore.isFlyoutActive(this.mode))
        this.track(this.uiManager.modeStore.subscribe(state => this.applyOpen(state.mode === this.mode)))
    }

    protected onGraphReady() {
        for (const sync of this.toggleSync) sync()
    }

    protected onDestroy() {
        this.panel?.remove()
        this.panel = undefined
        this.toggleSync.length = 0
    }

    private applyOpen(open: boolean) {
        this.panel?.classList.toggle('open', open)
    }

    /* ---------- helpers for subclasses ---------- */

    /** `querySelector`, scoped to this flyout's panel. */
    protected query<T extends HTMLElement>(selector: string): T | null {
        return this.panel?.querySelector<T>(selector) ?? null
    }

    /** `querySelectorAll`, scoped to this flyout's panel. Empty before mount. */
    protected queryAll<T extends HTMLElement>(selector: string): T[] {
        return [...this.panel?.querySelectorAll<T>(selector) ?? []]
    }

    /** The flyout's title row. */
    protected headerRow(icon: string, label: string): string {
        return `<div class="pvt-flyout-header"><span class="pvt-flyout-icon">${icon}</span>${label}</div>`
    }

    /** An all-caps label introducing a group of controls. */
    protected sectionLabel(text: string): string {
        return `<div class="pvt-flyout-section-label">${text}</div>`
    }

    /**
     * A labelled switch row; wire it with {@link wireToggle} under the same `id`. The
     * note span is for a row that has something to report about its own effect (how many
     * nodes it is hiding, say) — filled through {@link toggleNote}, and invisible while
     * empty.
     */
    protected toggleRow(id: string, icon: string, label: string, desc: string): string {
        return `
            <button type="button" class="pvt-flyout-toggle" data-toggle="${id}" role="switch" aria-pressed="false" title="${desc}">
                <span class="pvt-flyout-icon">${icon}</span>${label}
                <span class="pvt-flyout-toggle-note" data-note="${id}"></span>
                <span class="pvt-flyout-switch"></span>
            </button>`
    }

    /**
     * Write a switch row's note, or clear it with an empty string. A note is short enough
     * to sit on the row — a count, not a sentence; `title` is where the sentence goes.
     */
    protected toggleNote(id: string, text: string, title = '') {
        const note = this.query<HTMLElement>(`.pvt-flyout-toggle-note[data-note="${id}"]`)
        if (!note) return
        note.textContent = text
        note.title = title
    }

    /**
     * Bind a switch row: `toggle` flips the underlying state, `read` reports it.
     * The click handler is attached now, but `read` usually touches the
     * simulation — so the initial state is pushed at `graphReady` instead.
     */
    protected wireToggle(id: string, toggle: () => void, read: () => boolean) {
        const button = this.query<HTMLButtonElement>(`.pvt-flyout-toggle[data-toggle="${id}"]`)
        if (!button) return
        const sync = () => button.setAttribute('aria-pressed', String(read()))
        this.toggleSync.push(sync)
        this.listen(button, 'click', () => { toggle(); sync() })
    }
}
