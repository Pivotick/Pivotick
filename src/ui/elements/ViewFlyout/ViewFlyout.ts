import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import { PHYSICS_KNOB_RANGES, type PhysicsKnobs, type PhysicsPresetName } from '../../../Simulation'
import hasCycle from '../../../plugins/analytics/cycle'
import {
    show, atom, play, pause,
    magnet, arrowsHorizontal, circleDashed, wind,
    snapGrid, grid, pin, graphNavigationReset,
} from '../../icons'
import './viewflyout.scss'

type SliderKey = keyof PhysicsKnobs

// `desc` is surfaced as a hover tooltip (native `title`) so each knob explains itself.
const SLIDERS: Array<{ key: SliderKey; label: string; desc: string; icon: string; set: (sim: import('../../../Simulation').Simulation, v: number) => void }> = [
    { key: 'repulsion', label: 'Repulsion', desc: 'How strongly nodes push each other apart. Higher values spread the graph out.', icon: magnet, set: (s, v) => s.setRepulsion(v) },
    { key: 'linkDistance', label: 'Link distance', desc: 'The resting length of edges, in pixels. Higher values place connected nodes further apart.', icon: arrowsHorizontal, set: (s, v) => s.setLinkDistance(v) },
    { key: 'collisionRadius', label: 'Collision radius', desc: 'The clear space kept around each node to prevent overlap. Higher values keep nodes further apart.', icon: circleDashed, set: (s, v) => s.setCollisionRadius(v) },
    { key: 'friction', label: 'Friction', desc: 'How quickly node motion is damped. Higher values calm the layout and settle it faster.', icon: wind, set: (s, v) => s.setFriction(v) },
]

const PRESETS: PhysicsPresetName[] = ['tight', 'loose', 'default']

/** Tooltip for each preset button, explaining the layout it produces. */
const PRESET_DESCRIPTIONS: Record<PhysicsPresetName, string> = {
    tight: 'Compact layout with nodes packed closely together.',
    loose: 'Spacious layout with nodes spread further apart.',
    default: 'Reset the physics sliders to their default balance.',
}

/** Layout choices offered by the flyout (tree variants are disabled on cyclic graphs). */
const LAYOUTS: Array<{ id: string; label: string; tree: boolean; desc: string }> = [
    { id: 'force', label: 'Force', tree: false, desc: 'Positions nodes freely using the physics simulation.' },
    { id: 'tree-v', label: 'Tree — Vertical', tree: true, desc: 'Hierarchical tree flowing from top to bottom.' },
    { id: 'tree-h', label: 'Tree — Horizontal', tree: true, desc: 'Hierarchical tree flowing from left to right.' },
    { id: 'tree-r', label: 'Tree — Radial', tree: true, desc: 'Hierarchical tree radiating out from a central root.' },
]

/**
 * The B3 View flyout: an overlay toggled by the mode rail's View button (via
 * {@link UIManager.modeStore}). Consolidates the layout control, the physics
 * card (presets + sliders driving the {@link Simulation} setter API + a run
 * toggle) and the grid / freeze toggles — the graph's view/layout settings in one
 * place. Physics presets + sliders grey out under non-`force` layouts (D6/D7).
 */
export class ViewFlyout extends UIComponent {
    private flyout?: HTMLDivElement
    private layoutSelect?: HTMLSelectElement
    private runButton?: HTMLButtonElement
    private physicsCard?: HTMLDivElement
    private readonly sliders = new Map<SliderKey, HTMLInputElement>()
    private readonly sliderValues = new Map<SliderKey, HTMLElement>()
    private readonly presetButtons = new Map<PhysicsPresetName, HTMLButtonElement>()
    /** Closures that push each toggle's live state onto its button — run once the simulation exists. */
    private readonly toggleSync: Array<() => void> = []

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    private get sim() {
        return this.uiManager.graph.simulation
    }

    protected onMount(container?: HTMLElement) {
        if (!container) return
        this.flyout = document.createElement('div')
        this.flyout.className = 'pvt-viewflyout-panel'
        this.flyout.innerHTML = this.template()
        container.appendChild(this.flyout)
    }

