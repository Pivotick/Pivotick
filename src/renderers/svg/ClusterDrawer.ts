import { select as d3Select, type Selection } from 'd3-selection'
import { Node } from '../../Node'
import { NodeDrawer } from './NodeDrawer'
import { forceConstrainParent } from '../../plugins/layout/MicroForce'
import { Edge } from '../../Edge'
import type { EdgeDrawer } from './EdgeDrawer'
import { Graph } from '../../Graph'
import type { GraphOptions, RawEdge, RawNode, RelaxedGraphData } from '../../interfaces/GraphOptions'
import { forceCenter } from 'd3-force'
import type { GraphSvgRenderer } from './GraphSvgRenderer'
import { CoordinateTransform } from '../../utils/CoordinateTransform'
import type { NodeSelection } from '../../interfaces/GraphInteractions'

/**
 * ClusterDrawer manages the rendering of nested subgraphs when a cluster node is expanded.
 *
 * ## Architecture Overview
 *
 * When a node with children is expanded:
 * 1. A nested Graph instance (subgraph) is created containing the children nodes
 * 2. The subgraph uses local coordinates (relative to parent cluster center at 0,0)
 * 3. A cluster area circle is drawn around the parent node
 * 4. Synthetic edges (pointing to nested children) are hidden, actual edges are shown
 *
 * ## Coordinate Systems
 *
 * - **Global coordinates**: Used in the main graph, relative to SVG origin
 * - **Local coordinates**: Used in subgraphs, relative to parent cluster center (0, 0)
 *
 * Position conversion happens in both directions:
 * - Local → Global: When subgraph nodes move, update the real nodes in main graph
 * - Global → Local: Not typically needed as subgraph simulation uses local coords
 *
 * ## Node Identity
 *
 * - Subgraph nodes are created from dicts (clones) of the original nodes
 * - Each subgraph node has `_mainGraphNode` pointing to the real node in the root graph
 * - Position updates flow: subgraph node → real node → parent graph hierarchy
 *
 * ## Synthetic Edges
 *
 * Synthetic edges are created during graph normalization for edges that would point
 * to nested children. When a cluster is expanded, these are hidden and replaced with
 * the actual edges drawn within the subgraph.
 */
export class ClusterDrawer {

    public nodeDrawer: NodeDrawer
    public edgeDrawer?: EdgeDrawer

    public constructor(nodeDrawer: NodeDrawer) {
        this.nodeDrawer = nodeDrawer
    }

    /**
     * Renders an expanded cluster with its nested subgraph.
     *
     * This is called when a node with children is expanded. It creates:
     * - A cluster area circle around the parent node
     * - A nested subgraph containing the children nodes
     * - Appropriate edge visibility (hide synthetic, show actual)
     *
     * @param theClusterSelection - D3 selection of the cluster's SVG group element
     * @param node - The node being expanded
     * @param cb - Callback invoked after cluster expansion completes, receives final radius
     * @returns The cluster circle selection
     */
    public render(
        theClusterSelection: Selection<SVGGElement, Node, null, undefined>,
        node: Node,
        cb: (newRadius: number) => void
    ): Selection<SVGCircleElement, Node, null, undefined> {
        // Ensure we have access to edge drawer
        if (!this.edgeDrawer) {
            this.edgeDrawer = this.nodeDrawer.graphSvgRenderer.edgeDrawer
        }

        // Create or reuse the cluster area circle (visual boundary)
        let cluster = theClusterSelection.select<SVGCircleElement>('.pvt-cluster-area')

        if (cluster.empty()) {
            cluster = theClusterSelection.append('circle')
                .classed('pvt-cluster-area', true)
                .lower()
            const parentColor = ClusterDrawer.buildGradientForNode(
                theClusterSelection.node()!.querySelector('.node') as SVGCircleElement,
                cluster,
                node
            )
            if (parentColor)
                cluster.style('stroke', `color-mix(in srgb, ${parentColor} 70%, transparent)`)
        }

        // Calculate and apply new radius for the expanded cluster
        const r = ClusterDrawer.updateToNewRadiusExpanded(this.nodeDrawer.graph, node)

        // Animate cluster circle from 0 to final radius
        cluster
            .attr('r', 0)
            .attr('_final_r', r)
            .attr('cx', 0)
            .attr('cy', 0)

        cluster.transition().duration(250).attr('r', r)

        // Collect all edges connected to children (for subgraph)
        const seen = new Set<string>()
        const childrenEdges = node.children
            .flatMap(child => [
                ...(child.getEdgesOut() ?? []),
                ...(child.getEdgesIn() ?? []),
            ])
            .filter(edge => {
                if (seen.has(edge.id)) return false
                seen.add(edge.id)
                return true
            })

        // Create the nested subgraph containing children nodes
        const subgraphContainer: SVGGElement = theClusterSelection.node() as SVGGElement
        const subgraph = this.createSubgraph(
            node.children,
            childrenEdges,
            subgraphContainer,
            node,
            this.nodeDrawer.graph
        )
        node.setSubgraph(subgraph)

        // Fade in the zoom layer containing the subgraph
        theClusterSelection.select<SVGGElement>(':scope > .zoom-layer')
            .attr('opacity', 0)
            .transition()
            .duration(250)
            .attr('opacity', 1)

        // Update edge visibility: hide synthetic edges, show actual edges
        ClusterDrawer.toggleSyntheticEdges(node)

        // Propagate layout updates up the parent graph hierarchy
        let currParentGraph = this.nodeDrawer.graph.getParentGraph()
        while (currParentGraph) {
            currParentGraph.renderer.update(false)
            currParentGraph = currParentGraph.getParentGraph()
        }

        // Invoke callback after animation
        if (cb) {
            requestAnimationFrame(() => {
                cb(r)
            })
        }

        return cluster
    }

