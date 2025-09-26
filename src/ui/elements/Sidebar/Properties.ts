import { createHtmlElement, createHtmlTemplate } from '../../../utils/ElementCreation'
import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { GraphUI, PropertyEntry } from '../../../GraphOptions'
import { tryResolveArray } from '../../../utils/Getters'
import type { EdgeSelection, NodeSelection } from '../../../GraphInteractions'
import { createInlineBar } from '../../components/InlineBar'

type aggregatedProperties = Map<string, Map<string, number>>

function nodePropertiesGetter(node: Node, options: GraphUI): Array<PropertyEntry> {
    const data = node.getData()
    const properties: Array<PropertyEntry> = []

    if (options.propertiesPanel.nodePropertiesMap) {
        return tryResolveArray<[Node], PropertyEntry>(options.propertiesPanel.nodePropertiesMap, node)
    }

    for (const[key, value] of Object.entries(data)) {
        properties.push({
            name: key,
            value: value,
        })
    }
    return properties
}

function edgePropertiesGetter(edge: Edge, options: GraphUI): Array<PropertyEntry> {
    const data = edge.getData()
    const properties: Array<PropertyEntry> = []

    if (options.propertiesPanel.edgePropertiesMap) {
        return tryResolveArray<[Edge], PropertyEntry>(options.propertiesPanel.edgePropertiesMap, edge)
    }

    for (const [key, value] of Object.entries(data)) {
        properties.push({
            name: key,
            value: value,
        })
    }
    return properties
}

function injectRowForProperties(dl: HTMLDListElement, properties: Array<PropertyEntry>): void {
    for (const property of properties) {
        const row = createHtmlElement('dl',
            {
                'class': 'pivotick-property-row',
            },
            [
                createHtmlElement('dt', { class: 'pivotick-property-name' }, [property.name]),
                createHtmlElement('dd', { class: 'pivotick-property-value' }, [
                    typeof property.value === 'string' ? property.value : JSON.stringify(property.value)
                ]),
            ]
        )
        dl.append(row)
    }
}

function injectTableForAggregatedProperties(div: HTMLDivElement, aggregatedProperties: aggregatedProperties, selectedNodeCount: number): void {
    const sortedAggregatedProperties = sortAggregatedProperties(aggregatedProperties)

    for (const [propName, valueCountMap] of sortedAggregatedProperties) {
        const section = createHtmlElement('div', {
            'class': 'pivotick-aggregated-property-section'
        })
        const sectionTitle = createHtmlElement('span', {
            'class': 'pivotick-aggregated-property-title'
        }, [`.${propName}`])
        const container = createHtmlElement('div', {
            class: 'pivotick-aggregated-property-container',
        })

        let i = 0
        for (const [value, count] of valueCountMap) {
            if (i >= 10) {
                const row = createHtmlElement('div',
                    {},
                    [
                        createHtmlElement('div', {
                            style: 'text-align: center; font-weight: 300; font-size: 0.9rem; color: var(--pivotick-text-color-softer);'
                        }, [
                            `... ${valueCountMap.size - i} more`
                        ]),
                    ]
                )
                container.append(row)
                break
            }
            const row = createHtmlElement('div',
                {
                    class: 'pivotick-aggregated-property-row',
                },
                [
                    createHtmlElement('span', { class: 'pivotick-aggregated-property-value' }, [
                        typeof value === 'string' ? value : JSON.stringify(value)
                    ]),
                    createHtmlElement('span', { class: 'pivotick-aggregated-property-count' }, [
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

export function injectNodeProperties(mainBodyPanel: HTMLDivElement | undefined, node: Node, element: any, options: GraphUI): void {
    if (!mainBodyPanel) return

    const template = `<div class="pivotick-properties-container">
    <div class="enter-ready">
        <dl></dl>
    </div>
</div>`
    const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
    const dl = propertiesContainer.querySelector('dl')

    if (dl) {
        const properties = nodePropertiesGetter(node, options)
        injectRowForProperties(dl, properties)
    }

    mainBodyPanel.innerHTML = propertiesContainer.outerHTML
    requestAnimationFrame(() => {
        mainBodyPanel?.firstElementChild?.firstElementChild?.classList.add('enter-active')
    })
}

export function injectEdgeProperties(mainBodyPanel: HTMLDivElement | undefined, edge: Edge, element: any, options: GraphUI): void {
    if (!mainBodyPanel) return

    const template = `<div class="pivotick-properties-container">
    <div class="enter-ready">
        <dl></dl>
    </div>
</div>`
    const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
    const dl = propertiesContainer.querySelector('dl')

    if (dl) {
        const properties = edgePropertiesGetter(edge, options)
        injectRowForProperties(dl, properties)
    }

    mainBodyPanel.innerHTML = propertiesContainer.outerHTML
    requestAnimationFrame(() => {
        mainBodyPanel?.firstElementChild?.firstElementChild?.classList.add('enter-active')
    })
}


export function clearProperties(mainBodyPanel: HTMLDivElement | undefined): void {
    if (!mainBodyPanel) return
    mainBodyPanel.innerHTML = ''
}

export function injectNodesProperties(mainBodyPanel: HTMLDivElement | undefined, nodes: NodeSelection, options: GraphUI, nodeCount: number): void {
    if (!mainBodyPanel) return

    const template = `<div class="pivotick-properties-container">
    <div class="enter-ready">
        <div class="pivotick-aggregated-properties"></div>
    </div>
</div>`
    const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
    const div = propertiesContainer.querySelector('div.pivotick-aggregated-properties') as HTMLDivElement

    if (div) {
        const allProperties: Array<PropertyEntry>[] = []
        nodes.forEach(selecteNode => {
            const { node } = selecteNode
            const properties = nodePropertiesGetter(node, options)
            allProperties.push(properties)
        })
        const aggregatedProperties = aggregateProperties(allProperties)
        injectTableForAggregatedProperties(div, aggregatedProperties, nodes.length)
    }

    mainBodyPanel.innerHTML = propertiesContainer.outerHTML
    requestAnimationFrame(() => {
        mainBodyPanel?.firstElementChild?.firstElementChild?.classList.add('enter-active')
    })
}

export function injectEdgesProperties(mainBodyPanel: HTMLDivElement | undefined, edges: EdgeSelection, options: GraphUI): void {
    if (!mainBodyPanel) return

    const template = `<div class="pivotick-properties-container">
    <div class="enter-ready">
        <dl></dl>
    </div>
</div>`
    const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
    const dl = propertiesContainer.querySelector('dl')

    if (dl) {
        const properties = nodePropertiesGetter(node, options)
        injectRowForProperties(dl, properties)
    }

    mainBodyPanel.innerHTML = propertiesContainer.outerHTML
    requestAnimationFrame(() => {
        mainBodyPanel?.firstElementChild?.firstElementChild?.classList.add('enter-active')
    })
}

function aggregateProperties(allProperties: Array<PropertyEntry>[]): aggregatedProperties {
    const aggregatedProperties: aggregatedProperties = new Map()

    allProperties.forEach(properties => {
        properties.forEach(prop => {
            if (!aggregatedProperties.has(prop.name)) {
                aggregatedProperties.set(prop.name, new Map())
            }
            const valueCountMap = aggregatedProperties.get(prop.name)
            const currentCount = valueCountMap!.get(prop.value) || 0
            valueCountMap!.set(prop.value, currentCount + 1)
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
export function sortAggregatedProperties(
    aggregated: aggregatedProperties
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

    return new Map(sortedOuterEntries)
}