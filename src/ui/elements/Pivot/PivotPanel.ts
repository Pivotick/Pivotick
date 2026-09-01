import type { Node } from '../../../Node'
import type {
    PivotDefinition, PivotFacet, PivotNarrowing, PivotRefusal, PivotSummary,
} from '../../../interfaces/Pivot'
import type { FieldConfig, FieldOption, FormValues } from '../../../utils/FormFactory'
import { FormFactory } from '../../../utils/FormFactory'
import type { UIManager } from '../../UIManager'

const fmt = (value: number): string => value.toLocaleString()

/** Dock tab ids are namespaced by pivot — the same prefix `PivotTriage` registers under. */
const TRIAGE_TAB_PREFIX = 'pivot-triage:'

/** How long a typed narrowing field waits before it re-asks the provider. */
const TYPED_DELAY_MS = 400

/** The field kinds that commit as you type; everything else commits on `change`. */
const TYPED_FIELDS: ReadonlySet<string> = new Set(['text', 'numberRange'])

/**
 * Pivot mode's panel: the origin, and what can be done to it.
 *
 * It is a persistent element rather than something the tool panel rebuilds, because
 * `RailModeDefinition.render()` is only re-invoked when the panel itself is rebuilt —
 * which a summary landing is not. So this owns its DOM and repaints the parts that
 * changed, leaving the analyst's narrowing controls alone.
 */
export class PivotPanel {
    private readonly root: HTMLElement
    private readonly originBlock: HTMLElement
    private readonly heading: HTMLElement
    private readonly list: HTMLElement
    private readonly originless: HTMLDetailsElement
    private readonly originlessList: HTMLElement

    private readonly entries = new Map<string, PivotEntry>()
    private origin: Node[] = []
    /** True between `onEnter` and `onExit` — the window in which a provider may be called. */
    private active = false
    private readonly unsubscribe: () => void
    private readonly uiManager: UIManager

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.root = el('div', 'pvt-pivot-panel')

        this.originBlock = el('div', 'pvt-pivot-origin')
        this.heading = el('div', 'pvt-pivot-heading')
        this.list = el('div', 'pvt-pivot-list')

        this.originless = document.createElement('details')
        this.originless.className = 'pvt-pivot-originless'
        this.originless.appendChild(document.createElement('summary'))
        this.originlessList = el('div', 'pvt-pivot-list')
        this.originless.appendChild(this.originlessList)

        this.root.append(this.originBlock, this.heading, this.list, this.originless)

