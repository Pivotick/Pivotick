import type { FilterFieldConfig, FilterMatchMode, GraphFilters } from '../../../interfaces/GraphQueryEngine'
import { createHtmlElement, createHtmlTemplate, createIcon } from '../../../utils/ElementCreation'
import { Node } from '../../../Node'
import { FormFactory, type FieldConfig, type FieldType, type FormValue, type FormValues } from '../../../utils/FormFactory'
import { nodeNameGetter } from '../../../utils/GraphGetters'
import { createBadge } from '../../components/Badge'
import { createButton } from '../../components/Button'
import { funnel, funnelClear, graphEdgeIcon, nodeProperty, show } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './graphFilter.scss'


interface AttributeFilter {
    values?: string[];               // values for categorical attributes
    range?: [number, number];        // range for numeric attributes
}

const DEFAULT_FILTER_BUTTON_TEXT = 'Filter Graph'


export class GraphFilter implements UIElement {
    public uiManager: UIManager

    public graphFilter?: HTMLDivElement
    private formOptions: FieldConfig[]
    private manuallyFilteredContainer?: HTMLDivElement

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.formOptions = []
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return

        this.build()
        if (this.graphFilter) {
            container.appendChild(this.graphFilter)
        }
    }

    destroy() {
        this.graphFilter?.remove()
        this.graphFilter = undefined
    }

    afterMount() {
    }

    graphReady(): void { }

    build(): HTMLDivElement {
        this.graphFilter = document.createElement('div')
        this.graphFilter.classList.add('pvt-graph-filter-container')

        this.uiManager.graph.on('dataBatchChanged', () => {
            this.rebuild()
        })

        this.uiManager.graph.queryEngine.on('filterChange', (filters: GraphFilters) => {
            this.updateUIFilterButtonContent(filters)
            this.updateUIFilterHiddenNodes()
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
            size: 'sm',
            style: 'align-self: end;',
            svgIcon: funnelClear,
            onClick: () => {
                FormFactory.clear(filteringForm)
                const filters: FormValues = {}
                this.filterGraph(filters)
            }
        })

        const attributeFilters = this.getAvailableNodeAttributes()
        this.formOptions = Object.entries(attributeFilters).map(([key, filter]) => {
            let filterType: FieldType = 'text'
            let matchMode: FilterMatchMode = 'exact'
            let valuesAreBoolean = false
            if (!filter.values) {
                filterType = 'numberRange'
            } else if (filter.values && filter.values.every((v) => v.length < 64)) {
                if (filter.values.length > 2) {
                    filterType = 'multiselect'
                    matchMode = 'partial'
                } else {
                    filterType = 'select'
                }
            } else if (filter.values.every((v) => typeof v === 'boolean')) {
                filterType = 'select'
                filter.values = ['true', 'false']
                valuesAreBoolean = true
            }
            
            const option: FieldConfig = {
                key,
                label: key,
                type: filterType,
                matchMode: matchMode,
                valuesAreBoolean: valuesAreBoolean,
            }

            if ((option.type == 'select' || option.type == 'multiselect') && filter.values) {
                option.options = filter.values.map((v) => {
                    return {
                        label: v,
                        value: v
                    }
                })
                option.allowEmpty = true
            }
            return option
        })
        const filteringForm = FormFactory.createForm({
            fields: this.formOptions
        })

        const filterButton = createButton({
            variant: 'primary',
            text: 'Filter Graph',
            size: 'block',
            style: 'margin-top: 16px;',
            svgIcon: funnel,
            onClick: () => {
                const filters: FormValues = FormFactory.getValues(filteringForm)
                this.filterGraph(filters)
            }
        })

        const separator = createHtmlElement('div', { class: 'pvt-sidebar-separator' })

        this.manuallyFilteredContainer = createHtmlTemplate(`<div class="pvt-hidden-nodes-container">
                <h4>Hidden nodes</h4>
                <div class="pvt-hidden-nodes-container-list"></div>
            </div>`) as HTMLDivElement

        const resetHiddenButton = createButton({
            variant: 'secondary',
            text: 'Show all nodes',
            size: 'sm',
            style: 'align-self: end;',
            svgIcon: show,
            onClick: () => {
                this.uiManager.graph.queryEngine.clearNodeExclusions()
            },
            title: 'Restore manually hidden nodes',
        })
        this.manuallyFilteredContainer.querySelector('h4')?.appendChild(resetHiddenButton)

        this.graphFilter.appendChild(resetButton)
        this.graphFilter.appendChild(filteringForm)
        this.graphFilter.appendChild(filterButton)
        this.graphFilter.appendChild(separator)
        this.graphFilter.appendChild(this.manuallyFilteredContainer)
    }

    private updateUIFilterButtonContent(filters: GraphFilters) {
        const filterButton = this.uiManager.toolbar?.filterButton
        const filterButtonElement = filterButton?.querySelector('.action-text')
        if (!filterButtonElement) return

        filterButtonElement.innerHTML = ''
        let filterCount = Object.keys(filters).length
        const hidden = filters.manuallyHidden?.value
        if (Array.isArray(hidden) && hidden.length == 0) {
            filterCount--
        }

        if (filterCount > 0) {
            const activeFilterText = filterCount > 1 ? `${filterCount} active filters` : '1 active filter'
            const hiddenCount = this.uiManager.graph.queryEngine.getHiddenNodeCount()
            const hiddenNodeHtml = createHtmlElement('span',
                {
                    'class': 'active-filter-subtext',
                },
                [
                    createHtmlElement('span', {}, ['·']),
                    createHtmlElement('span', {}, [`${hiddenCount} hidden`]),
                ]
            )
            const filterBadge = createBadge({
                text: activeFilterText,
                html: hiddenNodeHtml,
                variant: 'primary',
                size: 'sm'
            })
            filterButtonElement.appendChild(filterBadge)
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

                const nodeElement = createHtmlElement('div',
                    {
                        'class': 'hidden-node'
                    },
                    [
                        nodeNameGetter(node, this.uiManager.getOptions().mainHeader),
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

                hiddenNodeContainer?.appendChild(nodeElement)
            })
        } else {
            this.manuallyFilteredContainer.classList.add('hidden')
        }
    }

    private getAvailableNodeAttributes(): Record<string, AttributeFilter> {
        const attributeMap = new Map()
        const nodes = this.uiManager.graph.getMutableNodes()

        nodes.forEach(node => {
            Object.entries(node.getData()).forEach(([key, value]) => {
                let attributeFilter = attributeMap.get(key)
                
                if (!attributeFilter) {
                    attributeFilter = {
                        numbers: new Set(),
                        values: new Set(),
                    }
                }
                if (Number.isInteger(value)) {
                    attributeFilter.range.add(value)
                } else {
                    attributeFilter.values.add(value)
                }
                attributeMap.set(key, attributeFilter)
            })
        })

        const attributeFilters = new Map<string, AttributeFilter>()
        attributeMap.forEach((filter, key) => {
            const attributeFilter: AttributeFilter = {}
            if (filter.values) {
                attributeFilter['values'] = [...new Set([...filter.values, ...filter.numbers])]
            } else if (filter.number) {
                attributeFilter['range'] = [Math.min(...filter.numbers), Math.max(...filter.numbers)]
            }
            attributeFilters.set(key, attributeFilter)
        })
        return Object.fromEntries(attributeFilters)
    }

    private filterGraph(filters: FormValues): void {
        const activeFilters: FormValues = this.getActiveFilters(filters)
        const graphFilter: GraphFilters = {}
        const formOptionMap = Object.fromEntries(this.formOptions.map(option => [option.key, option]))
        for (const [key, value] of Object.entries(activeFilters)) {
            const fieldCondig: FilterFieldConfig = {
                value: value,
                matchMode: formOptionMap[key].matchMode
            }
            if (value !== undefined) {
                graphFilter[key] = fieldCondig
            }
        }

        this.uiManager.graph.queryEngine.resetFilters()
        this.uiManager.graph.queryEngine.setFilters(graphFilter)
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