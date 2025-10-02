import type { MainHeader, PropertiesPanel, PropertyEntry } from '../GraphOptions'
import { tryResolveArray, tryResolveString } from './Getters'
import type { Node } from '../Node'
import type { Edge } from '../Edge'

export function nodeNameGetter(node: Node, mainHeader: MainHeader): string {
    if (mainHeader.nodeHeaderMap.title) {
        return tryResolveString(mainHeader.nodeHeaderMap.title, node) || 'Could not resolve title'
    }
    return node.getData().label ?? 'Optional name or label'
}

export function nodeDescriptionGetter(node: Node, mainHeader: MainHeader): string {
    if (mainHeader.nodeHeaderMap.subtitle) {
        return tryResolveString(mainHeader.nodeHeaderMap.subtitle, node) || 'Could not resolve subtitle'
    }
    return node.getData().description ?? 'Optional subtitle or description'
}

export function edgeNameGetter(edge: Edge, mainHeader: MainHeader): string {
    if (mainHeader.edgeHeaderMap.title) {
        return tryResolveString(mainHeader.nodeHeaderMap.title, edge) || 'Could not resolve title'
    }
    return edge.getData().label ?? 'Optional name or label'
}

export function edgeDescriptionGetter(edge: Edge, mainHeader: MainHeader): string {
    if (mainHeader.edgeHeaderMap.subtitle) {
        return tryResolveString(mainHeader.nodeHeaderMap.subtitle, edge) || 'Could not resolve subtitle'
    }
    return edge.getData().description ?? 'Optional subtitle or description'
}

export function edgeLabelGetter(edge: Edge): string {
    return edge.getData().label || ''
}

export function nodePropertiesGetter(node: Node, propertiesPanel: PropertiesPanel): Array<PropertyEntry> {
    const data = node.getData()
    const properties: Array<PropertyEntry> = []

    if (propertiesPanel.nodePropertiesMap) {
        return tryResolveArray<[Node], PropertyEntry>(propertiesPanel.nodePropertiesMap, node)
    }

    for (const [key, value] of Object.entries(data)) {
        properties.push({
            name: key,
            value: value,
        })
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
        properties.push({
            name: key,
            value: value,
        })
    }
    return properties
}