        // A pivot registered or unregistered while the mode is open changes the list.
        this.unsubscribe = this.uiManager.graph.pivots.on(change => {
            if (change === 'registry') this.rebuild()
            if (change === 'candidates') for (const entry of this.entries.values()) entry.refreshStaged()
        })
    }

    public element(): HTMLElement {
        return this.root
    }

    /** Called when the mode is entered: the origin is settled, so start asking. */
    public enter(): void {
        this.active = true
        this.rebuild()
        for (const entry of this.entries.values()) entry.start()
    }

    /**
     * Called when the mode is left. Every *question* in flight goes with it (D11) — but
     * not a fetch: that already has a candidate set and a pane of its own, so leaving is
     * not a cancellation (C3). Cancel is still reachable from both.
     */
    public exit(): void {
        this.active = false
        this.uiManager.graph.pivots.cancel(undefined, 'summarize')
        for (const entry of this.entries.values()) entry.stop()
    }

    /**
     * The origin changed. Which pivots apply is re-read from it, and every entry that
     * survives re-asks — the origin is half of the question its count answers.
     */
    public setOrigin(nodes: Node[]): void {
        if (sameIds(nodes, this.origin)) return
        this.origin = nodes
        this.rebuild()
        if (!this.active) return
        for (const entry of this.entries.values()) entry.originChanged()
    }

    /**
     * Scope the panel to one pivot: its entry is scrolled to and marked. Deferred a frame
     * because the caller is usually the same gesture that entered the mode, and the tool
     * panel has not laid the entry out yet.
     */
    public focus(pivotId: string): void {
        window.requestAnimationFrame(() => {
            for (const [id, entry] of this.entries) entry.element().classList.toggle('pvt-pivot-focus', id === pivotId)
            this.entries.get(pivotId)?.element().scrollIntoView({ block: 'nearest' })
        })
    }

    public destroy(): void {
        this.unsubscribe()
        for (const entry of this.entries.values()) entry.destroy()
        this.entries.clear()
        this.root.remove()
    }

    /** Repaint the origin block and re-derive which entries belong in which list. */
    private rebuild(): void {
        const pivots = this.uiManager.graph.pivots
        const applicable = pivots.for(this.origin)
        // With an origin picked, the origin-less pivots fold into a group of their own
        // (C14): they are still runnable, they just answer a different question.
        const detached = this.origin.length ? pivots.for([]) : []

        this.paintOrigin()
        this.paintHeading(applicable.length)
        this.paintList(this.list, applicable)
        this.paintList(this.originlessList, detached)

        this.originless.hidden = detached.length === 0
        const summary = this.originless.querySelector('summary')
        if (summary) summary.textContent = `Without an origin (${detached.length})`

        // Anything no longer in either list is gone for good — drop its state with it.
        const live = new Set([...applicable, ...detached].map(def => def.id))
        for (const [id, entry] of [...this.entries]) {
            if (live.has(id)) continue
            entry.destroy()
            this.entries.delete(id)
        }
    }

    private paintOrigin(): void {
        this.originBlock.replaceChildren()
        const label = el('div', 'pvt-pivot-origin-label')
        label.textContent = 'Origin'
        this.originBlock.appendChild(label)

        if (!this.origin.length) {
            const empty = el('div', 'pvt-pivot-origin-empty')
            empty.textContent = 'Nothing picked — click a node on the canvas, or run one of the pivots below'
            this.originBlock.appendChild(empty)
            return
        }

        const chips = el('div', 'pvt-pivot-chips')
        const shown = this.origin.slice(0, 3)
        for (const node of shown) {
            const chip = el('span', 'pvt-pivot-chip')
            const label = node.getData()?.label
            chip.textContent = typeof label === 'string' && label ? label : String(node.id)
            chip.title = String(node.id)
            chips.appendChild(chip)
        }
        if (this.origin.length > shown.length) {
            const rest = el('span', 'pvt-pivot-chip pvt-pivot-chip-more')
            rest.textContent = `+${fmt(this.origin.length - shown.length)}`
            chips.appendChild(rest)
        }

        const clear = document.createElement('button')
        clear.type = 'button'
        clear.className = 'pvt-pivot-clear'
        clear.textContent = 'Clear'
        clear.addEventListener('click', () => {
            this.uiManager.graph.renderer.getGraphInteraction().unselectAll()
            this.setOrigin([])
        })

        this.originBlock.append(chips, clear)
    }

    private paintHeading(applicable: number): void {
        if (!this.origin.length) {
            this.heading.textContent = ''
            this.heading.hidden = true
            return
        }
        this.heading.hidden = false
        this.heading.textContent = applicable
            ? `${applicable} pivot${applicable === 1 ? '' : 's'} appl${applicable === 1 ? 'ies' : 'y'}`
            : 'No pivots apply to this origin'
    }

    /** Put each definition's entry in `host`, in order, creating what is new. */
    private paintList(host: HTMLElement, defs: PivotDefinition[]): void {
        for (const def of defs) {
            let entry = this.entries.get(def.id)
            if (!entry) {
                entry = new PivotEntry(this.uiManager, def, () => this.originFor(def))
                this.entries.set(def.id, entry)
                if (this.active) entry.start()
            }
            host.appendChild(entry.element())
        }
    }

    /** An origin-less pivot is asked about nothing, whatever is selected (D19). */
    private originFor(def: PivotDefinition): Node[] {
        return def.origin === 'none' ? [] : this.origin
    }
}

/**
 * One pivot in the panel — the state machine of §2 of the states doc, from what the
 * provider has advertised down to the link into the triage pane its fetch filled.
 */
class PivotEntry {
    private readonly root: HTMLElement
    private readonly countLine: HTMLElement
    private readonly breakdown: HTMLElement
    private readonly refusalLine: HTMLElement
    private readonly narrowingHost: HTMLElement
    private readonly actions: HTMLElement

    private phase: 'idle' | 'summarizing' | 'ready' | 'resummarizing' | 'failed' | 'fetching' = 'idle'
    private summary?: PivotSummary
    private narrowing: PivotNarrowing = {}
    private refusal?: PivotRefusal
    private form?: HTMLFormElement
    /** The facet shape the current form was built from, so it is only rebuilt when it moves. */
    private facetSignature = ''
    /** Rebuild the form once the analyst's cursor has left it, never under their fingers. */
    private formStale = false
    /** Bumped on every ask, so a superseded answer is dropped rather than painted. */
    private token = 0
    private typedTimer?: number
    /** Whether this entry has asked since the mode was entered — `start` is idempotent. */
    private started = false
    /** The origin the last ask was about, so an origin change that isn't one asks nothing. */
    private askedFor?: string

