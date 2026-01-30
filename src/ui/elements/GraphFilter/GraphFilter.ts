import type { FilterFieldConfig, GraphFilters } from '../../../interfaces/GraphQueryEngine'
import { FormFactory, type FieldConfig, type FieldType, type FormValue, type FormValues } from '../../../utils/FormFactory'
import { createBadge } from '../../components/Badge'
import { createButton } from '../../components/Button'
import { funnel, funnelClear } from '../../icons'
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
            let matchMode = 'exact'
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

        this.graphFilter.appendChild(resetButton)
        this.graphFilter.appendChild(filteringForm)
        this.graphFilter.appendChild(filterButton)
    }

    private updateUIFilterButtonContent(filters: GraphFilters) {
        const filterButton = this.uiManager.toolbar?.filterButton
        const filterButtonElement = filterButton?.querySelector('.action-text')
        if (!filterButtonElement) return

        filterButtonElement.innerHTML = ''
        const filterCount = Object.keys(filters).length
        if (filterCount > 0) {
            const activeFilterText = filterCount > 1 ? `${filterCount} active filters` : '1 active filter'
            const filterBadge = createBadge({
                text: activeFilterText,
                variant: 'primary',
                size: 'sm'
            })
            filterButtonElement.appendChild(filterBadge)
        } else {
            filterButtonElement.textContent = DEFAULT_FILTER_BUTTON_TEXT
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