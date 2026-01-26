import type { GraphDataChange } from '../../../interfaces/GraphInteractions'
import { FormFactory, type FieldConfig, type FieldType } from '../../../utils/FormFactory'
import type { UIElement, UIManager } from '../../UIManager'
import './graphFilter.scss'


interface AttributeFilter {
    values?: string[];               // values for categorical attributes
    range?: [number, number];        // range for numeric attributes
}

export interface GraphFilterOptions {
}


export class GraphFilter implements UIElement {
    public uiManager: UIManager
    private options: GraphFilterOptions

    public graphFilter?: HTMLDivElement

    constructor(uiManager: UIManager, options: GraphFilterOptions = {}) {
        this.uiManager = uiManager
        this.options = options
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

        this.uiManager.graph.on('dataBatchChanged', () => {
            this.rebuild()
        })
        return this.graphFilter
    }

    private rebuild(): void {
        if (!this.graphFilter) return

        const attributeFilters = this.getAvailableNodeAttributes()
        const formOptions: FieldConfig[] = Object.entries(attributeFilters).map(([key, filter]) => {
            let filterType: FieldType = 'text'
            if (!filter.values) {
                filterType = 'numberRange'
            } else if (filter.values && filter.values.every((v) => v.length < 64)) {
                if (filter.values.length > 2) {
                    filterType = 'multiselect'
                } else {
                    filterType = 'select'
                }
            } else if (filter.values.every((v) => typeof v === 'boolean')) {
                filterType = 'select'
                filter.values = ['true', 'false']
            }
            
            const option: FieldConfig = {
                key,
                label: key,
                type: filterType
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
            fields: formOptions
        })
        this.graphFilter.appendChild(filteringForm)
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

}