    /**
     * Creates a nested subgraph for rendering children inside a cluster.
     *
     * The subgraph is a separate Graph instance that:
     * - Uses local coordinates (relative to parent cluster center at 0,0)
     * - Contains clones of the child nodes
     * - Shares the same Node object references for proper position syncing
     * - Has its own simulation constrained within the parent radius
     *
     * @param nodes - Child nodes to include in the subgraph
     * @param edges - Edges connecting the child nodes
     * @param container - SVG group element to contain the subgraph
     * @param parentNode - The parent cluster node (defines the local coordinate origin)
     * @param parentGraph - Reference to the parent graph for coordinate conversion
     * @returns The created subgraph instance
     */
    private createSubgraph(
        nodes: Node[],
        edges: Edge[],
        container: SVGGElement,
        parentNode: Node,
        parentGraph: Graph
    ): Graph {
        // Callback invoked before subgraph rendering
        const beforeRender = (graph: Graph) => {
            // Link each subgraph node clone to its main graph counterpart (bidirectional)
            graph.getMutableNodes().forEach((n: Node) => {
                let mainNode = parentGraph.getMutableNode(n.id) as Node
                // Walk up to the root graph node if this is already a clone
                mainNode = mainNode.getMainGraphNode() ?? mainNode
                n.setMainGraphNode(mainNode)
                mainNode.setSubgraphClone(n)
                n.isChild = true
            })
            // Link each subgraph edge clone to its main graph counterpart
            graph.getMutableEdges().forEach((e: Edge) => {
                let mainEdge = parentGraph.getMutableEdge(e.id)
                if (mainEdge) {
                    mainEdge = mainEdge.getMainGraphEdge() ?? mainEdge
                    e.setMainGraphEdge(mainEdge)
                }
            })
            // Fix parent references: ensure children point to the correct cluster node
            nodes.forEach((n: Node) => {
                if (n.parentNode?.id === parentNode.id) {
                    const subgraphNode = graph.getMutableNode(n.id)
                    if (subgraphNode) {
                        subgraphNode.parentNode = parentNode
                    }
                }
            })
            // Link main graph edges to their subgraph node clones (for edge rendering)
            parentGraph.getMutableEdges().forEach((e: Edge) => {
                const mainEdge = e.getMainGraphEdge() ?? e
                const subgraphFromNode = graph.getMutableNode(e.from.id)
                const subgraphToNode = graph.getMutableNode(e.to.id)
                if (subgraphFromNode) {
                    mainEdge.setSubgraphFromNode(subgraphFromNode)
                }
                if (subgraphToNode) {
                    mainEdge.setSubgraphToNode(subgraphToNode)
                }
            })
        }

        const options: GraphOptions = {
            UI: {
                mode: 'viewer',
                tooltip: {
                    enabled: false,
                },
                contextMenu: {
                    enabled: false,
                },
                navigation: {
                    enabled: false,
                }
            },
            render: {
                ...this.nodeDrawer.graph.getOptions().render,
                zoomEnabled: false,
                zoomAnimationDuration: 100,
                beforeRender: beforeRender,
            },
            simulation: {
                useWorker: false,
                warmupTicks: 10,
                cooldownTime: 50,
                freezeNodesOnDrag: false,
            },
            callbacks: {
                onNodeSelect: (node) => {
                    const mainGraphNode = parentGraph.getMutableNode(node.id)
                    if (mainGraphNode) {
                        parentGraph.selectElement(mainGraphNode)
                    }
                },
                onNodesSelect: (selection: NodeSelection<unknown>[]) => {
                    const selectedNodeIDs = subgraph.renderer.getGraphInteraction().getSelectedNodeIDs()
                    if (selectedNodeIDs === null) return

                    const mainGraphNodes: NodeSelection<unknown>[] = selectedNodeIDs.map((nodeId) => {
                        const mainGraphNode = parentGraph.getMutableNode(nodeId) as Node
                        return {
                            node: mainGraphNode,
                            element: mainGraphNode?.getGraphElement()
                        }
                    })
                    parentGraph.renderer.getGraphInteraction().addNodesToSelection(mainGraphNodes)
                },
                onEdgeSelect: (edge) => {
                    const mainGraphEdge = parentGraph.getMutableEdge(edge.id)
                    if (mainGraphEdge) {
                        parentGraph.selectElement(mainGraphEdge)
                    }
                },
                onNodeHoverIn: (event, node) => {
                    parentGraph.UIManager.tooltip?.openForNodeOnElement(event, node)
                },
            },
            parentGraph: this.nodeDrawer.graph
        }

        const subgraphData: RelaxedGraphData = {
            nodes: [...nodes].map((n) => {
                return n.toDict(true) as RawNode
            }),
            edges: [...edges].map(e => {
                return e.toDict() as RawEdge
            })
        }

        const tmpHtml = document.createElement('div')
        const subgraph = new Graph(tmpHtml, subgraphData, options)
        const zoomLayer = tmpHtml.querySelector('.zoom-layer') as SVGGElement
        container.appendChild(zoomLayer)

        subgraph.getMutableNodes().forEach((node) => {
            ClusterDrawer.toggleSyntheticEdges(node)
        })

        subgraph.on('ready', () => {
            subgraph.simulation.getSimulation()
                .force('center', forceCenter(0, 0))
                .force('constrainParent', forceConstrainParent<Node>(parentNode.getCircleRadius(), 10))

            subgraph.simulation.restart()
        })
        subgraph.renderer.getGraphInteraction().on('dragended', () => {
        })
        subgraph.renderer.getGraphInteraction().on('simulationTick', () => {
            const visibleNodes = subgraph.getMutableNodes().filter(node => node.visible)
            visibleNodes.forEach((node: Node) => {
                const x = node.x ?? 0
                const y = node.y ?? 0
                this.updatePositionOnRealChild(x, y, node.id)
            })
        })

        parentGraph.renderer.getGraphInteraction().on('dragging', () => {
            this.updatePositionOnAllRealChildren(parentGraph)
        })
        parentGraph.renderer.getGraphInteraction().on('simulationTick', () => {
            this.updatePositionOnAllRealChildren(parentGraph)
        })
        parentGraph.renderer.getGraphInteraction().on('canvasClick', () => {
            subgraph.deselectAll()
        })

        return subgraph
    }

