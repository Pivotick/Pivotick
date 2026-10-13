import { Flyout } from '../Flyout/Flyout'
import type { FlyoutMode } from '../../ModeStore'
import { PHYSICS_KNOB_RANGES, TREE_SPACING_RANGE, type PhysicsKnobs, type PhysicsPresetName, type TreeSpacing } from '../../../Simulation'
import type { TreeLayoutAlgorithm } from '../../../plugins/layout/Tree'
import { PivotickDropdown, type DropdownOption } from '../../components/Dropdown'
import {
    atom, play, pause,
    graphControlLayoutOrganic, graphControlLayoutTreeV, graphControlLayoutTreeH, graphControlLayoutTreeR,
    magnet, arrowsHorizontal, arrowsVertical, circleDashed, wind, focusElement, timeDuration10, sparkles,
    firstValidNode, mostConnectedNode, minHeight, selectElement, arrowDown, checkmark,
} from '../../icons'
import { applyMessages, i18nAttr, i18nText } from '../../../i18n/dom'
import type { MessageKey } from '../../../interfaces/I18n'
import { escapeHtml } from '../../../utils/utils'
import './physicsflyout.scss'

type SliderKey = keyof PhysicsKnobs

/**
 * A slider per knob. `desc` is surfaced as a hover tooltip (native `title`) so each
 * knob explains itself; `step`/`unit` exist because `settleTime` is the one knob
 * measured in seconds rather than in abstract units. `unit` is the message the value is
 * written with; a knob without one shows the bare number.
 */
const SLIDERS: Array<{
    key: SliderKey
    label: MessageKey
    desc: MessageKey
    icon: string
    step: number
    unit?: MessageKey
    set: (sim: import('../../../Simulation').Simulation, v: number) => void
}> = [
    { key: 'repulsion', label: 'physicsFlyout.knob.repulsion', desc: 'physicsFlyout.knob.repulsion.title', icon: magnet, step: 1, set: (s, v) => s.setRepulsion(v) },
    { key: 'linkDistance', label: 'physicsFlyout.knob.linkDistance', desc: 'physicsFlyout.knob.linkDistance.title', icon: arrowsHorizontal, step: 1, set: (s, v) => s.setLinkDistance(v) },
    { key: 'collisionRadius', label: 'physicsFlyout.knob.collisionRadius', desc: 'physicsFlyout.knob.collisionRadius.title', icon: circleDashed, step: 1, set: (s, v) => s.setCollisionRadius(v) },
    { key: 'friction', label: 'physicsFlyout.knob.friction', desc: 'physicsFlyout.knob.friction.title', icon: wind, step: 1, set: (s, v) => s.setFriction(v) },
    { key: 'centering', label: 'physicsFlyout.knob.centering', desc: 'physicsFlyout.knob.centering.title', icon: focusElement, step: 1, set: (s, v) => s.setCentering(v) },
    { key: 'settleTime', label: 'physicsFlyout.knob.settleTime', desc: 'physicsFlyout.knob.settleTime.title', icon: timeDuration10, step: 0.1, unit: 'physicsFlyout.knob.seconds', set: (s, v) => s.setSettleTime(v) },
]

/**
 * The preset row. `auto` is not a knob bundle like the others — it hands the knobs
 * to the tuner, which keeps moving them as the graph changes. Picking `tight` or
 * `loose` (or touching any slider) takes them back.
 */
type PresetChoice = 'auto' | PhysicsPresetName

const PRESETS: PresetChoice[] = ['auto', 'tight', 'loose']

/** Each preset button's caption. */
const PRESET_LABELS: Record<PresetChoice, MessageKey> = {
    auto: 'physicsFlyout.preset.auto',
    tight: 'physicsFlyout.preset.tight',
    loose: 'physicsFlyout.preset.loose',
}

/** Tooltip for each preset button, explaining the layout it produces. */
const PRESET_DESCRIPTIONS: Record<PresetChoice, MessageKey> = {
    auto: 'physicsFlyout.preset.auto.title',
    tight: 'physicsFlyout.preset.tight.title',
    loose: 'physicsFlyout.preset.loose.title',
}

