import type {
    EdgeFacet, EdgeFacetValue, FilterFacet, FilterFieldConfig, FilterOptions, GraphFilters,
} from '../../../interfaces/GraphQueryEngine'
import { createHtmlElement, createHtmlTemplate, createIcon } from '../../../utils/ElementCreation'
import { Node } from '../../../Node'
import { EDGE_FILTER_PREFIX } from '../../../GraphQueryEngine'
import { FormFactory, type FieldConfig, type FieldOption, type FieldType, type FormValue, type FormValues } from '../../../utils/FormFactory'
import { nodeNameGetter } from '../../../utils/GraphGetters'
import { createButton } from '../../components/Button'
import { funnel, funnelClear, graphEdgeIcon, nodeProperty, show } from '../../icons'
import { createEdgeSwatchFor } from '../../components/EdgeSwatch'
import { createInspectModal } from '../modals/InspectNodeModal/InspectNodeModal'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import { collectDataAttributes, inferAttributeType } from '../../../utils/DataAttributes'
import './graphFilter.scss'


const DEFAULT_FILTER_BUTTON_TEXT = 'Filter Graph'


export class GraphFilter extends UIComponent {

    public graphFilter?: HTMLDivElement
    private formOptions: FieldConfig[]
    private filteringForm?: HTMLFormElement
    private manuallyFilteredContainer?: HTMLDivElement
    /** The layer-toggle rows, by `edge:<key>|<value>`, so a filter change can relight them. */
    private layerRows = new Map<string, HTMLElement>()
    /** Set while the panel writes a layer filter, so it doesn't read its own echo back. */
    private applyingLayers = false

    constructor(uiManager: UIManager) {
        super(uiManager)
        this.formOptions = []
    }

    protected onMount(container: HTMLElement | undefined) {
        if (!container) return

        this.build()
        if (this.graphFilter) {
            container.appendChild(this.graphFilter)
        }
    }

    protected onDestroy() {
        this.graphFilter?.remove()
        this.graphFilter = undefined
    }

    protected onAfterMount() {
    }

    protected onGraphReady(): void { }

    build(): HTMLDivElement {
        this.graphFilter = document.createElement('div')
        this.graphFilter.classList.add('pvt-graph-filter-container')

        this.uiManager.graph.on('dataBatchChanged', () => {
            this.rebuild()
        })

        this.uiManager.graph.queryEngine.on('filterChange', (filters: GraphFilters) => {
            this.updateUIFilterButtonContent(filters)
            this.updateUIFilterHiddenNodes()
            this.syncFormFromActiveFilters(filters)
            this.syncLayerRows()
        })

        requestAnimationFrame(() => {
            this.updateUIFilterButtonContent({})
            this.updateUIFilterHiddenNodes()
        })
        return this.graphFilter
    }

    private rebuild(): void {
        if (!this.graphFilter) return

        const resetButton = createButton({
            variant: 'secondary',
            text: 'Reset',
            size: 'xs',
            svgIcon: funnelClear,
            title: 'Clear all attribute filters',
            onClick: () => {
                FormFactory.clear(filteringForm)
                const filters: FormValues = {}
                this.filterGraph(filters)
            }
        })

        this.formOptions = this.buildFormFields()
        const filteringForm = FormFactory.createForm({
            fields: this.formOptions
        })
        this.filteringForm = filteringForm

        const filterButton = createButton({
            variant: 'primary',
            text: 'Filter Graph',
            size: 'block',
            svgIcon: funnel,
            onClick: () => {
                const filters: FormValues = FormFactory.getValues(filteringForm)
                this.filterGraph(filters)
            }
        })

        // Attribute-filter section: a labelled header (with the reset action), the
        // generated form, then the primary apply button.
        const attributeSection = createHtmlElement('div', { class: 'pvt-filter-section' })
        const attributeHead = createHtmlElement('div', { class: 'pvt-filter-section-head' }, [
            createHtmlElement('span', { class: 'pvt-filter-section-label' }, ['Attributes']),
            resetButton,
        ])
        attributeSection.appendChild(attributeHead)
        attributeSection.appendChild(filteringForm)
        attributeSection.appendChild(filterButton)

        this.manuallyFilteredContainer = createHtmlTemplate(`<div class="pvt-hidden-nodes-container">
                <div class="pvt-filter-section-head">
                    <span class="pvt-filter-section-label">Hidden nodes</span>
                </div>
                <div class="pvt-hidden-nodes-container-list"></div>
            </div>`) as HTMLDivElement

        const resetHiddenButton = createButton({
            variant: 'secondary',
            text: 'Show all',
            size: 'xs',
            svgIcon: show,
            onClick: () => {
                this.uiManager.graph.queryEngine.clearNodeExclusions()
            },
            title: 'Restore manually hidden nodes',
        })
        this.manuallyFilteredContainer.querySelector('.pvt-filter-section-head')?.appendChild(resetHiddenButton)

        this.graphFilter.appendChild(attributeSection)
        const layerSection = this.buildLayerSection()
        if (layerSection) this.graphFilter.appendChild(layerSection)
        this.graphFilter.appendChild(this.manuallyFilteredContainer)
    }