    /**
     * Recursively updates positions of all real child nodes across nested subgraphs.
     *
     * This is called during simulation tick and drag events to propagate position changes
     * from subgraphs up to the main graph. It handles nested clusters by recursing through
     * parent graphs.
     *
     * @param graph - The graph to process (can be main graph or subgraph)
     */
    private updatePositionOnAllRealChildren(graph: Graph) {
        graph.getMutableNodes().filter((node) => node.isParent && node.expanded).forEach((node: Node) => {
            const children = node.children
            const subgraph = node.getSubgraph()
            // Build a map of subgraph nodes by ID for quick lookup
            const nodeProxy = new Map<string, Node>()
            if (subgraph) {
                subgraph.getMutableNodes().forEach((n: Node) => {
                    nodeProxy.set(n.id, n)
                })
                // Recursively process nested subgraphs first
                this.updatePositionOnAllRealChildren(subgraph)
            }

            // Update positions for direct children of this cluster
            children.forEach((child: Node) => {
                const childInSubgraph: Node | undefined = nodeProxy.get(child.id)
                if (!childInSubgraph || !childInSubgraph.x || !childInSubgraph.y) return
                this.updatePositionOnRealChild(childInSubgraph.x, childInSubgraph.y, child.id)
            })
        })
    }

    /**
     * Updates the position of a real child node in the main graph based on its subgraph position.
     * Then recursively bubbles the update up to parent graphs.
     *
     * This is the core method for syncing subgraph positions (local coordinates) to the main
     * graph (global coordinates). It:
     * 1. Converts local subgraph position to global position
     * 2. Updates the real node's position in the parent graph
     * 3. Triggers a render tick for the updated node
     * 4. Recursively updates parent graphs if this is a nested subgraph
     *
     * @param x - Local X position of the child in the subgraph
     * @param y - Local Y position of the child in the subgraph
     * @param id - ID of the child node (same in both subgraph and main graph)
     */
    updatePositionOnRealChild(x: number, y: number, id: string) {
        // Find the real node in the current graph (parent of subgraph)
        const realChild = this.nodeDrawer.graph.getMutableNode(id)
        const clusterNode = realChild?.parentNode
        if (realChild && clusterNode) {
            // Convert local coordinates to global coordinates
            const globalPos = CoordinateTransform.localToGlobal(x, y, clusterNode)
            realChild.x = globalPos.x
            realChild.y = globalPos.y

            // Trigger render update for this node
            this.nodeDrawer.graph.renderer.nextTickFor([realChild])

            // Recursively update parent graphs (bubble up the hierarchy)
            const parentGraph = this.nodeDrawer.graph.getParentGraph()
            if (parentGraph) {
                const svgRenderer = parentGraph.renderer as unknown as GraphSvgRenderer
                svgRenderer.nodeDrawer.clusterDrawer.updatePositionOnRealChild(x, y, id)
            }
        }
    }