    private readonly uiManager: UIManager
    private readonly def: PivotDefinition
    private readonly origin: () => Node[]

    constructor(uiManager: UIManager, def: PivotDefinition, origin: () => Node[]) {
        this.uiManager = uiManager
        this.def = def
        this.origin = origin
        this.root = el('div', 'pvt-pivot-entry')
        this.root.dataset.pivot = def.id

        const head = el('div', 'pvt-pivot-entry-head')
        if (def.icon) {
            const icon = el('span', 'pvt-pivot-entry-icon')
            icon.innerHTML = def.icon
            head.appendChild(icon)
        }
        const label = el('span', 'pvt-pivot-entry-label')
        label.textContent = def.label
        head.appendChild(label)

        this.countLine = el('div', 'pvt-pivot-count')
        this.breakdown = el('div', 'pvt-pivot-breakdown')
        this.refusalLine = el('div', 'pvt-pivot-refusal')
        this.narrowingHost = el('div', 'pvt-pivot-narrowing')
        this.actions = el('div', 'pvt-pivot-actions')

        this.root.append(head, this.countLine, this.breakdown, this.refusalLine, this.narrowingHost, this.actions)
        this.paint()
    }

    public element(): HTMLElement {
        return this.root
    }

    /** Entering the mode is the intent that starts the first call (D11). */
    public start(): void {
        if (this.started) return
        this.started = true
        if (!this.def.summarize) {
            this.phase = 'idle'
            this.paint()
            return
        }
        void this.ask(false)
    }

    /** Leaving the mode: nothing is in flight any more, so stop claiming it is. */
    public stop(): void {
        window.clearTimeout(this.typedTimer)
        this.token++
        this.started = false
        if (this.phase === 'summarizing' || this.phase === 'resummarizing' || this.phase === 'fetching') {
            this.phase = this.summary ? 'ready' : 'idle'
        }
        this.paint()
    }

    /**
     * The origin moved. A newly created entry has already asked about it through
     * {@link start}, so the guard is on the question rather than on who is asking:
     * clicking one node fires an unselect and a select, and the second must not ask
     * again for what the first already asked.
     */
    public originChanged(): void {
        if (this.def.origin === 'none') return
        if (this.askedFor === this.originKey()) return
        this.started = true
        void this.ask(true)
    }

    /** A staged set appeared, changed or went — only the `n in triage` link moves. */
    public refreshStaged(): void {
        this.paintActions()
    }

    public destroy(): void {
        window.clearTimeout(this.typedTimer)
        this.token++
        this.root.remove()
    }

    /**
     * Ask the provider what is out there. `resummarize` keeps the previous count on
     * screen, dimmed — blanking it makes every narrowing tick look like a reset (S5).
     */
    private async ask(resummarize: boolean): Promise<void> {
        if (!this.def.summarize) return
        const token = ++this.token
        this.askedFor = this.originKey()
        const cached = this.uiManager.graph.pivots.cachedSummary(this.def.id, this.origin(), this.narrowing)
        if (cached) {
            // A cache hit skips the skeleton entirely (S2): a re-opened mode shows its
            // number at once rather than flickering through a loading state.
            this.summary = cached
            this.phase = 'ready'
            this.paint()
            return
        }

        this.phase = resummarize && this.summary ? 'resummarizing' : 'summarizing'
        this.paint()

        try {
            const summary = await this.uiManager.graph.pivots.summarize(this.def.id, this.origin(), this.narrowing)
            if (token !== this.token) return
            // `undefined` means the call was superseded, and something newer is already
            // on its way — leave the state to whoever superseded it.
            if (!summary) return
            this.summary = summary
            this.phase = 'ready'
        } catch {
            if (token !== this.token) return
            this.phase = 'failed'
        }
        this.paint()
    }

    private async fetch(): Promise<void> {
        const token = ++this.token
        this.phase = 'fetching'
        this.refusal = undefined
        this.paint()

        const outcome = await this.uiManager.graph.pivots.run(this.def.id, this.origin(), this.narrowing)
        if (token !== this.token) return

        this.phase = this.summary ? 'ready' : 'idle'
        if (outcome.status === 'refused') this.refusal = outcome.refusal
        // A failed or vetoed run is reported where it happened: a staged pivot's pane
        // carries the error and its retry, and an auto-ingest one is the notifier's.
        this.paint()
    }