    protected onAfterMount() {
        if (!this.flyout) return
        this.layoutSelect = this.flyout.querySelector('.pvt-viewflyout-layout-select') as HTMLSelectElement
        this.runButton = this.flyout.querySelector('.pvt-viewflyout-run') as HTMLButtonElement
        this.physicsCard = this.flyout.querySelector('.pvt-viewflyout-physics') as HTMLDivElement

        for (const spec of SLIDERS) {
            this.sliders.set(spec.key, this.flyout.querySelector(`.pvt-viewflyout-range[data-slider="${spec.key}"]`) as HTMLInputElement)
            this.sliderValues.set(spec.key, this.flyout.querySelector(`.pvt-viewflyout-slider-value[data-value="${spec.key}"]`) as HTMLElement)
        }
        for (const name of PRESETS) {
            this.presetButtons.set(name, this.flyout.querySelector(`.pvt-viewflyout-preset[data-preset="${name}"]`) as HTMLButtonElement)
        }

        this.wireLayout()
        this.wirePhysics()
        this.wireToggles()

        // Reflect the mode store: show/hide with the View flyout flag.
        this.applyOpen(this.uiManager.modeStore.isViewActive())
        this.track(this.uiManager.modeStore.subscribe((s) => this.applyOpen(s.mode === 'view')))
    }

    protected onGraphReady() {
        // Disable tree layouts on cyclic graphs (they can't be drawn as a tree).
        const cyclic = hasCycle(this.uiManager.graph.getNodes(), this.uiManager.graph.getEdges())
        if (cyclic && this.layoutSelect) {
            for (const option of Array.from(this.layoutSelect.options)) {
                const choice = LAYOUTS.find(l => l.id === option.value)
                if (choice?.tree) {
                    option.disabled = true
                    option.title = 'The graph contains a cycle, so it cannot be displayed as a tree.'
                }
            }
        }
        // Seed physics from the live simulation (only available by graphReady —
        // the UIManager, and thus this component, is built before graph.simulation).
        this.refreshSliders(this.sim.getPhysicsKnobs())
        this.updateRunButton()
        this.updatePhysicsEnabled()
        for (const sync of this.toggleSync) sync()
        if (this.layoutSelect) this.layoutSelect.value = this.sim.getLayoutType() === 'force' ? 'force' : 'tree-v'
    }

    protected onDestroy() {
        this.flyout?.remove()
        this.flyout = undefined
        this.sliders.clear()
        this.sliderValues.clear()
        this.presetButtons.clear()
    }

    /* ---------- open / close ---------- */

    private applyOpen(open: boolean) {
        this.flyout?.classList.toggle('open', open)
    }

    /* ---------- layout ---------- */

    private wireLayout() {
        this.layoutSelect?.addEventListener('change', () => {
            const choice = LAYOUTS.find(l => l.id === this.layoutSelect!.value)
            if (!choice) return
            if (choice.id === 'force') this.sim.changeLayout('force')
            else if (choice.id === 'tree-v') this.sim.changeLayout('tree', { layout: { horizontal: false } })
            else if (choice.id === 'tree-h') this.sim.changeLayout('tree', { layout: { horizontal: true } })
            else if (choice.id === 'tree-r') this.sim.changeLayout('tree', { layout: { radial: true } })
            this.updatePhysicsEnabled(choice.tree)
        })
    }

    /* ---------- physics ---------- */

    private wirePhysics() {
        this.runButton?.addEventListener('click', () => {
            if (this.sim.isEnabled()) this.sim.disable()
            else this.sim.enable()
            this.updateRunButton()
        })

        for (const name of PRESETS) {
            this.presetButtons.get(name)?.addEventListener('click', () => {
                this.sim.applyPhysicsPreset(name)
                this.refreshSliders(this.sim.getPhysicsKnobs())
                this.highlightPreset(name)
            })
        }

        for (const spec of SLIDERS) {
            const input = this.sliders.get(spec.key)
            input?.addEventListener('input', () => {
                const value = Number(input.value)
                spec.set(this.sim, value)
                this.sliderValues.get(spec.key)!.textContent = String(value)
                this.highlightPreset(null) // manual edit → no active preset
            })
        }
    }

    private refreshSliders(knobs: PhysicsKnobs) {
        for (const spec of SLIDERS) {
            const value = knobs[spec.key]
            const input = this.sliders.get(spec.key)
            if (input) input.value = String(value)
            const label = this.sliderValues.get(spec.key)
            if (label) label.textContent = String(value)
        }
    }

    private highlightPreset(active: PhysicsPresetName | null) {
        for (const [name, button] of this.presetButtons) {
            button.classList.toggle('active', name === active)
        }
    }

    private updateRunButton() {
        if (!this.runButton) return
        const running = this.sim.isEnabled()
        this.runButton.innerHTML = running ? pause : play
        this.runButton.title = running ? 'Pause physics' : 'Resume physics'
        this.runButton.setAttribute('aria-pressed', String(running))
    }