    /**
     * Toggles visibility of synthetic edges based on cluster expansion state.
     *
     * Synthetic edges are placeholder edges created during graph normalization that point
     * from external nodes to collapsed cluster children. When a cluster is expanded:
     * - Synthetic edges pointing to this node are hidden (real edges become visible instead)
     * - Actual edges from outside to children are shown
     * When collapsed:
     * - Synthetic edges are restored
     * - Actual edges to nested children are hidden
     *
     * Handles both the subgraph clone and the main graph node to cover edges at all levels.
     *
     * @param node - The cluster node being expanded/collapsed
     */
    public static toggleSyntheticEdges(node: Node) {
        const mainNode = node.getMainGraphNode() ?? node
        const childSet = new Set(mainNode.children.map(c => c.id))

        if (node.expanded) {
            // Hide synthetic edges at both levels (subgraph clone + main graph node)
            ClusterDrawer.setSyntheticEdgeVisibility(node, false)
            if (mainNode !== node) {
                ClusterDrawer.setSyntheticEdgeVisibility(mainNode, false)
            }

            // Show actual edges from outside nodes to children (edges between siblings are drawn in the subgraph)
            mainNode.children.forEach((child: Node) => {
                child.getEdgesIn()
                    .filter((e: Edge) => !childSet.has(e.from.id))
                    .forEach((e: Edge) => e.show())
            })
        } else {
            // Restore synthetic edges (only if the node itself is visible)
            ClusterDrawer.setSyntheticEdgeVisibility(node, true)
            if (mainNode !== node && node.visible) {
                ClusterDrawer.setSyntheticEdgeVisibility(mainNode, true)
            }

            // Hide all edges pointing to nested children (recursively)
            ClusterDrawer.hideNestedEdges(mainNode, childSet)
        }
    }

    /**
     * Shows or hides all synthetic edges pointing to a node.
     */
    private static setSyntheticEdgeVisibility(node: Node, visible: boolean) {
        node.getEdgesIn()
            .filter((e: Edge) => e.isSynthetic === true)
            .forEach((e: Edge) => visible ? e.show() : e.hide())
    }

