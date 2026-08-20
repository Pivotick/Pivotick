import { Flyout } from '../Flyout/Flyout'
import type { FlyoutMode } from '../../ModeStore'
import { PHYSICS_KNOB_RANGES, TREE_SPACING_RANGE, type PhysicsKnobs, type PhysicsPresetName, type TreeSpacing } from '../../../Simulation'
import type { TreeLayoutAlgorithm } from '../../../plugins/layout/Tree'
import {
    atom, play, pause,
    graphControlLayoutOrganic, graphControlLayoutTreeV, graphControlLayoutTreeH, graphControlLayoutTreeR,
    magnet, arrowsHorizontal, arrowsVertical, circleDashed, wind, focusElement, timeDuration10, sparkles,
    firstValidNode, mostConnectedNode, minHeight, selectElement,
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
 * The one physics knob a tree layout still answers to.
 *
 * `adjustOtherSimulationForces` zeroes link, charge and gravity under a tree — but not
 * `forceCollide`, which goes on keeping nodes off each other along whichever axis the
 * layout left free. So this slider stays live where the rest grey out. Not under the
 * radial layout, which pins both axes and leaves collision nothing to push.
 */
const TREE_LIVE_SLIDER: SliderKey = 'collisionRadius'

type SpacingKey = keyof TreeSpacing

/**
 * The tree-spacing sliders — what the flyout offers *instead of* the physics knobs
 * while a tree layout is active. Under a tree the simulation only holds nodes in
 * slots the layout has already chosen, so the distances are the layout's to give.
 *
 * `radial` marks the sliders the radial layout can honour: it spreads every level
 * over the full circle, so only the ring gap is left to widen.
 */
const SPACING_SLIDERS: Array<{ key: SpacingKey, label: string, desc: string, icon: string, radial: boolean }> = [
    { key: 'levelSpacing', label: 'Level distance', desc: 'How far apart consecutive levels of the tree sit — the gap between rings, in the radial layout.', icon: arrowsVertical, radial: true },
    { key: 'siblingSpacing', label: 'Sibling distance', desc: 'How far apart nodes on the same level sit. The radial layout spreads a level over the whole circle, so it ignores this one.', icon: arrowsHorizontal, radial: false },
]

/**
 * What the Root card offers: the node the user has selected, or one of the finders in
 * `plugins/analytics/DAGAlgorithms.ts`.
 */
type RootChoice = 'selected' | TreeLayoutAlgorithm

/**
 * The Root tiles, in the order they read best: the deliberate choice first, then the
 * three finders.
 *
 * Three finders, not the four `TreeLayoutAlgorithm` accepts: `MinMaxDistance` and
 * `MinHeight` are the same search — smallest longest-path-down — so offering both would
 * be offering the same tile twice. A tree that asks for `MinMaxDistance` lights the
 * `MinHeight` tile, which is what it gets.
 */
const SELECTED_ROOT_DESCRIPTION = 'Hang the tree from the selected node. Edges are followed either way round, so any node — a leaf included — gives a whole tree. Select a node to enable this.'

const ROOT_TILES: Array<{ id: RootChoice, label: string, icon: string, desc: string }> = [
    { id: 'selected', label: 'Selected node', icon: selectElement, desc: SELECTED_ROOT_DESCRIPTION },
    { id: 'FirstZeroInDegree', label: 'First source', icon: firstValidNode, desc: 'Root at the first node nothing points at.' },
    { id: 'MaxReachability', label: 'Widest reach', icon: mostConnectedNode, desc: 'Root at the node that reaches the most others. The default.' },
    { id: 'MinHeight', label: 'Shallowest', icon: minHeight, desc: 'Root at the node that makes the tree as shallow as it can be. Needs an acyclic graph; on a cyclic one it falls back to the first node.' },
]

/** The tile that stands for a finder — the two duplicate finders share one. */
const rootTileFor = (algorithm: TreeLayoutAlgorithm): RootChoice =>
    algorithm === 'MinMaxDistance' ? 'MinHeight' : algorithm

/** Tooltip for the spacing card's Auto button. */
const AUTO_SPACING_DESCRIPTION = 'Let the tree work out its own distances from the size of the nodes and the shape of the tree — and keep working them out as the graph changes.'

/** The layout options each tree tile applies, keyed by tile id. */
const TREE_ORIENTATIONS: Record<string, { horizontal?: boolean, radial?: boolean }> = {
    'tree-v': { horizontal: false },
    'tree-h': { horizontal: true },
    'tree-r': { radial: true },
}

/**
 * The B3 Physics flyout: an overlay toggled by the mode rail's Physics button
 * (via {@link UIManager.modeStore}). Holds the layout control and the simulation
 * card — presets + live sliders driving the {@link Simulation} setter API, plus a
 * run/pause toggle. Under a non-`force` layout the presets and all but one of the
 * sliders are disabled and hidden, and the root and tree-spacing cards take their
 * place: a tree places nodes itself, so where it hangs from and how far apart it
 * spreads are the layout's to give rather than the forces'. The exception is
 * {@link TREE_LIVE_SLIDER}.
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
    private spacingCard?: HTMLDivElement
    private readonly sliders = new Map<SliderKey, HTMLInputElement>()
    private readonly sliderValues = new Map<SliderKey, HTMLElement>()
    private readonly spacingSliders = new Map<SpacingKey, HTMLInputElement>()
    private readonly spacingValues = new Map<SpacingKey, HTMLElement>()
    private readonly presetButtons = new Map<PresetChoice, HTMLButtonElement>()
    private readonly layoutButtons = new Map<string, HTMLButtonElement>()
    private readonly rootButtons = new Map<RootChoice, HTMLButtonElement>()
    private rootCard?: HTMLDivElement
    /** The tile the graph is laid out by; drives which controls are live. */
    private activeLayout = 'force'
    /** The node the tree is pinned to, if the user picked one; the Root card's state. */
    private pinnedRootId?: string
    /** The finder in force while nothing is pinned. */
    private rootFinder: TreeLayoutAlgorithm = 'MaxReachability'
    /** Whether tree spacing is left to the tuner — the Auto button's state. */
    private autoSpacing = true
    private autoSpacingButton?: HTMLButtonElement

    protected wire() {
        this.runButton = this.query<HTMLButtonElement>('.pvt-physicsflyout-run') ?? undefined
        this.simulationCard = this.query<HTMLDivElement>('.pvt-physicsflyout-card') ?? undefined
        this.spacingCard = this.query<HTMLDivElement>('.pvt-physicsflyout-spacing') ?? undefined
        this.autoSpacingButton = this.query<HTMLButtonElement>('.pvt-physicsflyout-autospacing') ?? undefined

        for (const spec of SLIDERS) {
            const input = this.query<HTMLInputElement>(`.pvt-physicsflyout-range[data-slider="${spec.key}"]`)
            const value = this.query(`.pvt-physicsflyout-slider-value[data-value="${spec.key}"]`)
            if (input) this.sliders.set(spec.key, input)
            if (value) this.sliderValues.set(spec.key, value)
        }
        for (const spec of SPACING_SLIDERS) {
            const input = this.query<HTMLInputElement>(`.pvt-physicsflyout-range[data-spacing="${spec.key}"]`)
            const value = this.query(`.pvt-physicsflyout-slider-value[data-value="${spec.key}"]`)
            if (input) this.spacingSliders.set(spec.key, input)
            if (value) this.spacingValues.set(spec.key, value)
        }
        for (const name of PRESETS) {
            const button = this.query<HTMLButtonElement>(`.pvt-physicsflyout-preset[data-preset="${name}"]`)
            if (button) this.presetButtons.set(name, button)
        }
        for (const choice of LAYOUTS) {
            const button = this.query<HTMLButtonElement>(`.pvt-physicsflyout-layout[data-layout="${choice.id}"]`)
            if (button) this.layoutButtons.set(choice.id, button)
        }
        for (const tile of ROOT_TILES) {
            const button = this.query<HTMLButtonElement>(`.pvt-physicsflyout-roottile[data-root="${tile.id}"]`)
            if (button) this.rootButtons.set(tile.id, button)
        }
        this.rootCard = this.query<HTMLDivElement>('.pvt-physicsflyout-root') ?? undefined

        this.wireLayout()
        this.wireRoot()
        this.wirePhysics()
    }

    protected onGraphReady() {
        super.onGraphReady()
        // Seed physics from the live simulation (only available by graphReady —
        // the UIManager, and thus this component, is built before graph.simulation).
        this.refreshSliders(this.sim.getPhysicsKnobs())
        this.refreshSpacingSliders(this.sim.getTreeSpacing())
        this.setAutoSpacing(this.sim.getLayoutType() === 'force' || this.sim.isAutoTreeSpacingEnabled())
        this.highlightPreset(this.sim.isAutoPhysicsEnabled() ? 'auto' : null)
        this.updateRunButton()
        this.highlightLayout(this.sim.getLayoutType() === 'force' ? 'force' : 'tree-v')
        this.watchSelection()
        this.syncRoot()
        this.updateLayoutControls()
    }

    protected onDestroy() {
        super.onDestroy()
        this.runButton = undefined
        this.simulationCard = undefined
        this.spacingCard = undefined
        this.autoSpacingButton = undefined
        this.sliders.clear()
        this.sliderValues.clear()
        this.spacingSliders.clear()
        this.spacingValues.clear()
        this.presetButtons.clear()
        this.layoutButtons.clear()
        this.rootButtons.clear()
        this.rootCard = undefined
    }

    /* ---------- layout ---------- */

    private wireLayout() {
        for (const choice of LAYOUTS) {
            const button = this.layoutButtons.get(choice.id)
            if (!button) continue
            this.listen(button, 'click', () => {
                // `changeLayout` builds a fresh TreeLayout from what it is handed, so the
                // spacing and the root have to travel with the orientation or every tile
                // click would reset both to the defaults the user just moved away from.
                if (choice.id === 'force') this.sim.changeLayout('force')
                else this.sim.changeLayout('tree', { layout: { ...TREE_ORIENTATIONS[choice.id], ...this.spacingOptions(), ...this.rootOptions() } })
                this.highlightLayout(choice.id)
                this.updateLayoutControls()
            })
        }
    }

    /** Mark the chosen layout tile as the active one. */
    private highlightLayout(active: string) {
        this.activeLayout = active
        for (const [id, button] of this.layoutButtons) {
            const on = id === active
            button.classList.toggle('active', on)
            button.setAttribute('aria-pressed', String(on))
        }
    }

    /**
     * What to hand `changeLayout` so a rebuilt tree carries on as it was. Under `Auto`
     * that means the *mode*, not the numbers: the new tree may be a different shape
     * (a radial one crowds where a vertical one does not), so it must be free to
     * re-derive its own multipliers rather than inherit the last tree's.
     */
    private spacingOptions(): { spacing: 'auto' | 'manual' } | ({ spacing: 'manual' } & TreeSpacing) {
        if (this.autoSpacing) return { spacing: 'auto' }
        const read = (key: SpacingKey) => Number(this.spacingSliders.get(key)?.value ?? 1)
        return { spacing: 'manual', levelSpacing: read('levelSpacing'), siblingSpacing: read('siblingSpacing') }
    }

    /* ---------- root ---------- */

    private wireRoot() {
        for (const tile of ROOT_TILES) {
            const button = this.rootButtons.get(tile.id)
            if (!button) continue
            this.listen(button, 'click', () => {
                if (tile.id === 'selected') {
                    const selected = this.selectedNodeId()
                    if (!selected) return
                    this.pinnedRootId = selected
                    this.sim.setTreeRoot({ rootId: selected })
                } else {
                    this.pinnedRootId = undefined
                    this.rootFinder = tile.id
                    this.sim.setTreeRoot({ algorithm: tile.id })
                }
                this.highlightRoot()
                // A tree hung from somewhere else is a different shape, and nothing pulls it
                // back into frame — so reframe, as a spacing drag does.
                this.uiManager.graph.renderer.fitAndCenterWhenSettled()
            })
        }
    }

    /**
     * Keep the Selected-node tile in step with the selection. Subscribed at `graphReady`
     * rather than in {@link wire}: the interaction bus belongs to the renderer, which does
     * not exist yet when the flyout builds its markup.
     */
    private watchSelection() {
        for (const event of ['selectNode', 'unselectNode', 'selectNodes', 'unselectNodes'] as const) {
            this.trackInteraction(event, () => this.updateSelectedRootTile())
        }
    }

    /** Take the Root card's state from the layout — at `graphReady`, and after a rebuild. */
    private syncRoot() {
        const root = this.sim.getTreeRoot()
        this.pinnedRootId = root.rootId
        this.rootFinder = root.algorithm
        this.highlightRoot()
    }

    /** The one selected node, or nothing — a multi-selection roots nothing in particular. */
    private selectedNodeId(): string | undefined {
        return this.uiManager.graph.renderer.getGraphInteraction().getSelectedNode()?.node.id
    }

    /** Light the tile the tree is actually hung from. */
    private highlightRoot() {
        const active: RootChoice = this.pinnedRootId ? 'selected' : rootTileFor(this.rootFinder)
        for (const [id, button] of this.rootButtons) {
            const on = id === active
            button.classList.toggle('active', on)
            button.setAttribute('aria-pressed', String(on))
        }
        this.updateSelectedRootTile()
    }

    /**
     * Enable the Selected-node tile only when a click on it would do something. It can be
     * lit and disabled at once — the tree stays pinned to a node after the selection moves
     * off it, and saying so beats pretending the pin is gone.
     */
    private updateSelectedRootTile() {
        const button = this.rootButtons.get('selected')
        if (!button) return
        button.disabled = this.activeLayout === 'force' || !this.selectedNodeId()
        button.title = this.pinnedRootId
            ? `The tree is hung from "${this.pinnedRootId}". Select another node to move it.`
            : SELECTED_ROOT_DESCRIPTION
    }

    /**
     * What to hand `changeLayout` so a rebuilt tree hangs from the same place. A pin
     * travels as the id; otherwise the finder does, since a fresh `TreeLayout` starts from
     * the defaults and would silently go back to `MaxReachability`.
     */
    private rootOptions(): { rootId: string } | { rootIdAlgorithmFinder: TreeLayoutAlgorithm } {
        if (this.pinnedRootId) return { rootId: this.pinnedRootId }
        return { rootIdAlgorithmFinder: this.rootFinder }
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

        if (this.autoSpacingButton) {
            this.listen(this.autoSpacingButton, 'click', () => {
                this.sim.enableAutoTreeSpacing()
                this.refreshSpacingSliders(this.sim.getTreeSpacing())
                this.setAutoSpacing(true)
            })
        }

        for (const spec of SPACING_SLIDERS) {
            const input = this.spacingSliders.get(spec.key)
            if (!input) continue
            this.listen(input, 'input', () => {
                const value = Number(input.value)
                this.sim.setTreeSpacing({ [spec.key]: value }) // also leaves Auto, in the layout
                this.setSpacingLabel(spec.key, value)
                this.setAutoSpacing(false)
            })
            // A spread-out tree easily outgrows the viewport, and unlike a force layout
            // nothing pulls it back toward the centre — so reframe once the gesture ends
            // (`change`, not `input`, or the view would be yanked on every step of a drag).
            this.listen(input, 'change', () => this.uiManager.graph.renderer.fitAndCenterWhenSettled())
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

    /**
     * Follow a tune the tree's `Auto` spacing just applied: move the sliders to what it
     * chose and keep the Auto button lit. Called by the layout, not the user.
     * @private
     */
    public syncAutoSpacing(spacing: TreeSpacing) {
        this.refreshSpacingSliders(spacing)
        this.setAutoSpacing(true)
    }

    private setAutoSpacing(on: boolean) {
        this.autoSpacing = on
        this.autoSpacingButton?.classList.toggle('active', on)
        this.autoSpacingButton?.setAttribute('aria-pressed', String(on))
    }

    private refreshSpacingSliders(spacing: TreeSpacing) {
        for (const spec of SPACING_SLIDERS) {
            const value = spacing[spec.key]
            const input = this.spacingSliders.get(spec.key)
            if (input) input.value = String(value)
            this.setSpacingLabel(spec.key, value)
        }
    }

    private setSpacingLabel(key: SpacingKey, value: number) {
        const label = this.spacingValues.get(key)
        if (label) label.textContent = `${value}\u00d7`
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

    /**
     * Hand the controls to whichever half of the flyout the active layout listens
     * to: the physics presets + sliders grey out under a tree, and the spacing card
     * — which only a tree can honour — takes their place.
     */
    private updateLayoutControls() {
        const isTree = this.activeLayout !== 'force'
        const collisionApplies = isTree && this.activeLayout !== 'tree-r'
        this.simulationCard?.classList.toggle('pvt-physicsflyout-disabled', isTree)
        this.simulationCard?.classList.toggle('pvt-physicsflyout-collision-only', collisionApplies)
        for (const [key, input] of this.sliders) {
            input.disabled = isTree && !(collisionApplies && key === TREE_LIVE_SLIDER)
        }
        for (const button of this.presetButtons.values()) button.disabled = isTree

        if (this.rootCard) this.rootCard.hidden = !isTree
        this.updateSelectedRootTile()
        if (this.spacingCard) this.spacingCard.hidden = !isTree
        for (const spec of SPACING_SLIDERS) {
            const input = this.spacingSliders.get(spec.key)
            if (input) input.disabled = this.activeLayout === 'tree-r' && !spec.radial
        }
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
        const roots = ROOT_TILES.map(r => `
            <button type="button" class="pvt-physicsflyout-roottile" data-root="${r.id}" aria-pressed="false" title="${r.desc}">
                <span class="pvt-flyout-icon">${r.icon}</span>${r.label}
            </button>`).join('')
        const spacing = SPACING_SLIDERS.map(s => `
            <div class="pvt-physicsflyout-slider" title="${s.desc}">
                <div class="pvt-physicsflyout-slider-head">
                    <span class="pvt-physicsflyout-slider-label"><span class="pvt-flyout-icon">${s.icon}</span>${s.label}</span>
                    <span class="pvt-physicsflyout-slider-value" data-value="${s.key}">1&times;</span>
                </div>
                <input type="range" class="pvt-physicsflyout-range" data-spacing="${s.key}"
                    min="${TREE_SPACING_RANGE[0]}" max="${TREE_SPACING_RANGE[1]}" step="0.1" value="1" />
            </div>`).join('')
        const sliders = SLIDERS.map(s => `
            <div class="pvt-physicsflyout-slider" data-row="${s.key}" title="${s.desc}">
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
            <div class="pvt-physicsflyout-root" hidden>
                <div class="pvt-physicsflyout-card-head">
                    <span class="pvt-physicsflyout-card-title">Root</span>
                </div>
                <div class="pvt-physicsflyout-roots">${roots}</div>
            </div>
            <div class="pvt-physicsflyout-spacing" hidden>
                <div class="pvt-physicsflyout-card-head">
                    <span class="pvt-physicsflyout-card-title">Spacing</span>
                    <button type="button" class="pvt-physicsflyout-autospacing active" aria-pressed="true"
                        title="${AUTO_SPACING_DESCRIPTION}"><span class="pvt-flyout-icon">${sparkles}</span>Auto</button>
                </div>
                <div class="pvt-physicsflyout-sliders">${spacing}</div>
            </div>
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
