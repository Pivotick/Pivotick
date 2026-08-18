import { Flyout } from '../Flyout/Flyout'
import type { FlyoutMode } from '../../ModeStore'
import { PHYSICS_KNOB_RANGES, type PhysicsKnobs, type PhysicsPresetName } from '../../../Simulation'
import hasCycle from '../../../plugins/analytics/cycle'
import {
    atom, play, pause,
    magnet, arrowsHorizontal, circleDashed, wind,
} from '../../icons'
import './physicsflyout.scss'

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
 * The B3 Physics flyout: an overlay toggled by the mode rail's Physics button
 * (via {@link UIManager.modeStore}). Holds the layout control and the simulation
 * card — presets + live sliders driving the {@link Simulation} setter API, plus a
 * run/pause toggle. Presets + sliders grey out under non-`force` layouts (D6/D7).
 *
 * It shipped as one half of the View flyout; the grid / canvas switches it left
 * behind are still there, see {@link ViewFlyout}.
 */
export class PhysicsFlyout extends Flyout {
    protected readonly mode: FlyoutMode = 'physics'

    private layoutSelect?: HTMLSelectElement
    private runButton?: HTMLButtonElement
    private simulationCard?: HTMLDivElement
    private readonly sliders = new Map<SliderKey, HTMLInputElement>()
    private readonly sliderValues = new Map<SliderKey, HTMLElement>()
    private readonly presetButtons = new Map<PhysicsPresetName, HTMLButtonElement>()

    protected wire() {
        this.layoutSelect = this.query<HTMLSelectElement>('.pvt-physicsflyout-layout-select') ?? undefined
        this.runButton = this.query<HTMLButtonElement>('.pvt-physicsflyout-run') ?? undefined
        this.simulationCard = this.query<HTMLDivElement>('.pvt-physicsflyout-card') ?? undefined

        for (const spec of SLIDERS) {
            const input = this.query<HTMLInputElement>(`.pvt-physicsflyout-range[data-slider="${spec.key}"]`)
            const value = this.query(`.pvt-physicsflyout-slider-value[data-value="${spec.key}"]`)
            if (input) this.sliders.set(spec.key, input)
            if (value) this.sliderValues.set(spec.key, value)
        }
        for (const name of PRESETS) {
            const button = this.query<HTMLButtonElement>(`.pvt-physicsflyout-preset[data-preset="${name}"]`)
            if (button) this.presetButtons.set(name, button)
        }

        this.wireLayout()
        this.wirePhysics()
    }

    protected onGraphReady() {
        super.onGraphReady()
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
        if (this.layoutSelect) this.layoutSelect.value = this.sim.getLayoutType() === 'force' ? 'force' : 'tree-v'
    }

    protected onDestroy() {
        super.onDestroy()
        this.layoutSelect = undefined
        this.runButton = undefined
        this.simulationCard = undefined
        this.sliders.clear()
        this.sliderValues.clear()
        this.presetButtons.clear()
    }

    /* ---------- layout ---------- */

    private wireLayout() {
        if (!this.layoutSelect) return
        this.listen(this.layoutSelect, 'change', () => {
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
        if (this.runButton) {
            this.listen(this.runButton, 'click', () => {
                if (this.sim.isEnabled()) this.sim.disable()
                else this.sim.enable()
                this.updateRunButton()
            })
        }

        for (const name of PRESETS) {
            const button = this.presetButtons.get(name)
            if (!button) continue
            this.listen(button, 'click', () => {
                this.sim.applyPhysicsPreset(name)
                this.refreshSliders(this.sim.getPhysicsKnobs())
                this.highlightPreset(name)
            })
        }

        for (const spec of SLIDERS) {
            const input = this.sliders.get(spec.key)
            if (!input) continue
            this.listen(input, 'input', () => {
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

    /** Re-sync the run/pause button with the live simulation state — e.g. after the
     *  slow-tick watchdog disables physics without going through the button. */
    public syncRunState() {
        if (!this.uiManager.graph.simulation) return
        this.updateRunButton()
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
        this.simulationCard?.classList.toggle('pvt-physicsflyout-disabled', isTree)
        for (const input of this.sliders.values()) input.disabled = isTree
        for (const button of this.presetButtons.values()) button.disabled = isTree
    }

    /* ---------- template ---------- */

    protected template(): string {
        const options = LAYOUTS.map(l => `<option value="${l.id}" title="${l.desc}">${l.label}</option>`).join('')
        const presets = PRESETS.map(p =>
            `<button type="button" class="pvt-physicsflyout-preset" data-preset="${p}" title="${PRESET_DESCRIPTIONS[p]}">${p[0].toUpperCase()}${p.slice(1)}</button>`
        ).join('')
        const sliders = SLIDERS.map(s => `
            <div class="pvt-physicsflyout-slider" title="${s.desc}">
                <div class="pvt-physicsflyout-slider-head">
                    <span class="pvt-physicsflyout-slider-label"><span class="pvt-flyout-icon">${s.icon}</span>${s.label}</span>
                    <span class="pvt-physicsflyout-slider-value" data-value="${s.key}">0</span>
                </div>
                <input type="range" class="pvt-physicsflyout-range" data-slider="${s.key}"
                    min="${PHYSICS_KNOB_RANGES[s.key][0]}" max="${PHYSICS_KNOB_RANGES[s.key][1]}" step="1" value="0" />
            </div>`).join('')

        return this.headerRow(atom, 'Physics')
            + this.sectionLabel('LAYOUT &amp; SIMULATION')
            + `
            <label class="pvt-physicsflyout-layout">Layout
                <select class="pvt-physicsflyout-layout-select" title="Choose how nodes are arranged on the canvas.">${options}</select>
            </label>
            <div class="pvt-physicsflyout-card">
                <div class="pvt-physicsflyout-card-head">
                    <span class="pvt-physicsflyout-card-title">Simulation</span>
                    <button type="button" class="pvt-physicsflyout-run" title="Pause physics">${pause}</button>
                </div>
                <div class="pvt-physicsflyout-presets">${presets}</div>
                <div class="pvt-physicsflyout-sliders">${sliders}</div>
            </div>`
    }
}