    /** The declared edge facets — the graph's relation layers. */
    private get edgeFacets(): EdgeFacet[] {
        return this.filterOptions.edgeFacets ?? []
    }

    /**
     * A layer facet is the multiselect kind (the default): a set of relation kinds,
     * each on or off, toggled live. Every other type is a batch control and goes in
     * the attribute form with the node facets.
     */
    private isLayerFacet(facet: EdgeFacet): boolean {
        return (facet.type ?? 'multiselect') === 'multiselect'
    }

    /**
     * The Relationships section: one live toggle per relation kind. Clicking applies
     * at once, like the canvas legend — a layer behind an apply button reads wrong when
     * the legend right beside it toggles instantly.
     */
    private buildLayerSection(): HTMLElement | undefined {
        this.layerRows.clear()
        const facets = this.edgeFacets
            .filter((facet) => this.isLayerFacet(facet))
            .map((facet, index) => ({ facet, order: facet.order ?? index }))
            .sort((a, b) => a.order - b.order)
        if (facets.length === 0) return undefined

        const lists: HTMLElement[] = []
        for (const { facet } of facets) {
            const values = this.uiManager.graph.queryEngine.getEdgeFacetValues(facet.key)
            if (values.length === 0) continue

            // Several layer facets each get their own labelled list; a single one — the
            // common case — needs no sub-heading above the section's own.
            if (facets.length > 1) {
                const label = facet.label ?? FormFactory.niceLabelFromKey(facet.key)
                lists.push(createHtmlElement('span', { class: 'pvt-edge-layer-group' }, [label]))
            }
            const list = createHtmlElement('div', { class: 'pvt-edge-layer-list' })
            for (const entry of values) {
                list.appendChild(this.buildLayerRow(facet, entry))
            }
            lists.push(list)
        }
        if (lists.length === 0) return undefined

        const showAll = createButton({
            variant: 'secondary',
            text: 'Show all',
            size: 'xs',
            svgIcon: show,
            title: 'Show every relationship layer',
            onClick: () => {
                for (const { facet } of facets) {
                    this.uiManager.graph.queryEngine.removeEdgeFilter(facet.key)
                }
            },
        })

        const section = createHtmlElement('div', { class: 'pvt-filter-section pvt-edge-layers' }, [
            createHtmlElement('div', { class: 'pvt-filter-section-head' }, [
                createHtmlElement('span', { class: 'pvt-filter-section-label' }, ['Relationships']),
                showAll,
            ]),
            ...lists,
        ])
        this.syncLayerRows()
        return section
    }

    private buildLayerRow(facet: EdgeFacet, entry: EdgeFacetValue): HTMLElement {
        const { value, count, sample } = entry
        const declared = Array.isArray(facet.options)
            ? facet.options.find((option) => option.value === value)
            : undefined
        const row = createHtmlElement('button', {
            type: 'button',
            class: 'pvt-edge-layer',
            'data-key': facet.key,
            'data-value': value,
        }, [
            createEdgeSwatchFor(this.uiManager.graph, sample),
            // A value is data, so it is shown as it is unless the facet named it.
            createHtmlElement('span', { class: 'pvt-edge-layer-label' }, [declared?.label ?? value]),
            createHtmlElement('span', { class: 'pvt-edge-layer-count' }, [String(count)]),
        ])
        row.addEventListener('click', () => this.toggleLayer(facet, value))
        this.layerRows.set(`${facet.key}|${value}`, row)
        return row
    }

