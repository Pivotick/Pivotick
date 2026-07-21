import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import type { ModeState, PointerMode } from '../../ModeStore'
import { cursor, addCircle, show, sparkles } from '../../icons'
import './moderail.scss'

/**
 * The B3 left-edge mode rail. Holds the two real pointer-modes (Select, Create),
 * a View button that toggles the settings flyout, and a disabled "SOON" Enrich
 * affordance. It owns no logic beyond presentation + dispatching to the
 * {@link UIManager.modeStore}; the rail, contextual panels, View flyout and
 * canvas cursor all react to that shared store.
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

        // Pointer-modes (exclusive) + View (independent flyout toggle).
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
        this.buttons.get('select')?.addEventListener('click', () => this.uiManager.modeStore.setMode('select'))
        this.buttons.get('create')?.addEventListener('click', () => this.uiManager.modeStore.setMode('create'))
        this.buttons.get('view')?.addEventListener('click', () => this.uiManager.modeStore.toggleViewFlyout())

        // Keyboard: V → Select, C → Create (focus-gated via the key manager).
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

    /** Highlight the active pointer-mode and the View button when its flyout is open. */
    private render(state: Readonly<ModeState>) {
        for (const [key, button] of this.buttons) {
            const active = key === 'view' ? state.viewFlyoutOpen : key === (state.mode as PointerMode)
            button.classList.toggle('active', active)
            button.setAttribute('aria-pressed', String(active))
        }
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
