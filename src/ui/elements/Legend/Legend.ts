import type { GraphFilters } from '../../../interfaces/GraphQueryEngine'
import type { LegendPosition, LegendSection } from '../../../interfaces/GraphUI'
import { createHtmlElement } from '../../../utils/ElementCreation'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import { LegendSectionView } from './LegendSectionView'
import './legend.scss'

/** The filter key a lone legend writes when it isn't adopting a declared facet. */
export const RESERVED_LEGEND_FILTER_KEY = '__legend'

/** A section with its identity resolved, ready to be handed to a view. */
interface IdentifiedSection {
    id: string
    config: LegendSection
}

/** `UI.legend` in whichever form it was declared, reduced to one shape. */
interface NormalisedLegend {
    position?: LegendPosition
    sections: IdentifiedSection[]
    /** `UI.legend: true` — derive without vetting the colours first. */
    forced: boolean
    /** The multi-section form, which namespaces its sections' filter keys. */
    grouped: boolean
}

/**
 * The canvas legend: a key for the graph's colours that doubles as a filter.
 *
 * This is the **container** — one card docked in a canvas corner, holding a stack
 * of {@link LegendSectionView}s, one per encoding the graph uses. A single-section
 * config (`UI.legend: { key: 'type' }`) is just the stack of one.
 *
 * The container owns the corner, the panel, the delegated click handler and the
 * rebuild schedule; everything about *what a section lists and what it filters*
 * belongs to the section itself. Each filterable section drives its own filter key,
 * so the query engine ands them: switch `attribute` off in one section and `self`
 * off in another, and what is left is the nodes that are neither.
 *
 * Shown in `full` and `light` modes only.
 */
export class Legend extends UIComponent {
    private slot?: HTMLElement
    private panel?: HTMLDivElement
    /** The live sections, in render order, keyed by section id. */
    private views = new Map<string, LegendSectionView>()
    private rebuildFrame: number | null = null
    /** Set for the length of a rebuild, so a filter it writes isn't read back mid-flight. */
    private rebuilding = false
    /** Warnings already emitted, so rebuilds don't spam the console. */
    private readonly warned = new Set<string>()

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    /* ---------- lifecycle ---------- */

    protected onMount(container?: HTMLElement) {
        if (!container) return
        this.slot = container

        this.panel = createHtmlElement('div', { class: 'pvt-legend-panel' })
        container.appendChild(this.panel)

        // Delegated once on the panel, which survives every rebuild — per-row
        // listeners would pile up each time the entries are re-resolved.
        this.listen(this.panel, 'click', (event) => this.onPanelClick(event as MouseEvent))
        this.listen(this.panel, 'pointerover', (event) => this.onPanelPointerOver(event as PointerEvent))
        this.listen(this.panel, 'pointerleave', () => this.endHover())
    }

    private onPanelClick(event: MouseEvent) {
        const target = event.target as HTMLElement
        const view = this.viewFor(target)
        if (!view) return

        const action = target.closest('.pvt-legend-action') as HTMLElement | null
        if (action) {
            const name = action.dataset.action
            // Alt-click on a chevron folds (or unfolds) the whole stack, so a legend
            // keying four dimensions can be got out of the way in one click.
            if (name === 'collapse' && event.altKey && this.views.size > 1) {
                const collapsed = !view.isCollapsed
                for (const other of this.views.values()) other.setCollapsed(collapsed)
                return
            }
            if (name === 'show-all' || name === 'invert' || name === 'collapse') view.onAction(name)
            return
        }

        const row = target.closest('.pvt-legend-entry') as HTMLElement | null
        if (row?.dataset.id) view.onEntryClick(row.dataset.id, event.altKey)
    }

    /**
     * Hovering an entry reads its category off the canvas. Delegated like the click,
     * and on `pointerover` rather than `pointerenter` so it bubbles: moving from one
     * row to the next fires here once, with no gap in which the canvas un-dims.
     */
    private onPanelPointerOver(event: PointerEvent) {
        // A tap fires this too, and nothing follows it to say the finger left — the
        // canvas would be stranded dim.
        if (event.pointerType === 'touch') return

        const target = event.target as HTMLElement
        const row = target.closest('.pvt-legend-entry') as HTMLElement | null
        const view = row ? this.viewFor(row) : undefined
        // The header, the gap between sections, a row whose section has gone: the
        // pointer is inside the card but not on a category.
        if (!view || !row?.dataset.id) {
            this.endHover()
            return
        }
        this.endHover(view)
        view.onEntryHover(row.dataset.id)
    }