    /** Grey out presets + sliders when the layout isn't force-directed. */
    private updatePhysicsEnabled(isTree = this.sim.getLayoutType() !== 'force') {
        this.physicsCard?.classList.toggle('pvt-viewflyout-disabled', isTree)
        for (const input of this.sliders.values()) input.disabled = isTree
        for (const button of this.presetButtons.values()) button.disabled = isTree
    }

    /* ---------- grid / freeze toggles ---------- */

    private wireToggles() {
        // Highlight the grid on the layout root so the canvas AND the transparent
        // top-bar strip (which continues the grid) brighten together.
        const root = this.uiManager.layout?.layout
        this.wireToggle('snap', () => this.sim.toggleGridSnapping(), () => this.sim.isGridSnappingEnabled())
        this.wireToggle('highlight',
            () => root?.classList.toggle('grid-highlighted'),
            () => root?.classList.contains('grid-highlighted') ?? false)
        this.wireToggle('freeze', () => this.sim.toggleFreezeNodesOnDrag(), () => this.sim.isFreezeNodesOnDrag())
        this.wireToggle('fit', () => this.sim.toggleFitViewOnExpandCollapse(), () => this.sim.isFitViewOnExpandCollapse())
    }

    // Attaches the click handler now; `read()` touches the simulation, so the
    // initial state is pushed later (via toggleSync) once graph.simulation exists.
    private wireToggle(id: string, toggle: () => void, read: () => boolean) {
        const button = this.flyout?.querySelector(`.pvt-viewflyout-toggle[data-toggle="${id}"]`) as HTMLButtonElement | null
        if (!button) return
        const sync = () => button.setAttribute('aria-pressed', String(read()))
        this.toggleSync.push(sync)
        button.addEventListener('click', () => { toggle(); sync() })
    }

    /* ---------- template ---------- */

    private template(): string {
        const options = LAYOUTS.map(l => `<option value="${l.id}" title="${l.desc}">${l.label}</option>`).join('')
        const presets = PRESETS.map(p =>
            `<button type="button" class="pvt-viewflyout-preset" data-preset="${p}" title="${PRESET_DESCRIPTIONS[p]}">${p[0].toUpperCase()}${p.slice(1)}</button>`
        ).join('')
        const sliders = SLIDERS.map(s => `
            <div class="pvt-viewflyout-slider" title="${s.desc}">
                <div class="pvt-viewflyout-slider-head">
                    <span class="pvt-viewflyout-slider-label"><span class="pvt-viewflyout-icon">${s.icon}</span>${s.label}</span>
                    <span class="pvt-viewflyout-slider-value" data-value="${s.key}">0</span>
                </div>
                <input type="range" class="pvt-viewflyout-range" data-slider="${s.key}"
                    min="${PHYSICS_KNOB_RANGES[s.key][0]}" max="${PHYSICS_KNOB_RANGES[s.key][1]}" step="1" value="0" />
            </div>`).join('')
        const toggle = (id: string, icon: string, label: string, desc: string) => `
            <button type="button" class="pvt-viewflyout-toggle" data-toggle="${id}" role="switch" aria-pressed="false" title="${desc}">
                <span class="pvt-viewflyout-icon">${icon}</span>${label}
                <span class="pvt-viewflyout-switch"></span>
            </button>`

        return `
            <div class="pvt-viewflyout-header"><span class="pvt-viewflyout-icon">${show}</span>View</div>
            <div class="pvt-viewflyout-section-label">LAYOUT &amp; SIMULATION</div>
            <label class="pvt-viewflyout-layout">Layout
                <select class="pvt-viewflyout-layout-select" title="Choose how nodes are arranged on the canvas.">${options}</select>
            </label>
            <div class="pvt-viewflyout-physics">
                <div class="pvt-viewflyout-physics-head">
                    <span class="pvt-viewflyout-physics-title"><span class="pvt-viewflyout-icon">${atom}</span>Physics</span>
                    <button type="button" class="pvt-viewflyout-run" title="Pause physics">${pause}</button>
                </div>
                <div class="pvt-viewflyout-presets">${presets}</div>
                <div class="pvt-viewflyout-sliders">${sliders}</div>
            </div>
            ${toggle('snap', snapGrid, 'Snap to grid', 'Align nodes to the grid while you drag them.')}
            ${toggle('highlight', grid, 'Highlight grid', 'Make the background grid lines more visible.')}
            ${toggle('freeze', pin, 'Freeze on drag', 'Keep nodes pinned where you drop them instead of letting physics move them again.')}
            ${toggle('fit', graphNavigationReset, 'Fit on expand/collapse', 'Zoom and re-center to fit the graph when clusters are expanded or collapsed.')}
        `
    }
}
