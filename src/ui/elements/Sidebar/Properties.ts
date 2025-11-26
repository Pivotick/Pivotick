import { createHtmlDL, createHtmlElement, createHtmlTemplate, createIcon } from '../../../utils/ElementCreation'
import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import { createInlineBar } from '../../components/InlineBar'
import type { UIElement, UIManager } from '../../UIManager'
import './properties.scss'
import { edgePropertiesGetter, nodePropertiesGetter } from '../../../utils/GraphGetters'
import { filterAdd, filterRemove } from '../../icons'
import type { PropertyEntry } from '../../../interfaces/GraphUI'
import type { EdgeSelection, NodeSelection } from '../../../interfaces/GraphInteractions'
import { tryResolveHTMLElement } from '../../../utils/Getters'


type aggregatedProperties = Map<string, Map<string, number>>
const UNIQUE_KEY = '4dfd89de5d25fc9cc4b66c23d84b443af631c7dc' // Value to cheat to aggregate unique properties
const MERGE_UNIQUE_THRESHOLD = 6

export class SidebarProperties implements UIElement {
    private uiManager: UIManager

    private panel?: HTMLDivElement
    private header?: HTMLDivElement
    private body?: HTMLDivElement

    private renderCb?: ((element: Node | Edge | Node[] | Edge[] | null) => HTMLElement | string) | HTMLElement | string

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.renderCb = typeof this.uiManager.getOptions().propertiesPanel.render === 'function' ? this.uiManager.getOptions().propertiesPanel.render : undefined
    }

    public mount(rootContainer: HTMLElement | undefined) {
        if (!rootContainer) return

        const template = `
<div class="enter-ready">
    <div class="pvt-properties-header-panel pvt-sidebar-header-panel"></div>
    <div class="pvt-properties-body-panel pvt-sidebar-body-panel"></div>
</div>`
        this.panel = createHtmlTemplate(template) as HTMLDivElement
        this.header = this.panel.querySelector('.pvt-properties-header-panel') as HTMLDivElement
        this.body = this.panel.querySelector('.pvt-properties-body-panel') as HTMLDivElement

        rootContainer.appendChild(this.panel)
    }

    public destroy() {
        this.panel?.remove()
        this.panel = undefined
    }

    public afterMount() {
        this.clearProperties()
    }

    public clearProperties(): void {
        if (!this.body) return

        if (this.renderCb) {
            this.renderCustomContent(null)
            return
        }

        this.body.innerHTML = ''
        this.hidePanel()
    }

    public graphReady(): void { }

    private renderCustomContent(element: Node | Edge | Node[] | Edge[] | null) {
        if (!this.body || !this.renderCb) return

        this.body.innerHTML = ''
        const content = tryResolveHTMLElement(this.renderCb, element)
        if (content) {
            this.body?.appendChild(content)
        }
    }

    private setHeaderBasicNode() {
        this.header!.textContent = 'Basic Node Properties'
    }

    private setHeaderBasicEdge() {
        this.header!.textContent = 'Basic Edge Properties'
    }

    private setHeaderMultiSelectNode() {
        this.header!.textContent = 'Aggregated Node Properties'
    }

    private setHeaderMultiSelectEdge() {
        this.header!.textContent = 'Aggregated Edge Properties'
    }

    private showPanel() {
        this.panel!.classList.add('enter-active')
    }

    private hidePanel() {
        this.panel!.classList.remove('enter-active')
    }

    /* Single selection */
    public updateNodeProperties(node: Node): void {
        if (!this.body) return

        this.setHeaderBasicNode()
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(node)
            return
        }

        const template = `
<div class="pvt-properties-container">
    <div class="dl-container">
    </div>
</div>`
        const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
        const dlContainer = propertiesContainer.querySelector('.dl-container')

        if (dlContainer) {
            const properties = nodePropertiesGetter(node, this.uiManager.getOptions().propertiesPanel)
            dlContainer.append(createHtmlDL(properties, node))
        }

        this.body.innerHTML = ''
        this.body.appendChild(propertiesContainer)
    }

    public updateEdgeProperties(edge: Edge): void {
        if (!this.body) return
        this.setHeaderBasicEdge()
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(edge)
            return
        }

        const template = `
<div class="pvt-properties-container">
    <div class="dl-container">
    </div>
</div>`
        const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
        const dlContainer = propertiesContainer.querySelector('.dl-container')

        if (dlContainer) {
            const properties = edgePropertiesGetter(edge, this.uiManager.getOptions().propertiesPanel)
            dlContainer.append(createHtmlDL(properties, edge))
        }

        this.body.innerHTML = ''
        this.body.appendChild(propertiesContainer)
    }


    /* Multiple selection */
    public updateNodesProperties(nodes: NodeSelection<unknown>[]): void {
        if (!this.body) return
        this.setHeaderMultiSelectNode()
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(nodes.map((nodeS: NodeSelection<unknown>) => nodeS.node))
            return
        }

        const template = `
<div class="pvt-properties-container">
    <div class="">
        <div class="pvt-aggregated-properties"></div>
    </div>
</div>`
        const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
        const div = propertiesContainer.querySelector('div.pvt-aggregated-properties') as HTMLDivElement

        if (div) {
            const allProperties: PropertyEntry[][] = []
            nodes.forEach((selectedNode) => {
                const { node } = selectedNode
                const properties = nodePropertiesGetter(node, this.uiManager.getOptions().propertiesPanel)
                allProperties.push(properties)
            })
            const aggregatedProperties = this.aggregateProperties(allProperties)
            this.injectTableForAggregatedProperties(div, aggregatedProperties, nodes.length)
        }

        this.body.innerHTML = ''
        this.body.appendChild(propertiesContainer)
    }

    public updateEdgesProperties(edges: EdgeSelection<unknown>[]): void {
        if (!this.body) return
        this.setHeaderMultiSelectEdge()
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(edges.map((nodeS: EdgeSelection<unknown>) => nodeS.edge))
            return
        }

        const template = `
<div class="pvt-properties-container">
    <div class="">
        <div class="pvt-aggregated-properties"></div>
    </div>
</div>`
        const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
        const div = propertiesContainer.querySelector('div.pvt-aggregated-properties') as HTMLDivElement

        if (div) {
            const allProperties: PropertyEntry[][] = []
            edges.forEach((selectedEdge) => {
                const { edge } = selectedEdge
                const properties = edgePropertiesGetter(edge, this.uiManager.getOptions().propertiesPanel)
                allProperties.push(properties)
            })
            const aggregatedProperties = this.aggregateProperties(allProperties)
            this.injectTableForAggregatedProperties(div, aggregatedProperties, edges.length)
        }

        this.body.innerHTML = ''
        this.body.appendChild(propertiesContainer)
    }

    private injectTableForAggregatedProperties(div: HTMLDivElement, aggregatedProperties: aggregatedProperties, selectedNodeCount: number): void {
        const sortedAggregatedProperties = this.sortAggregatedProperties(aggregatedProperties)

        for (const [propName, valueCountMap] of sortedAggregatedProperties) {
            const section = createHtmlElement('div', {
                class: 'pvt-aggregated-property-section'
            })
            const sectionTitle = createHtmlElement('span', {
                class: 'pvt-aggregated-property-title'
            }, [`.${propName}`])
            const container = createHtmlElement('div', {
                class: 'pvt-aggregated-property-container',
            })

            let i = 0
            for (const [value, count] of valueCountMap) {
                if (i >= 10) {
                    const row = createHtmlElement('div',
                        {},
                        [
                            createHtmlElement('div', {
                                style: 'text-align: center; font-weight: 300; font-size: 0.9rem; color: var(--pvt-text-color-5);'
                            }, [
                                `... ${valueCountMap.size - i} more`
                            ]),
                        ]
                    )
                    container.append(row)
                    break
                }
                const actionButtons = !this.hasSpecialHighlighting(value) ? this.genActionButtons(propName, value) : ''
                const row = createHtmlElement('div',
                    {
                        class: 'pvt-aggregated-property-row',
                    },
                    [
                        createHtmlElement('span', {
                            class: [
                                'pvt-aggregated-property-value',
                                !this.hasSpecialHighlighting(value) ? 'code-container' : '',
                            ]
                        }, [
                            createHtmlElement('span', {}, [
                                this.wrapValues(this.getDislayableValue(value)),
                                actionButtons
                            ])
                        ]),
                        createHtmlElement('span', { class: 'pvt-aggregated-property-count' }, [
                            createInlineBar(count, selectedNodeCount)
                        ]),
                    ]
                )
                container.append(row)
                i++
            }

            section.appendChild(sectionTitle)
            section.appendChild(container)
            div.appendChild(section)
        }
    }

    private getDislayableValue(value: string): string {
        return typeof value === 'string' ? value : JSON.stringify(value)
    }

    private wrapValues(value: string): HTMLElement | Text {
        if (this.hasSpecialHighlighting(value)) {
            let textNode = '', title = ''
            if (this.isValueEmpty(value)) {
                textNode = '- empty -'
                title = 'The value is empty'
            } else if (this.isValueUnique(value)) {
                textNode = '- Unique values -'
                title = 'All other values are unique'
            }
            return createHtmlElement('span', { class: 'pvt-aggregated-property-value-dim', title: title }, [
                textNode
            ])
        }
        return document.createTextNode(value)
    }

    private isValueEmpty(value: string): boolean {
        return value.length === 0
    }

    private isValueUnique(value: string): boolean {
        return value === UNIQUE_KEY
    }

    private hasSpecialHighlighting(value: string): boolean {
        return this.isValueEmpty(value) || this.isValueUnique(value)
    }

    private genActionButtons(key: string, value: string): HTMLDivElement {
        const buttonKeep = createHtmlElement('button', {
            title: 'Select Similar',
        }, [createIcon({ svgIcon: filterAdd }) ])
        buttonKeep.addEventListener('click', () => {
            const matchingNodes = this.uiManager.graph.renderer.getGraphInteraction().getSelectedNodes()
                .filter((nodeSelection: NodeSelection<unknown>) => {
                    const node = nodeSelection.node
                    return node.getData()[key] != value
                })
            this.uiManager.graph.renderer.getGraphInteraction().removeNodesFromSelection(matchingNodes)
        })
        
        const buttonExclude = createHtmlElement('button', {
            title: 'Exclude Similar',
        }, [createIcon({ svgIcon: filterRemove }) ])
        buttonExclude.addEventListener('click', () => {
            const matchingNodes = this.uiManager.graph.renderer.getGraphInteraction().getSelectedNodes()
                .filter((nodeSelection: NodeSelection<unknown>) => {
                    const node = nodeSelection.node
                    return node.getData()[key] == value
                })
            this.uiManager.graph.renderer.getGraphInteraction().removeNodesFromSelection(matchingNodes)
        })

        const container = createHtmlElement('div', { class: 'pvt-aggregated-property-actions' }, [
            buttonKeep,
            buttonExclude
        ])
        return container
    }


    /**
     * Aggregates a collection of property entries into a nested map structure.
     *
     * For each property name, this function counts the occurrences of each
     * property value across all provided entries. The result is a map where:
     *
     * - Keys are property names (e.g. "label", "type").
     * - Values are maps of property values to their occurrence counts.
     *
     * Example:
     * ```ts
     * [
     *   [ { name: "type", value: "node" }, { name: "label", value: "Node 1" } ],
     *   [ { name: "type", value: "node" }, { name: "label", value: "Node 2" } ],
     *   [ { name: "type", value: "node" }, { name: "label", value: "Node 1" } ]
     * ]
     *
     * => Map {
     *   "type"  => Map { "node" => 3 },
     *   "label" => Map { "Node 1" => 2, "Node 2" => 1 }
     * }
     * ```
     *
     * @param allProperties Array of property entry arrays, where each inner array
     * represents the properties of a node.
     * @returns A nested map of property name → (property value → count).
     */
    private aggregateProperties(allProperties: Array<PropertyEntry>[]): aggregatedProperties {
        const aggregatedProperties: aggregatedProperties = new Map()

        allProperties.forEach(properties => {
            properties.forEach(prop => {
                if (
                    (typeof prop.name === 'string' || typeof prop.name === 'number' || typeof prop.name === 'boolean') &&
                    (typeof prop.value === 'string' || typeof prop.value === 'number' || typeof prop.value === 'boolean')
                ) {
                    if (!aggregatedProperties.has(prop.name)) {
                        aggregatedProperties.set(prop.name, new Map())
                    }
                    const valueCountMap = aggregatedProperties.get(prop.name)
                    const currentCount = valueCountMap!.get(prop.value) || 0
                    valueCountMap!.set(prop.value, currentCount + 1)
                }
            })
        })

        return aggregatedProperties
    }

    /**
     * Sorts an aggregated properties map.
     * 
     * 1. Inner maps (value -> count) are sorted by count (descending).
     * 2. Outer map (property -> Map) is sorted by inner map size (ascending).
     *
     * @param aggregated Map of property -> Map of value -> count
     * @returns A new Map with the same structure but sorted.
     */
    private sortAggregatedProperties(
        aggregated: aggregatedProperties,
        mergeUniqueProperties: boolean = true
    ): aggregatedProperties {
        // Step 1: sort each inner map by count (descending)
        const sortedInnerMaps = new Map<string, Map<string, number>>()
        for (const [prop, valuesMap] of aggregated.entries()) {
            const sortedEntries = Array.from(valuesMap.entries()).sort(
                (a, b) => b[1] - a[1] // high count first
            )
            sortedInnerMaps.set(prop, new Map(sortedEntries))
        }

        // Step 2: sort outer map by inner map size (ascending)
        const sortedOuterEntries = Array.from(sortedInnerMaps.entries()).sort(
            (a, b) => a[1].size - b[1].size
        )

        const sortedMap = new Map(sortedOuterEntries)
        if (!mergeUniqueProperties) {
            return sortedMap
        }

        const mergedAggregatedProperties: aggregatedProperties = new Map()
        for (const [name, innerMap] of sortedMap) {
            for (const [value, count] of innerMap) {
                if (!mergedAggregatedProperties.has(name)) {
                    mergedAggregatedProperties.set(name, new Map())
                }
                const valueCountMap = mergedAggregatedProperties.get(name)
                if (innerMap.size > MERGE_UNIQUE_THRESHOLD && count === 1) {
                    const currentCount = valueCountMap!.get(UNIQUE_KEY) || 0
                    valueCountMap!.set(UNIQUE_KEY, currentCount + 1)
                } else {
                    valueCountMap!.set(value, count)
                }
            }
        }
        return mergedAggregatedProperties
    }

}
