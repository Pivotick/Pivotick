import { isThenable, tryResolveString } from './Getters'
import { DETACHED_RENDER_CONTEXT } from './AsyncRender'
import type { Node } from '../Node'
import type { Edge } from '../Edge'
import type { MainHeader, PropertiesPanel, PropertyEntry } from '../interfaces/GraphUI'
import type { RenderContext } from '../interfaces/AsyncContent'


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

/**
 * A properties map may hand back the entries or a promise of them (and, being
 * consumer code, occasionally neither). Normalise both shapes, keeping the
 * synchronous one synchronous.
 */
function asPropertyEntries(
    resolved: PropertyEntry[] | Promise<PropertyEntry[]>,
): PropertyEntry[] | Promise<PropertyEntry[]> {
    if (isThenable(resolved)) {
        return Promise.resolve(resolved).then((entries) => Array.isArray(entries) ? entries : [])
    }
    return Array.isArray(resolved) ? resolved : []
}

/**
 * The property entries to show for a node: the consumer's map when one is
 * declared, otherwise every key/value pair on the node's data.
 *
 * A declared map may be `async`; pass the render pass's `ctx` so the consumer
 * can cancel when the selection moves on. Omit it for a one-shot read outside
 * any render pass.
 */
export function nodePropertiesGetter(
    node: Node,
    propertiesPanel: PropertiesPanel,
    ctx: RenderContext = DETACHED_RENDER_CONTEXT,
): PropertyEntry[] | Promise<PropertyEntry[]> {
    const data = node.getData()
    const properties: PropertyEntry[] = []

    if (propertiesPanel.nodePropertiesMap) {
        return asPropertyEntries(propertiesPanel.nodePropertiesMap(node, ctx))
    }
    properties.push({
        name: 'id',
        value: node.id,
    } as PropertyEntry)

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

/**
 * Read one property list per element (a multi-selection, aggregated).
 *
 * Stays synchronous unless at least one element's map is async, so the common
 * case never picks up a microtask it didn't have before.
 */
export function collectPropertyEntries<T>(
    elements: T[],
    read: (element: T) => PropertyEntry[] | Promise<PropertyEntry[]>,
): PropertyEntry[][] | Promise<PropertyEntry[][]> {
    const collected = elements.map(read)
    return collected.some(isThenable) ? Promise.all(collected) : collected as PropertyEntry[][]
}

/** The edge counterpart of {@link nodePropertiesGetter}, on the same terms. */
export function edgePropertiesGetter(
    edge: Edge,
    propertiesPanel: PropertiesPanel,
    ctx: RenderContext = DETACHED_RENDER_CONTEXT,
): PropertyEntry[] | Promise<PropertyEntry[]> {
    const data = edge.getData()
    const properties: Array<PropertyEntry> = []

    if (propertiesPanel.edgePropertiesMap) {
        return asPropertyEntries(propertiesPanel.edgePropertiesMap(edge, ctx))
    }
    properties.push({
        name: 'id',
        value: edge.id,
    } as PropertyEntry)

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

export function resolveNodeByName(nodeName: string, nodes: Node[], mainHeaderOptions: MainHeader): Node | undefined {
    const normalizedSearch = nodeName.trim().toLowerCase()
    return nodes.find(n => {

        // Match by ID
        if (n.id.toLowerCase() === normalizedSearch) {
            return true
        }

        // Match by main label
        const mainLabel = nodeNameGetter(n, mainHeaderOptions)

        return (
            typeof mainLabel === 'string'
            && mainLabel.trim().toLowerCase() === normalizedSearch
        )
    })
}
/**
 * The kind an edge is styled and keyed by, via `render.edgeTypeAccessor`.
 *
 * A synthetic stand-in carries no data of its own, so it borrows the kind of the
 * real edges it speaks for — but only when they agree: a stand-in covering several
 * kinds has no single kind to draw in and falls back to the default style.
 */
export function edgeTypeGetter(
    edge: Edge,
    accessor: ((edge: Edge) => string | undefined) | undefined
): string | undefined {
    if (typeof accessor !== 'function') return undefined

    const represented = edge.representedEdges
    if (!represented?.length) return accessor(edge)

    let common: string | undefined
    for (const real of represented) {
        const kind = accessor(real)
        if (kind === undefined) continue
        if (common === undefined) common = kind
        else if (common !== kind) return undefined
    }
    return common
}
