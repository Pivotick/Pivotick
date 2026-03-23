/**
 * Utilities for converting between global and local coordinate systems
 * in nested subgraphs for collapsible clusters.
 *
 * Coordinate Systems:
 * - Global coordinates: x/y relative to main graph origin
 * - Local coordinates: x/y relative to parent cluster center (0, 0)
 */
export class CoordinateTransform {
    /**
     * Convert global coordinates to local coordinates relative to a parent cluster.
     *
     * Used when reading positions from the main graph and applying them to subgraph nodes.
     *
     * @param globalX Global X coordinate
     * @param globalY Global Y coordinate  * @param parentNode The parent cluster node (whose position defines the local origin)
     * @returns Local coordinates relative to parent center
     */
    static globalToLocal(globalX: number, globalY: number, parentNode: { x?: number; y?: number }): { x: number; y: number } {
        const parentX = parentNode.x ?? 0
        const parentY = parentNode.y ?? 0
        return {
            x: globalX - parentX,
            y: globalY - parentY
        }
    }

    /**
     * Convert local coordinates (relative to parent cluster center) to global coordinates.
     *
     * Used when reading positions from subgraph nodes and updating the main graph.
     *
     * @param localX Local X coordinate (relative to parent)
     * @param localY Local Y coordinate (relative to parent)
     * @param parentNode The parent cluster node (whose position defines the local origin)
     * @returns Global coordinates
     */
    static localToGlobal(localX: number, localY: number, parentNode: { x?: number; y?: number }): { x: number; y: number } {
        const parentX = parentNode.x ?? 0
        const parentY = parentNode.y ?? 0
        return {
            x: localX + parentX,
            y: localY + parentY
        }
    }
}
