import { Flyout } from '../Flyout/Flyout'
import type { FlyoutMode } from '../../ModeStore'
import { PHYSICS_KNOB_RANGES, type PhysicsKnobs, type PhysicsPresetName } from '../../../Simulation'
import hasCycle from '../../../plugins/analytics/cycle'
import {
    atom, play, pause,
    graphControlLayoutOrganic, graphControlLayoutTreeV, graphControlLayoutTreeH, graphControlLayoutTreeR,
    magnet, arrowsHorizontal, circleDashed, wind, focusElement, timeDuration10, sparkles,
} from '../../icons'
import './physicsflyout.scss'

type SliderKey = keyof PhysicsKnobs

/**
 * A slider per knob. `desc` is surfaced as a hover tooltip (native `title`) so each
 * knob explains itself; `step`/`unit` exist because `settleTime` is the one knob
 * measured in seconds rather than in abstract units.
 */
const SLIDERS: Array<{
    key: SliderKey
    label: string
    desc: string
    icon: string
    step: number
    unit?: string
    set: (sim: import('../../../Simulation').Simulation, v: number) => void
}> = [
    { key: 'repulsion', label: 'Repulsion', desc: 'How strongly nodes push each other apart. Higher values spread the graph out.', icon: magnet, step: 1, set: (s, v) => s.setRepulsion(v) },
    { key: 'linkDistance', label: 'Link distance', desc: 'The resting length of edges, in pixels. Higher values place connected nodes further apart.', icon: arrowsHorizontal, step: 1, set: (s, v) => s.setLinkDistance(v) },
    { key: 'collisionRadius', label: 'Collision radius', desc: 'The clear space kept around each node to prevent overlap. Higher values keep nodes further apart.', icon: circleDashed, step: 1, set: (s, v) => s.setCollisionRadius(v) },
    { key: 'friction', label: 'Friction', desc: 'How quickly node motion is damped. Higher values calm the layout and settle it faster.', icon: wind, step: 1, set: (s, v) => s.setFriction(v) },
    { key: 'centering', label: 'Centering', desc: 'How strongly the graph is pulled toward the middle of the canvas. Higher values keep disconnected parts in frame.', icon: focusElement, step: 1, set: (s, v) => s.setCentering(v) },
    { key: 'settleTime', label: 'Settle time', desc: 'How long the layout is given to settle, in seconds. Higher values let large graphs unfold further before they stop.', icon: timeDuration10, step: 0.1, unit: 's', set: (s, v) => s.setSettleTime(v) },
]

/**
 * The preset row. `auto` is not a knob bundle like the others — it hands the knobs
 * to the tuner, which keeps moving them as the graph changes. Picking `tight` or
 * `loose` (or touching any slider) takes them back.
 */
type PresetChoice = 'auto' | PhysicsPresetName

const PRESETS: PresetChoice[] = ['auto', 'tight', 'loose']

/** Tooltip for each preset button, explaining the layout it produces. */
const PRESET_DESCRIPTIONS: Record<PresetChoice, string> = {
    auto: 'Let the layout tune itself from the number of nodes, their size and the canvas — and keep tuning as the graph changes.',
    tight: 'Compact layout with nodes packed closely together.',
    loose: 'Spacious layout with nodes spread further apart.',
}

/** The Auto button carries an icon; the character presets are plain labels. */
const PRESET_ICONS: Partial<Record<PresetChoice, string>> = { auto: sparkles }

/**
 * Layout choices, rendered as a grid of tiles — one click each, no dropdown to
 * open first. `label` is the tile's caption (the `desc` tooltip carries the full
 * name); tree variants are disabled on cyclic graphs.
 */
const LAYOUTS: Array<{ id: string; label: string; icon: string; tree: boolean; desc: string }> = [
    { id: 'force', label: 'Force', icon: graphControlLayoutOrganic, tree: false, desc: 'Force — positions nodes freely using the physics simulation.' },
    { id: 'tree-v', label: 'Vertical', icon: graphControlLayoutTreeV, tree: true, desc: 'Tree — hierarchical layout flowing from top to bottom.' },
    { id: 'tree-h', label: 'Horizontal', icon: graphControlLayoutTreeH, tree: true, desc: 'Tree — hierarchical layout flowing from left to right.' },
    { id: 'tree-r', label: 'Radial', icon: graphControlLayoutTreeR, tree: true, desc: 'Tree — hierarchical layout radiating out from a central root.' },
]

/**
 * The B3 Physics flyout: an overlay toggled by the mode rail's Physics button
 * (via {@link UIManager.modeStore}). Holds the layout control and the simulation
 * card — presets + live sliders driving the {@link Simulation} setter API, plus a
 * run/pause toggle. Presets + sliders grey out under non-`force` layouts.
 *
 * While `Auto` is active the sliders stay enabled and *follow* what the tuner
 * decides ({@link syncAutoKnobs}) — so auto's choices are visible and can be taken
 * over at any moment by simply dragging one.
 *
 * It shipped as one half of the View flyout; the grid / canvas switches it left
 * behind are still there, see {@link ViewFlyout}.
 */
export class PhysicsFlyout extends Flyout {
    protected readonly mode: FlyoutMode = 'physics'

    private runButton?: HTMLButtonElement
    private simulationCard?: HTMLDivElement
    private readonly sliders = new Map<SliderKey, HTMLInputElement>()
    private readonly sliderValues = new Map<SliderKey, HTMLElement>()
    private readonly presetButtons = new Map<PresetChoice, HTMLButtonElement>()
    private readonly layoutButtons = new Map<string, HTMLButtonElement>()

