import type { MainHeader, PropertiesPanel, PropertyEntry } from '../GraphOptions'
import { tryResolveArray, tryResolveString } from './Getters'
import type { Node } from '../Node'
import type { Edge } from '../Edge'


export function nodeNameGetter(node: Node, mainHeader: MainHeader): string {
    if (mainHeader.nodeHeaderMap.title) {
        return tryResolveString(mainHeader.nodeHeaderMap.title, node) || 'Could not resolve title'
    }
    return node.getData()?.label ?? 'Optional name or label'
}

export function nodeDescriptionGetter(node: Node, mainHeader: MainHeader): string | null {
    if (mainHeader.nodeHeaderMap.subtitle) {
        return tryResolveString(mainHeader.nodeHeaderMap.subtitle, node) || null
    }
    return node.getData()?.description ?? 'Optional subtitle or description'
}

export function edgeNameGetter(edge: Edge, mainHeader: MainHeader): string {
    if (mainHeader.edgeHeaderMap.title) {
        return tryResolveString(mainHeader.edgeHeaderMap.title, edge) || 'Could not resolve title'
    }
    return edge.getData()?.label ?? 'Optional name or label'
}

export function edgeDescriptionGetter(edge: Edge, mainHeader: MainHeader): string | null {
    if (mainHeader.edgeHeaderMap.subtitle) {
        return tryResolveString(mainHeader.edgeHeaderMap.subtitle, edge) || null
    }
    return edge.getData()?.description ?? 'Optional subtitle or description'
}

export function edgeLabelGetter(edge: Edge): string {
    return edge.getData()?.label ?? ''
}

export function nodePropertiesGetter(node: Node, propertiesPanel: PropertiesPanel): Array<PropertyEntry> {
    const data = node.getData()
    const properties: Array<PropertyEntry> = []

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