    /* ---------- painting ---------- */

    private paint(): void {
        this.root.dataset.phase = this.phase
        this.paintCount()
        this.paintBreakdown()
        this.paintRefusal()
        this.paintNarrowing()
        this.paintActions()
    }

    private paintCount(): void {
        const line = this.countLine
        line.classList.toggle('pvt-pivot-dim', this.phase === 'resummarizing')
        line.classList.remove('pvt-pivot-skeleton')

        if (this.phase === 'failed') {
            line.textContent = 'Couldn\'t reach the source.'
            return
        }
        if (this.phase === 'summarizing') {
            line.textContent = ''
            line.classList.add('pvt-pivot-skeleton')
            return
        }
        if (this.summary) {
            line.textContent = this.countText(this.summary.total)
            return
        }
        // Nothing asked yet, or nothing to ask: a declared potential is the only number
        // the canvas ever shows unprompted, so it is the only one that belongs here (D12).
        const declared = this.declared()
        line.textContent = declared ? `~${fmt(declared)} declared` : ''
    }

    /** `~2,143`, and C2's one line for a multi-node origin — never one line per node. */
    private countText(total: number): string {
        const nodes = this.origin().length
        return nodes > 1 ? `~${fmt(total)} across ${fmt(nodes)} nodes` : `~${fmt(total)}`
    }

    private originKey(): string {
        return this.origin().map(node => node.id).join(',')
    }

    /** What the origin declared for this pivot, summed — advisory like everything else. */
    private declared(): number {
        return this.origin().reduce((sum, node) => sum + (node.getPotential(this.def.id) ?? 0), 0)
    }

    private paintBreakdown(): void {
        const facets = this.summary?.facets ?? []
        const counted = facets.flatMap(facet => (facet.options ?? []).filter(o => o.count !== undefined))
        // The label is the provider's, used verbatim like every other label in the
        // library — lower-casing one would mangle a translated noun.
        this.breakdown.textContent = counted
            .map(option => `${fmt(option.count as number)} ${option.label}`)
            .join(' · ')
        this.breakdown.hidden = counted.length === 0
    }

    private paintRefusal(): void {
        const capped = this.overCap()
        if (capped) {
            this.refusalLine.textContent =
                `~${fmt(this.summary?.total ?? 0)} exceeds this pivot's cap of ${fmt(this.def.maxCandidates as number)}`
                + ' — narrow further to fetch'
        } else if (this.refusal?.kind === 'ceiling') {
            this.refusalLine.textContent =
                `The source returned ${fmt(this.refusal.count)} candidates, over the ${fmt(this.refusal.limit)} limit.`
                + ' Nothing was staged — narrow and run again.'
        } else {
            this.refusalLine.textContent = ''
        }
        this.refusalLine.hidden = !this.refusalLine.textContent
    }

    /** Over the pivot's own cap, judged on the freshest advisory count (D4). */
    private overCap(): boolean {
        return this.def.maxCandidates !== undefined
            && this.summary !== undefined
            && this.summary.total > this.def.maxCandidates
    }

    /**
     * Build the narrowing form from the facets the provider declared. Rebuilt only when
     * the facets themselves move — including their option counts, which are the source's
     * answer to the current narrowing (C4) — and never while a field has focus.
     */
    private paintNarrowing(): void {
        const facets = this.summary?.facets ?? []
        const signature = JSON.stringify(facets)
        if (signature === this.facetSignature) return

        if (this.form?.contains(document.activeElement)) {
            this.formStale = true
            return
        }
        this.facetSignature = signature
        this.formStale = false
        this.narrowingHost.replaceChildren()
        this.form = undefined
        if (!facets.length) return

        const form = FormFactory.createForm({ fields: facets.map(facetToField) })
        FormFactory.setValues(form, this.narrowing as FormValues)
        this.form = form
        this.narrowingHost.appendChild(form)

        form.addEventListener('submit', event => {
            event.preventDefault()
            this.commitNarrowing()
        })
        form.addEventListener('change', () => this.commitNarrowing())
        form.addEventListener('input', event => {
            const type = (event.target as HTMLElement | null)?.closest?.('[data-field-type]')
                ?.getAttribute('data-field-type')
            if (!type || !TYPED_FIELDS.has(type)) return
            window.clearTimeout(this.typedTimer)
            this.typedTimer = window.setTimeout(() => this.commitNarrowing(), TYPED_DELAY_MS)
        })
        form.addEventListener('focusout', () => {
            if (this.formStale) window.setTimeout(() => this.paintNarrowing(), 0)
        })
    }