    protected wire() {
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
        for (const choice of LAYOUTS) {
            const button = this.query<HTMLButtonElement>(`.pvt-physicsflyout-layout[data-layout="${choice.id}"]`)
            if (button) this.layoutButtons.set(choice.id, button)
        }

        this.wireLayout()
        this.wirePhysics()
    }

    protected onGraphReady() {
        super.onGraphReady()
        // Disable tree layouts on cyclic graphs (they can't be drawn as a tree).
        if (hasCycle(this.uiManager.graph.getNodes(), this.uiManager.graph.getEdges())) {
            for (const choice of LAYOUTS.filter(l => l.tree)) {
                const button = this.layoutButtons.get(choice.id)
                if (!button) continue
                button.disabled = true
                button.title = 'The graph contains a cycle, so it cannot be displayed as a tree.'
            }
        }
        // Seed physics from the live simulation (only available by graphReady —
        // the UIManager, and thus this component, is built before graph.simulation).
        this.refreshSliders(this.sim.getPhysicsKnobs())
        this.highlightPreset(this.sim.isAutoPhysicsEnabled() ? 'auto' : null)
        this.updateRunButton()
        this.updatePhysicsEnabled()
        this.highlightLayout(this.sim.getLayoutType() === 'force' ? 'force' : 'tree-v')
    }

    protected onDestroy() {
        super.onDestroy()
        this.runButton = undefined
        this.simulationCard = undefined
        this.sliders.clear()
        this.sliderValues.clear()
        this.presetButtons.clear()
        this.layoutButtons.clear()
    }

    /* ---------- layout ---------- */

    private wireLayout() {
        for (const choice of LAYOUTS) {
            const button = this.layoutButtons.get(choice.id)
            if (!button) continue
            this.listen(button, 'click', () => {
                if (choice.id === 'force') this.sim.changeLayout('force')
                else if (choice.id === 'tree-v') this.sim.changeLayout('tree', { layout: { horizontal: false } })
                else if (choice.id === 'tree-h') this.sim.changeLayout('tree', { layout: { horizontal: true } })
                else if (choice.id === 'tree-r') this.sim.changeLayout('tree', { layout: { radial: true } })
                this.highlightLayout(choice.id)
                this.updatePhysicsEnabled(choice.tree)
            })
        }
    }

    /** Mark the chosen layout tile as the active one. */
    private highlightLayout(active: string) {
        for (const [id, button] of this.layoutButtons) {
            const on = id === active
            button.classList.toggle('active', on)
            button.setAttribute('aria-pressed', String(on))
        }
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
                if (name === 'auto') this.sim.enableAutoPhysics()
                else this.sim.applyPhysicsPreset(name)
                this.refreshSliders(this.sim.getPhysicsKnobs())
                this.highlightPreset(name)
            })
        }

        for (const spec of SLIDERS) {
            const input = this.sliders.get(spec.key)
            if (!input) continue
            this.listen(input, 'input', () => {
                const value = Number(input.value)
                spec.set(this.sim, value) // also leaves Auto, in the simulation
                this.setSliderLabel(spec.key, value)
                this.highlightPreset(null) // manual edit → no active preset
            })
        }
    }

    /**
     * Follow a tune the `Auto` preset just applied: move the sliders to what it
     * chose and keep the Auto button lit. Called by the simulation, not the user.
     * @private
     */
    public syncAutoKnobs(knobs: PhysicsKnobs) {
        this.refreshSliders(knobs)
        this.highlightPreset('auto')
    }

    private refreshSliders(knobs: PhysicsKnobs) {
        for (const spec of SLIDERS) {
            const value = knobs[spec.key]
            const input = this.sliders.get(spec.key)
            if (input) input.value = String(value)
            this.setSliderLabel(spec.key, value)
        }
    }

    private setSliderLabel(key: SliderKey, value: number) {
        const label = this.sliderValues.get(key)
        if (!label) return
        const spec = SLIDERS.find(s => s.key === key)
        label.textContent = `${value}${spec?.unit ?? ''}`
    }

    private highlightPreset(active: PresetChoice | null) {
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
        const layouts = LAYOUTS.map(l => `
            <button type="button" class="pvt-physicsflyout-layout" data-layout="${l.id}" aria-pressed="false" title="${l.desc}">
                <span class="pvt-flyout-icon">${l.icon}</span>${l.label}
            </button>`).join('')
        const presets = PRESETS.map(p => {
            const icon = PRESET_ICONS[p] ? `<span class="pvt-flyout-icon">${PRESET_ICONS[p]}</span>` : ''
            return `<button type="button" class="pvt-physicsflyout-preset" data-preset="${p}" title="${PRESET_DESCRIPTIONS[p]}">${icon}${p[0].toUpperCase()}${p.slice(1)}</button>`
        }).join('')
        const sliders = SLIDERS.map(s => `
            <div class="pvt-physicsflyout-slider" title="${s.desc}">
                <div class="pvt-physicsflyout-slider-head">
                    <span class="pvt-physicsflyout-slider-label"><span class="pvt-flyout-icon">${s.icon}</span>${s.label}</span>
                    <span class="pvt-physicsflyout-slider-value" data-value="${s.key}">0</span>
                </div>
                <input type="range" class="pvt-physicsflyout-range" data-slider="${s.key}"
                    min="${PHYSICS_KNOB_RANGES[s.key][0]}" max="${PHYSICS_KNOB_RANGES[s.key][1]}" step="${s.step}" value="0" />
            </div>`).join('')

        return this.headerRow(atom, 'Physics')
            + this.sectionLabel('LAYOUT &amp; SIMULATION')
            + `
            <div class="pvt-physicsflyout-layouts">${layouts}</div>
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
