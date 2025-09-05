import { createHtmlElement, createHtmlTemplate } from '../../../utils/ElementCreation'
import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { GraphUI, PropertyEntry } from '../../../GraphOptions'
import { tryResolveArray } from '../../../utils/Getters'


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