    /**
     * Recursively hides edges from outside nodes that point to nested children
     * of a collapsed cluster.
     *
     * @param node - The cluster node whose nested edges should be hidden
     * @param siblingIds - Set of sibling node IDs (edges between siblings are skipped)
     */
    private static hideNestedEdges(node: Node, siblingIds?: Set<string>) {
        node.children.forEach((child: Node) => {
            ClusterDrawer.hideNestedEdges(child, new Set(node.children.map(c => c.id)))

            child.getEdgesIn()
                .filter((e: Edge) => !siblingIds || !siblingIds.has(e.from.id))
                .forEach((e: Edge) => e.hide())
        })
    }

    /**
     * Recursively collapses all expanded clusters starting from the given node.
     *
     * Used when collapsing a parent cluster - all nested expanded clusters
     * must also be collapsed first.
     *
     * @param node - The node whose subtree should be collapsed
     */
    public static collapseAllOpenedClusters(node: Node) {
        node.children.forEach((child: Node) => {
            ClusterDrawer.collapseAllOpenedClusters(child)
            child.collapse()
            child.setCircleRadius(child.getCircleRadiusCollapsed())
        })
        ClusterDrawer.cleanupSubgraphReferences(node)
    }

    /**
     * Cleans up all references between the main graph and a destroyed subgraph.
     * Clears _subgraphClone on main graph nodes, _subgraphFromNode/_subgraphToNode
     * on main graph edges, and destroys the subgraph instance.
     *
     * @param node - The cluster node whose subgraph is being destroyed
     */
    private static cleanupSubgraphReferences(node: Node) {
        const subgraph = node.getSubgraph()
        if (!subgraph) return

        // Clear subgraph clone references on main graph nodes
        subgraph.getMutableNodes().forEach((subgraphNode: Node) => {
            const mainNode = subgraphNode.getMainGraphNode()
            if (mainNode) {
                mainNode.clearSubgraphClone()
            }
        })

        // Clear subgraph node references on main graph edges
        subgraph.getMutableEdges().forEach((subgraphEdge: Edge) => {
            const mainEdge = subgraphEdge.getMainGraphEdge()
            if (mainEdge) {
                mainEdge.clearSubgraphNodes()
            }
        })

        node.destroySubgraph()
    }

    /**
     * Updates the radius of a node when it is expanded, propagating changes up the parent hierarchy.
     *
     * When a cluster node expands:
     * 1. Save current radius as collapsed radius
     * 2. Calculate new expanded radius based on children
     * 3. Update the node in its parent graph
     * 4. Recursively update parent clusters
     *
     * @param graph - The graph containing the node
     * @param node - The node being expanded
     * @returns The calculated expanded radius
     */
    public static updateToNewRadiusExpanded(graph: Graph, node: Node): number {
        const r = ClusterDrawer.getRadiusForClusterNode(node)
        // Save current radius as the collapsed radius
        if (!node.expanded) {
            node.setCircleRadiusCollapsed(node.getCircleRadius())
        }
        node.setCircleRadius(r)

        const parentGraph = graph.getParentGraph()
        if (parentGraph) {
            // Propagate radius change to parent graph
            const newParentRadius = ClusterDrawer.updateParentGraph(parentGraph, node, r)
            if (newParentRadius) {
                graph.simulation.getSimulation()
                    .force('link', null)
                    .force('constrainParent', forceConstrainParent<Node>(newParentRadius, 10))
            }

            // Recursively update parent's parent if needed
            if (parentGraph.getParentGraph() && node.parentNode) {
                ClusterDrawer.updateToNewRadiusExpanded(parentGraph, node.parentNode)
            }
        }

        return r
    }

    /**
     * Updates the radius of a node when it is collapsed, propagating changes up the parent hierarchy.
     *
     * @param node - The node being collapsed
     * @param restoreR - Whether to restore the original collapsed radius
     * @param graph - The graph containing the node (optional, used for propagation)
     */
    public static updateToNewRadiusCollapsed(node: Node, restoreR: boolean, graph?: Graph) {
        const newR = restoreR
            ? node.getCircleRadiusCollapsed()  // Restore original radius before expansion
            : ClusterDrawer.getRadiusForClusterNode(node)
        node.setCircleRadius(newR)
        if (graph) {
            ClusterDrawer.updateParentGraph(graph, node, newR)
            const parentGraph = graph.getParentGraph()
            if (node.parentNode) {
                ClusterDrawer.updateToNewRadiusCollapsed(node.parentNode, false, parentGraph)
            }
        }
    }