    /**
     * Flip one layer. The filter value is the list of kinds that stay on, so an empty
     * list means every layer of that facet is off and no filter at all means all on.
     */
    private toggleLayer(facet: EdgeFacet, value: string) {
        const engine = this.uiManager.graph.queryEngine
        const all = engine.getEdgeFacetValues(facet.key).map((entry) => entry.value)
        const active = engine.getEdgeFilters()[facet.key]?.value
        const on = new Set(Array.isArray(active) ? active.map(String) : all)

        if (on.has(value)) on.delete(value)
        else on.add(value)

        this.applyingLayers = true
        try {
            if (all.every((candidate) => on.has(candidate))) engine.removeEdgeFilter(facet.key)
            else engine.setEdgeFilter(facet.key, {
                value: all.filter((candidate) => on.has(candidate)),
                matchMode: facet.matchMode ?? 'exact',
            })
        } finally {
            this.applyingLayers = false
        }
        this.syncLayerRows()
    }

    /** Relight the toggle rows from the live filters, so the panel follows the legend. */
    private syncLayerRows() {
        if (this.applyingLayers || this.layerRows.size === 0) return
        const edgeFilters = this.uiManager.graph.queryEngine.getEdgeFilters()

        for (const [id, row] of this.layerRows) {
            const separator = id.lastIndexOf('|')
            const key = id.slice(0, separator)
            const value = id.slice(separator + 1)
            const active = edgeFilters[key]?.value
            const on = active === undefined
                || (Array.isArray(active) ? active.map(String).includes(value) : String(active) === value)

            row.setAttribute('aria-pressed', String(on))
            row.classList.toggle('pvt-edge-layer-hidden', !on)
            row.setAttribute('title', on ? `Hide ${value}` : `Show ${value}`)
        }
    }

    // Reflect the active filters (e.g. set via queryEngine.setFilter from code) back into the
    // form controls; without this the panel only updates on dataBatchChanged and stays empty.
    private syncFormFromActiveFilters(filters: GraphFilters): void {
        if (!this.filteringForm) return
        const values: FormValues = {}
        for (const [key, config] of Object.entries(filters)) {
            if (key === 'manuallyHidden' || config === undefined) continue
            values[key] = config.value
        }
        FormFactory.setValues(this.filteringForm, values)
    }

    private updateUIFilterButtonContent(filters: GraphFilters) {
        const filterButton = this.uiManager.mainHeader?.filterButton
        const filterButtonElement = filterButton?.querySelector('.action-text')
        if (!filterButtonElement) return

        filterButtonElement.innerHTML = ''
        let filterCount = Object.keys(filters).length
        const hidden = filters.manuallyHidden?.value
        if (Array.isArray(hidden) && hidden.length == 0) {
            filterCount--
        }

        // When filters are active the pill turns into a subtle accent-tinted chip
        // (see mainheader.scss `.pvt-filter-on`): accent count + noun, with the
        // hidden-node total as muted subtext — rather than a loud solid badge.
        filterButton?.classList.toggle('pvt-filter-on', filterCount > 0)

        if (filterCount > 0) {
            const hiddenCount = this.uiManager.graph.queryEngine.getHiddenNodeCount()
            const status = createHtmlElement('span', { 'class': 'pvt-filter-status' }, [
                createHtmlElement('span', { 'class': 'pvt-filter-count' }, [`${filterCount}`]),
                createHtmlElement('span', { 'class': 'pvt-filter-word' }, [filterCount > 1 ? 'active filters' : 'active filter']),
            ])
            if (hiddenCount > 0) {
                status.appendChild(createHtmlElement('span', { 'class': 'pvt-filter-hidden' }, [`${hiddenCount} hidden`]))
            }
            filterButtonElement.appendChild(status)
        } else {
            filterButtonElement.textContent = DEFAULT_FILTER_BUTTON_TEXT
        }
    }