    /** Drop the hover every section but `keep` is holding — one pointer, one category. */
    private endHover(keep?: LegendSectionView) {
        for (const view of this.views.values()) {
            if (view !== keep) view.endHover()
        }
    }

    /** The section an event inside the panel landed in. */
    private viewFor(target: HTMLElement): LegendSectionView | undefined {
        const block = target.closest('.pvt-legend-section') as HTMLElement | null
        if (block?.dataset.section === undefined) return undefined
        return this.views.get(block.dataset.section)
    }

    protected onAfterMount() {
        const graph = this.uiManager.graph

        // Entries can be a function of the graph, and derived entries follow the data.
        const onData = () => this.queueRebuild()
        graph.on('dataBatchChanged', onData)
        this.track(() => graph.off('dataBatchChanged', onData))

        const onFilterChange = (filters: GraphFilters) => this.syncFromFilters(filters)
        graph.queryEngine.on('filterChange', onFilterChange)
        this.track(() => graph.queryEngine.off('filterChange', onFilterChange))

        // The renderer (whose styles the swatches are sampled from) and the declared
        // facets are both wired *after* the UIManager is constructed, so the first
        // resolution waits a frame rather than running inside the constructor.
        this.queueRebuild()
    }

    protected onGraphReady() {
        this.queueRebuild()
    }

    protected onDestroy() {
        if (this.rebuildFrame !== null) cancelAnimationFrame(this.rebuildFrame)
        this.rebuildFrame = null
        this.clear()
        this.panel?.remove()
        this.panel = undefined
    }

    /* ---------- public API ---------- */

    /**
     * Re-read `UI.legend` and rebuild. Called by `graph.setLegend`, which has
     * already replaced the options block.
     */
    public refresh() {
        this.rebuild()
    }

    /* ---------- configuration ---------- */

    /**
     * `UI.legend` normalised: `false` (or `enabled: false`) means no legend, an
     * object with `sections` is the stacked form, and `true` / absent / an object
     * with no `key` or `entries` all mean "work out what to list".
     */
    private get config(): NormalisedLegend | undefined {
        const declared = this.uiManager.getOptions().legend
        if (declared === false) return undefined
        if (declared === undefined || declared === true) {
            return { sections: this.identify([{}]), forced: declared === true, grouped: false }
        }
        if (declared.enabled === false) return undefined

        if ('sections' in declared) {
            const sections = declared.sections.filter(section => section.enabled !== false)
            return {
                position: declared.position,
                sections: this.identify(sections),
                forced: false,
                grouped: true,
            }
        }
        return {
            position: declared.position,
            sections: this.identify([declared]),
            forced: false,
            grouped: false,
        }
    }

    /**
     * Give every section a stable id — its own `id`, else its `key`, else its place
     * in the stack. Two sections keying on `nodeTypeAccessor` would be the same list
     * twice, so only the first survives.
     */
    private identify(sections: LegendSection[]): IdentifiedSection[] {
        const used = new Set<string>()
        const identified: IdentifiedSection[] = []
        let autoTaken = false

        sections.forEach((config, index) => {
            if (config.key === undefined && config.entries === undefined) {
                if (autoTaken) {
                    this.warnOnce('duplicate-auto',
                        'Pivotick: only one legend section can key on `render.nodeTypeAccessor`; give the others a `key` or `entries`. The extra section is dropped.')
                    return
                }
                autoTaken = true
            }

            let id = config.id ?? config.key ?? `section-${index}`
            if (used.has(id)) {
                this.warnOnce(`duplicate-id-${id}`,
                    `Pivotick: two legend sections resolve to the id '${id}'; the second is renamed '${id}-${index}'. Declare 'id' to choose.`)
                id = `${id}-${index}`
            }
            used.add(id)
            identified.push({ id, config })
        })

        return identified
    }

    private warnOnce(token: string, message: string) {
        if (this.warned.has(token)) return
        this.warned.add(token)
        console.warn(message)
    }

