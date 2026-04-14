import { tryResolveArray, tryResolveString } from './Getters'
import type { Node } from '../Node'
import type { Edge } from '../Edge'
import type { MainHeader, PropertiesPanel, PropertyEntry } from '../interfaces/GraphUI'


export function nodeNameGetter(node: Node, mainHeader: MainHeader): string {
    if (mainHeader.nodeHeaderMap.title) {
        return tryResolveString(mainHeader.nodeHeaderMap.title, node) || 'Could not resolve title'
    }
    const text = node.getData()?.label
    return typeof text === 'string' ? text : 'Optional name or label'
}

export function nodeDescriptionGetter(node: Node, mainHeader: MainHeader): string | null {
    if (mainHeader.nodeHeaderMap.subtitle) {
        return tryResolveString(mainHeader.nodeHeaderMap.subtitle, node) || null
    }
    const text = node.getData()?.description
    return typeof text === 'string' ? text : 'Optional subtitle or description'
}

export function edgeNameGetter(edge: Edge, mainHeader: MainHeader): string {
    if (mainHeader.edgeHeaderMap.title) {
        return tryResolveString(mainHeader.edgeHeaderMap.title, edge) || ''
    }
    const text = edge.getData()?.label
    return typeof text === 'string' ? text : 'Optional name or label'
}

export function edgeDescriptionGetter(edge: Edge, mainHeader: MainHeader): string | null {
    if (mainHeader.edgeHeaderMap.subtitle) {
        return tryResolveString(mainHeader.edgeHeaderMap.subtitle, edge) || null
    }
    const text = edge.getData()?.label
    return typeof text === 'string' ? text : 'Optional subtitle or description'
}

export function edgeLabelGetter(edge: Edge): string {
    const text = edge.getData()?.label
    return typeof text === 'string' ? text : ''
}

export function nodePropertiesGetter(node: Node, propertiesPanel: PropertiesPanel): Array<PropertyEntry> {
    const data = node.getData()
    const properties: PropertyEntry[] = []

    if (propertiesPanel.nodePropertiesMap) {
        return tryResolveArray<[Node], PropertyEntry>(propertiesPanel.nodePropertiesMap, node)
    }

    for (const [key, value] of Object.entries(data)) {
        if (key && value) {
            properties.push({
                name: key,
                value: value,
            } as PropertyEntry)
        }
    }
    return properties
}

export function edgePropertiesGetter(edge: Edge, propertiesPanel: PropertiesPanel): Array<PropertyEntry> {
    const data = edge.getData()
    const properties: Array<PropertyEntry> = []

    if (propertiesPanel.edgePropertiesMap) {
        return tryResolveArray<[Edge], PropertyEntry>(propertiesPanel.edgePropertiesMap, edge)
    }

    for (const [key, value] of Object.entries(data)) {
        if (key && value) {
            properties.push({
                name: key,
                value: value,
            } as PropertyEntry)
        }
    }
    return properties
}
