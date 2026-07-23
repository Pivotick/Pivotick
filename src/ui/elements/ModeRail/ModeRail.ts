import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import type { ModeState, PointerMode } from '../../ModeStore'
import { cursor, addCircle, show, sparkles, lassoTool, graphEdgeIcon } from '../../icons'
import './moderail.scss'

/**
 * The B3 left-edge mode rail. Holds the three exclusive modes (Select, Create,
 * View) and a disabled "SOON" Enrich affordance. It owns no logic beyond
 * presentation + dispatching to the {@link UIManager.modeStore}; the rail and
 * contextual tool panel react to that shared store.
 *
 * The Select/Create slots double as split-buttons: clicking the *active* mode
 * toggles its tool panel, and the slot's icon + label reflect the armed tool
 * (e.g. `Select` → `Lasso`).
 */
export class ModeRail extends UIComponent {
    private rail?: HTMLDivElement
    private readonly buttons = new Map<string, HTMLButtonElement>()

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    protected onMount(container?: HTMLElement) {
        if (!container) return

        this.rail = document.createElement('div')
        this.rail.className = 'pvt-moderail-rail'

        // The three exclusive modes: Select, Create, View.
        this.rail.appendChild(this.makeButton('select', 'Select', cursor, 'V'))
        this.rail.appendChild(this.makeButton('create', 'Create', addCircle, 'C'))
        this.rail.appendChild(this.makeButton('view', 'View', show))

        // DATA zone — Enrich ships later; render it disabled with a SOON badge.
        const divider = document.createElement('div')
        divider.className = 'pvt-moderail-divider'
        this.rail.appendChild(divider)
        this.rail.appendChild(this.makeSoonButton('enrich', 'Enrich', sparkles))

        container.appendChild(this.rail)
    }

    protected onAfterMount() {
        this.buttons.get('select')?.addEventListener('click', () => this.activateOrToggle('select'))
        this.buttons.get('create')?.addEventListener('click', () => this.activateOrToggle('create'))
        this.buttons.get('view')?.addEventListener('click', () => this.uiManager.modeStore.toggleView())

        // Keyboard: V → Select, C → Create (switch only — no panel toggle).
        this.track(this.uiManager.keyManager.register({ key: 'v', callback: () => this.uiManager.modeStore.setMode('select'), description: 'Select mode' }))
        this.track(this.uiManager.keyManager.register({ key: 'c', callback: () => this.uiManager.modeStore.setMode('create'), description: 'Create mode' }))

        // Reflect the store; render the initial state, then subscribe for changes.
        this.render(this.uiManager.modeStore.getState())
        this.track(this.uiManager.modeStore.subscribe((state) => this.render(state)))
    }

    protected onDestroy() {
        this.rail?.remove()
        this.rail = undefined
        this.buttons.clear()
    }

    /** Click the active mode to toggle its panel; click another to switch to it. */
    private activateOrToggle(mode: PointerMode) {
        const store = this.uiManager.modeStore
        if (store.getMode() === mode) store.toggleToolPanel(mode)
        else store.setMode(mode)
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
    }

    /** Set a mode slot's icon + label to match its armed tool (mode name at rest). */
    private applyFace(mode: PointerMode, armed: string | null) {
        const button = this.buttons.get(mode)
        if (!button) return
        const { icon, label } = this.railFace(mode, armed)
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

    private makeButton(key: string, label: string, icon: string, shortcut?: string): HTMLButtonElement {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'pvt-moderail-button'
        button.dataset.mode = key
        button.title = shortcut ? `${label} (${shortcut})` : label
        button.innerHTML = `<span class="pvt-moderail-icon">${icon}</span><span class="pvt-moderail-label">${label}</span>`
        this.buttons.set(key, button)
        return button
    }

    private makeSoonButton(key: string, label: string, icon: string): HTMLButtonElement {
        const button = this.makeButton(key, label, icon)
        button.classList.add('pvt-moderail-soon')
        button.disabled = true
        button.title = `${label} — coming soon`
        button.innerHTML += '<span class="pvt-moderail-badge">SOON</span>'
        return button
    }
}