/** The Auto button carries an icon; the character presets are plain labels. */
const PRESET_ICONS: Partial<Record<PresetChoice, string>> = { auto: sparkles }

/**
 * Layout choices, rendered as a grid of tiles — one click each, no dropdown to
 * open first. `label` is the tile's caption (the `desc` tooltip carries the full
 * name); tree variants are disabled on cyclic graphs.
 */
const LAYOUTS: Array<{ id: string; label: MessageKey; icon: string; tree: boolean; desc: MessageKey }> = [
    { id: 'force', label: 'physicsFlyout.layout.force', icon: graphControlLayoutOrganic, tree: false, desc: 'physicsFlyout.layout.force.title' },
    { id: 'tree-v', label: 'physicsFlyout.layout.treeV', icon: graphControlLayoutTreeV, tree: true, desc: 'physicsFlyout.layout.treeV.title' },
    { id: 'tree-h', label: 'physicsFlyout.layout.treeH', icon: graphControlLayoutTreeH, tree: true, desc: 'physicsFlyout.layout.treeH.title' },
    { id: 'tree-r', label: 'physicsFlyout.layout.treeR', icon: graphControlLayoutTreeR, tree: true, desc: 'physicsFlyout.layout.treeR.title' },
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
const SPACING_SLIDERS: Array<{ key: SpacingKey, label: MessageKey, desc: MessageKey, icon: string, radial: boolean }> = [
    { key: 'levelSpacing', label: 'physicsFlyout.spacing.level', desc: 'physicsFlyout.spacing.level.title', icon: arrowsVertical, radial: true },
    { key: 'siblingSpacing', label: 'physicsFlyout.spacing.sibling', desc: 'physicsFlyout.spacing.sibling.title', icon: arrowsHorizontal, radial: false },
]

/**
 * What the root menu offers: the node the user has selected, or one of the finders in
 * `plugins/analytics/DAGAlgorithms.ts`.
 */
type RootChoice = 'selected' | TreeLayoutAlgorithm

/**
 * The root menu, in the order it reads best: the deliberate choice first, then the three
 * finders. Each carries a sentence, which is the reason this is a menu rather than a row
 * of tiles — "First source" and "Shallowest" do not explain themselves in two words, and
 * a tooltip is a poor place to keep the explanation.
 *
 * Three finders, not the four `TreeLayoutAlgorithm` accepts: `MinMaxDistance` and
 * `MinHeight` are the same search — smallest longest-path-down — so offering both would
 * be offering the same item twice. A tree that asks for `MinMaxDistance` reads as
 * `MinHeight`, which is what it gets.
 */
const ROOT_CHOICES: Array<{ id: RootChoice, label: MessageKey, icon: string, desc: MessageKey }> = [
    { id: 'selected', label: 'physicsFlyout.root.selected', icon: selectElement, desc: 'physicsFlyout.root.selected.description' },
    { id: 'FirstZeroInDegree', label: 'physicsFlyout.root.firstSource', icon: firstValidNode, desc: 'physicsFlyout.root.firstSource.description' },
    { id: 'MaxReachability', label: 'physicsFlyout.root.widestReach', icon: mostConnectedNode, desc: 'physicsFlyout.root.widestReach.description' },
    { id: 'MinHeight', label: 'physicsFlyout.root.shallowest', icon: minHeight, desc: 'physicsFlyout.root.shallowest.description' },
]

/** The menu entry that stands for a finder — the two duplicate finders share one. */
const rootChoiceFor = (algorithm: TreeLayoutAlgorithm): RootChoice =>
    algorithm === 'MinMaxDistance' ? 'MinHeight' : algorithm

/** The layout options each tree tile applies, keyed by tile id. */
const TREE_ORIENTATIONS: Record<string, { horizontal?: boolean, radial?: boolean }> = {
    'tree-v': { horizontal: false },
    'tree-h': { horizontal: true },
    'tree-r': { radial: true },
}

/**
 * The Physics flyout: an overlay toggled by the mode rail's Physics button
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
    private rootRow?: HTMLDivElement
    private rootPicker?: HTMLButtonElement
    private rootMenu?: PivotickDropdown
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
        this.rootRow = this.query<HTMLDivElement>('.pvt-physicsflyout-rootrow') ?? undefined
        this.rootPicker = this.query<HTMLButtonElement>('.pvt-physicsflyout-rootpick') ?? undefined

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
        // A structured layout has no tile: none lights up until the user picks one.
        const type = this.sim.getLayoutType()
        this.highlightLayout(type === 'force' || type === 'structured' ? type : 'tree-v')
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
        this.rootMenu?.destroy()
        this.rootMenu = undefined
        this.rootRow = undefined
        this.rootPicker = undefined
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

    /**
     * Hang the root menu off the picker row. {@link PivotickDropdown} already does what
     * this needs — it portals to `document.body`, so the menu is never clipped by the
     * flyout's own scroll box; it positions itself against the row, flips upward near the
     * bottom of the window, and closes on an outside click and on select.
     */
    private wireRoot() {
        if (!this.rootPicker) return
        this.rootMenu = new PivotickDropdown(this.rootPicker, this.rootMenuOptions(), {
            closeOnSelect: true,
            placement: 'bottom-end',
        })
    }

    /**
     * The menu, rebuilt whenever it can have changed: which item carries the tick, and
     * whether `Selected node` is reachable at all, both follow state the user moves from
     * outside this flyout.
     */
    private rootMenuOptions(): DropdownOption[] {
        const current: RootChoice = this.pinnedRootId ? 'selected' : rootChoiceFor(this.rootFinder)
        return ROOT_CHOICES.map(choice => ({
            id: choice.id,
            html: this.rootMenuItem(choice, choice.id === current),
            disabled: choice.id === 'selected' && !this.selectedNodeId(),
            onClick: () => this.applyRoot(choice.id),
        }))
    }

    /** One menu row: icon, name, and the sentence the name needs. */
    private rootMenuItem(choice: typeof ROOT_CHOICES[number], isCurrent: boolean): HTMLElement {
        const item = document.createElement('span')
        item.className = 'pvt-rootmenu-item'
        if (isCurrent) item.classList.add('current')
        const desc: MessageKey = choice.id === 'selected' && !this.selectedNodeId()
            ? 'physicsFlyout.root.selectFirst'
            : choice.desc
        item.innerHTML = `
            <span class="pvt-flyout-icon">${choice.icon}</span>
            <span class="pvt-rootmenu-text"><b ${i18nText(choice.label)}></b><em ${i18nText(desc)}></em></span>
            <span class="pvt-rootmenu-tick">${checkmark}</span>`
        applyMessages(item, this.i18n)
        return item
    }

    /** Take a pick from the menu: pin the selected node, or hand back to a finder. */
    private applyRoot(choice: RootChoice) {
        if (choice === 'selected') {
            const selected = this.selectedNodeId()
            if (!selected) return
            this.pinnedRootId = selected
            this.sim.setTreeRoot({ rootId: selected })
        } else {
            this.pinnedRootId = undefined
            this.rootFinder = choice
            this.sim.setTreeRoot({ algorithm: choice })
        }
        this.highlightRoot()
        // A tree hung from somewhere else is a different shape, and nothing pulls it back
        // into frame — so reframe, as a spacing drag does.
        this.uiManager.graph.renderer.fitAndCenterWhenSettled()
    }

    /**
     * Keep the menu in step with the selection: `Selected node` is only reachable while
     * there is one node to hang the tree from. Subscribed at `graphReady` rather than in
     * {@link wire}: the interaction bus belongs to the renderer, which does not exist yet
     * when the flyout builds its markup.
     */
    private watchSelection() {
        for (const event of ['selectNode', 'unselectNode', 'selectNodes', 'unselectNodes'] as const) {
            this.trackInteraction(event, () => this.rootMenu?.setOptions(this.rootMenuOptions()))
        }
    }

    /** Take the row's state from the layout — at `graphReady`, and after a rebuild. */
    private syncRoot() {
        const root = this.sim.getTreeRoot()
        this.pinnedRootId = root.rootId
        this.rootFinder = root.algorithm
        this.highlightRoot()
    }

    /**
     * The one selected node, or nothing — a multi-selection roots nothing in particular.
     *
     * Guarded rather than assumed: the menu is built while the flyout's markup is, which
     * is before the renderer that owns the interaction bus exists.
     */
    private selectedNodeId(): string | undefined {
        return this.uiManager.graph.renderer?.getGraphInteraction()?.getSelectedNode()?.node.id
    }

    /** What to call the pinned node: its label if it has one, else its id. */
    private pinnedRootName(): string {
        if (!this.pinnedRootId) return ''
        // `getMutableNode`, not `getNode`: the latter `structuredClone`s the node, which
        // throws on the DOM references a rendered node holds. Nothing here mutates it.
        const label = this.uiManager.graph.getMutableNode(this.pinnedRootId)?.getData()?.label
        return typeof label === 'string' && label ? label : this.pinnedRootId
    }

    /** Say on the row what the tree is actually hung from, and move the menu's tick. */
    private highlightRoot() {
        this.rootMenu?.setOptions(this.rootMenuOptions())
        if (!this.rootPicker) return

        const pinned = Boolean(this.pinnedRootId)
        const choice = ROOT_CHOICES.find(c => c.id === (pinned ? 'selected' : rootChoiceFor(this.rootFinder)))
        const label = pinned ? this.pinnedRootName() : choice ? this.i18n.t(choice.label) : ''
        const icon = this.query('.pvt-physicsflyout-rootpick-icon')
        const value = this.query('.pvt-physicsflyout-rootpick-value')
        if (icon && choice) icon.innerHTML = choice.icon
        if (value) value.textContent = label
        this.rootPicker.title = pinned
            ? this.i18n.t('physicsFlyout.root.pinned.title', { node: label })
            : this.i18n.t('physicsFlyout.root.finder.title', { label, description: choice ? this.i18n.t(choice.desc) : '' })
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
        label.textContent = spec?.unit ? this.i18n.t(spec.unit, { count: value }) : this.i18n.formatNumber(value)
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
        if (label) label.textContent = this.i18n.t('physicsFlyout.spacing.value', { count: value })
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
        this.runButton.title = this.i18n.t(running ? 'physicsFlyout.pause.title' : 'physicsFlyout.resume.title')
        this.runButton.setAttribute('aria-pressed', String(running))
    }

    /**
     * Hand the controls to whichever half of the flyout the active layout listens
     * to: the physics presets + sliders grey out under a tree, and the spacing card
     * — which only a tree can honour — takes their place.
     */
    private updateLayoutControls() {
        // A structured layout pins every node, so no physics knob reaches it — collision included.
        const placed = this.activeLayout !== 'force'
        const isTree = placed && this.activeLayout !== 'structured'
        const collisionApplies = isTree && this.activeLayout !== 'tree-r'
        this.simulationCard?.classList.toggle('pvt-physicsflyout-disabled', placed)
        this.simulationCard?.classList.toggle('pvt-physicsflyout-collision-only', collisionApplies)
        for (const [key, input] of this.sliders) {
            input.disabled = placed && !(collisionApplies && key === TREE_LIVE_SLIDER)
        }
        for (const button of this.presetButtons.values()) button.disabled = placed

        if (this.rootRow) this.rootRow.hidden = !isTree
        if (this.spacingCard) this.spacingCard.hidden = !isTree
        for (const spec of SPACING_SLIDERS) {
            const input = this.spacingSliders.get(spec.key)
            if (input) input.disabled = this.activeLayout === 'tree-r' && !spec.radial
        }
    }

    /* ---------- template ---------- */

    protected template(): string {
        // Words beside an icon have no element of their own to be marked, so they are escaped.
        const text = (key: MessageKey) => escapeHtml(this.i18n.t(key))
        const layouts = LAYOUTS.map(l => `
            <button type="button" class="pvt-physicsflyout-layout" data-layout="${l.id}" aria-pressed="false" ${i18nAttr('title', l.desc)}>
                <span class="pvt-flyout-icon">${l.icon}</span>${text(l.label)}
            </button>`).join('')
        const presets = PRESETS.map(p => {
            const icon = PRESET_ICONS[p] ? `<span class="pvt-flyout-icon">${PRESET_ICONS[p]}</span>` : ''
            return `<button type="button" class="pvt-flyout-btn-group-btn pvt-physicsflyout-preset" data-preset="${p}" ${i18nAttr('title', PRESET_DESCRIPTIONS[p])}>${icon}${text(PRESET_LABELS[p])}</button>`
        }).join('')
        const spacing = SPACING_SLIDERS.map(s => `
            <div class="pvt-physicsflyout-slider" ${i18nAttr('title', s.desc)}>
                <div class="pvt-physicsflyout-slider-head">
                    <span class="pvt-physicsflyout-slider-label"><span class="pvt-flyout-icon">${s.icon}</span>${text(s.label)}</span>
                    <span class="pvt-physicsflyout-slider-value" data-value="${s.key}">1&times;</span>
                </div>
                <input type="range" class="pvt-physicsflyout-range" data-spacing="${s.key}"
                    min="${TREE_SPACING_RANGE[0]}" max="${TREE_SPACING_RANGE[1]}" step="0.1" value="1" />
            </div>`).join('')
        const sliders = SLIDERS.map(s => `
            <div class="pvt-physicsflyout-slider" data-row="${s.key}" ${i18nAttr('title', s.desc)}>
                <div class="pvt-physicsflyout-slider-head">
                    <span class="pvt-physicsflyout-slider-label"><span class="pvt-flyout-icon">${s.icon}</span>${text(s.label)}</span>
                    <span class="pvt-physicsflyout-slider-value" data-value="${s.key}">0</span>
                </div>
                <input type="range" class="pvt-physicsflyout-range" data-slider="${s.key}"
                    min="${PHYSICS_KNOB_RANGES[s.key][0]}" max="${PHYSICS_KNOB_RANGES[s.key][1]}" step="${s.step}" value="0" />
            </div>`).join('')

        return this.headerRow(atom, this.i18n.t('physicsFlyout.title'))
            + this.sectionLabel(this.i18n.t('physicsFlyout.section'))
            + `
            <div class="pvt-physicsflyout-layouts">${layouts}</div>
            <div class="pvt-physicsflyout-rootrow" hidden>
                <span class="pvt-physicsflyout-rootrow-label" ${i18nText('physicsFlyout.root')}></span>
                <button type="button" class="pvt-physicsflyout-rootpick" aria-haspopup="menu">
                    <span class="pvt-flyout-icon pvt-physicsflyout-rootpick-icon"></span>
                    <span class="pvt-physicsflyout-rootpick-value"></span>
                    <span class="pvt-flyout-icon pvt-physicsflyout-rootpick-caret">${arrowDown}</span>
                </button>
            </div>
            <div class="pvt-flyout-card pvt-physicsflyout-spacing" hidden>
                <div class="pvt-flyout-card-head">
                    <span class="pvt-flyout-card-title" ${i18nText('physicsFlyout.spacing')}></span>
                    <button type="button" class="pvt-physicsflyout-autospacing active" aria-pressed="true"
                        ${i18nAttr('title', 'physicsFlyout.spacing.auto.title')}><span class="pvt-flyout-icon">${sparkles}</span>${text('physicsFlyout.spacing.auto')}</button>
                </div>
                <div class="pvt-physicsflyout-sliders">${spacing}</div>
            </div>
            <div class="pvt-flyout-card pvt-physicsflyout-card">
                <div class="pvt-flyout-card-head">
                    <span class="pvt-flyout-card-title" ${i18nText('physicsFlyout.simulation')}></span>
                    <button type="button" class="pvt-physicsflyout-run" ${i18nAttr('title', 'physicsFlyout.pause.title')}>${pause}</button>
                </div>
                <div class="pvt-flyout-btn-group pvt-physicsflyout-presets">${presets}</div>
                <div class="pvt-physicsflyout-sliders">${sliders}</div>
            </div>`
    }
}