    private updateUIFilterHiddenNodes() {
        if (!this.manuallyFilteredContainer) return
        const hiddenNodeContainer = this.manuallyFilteredContainer.querySelector('.pvt-hidden-nodes-container-list')
        if (!hiddenNodeContainer) return

        if (this.uiManager.graph.queryEngine.getExcludedNodeCount() > 0) {
            this.manuallyFilteredContainer.classList.remove('hidden')
            hiddenNodeContainer.innerHTML = ''
            this.uiManager.graph.queryEngine.getExcludedNodes().forEach((node: Node) => {
                const nodePropertyCount = Object.keys(node.getData()).length
                const nodeEdgesCount = node.getEdgesIn().length + node.getEdgesOut().length
                const showNodeButton = createButton({
                    variant: 'secondary',
                    text: 'Show node',
                    size: 'sm',
                    title: 'Restore manually hidden node',
                    svgIcon: show,
                    onClick: () => {
                        this.uiManager.graph.queryEngine.includeNode(node)
                    }
                })

                const propertyTextElement = createHtmlElement('span',
                    {
                        'class': 'subtext'
                    },
                    [
                        createHtmlElement('span', { 'class': 'nodeinfo'}, [nodePropertyCount.toString(), createIcon({svgIcon :nodeProperty})]),
                        '·',
                        createHtmlElement('span', { 'class': 'nodeinfo'}, [nodeEdgesCount.toString(), createIcon({svgIcon: graphEdgeIcon(24)})]),
                    ]
                )

                const nodeName = nodeNameGetter(node, this.uiManager.getOptions().mainHeader)
                const nodeElement = createHtmlElement('div',
                    {
                        'class': 'hidden-node',
                        'role': 'button',
                        'tabindex': '0',
                        'aria-label': `Inspect ${nodeName}`,
                    },
                    [
                        nodeName,
                        propertyTextElement,
                        showNodeButton,
                    ]
                )
                nodeElement
                    .addEventListener('mouseenter', (event: MouseEvent) => {
                        this.uiManager.tooltip?.openForNodeOnElement(event, node)
                    })
                nodeElement
                    .addEventListener('mouseleave', () => {
                        this.uiManager.tooltip?.hide()
                    })
                // Click the row (but not its "Show node" button) to inspect the node.
                const inspect = () => {
                    this.uiManager.tooltip?.hide()
                    createInspectModal(node, this.uiManager)
                }
                nodeElement.addEventListener('click', (event: MouseEvent) => {
                    if ((event.target as HTMLElement).closest('button')) return
                    inspect()
                })
                nodeElement.addEventListener('keydown', (event: KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        inspect()
                    }
                })

                hiddenNodeContainer?.appendChild(nodeElement)
            })
        } else {
            this.manuallyFilteredContainer.classList.add('hidden')
        }
    }

    private get filterOptions(): FilterOptions {
        return this.uiManager.getOptions().filter ?? {}
    }

    /**
     * The panel's form fields: generated from `UI.filter.facets` when the consumer
     * declared them, otherwise derived by scanning node data (the default).
     */
    private buildFormFields(): FieldConfig[] {
        const facets = this.filterOptions.facets
        const nodeFields = facets?.length ? this.declaredFields(facets) : this.derivedFields()
        return [...nodeFields, ...this.batchedEdgeFields()]
    }

    /**
     * Edge facets that aren't layers — a `numberRange` on a weight, a `regex` on a
     * label. They apply with the button like every other batch control, so they sit in
     * this form; only the on/off layers get the live Relationships section.
     */
    private batchedEdgeFields(): FieldConfig[] {
        return this.edgeFacets
            .filter((facet) => !this.isLayerFacet(facet))
            .map((facet, index) => ({ facet, order: facet.order ?? index }))
            .sort((a, b) => a.order - b.order)
            .map(({ facet }) => this.edgeFacetToField(facet))
    }

    /** An edge facet's form field. Its key carries the namespace the engine matches on. */
    private edgeFacetToField(facet: EdgeFacet): FieldConfig {
        const field = this.facetToField({
            ...facet,
            key: EDGE_FILTER_PREFIX + facet.key,
            label: facet.label ?? FormFactory.niceLabelFromKey(facet.key),
            type: facet.type ?? 'multiselect',
        } as FilterFacet)
        if (field.type === 'select' || field.type === 'multiselect') {
            field.options = this.uiManager.graph.queryEngine.getEdgeFacetValues(facet.key)
                .map(({ value }) => ({ label: value, value }))
            field.allowEmpty = true
        }
        return field
    }

    private declaredFields(facets: FilterFacet[]): FieldConfig[] {
        return facets
            .map((facet, index) => ({ facet, order: facet.order ?? index }))
            .sort((a, b) => a.order - b.order)
            .map(({ facet }) => this.facetToField(facet))
    }

    private facetToField(facet: FilterFacet): FieldConfig {
        // A declared label is used verbatim (it may be translated); a key is prettified.
        const label = facet.label ?? FormFactory.niceLabelFromKey(facet.key)
        const matchMode = facet.matchMode ?? 'exact'

        // 'boolean' is a true/false/unset dropdown — a checkbox has no "unset".
        if (facet.type === 'boolean') {
            return {
                key: facet.key,
                label,
                type: 'select',
                matchMode,
                valuesAreBoolean: true,
                allowEmpty: true,
                options: [{ label: 'true', value: 'true' }, { label: 'false', value: 'false' }],
            }
        }

        const field: FieldConfig = { key: facet.key, label, type: facet.type, matchMode }
        if (facet.type === 'select' || facet.type === 'multiselect') {
            field.options = this.resolveFacetOptions(facet)
            field.allowEmpty = true
        }
        return field
    }

    /** Resolve a facet's option list, calling the consumer's function against the live graph. */
    private resolveFacetOptions(facet: FilterFacet): FieldOption[] {
        let options = facet.options ?? []
        if (typeof options === 'function') {
            try {
                options = options(this.uiManager.graph)
            } catch (error) {
                console.warn(`Pivotick: options() for filter facet '${facet.key}' threw; the field will be empty.`, error)
                options = []
            }
        }
        return options.map(({ label, value }) => ({ label, value }))
    }

    /**
     * Zero-config fallback: one field per node-data key, widget inferred from its values.
     *
     * The scan and the inference live in `utils/DataAttributes` because the data dock
     * derives its columns from exactly the same reading — sharing them is what keeps the
     * filter panel's controls and the dock's column types from ever disagreeing.
     */
    private derivedFields(): FieldConfig[] {
        const attributes = collectDataAttributes(
            this.uiManager.graph.getMutableNodes(),
            this.filterOptions.excludeKeys,
        )

        return attributes.map((attribute) => {
            const inferred = inferAttributeType(attribute)
            const field: FieldConfig = {
                key: attribute.key,
                label: FormFactory.niceLabelFromKey(attribute.key),
                type: inferred.type as FieldType,
                matchMode: inferred.matchMode,
                valuesAreBoolean: inferred.valuesAreBoolean,
            }

            if ((field.type === 'select' || field.type === 'multiselect') && inferred.options) {
                field.options = inferred.options.map((value) => ({ label: String(value), value: String(value) }))
                field.allowEmpty = true
            }
            return field
        })
    }

    private filterGraph(filters: FormValues): void {
        if (this.filteringForm) FormFactory.clearFieldErrors(this.filteringForm)
        // An unusable pattern is a form error, not an exception inside apply(): report it
        // and leave whatever was already applied in place.
        if (!this.validatePatternFields(filters)) return

        const activeFilters: FormValues = this.getActiveFilters(filters)
        const graphFilter: GraphFilters = {}
        const formOptionMap = Object.fromEntries(this.formOptions.map(option => [option.key, option]))
        for (const [key, value] of Object.entries(activeFilters)) {
            const fieldCondig: FilterFieldConfig = {
                value: value,
                matchMode: formOptionMap[key]?.matchMode
            }
            if (value !== undefined) {
                graphFilter[key] = fieldCondig
            }
        }

        // Not resetFilters(): a filter key this form doesn't own — a legend section's, a
        // live edge layer's — must survive pressing the button.
        this.uiManager.graph.queryEngine.replaceFilters(
            this.formOptions.map((option) => option.key),
            graphFilter,
        )
    }

    /** Every `regex` field must hold a compilable pattern; marks the ones that don't. */
    private validatePatternFields(filters: FormValues): boolean {
        let valid = true
        for (const option of this.formOptions) {
            if (option.type !== 'regex') continue

            const pattern = filters[option.key]
            if (typeof pattern !== 'string' || pattern.trim() === '') continue
            try {
                new RegExp(pattern)
            } catch {
                valid = false
                if (this.filteringForm) {
                    FormFactory.setFieldError(this.filteringForm, option.key, 'Invalid pattern')
                }
            }
        }
        return valid
    }

    private getActiveFilters(filters: FormValues): FormValues {
        const activeFilters: FormValues = {}

        for (const [key, value] of Object.entries(filters)) {
            if (this.isFilterActive(value)) {
                activeFilters[key] = value
            } else {
                activeFilters[key] = undefined
            }
        }

        return activeFilters
    }

    private isFilterActive(value: FormValue): boolean {
        if (value === undefined) return false

        if (typeof value === 'string') return value.trim() !== ''

        if (typeof value === 'number') return true

        if (typeof value === 'boolean') return true

        if (Array.isArray(value)) return value.length > 0

        if (typeof value === 'object') {
            return value.min !== undefined || value.max !== undefined
        }

        return false
    }


}