    /**
     * Calculates the appropriate radius for a cluster node based on its expansion state.
     *
     * For collapsed nodes: returns current radius + 4px padding
     * For expanded nodes: calculates radius based on children count and sizes using
     * a formula that approximates the area needed to contain all children.
     *
     * @param node - The cluster node to calculate radius for
     * @returns The calculated radius
     */
    public static getRadiusForClusterNode(node: Node): number {
        if (!node.expanded) {
            return node.getCircleRadius() + 4
        }

        const padding = 50
        const childPadding = 16
        // Sum of all children's radii plus spacing
        const totalRadius = node.children.reduce((sum, child) => {
            const childRadius = child.getCircleRadius()
            return sum + childRadius + childPadding
        }, 0)
        const avgRadius = totalRadius / node.children.length
        // Area-based formula: sqrt(children) * 2 * avgChildRadius + padding
        const estimatedRadius = Math.sqrt(node.children.length) * (2 * avgRadius) + padding

        return Math.max(50, estimatedRadius)
    }

    /**
     * Updates the parent graph when a child cluster's radius changes.
     *
     * This method:
     * 1. Updates the radius of the node in the parent graph
     * 2. Triggers a re-layout of the parent graph
     * 3. Updates the parent cluster's visual radius if it exists
     *
     * @param parentGraph - The parent graph to update
     * @param node - The node whose radius changed
     * @param r - The new radius
     * @returns The parent's new radius if updated, undefined otherwise
     */
    public static updateParentGraph(parentGraph: Graph, node: Node, r: number): number | undefined {
        // Update the node's radius in the parent graph
        const realChild = parentGraph.getMutableNode(node.id)
        realChild?.setCircleRadius(r)
        const mainGraphNode = node.getMainGraphNode()
        if (mainGraphNode) {
            mainGraphNode.setCircleRadius(r)
        }

        const parentNode = node.parentNode
        if (parentNode) {
            const parentR = ClusterDrawer.getRadiusForClusterNode(parentNode)
            parentNode.setCircleRadius(parentR)
            parentGraph.onChange()
            parentGraph.simulation.reheat(0.1)

            // Update the visual cluster radius if it exists
            const parentCluster: SVGCircleElement | undefined | null = parentNode.getGraphElement()?.querySelector('& > .pvt-cluster-area')

            if (parentCluster) {
                const parentClusterSelection: Selection<SVGCircleElement, Node, null, undefined> = d3Select<SVGCircleElement, Node>(parentCluster)
                parentClusterSelection
                    .attr('_final_r', parentR)
                    .transition().duration(250).attr('r', parentR)
                NodeDrawer.handleChildrenExpanded(parentGraph, parentNode, parentClusterSelection)
            }
            return parentR
        }
    }

    /**
     * Creates a radial gradient fill for the cluster area circle.
     *
     * The gradient fades from transparent at 90% to a color-mixed version of the
     * parent node's fill color at 100%, creating a subtle visual boundary.
     *
     * @param parentCircleElement - The parent node's circle element
     * @param clusterSelection - The cluster area circle selection
     * @param node - The cluster node
     * @returns The parent node's fill color, or undefined if not found
     */
    public static buildGradientForNode(
        parentCircleElement: SVGCircleElement,
        clusterSelection: Selection<SVGCircleElement, Node, null, undefined>,
        node: Node
    ): string | undefined {
        if (parentCircleElement) {
            const parentNodeFillColor = getComputedStyle(parentCircleElement).fill
            const outerColor = `color-mix(in srgb, ${parentNodeFillColor} 40%, transparent)`
            const id = `pvt-cluster-area-${node.id}`

            const rootSvg = parentCircleElement.closest('.pvt-canvas-element')
            const defs = rootSvg?.querySelector('defs')
            if (!defs) return

            const gradient = defs.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient'))
            gradient.setAttribute('id', id)

            const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
            stop1.setAttribute('offset', '90%')
            stop1.setAttribute('stop-color', '#ffffff00')
            gradient.appendChild(stop1)

            const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
            stop2.setAttribute('offset', '100%')
            stop2.setAttribute('stop-color', outerColor)
            gradient.appendChild(stop2)

            clusterSelection.style('fill', `url(#${id})`)
            return parentNodeFillColor
        }
    }
}