    /** Read the form and re-ask — narrowing and the count are one question (D4). */
    private commitNarrowing(): void {
        if (!this.form) return
        window.clearTimeout(this.typedTimer)
        this.narrowing = compactNarrowing(FormFactory.getValues(this.form))
        this.refusal = undefined
        void this.ask(true)
    }

    private paintActions(): void {
        this.actions.replaceChildren()

        if (this.phase === 'fetching') {
            const total = this.summary ? `~${fmt(this.summary.total)}` : ''
            const label = el('span', 'pvt-pivot-progress')
            label.textContent = total ? `Fetching ${total}…` : 'Fetching…'
            this.actions.append(label, this.button('Cancel', true, () => {
                this.uiManager.graph.pivots.cancelFetch(this.def.id)
            }))
            return
        }

        if (this.phase === 'failed') {
            this.actions.appendChild(this.button('Retry', true, () => {
                this.uiManager.graph.pivots.invalidate(this.def.id, this.origin())
                void this.ask(false)
            }))
            return
        }

        if (Object.keys(this.narrowing).length) {
            this.actions.appendChild(this.button('Clear narrowing', false, () => {
                if (this.form) FormFactory.clear(this.form)
                this.narrowing = {}
                this.refusal = undefined
                void this.ask(true)
            }))
        }

        // A pivot with no `summarize` has no count to gate on, so it just runs (S7).
        const primary = this.def.summarize ? 'Fetch' : 'Run'
        const busy = this.phase === 'summarizing' || this.phase === 'resummarizing'
        const fetch = this.button(primary, true, () => void this.fetch())
        fetch.disabled = busy || this.overCap()
        this.actions.appendChild(fetch)

        const staged = this.uiManager.graph.pivots.candidates(this.def.id)
        const waiting = staged?.nodes.filter(c => c.state !== 'rejected' && !c.deduped).length ?? 0
        if (staged && !staged.loading && waiting) {
            const link = this.button(`${fmt(waiting)} in triage ▸`, false, () => {
                this.uiManager.activateDockTab(TRIAGE_TAB_PREFIX + this.def.id)
            })
            link.classList.add('pvt-pivot-triage-link')
            this.actions.appendChild(link)
        }
    }

    private button(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = primary ? 'pvt-pivot-button pvt-pivot-button-primary' : 'pvt-pivot-button'
        button.textContent = label
        button.addEventListener('click', onClick)
        return button
    }
}

/* ---------- helpers ---------- */

function el(tag: string, className: string): HTMLElement {
    const element = document.createElement(tag)
    element.className = className
    return element
}

function sameIds(a: Node[], b: Node[]): boolean {
    return a.length === b.length && a.every((node, index) => node.id === b[index].id)
}

/**
 * A facet as a form field. `boolean` becomes a true/false/unset dropdown for the same
 * reason the filter panel does it — a checkbox has no "unset" — and an option's count
 * rides in its label, which is the only place the widget has for it.
 */
function facetToField(facet: PivotFacet): FieldConfig {
    const label = facet.label ?? FormFactory.niceLabelFromKey(facet.key)
    if (facet.type === 'boolean') {
        return {
            key: facet.key, label, type: 'select', allowEmpty: true, valuesAreBoolean: true,
            options: [{ label: 'true', value: 'true' }, { label: 'false', value: 'false' }],
        }
    }
    const field: FieldConfig = { key: facet.key, label, type: facet.type }
    if (facet.type === 'select' || facet.type === 'multiselect') {
        field.allowEmpty = true
        field.options = (facet.options ?? []).map((option): FieldOption => ({
            label: option.count === undefined ? option.label : `${option.label}  ${fmt(option.count)}`,
            value: option.value,
        }))
    }
    return field
}

/**
 * Drop the keys the analyst has not actually set. An empty multiselect is not a
 * narrowing, and leaving it in would make `{type: []}` a different cache key — and a
 * different question — from asking nothing at all.
 */
function compactNarrowing(values: FormValues): PivotNarrowing {
    const narrowing: PivotNarrowing = {}
    for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === '') continue
        if (Array.isArray(value) && !value.length) continue
        if (isRange(value) && value.min === undefined && value.max === undefined) continue
        narrowing[key] = value
    }
    return narrowing
}

function isRange(value: unknown): value is { min?: number, max?: number } {
    return typeof value === 'object' && value !== null && ('min' in value || 'max' in value)
}