    /* ---------- rebuild ---------- */

    private queueRebuild() {
        if (this.rebuildFrame !== null) return
        this.rebuildFrame = requestAnimationFrame(() => {
            this.rebuildFrame = null
            this.rebuild()
        })
    }

    /**
     * Which corner the legend takes when the consumer hasn't named one.
     *
     * `full` mode docks it bottom-right, stacked above the minimap it also mounts: the
     * left column belongs to the mode rail and its panels, and a rail mode whose panel
     * is a workspace rather than a settings sheet reaches far enough down it to squeeze
     * the legend to a single row. The other modes keep the bottom-left corner — they
     * have no minimap to stack on, and much shorter panels beside them.
     */
    private defaultPosition(): LegendPosition {
        return this.uiManager.getOptions().mode === 'full' ? 'bottom-right' : 'bottom-left'
    }

    private rebuild() {
        if (!this.panel) return
        const config = this.config
        if (!config) {
            this.clear()
            return
        }

        this.rebuilding = true
        try {
            this.slot?.setAttribute('data-position', config.position ?? this.defaultPosition())
            this.syncViews(config)

            // A section with nothing to list (a key no node carries, an empty
            // declaration) is skipped entirely rather than shown as a titled empty box.
            const rendered = [...this.views.values()].filter(view => view.resolve() > 0)

            this.panel.innerHTML = ''
            for (const view of rendered) {
                view.setCollapseAllOffered(rendered.length > 1)
                this.panel.appendChild(view.render())
            }
            this.panel.classList.toggle('pvt-legend-stacked', rendered.length > 1)
            this.warnOnTitleCollision(rendered)
        } finally {
            this.rebuilding = false
        }

        for (const view of this.views.values()) {
            view.refreshFilter()
            // The row the pointer is on was just replaced, and no pointer event says so.
            view.refreshHover()
        }
    }

    /**
     * Reconcile the live sections against the config **by id**, so a rebuild keeps
     * what the user did — which categories are off, which sections are folded — and
     * a section that left the config releases its facet and drops its filter.
     */
    private syncViews(config: NormalisedLegend) {
        const next = new Map<string, LegendSectionView>()

        for (const { id, config: section } of config.sections) {
            const reservedKey = config.grouped ? `${RESERVED_LEGEND_FILTER_KEY}:${id}` : RESERVED_LEGEND_FILTER_KEY
            let view = this.views.get(id)
            // Switching between the lone and the stacked form renames the filter key,
            // which a live view can't be handed: it is rebuilt instead.
            if (view && view.reservedKey !== reservedKey) {
                view.dispose()
                view = undefined
            }
            if (!view) view = new LegendSectionView(this.uiManager, id, reservedKey)
            view.setConfig(section, config.forced)
            next.set(id, view)
        }

        for (const [id, view] of this.views) {
            if (next.get(id) !== view) view.dispose()
        }
        this.views = next
    }

    /** Empty the legend without tearing the component down (`setLegend(undefined)`). */
    private clear() {
        // A legend that goes away must not leave nodes hidden behind it — including
        // when its sections were driving adopted facets.
        for (const view of this.views.values()) view.dispose()
        this.views.clear()
        if (!this.panel) return
        this.panel.innerHTML = ''
        this.panel.classList.remove('pvt-legend-stacked')
    }

    /**
     * Two sections headed the same thing are unreadable, and it is easy to land on:
     * declared entries fall back to `'Legend'` whatever they list.
     */
    private warnOnTitleCollision(views: LegendSectionView[]) {
        if (views.length < 2) return
        const seen = new Map<string, string>()
        for (const view of views) {
            const first = seen.get(view.title)
            if (first !== undefined) {
                this.warnOnce(`title-${view.title}`,
                    `Pivotick: legend sections '${first}' and '${view.id}' are both headed '${view.title}'; give one a 'title'.`)
                continue
            }
            seen.set(view.title, view.id)
        }
    }

    private syncFromFilters(filters: GraphFilters) {
        // Mid-rebuild the sections are re-resolving their own entries; the filters a
        // rebuild writes are its own echo.
        if (this.rebuilding) return
        for (const view of this.views.values()) view.syncFromFilters(filters)
    }
}
