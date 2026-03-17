import { select as d3Select, type Selection } from 'd3-selection'
import { Node } from '../../Node'
import type { GraphRendererOptions } from '../../interfaces/RendererOptions'
import { NodeDrawer } from './NodeDrawer'
import { forceConstrainParent } from '../../plugins/layout/MicroForce'
import { Edge } from '../../Edge'
import type { EdgeDrawer } from './EdgeDrawer'
import { Graph } from '../../Graph'
import type { GraphOptions, RawEdge, RawNode, RelaxedGraphData } from '../../interfaces/GraphOptions'
import { forceCenter } from 'd3-force'

export class ClusterDrawer {

    private renderCB?: GraphRendererOptions['renderCluster']

    public nodeDrawer: NodeDrawer
    public edgeDrawer?: EdgeDrawer

    public constructor(nodeDrawer: NodeDrawer) {
        this.nodeDrawer = nodeDrawer
        this.renderCB = this.nodeDrawer.rendererOptions?.renderNode
    }

    public render(theClusterSelection: Selection<SVGGElement, Node, null, undefined>, node: Node, cb: (newRadius: number) => void): Selection<SVGCircleElement, Node, null, undefined> {
        if (!this.edgeDrawer) {
            this.edgeDrawer = this.nodeDrawer.graphSvgRenderer.edgeDrawer
        }

        let cluster = theClusterSelection.select<SVGCircleElement>('.pvt-cluster-area')

        if (cluster.empty()) {
            cluster = theClusterSelection.append('circle')
                .classed('pvt-cluster-area', true)
                .lower()
            const parentColor = ClusterDrawer.buildGradientForNode(theClusterSelection.node()!.querySelector('.node') as SVGCircleElement, cluster, node)
            if (parentColor)
                cluster.style('stroke', `color-mix(in srgb, ${parentColor} 70%, transparent)`)
        }

        const r = ClusterDrawer.getRadiusForClusterNode(node)
        node.setCircleRadiusCollapsed(node.getCircleRadius())
        node.setCircleRadius(r)

        const parentGraph = this.nodeDrawer.graph.getParentGraph()
        if (parentGraph) { // We're in a subgraph, propagate change to upper graph
            const newParentRadius = ClusterDrawer.updateParentGraph(parentGraph, node, r)
            if (newParentRadius) {
                this.nodeDrawer.graph.simulation.getSimulation()
                    .force('link', null)
                    .force('constrainParent', forceConstrainParent<Node>(newParentRadius, 10))
            }
        }

        cluster
            .attr('r', 0)
            .attr('_final_r', r)
            .attr('cx', 0)
            .attr('cy', 0)

            cluster.transition().duration(250).attr('r', r)


        const childrenEdges: Edge[] =
            node.children.flatMap(child => child.getEdgesOut() ?? [])
            .map((e) => {
                const from = this.nodeDrawer.graph.getMutableNode(e.from.id) as Node
                const to = this.nodeDrawer.graph.getMutableNode(e.to.id) as Node

                return new Edge(
                    e.id,
                    from,
                    to,
                    e.getData(),
                    e.getStyle(),
                    e.directed,
                    e.syntheticTerminalNode
                )
            })

        const subgraphContainer: SVGGElement = theClusterSelection.node() as SVGGElement
        const subgraph = this.createSubgraph(node.children, childrenEdges, subgraphContainer, node, this.nodeDrawer.graph)
        node._subgraph = subgraph

        theClusterSelection.select<SVGGElement>(':scope > .zoom-layer')
            .attr('opacity', 0)
            .transition()
            .duration(250)
            .attr('opacity', 1)

        const shouldUpdateParentGraph = ClusterDrawer.toggleSyntheticEdges(node)
        if (shouldUpdateParentGraph) {
            parentGraph?.renderer.update(false)
        }


        if (cb) {
            requestAnimationFrame(() => {
                cb(r)
            })
        }

        return cluster

    }

    /**
     * Show/Hide synthetic edges based on collapse state
     * @param node The expanding/collapsing cluster node
     * @returns true if parent graph should be updated
     */
    public static toggleSyntheticEdges(node: Node): boolean {
        let shouldUpdateParentGraph = false
        const childrenSet = new Set(node.children.map(n => n.id))
        if (node.expanded) {
            // Hide synthetic edges that point to the parent node of this subgraph
            node.getEdgesIn().filter((e: Edge) => e.isSynthetic === true).forEach((e: Edge) => {
                e.hide()
            })
            
            // Then show actual edges
            node.children.forEach((child: Node) => {
                child.getEdgesIn()
                .filter((e: Edge) => !node.children.includes(e.from)) // Edges are already drawn in the subgraph
                .forEach((e: Edge) => {
                    e.show()
                })
            })

            // Current cluster might not know of other inbound edges from outer graph
            // check in parent if there's a synthetic edge toward it's parent node with terminal node as children
            // if yes, check the origin of the edge and loop over them
                // if one edge is pointing to a children of the cluster, show it
            if (node.parentNode) {
                const syntheticEdgesToParentNode = node.parentNode.getEdgesIn()
                    .filter((e) => e.isSynthetic && childrenSet.has(e.syntheticTerminalNode?.id ?? ''))
                syntheticEdgesToParentNode.forEach((synthEdgeWithTerminalNode) => {
                    shouldUpdateParentGraph = true
                    synthEdgeWithTerminalNode.hide()
                    const outerParent: Node = synthEdgeWithTerminalNode.from
                    const outerEdges = outerParent.getEdgesOut()
                    outerEdges
                        .filter((e) => childrenSet.has(e.syntheticTerminalNode?.id ?? ''))
                        .forEach((e) => {
                            e.hide()
                        })
                    outerEdges
                        .filter((e) => childrenSet.has(e.to.id))
                        .forEach((e) => {
                            e.show()
                        })
                })

            }
        } else {
            // Show synthetic edges that point to the parent node of this subgraph
            node.getEdgesIn().filter((e: Edge) => e.isSynthetic === true).forEach((e: Edge) => {
                e.show()
            })
            // Then hide actual edges
            node.children.forEach((child: Node) => {
                child.getEdgesIn()
                    .filter((e: Edge) => !node.children.includes(e.from)) // Edges are already drawn in the subgraph
                    .forEach((e: Edge) => {
                        e.hide()
                    })
            })

            // Hide outer edges that were shown in expanded state
            if (node.parentNode) {
                const syntheticEdgesToParentNode = node.parentNode.getEdgesIn()
                    .filter(e => e.isSynthetic && childrenSet.has(e.syntheticTerminalNode?.id ?? ''))

                syntheticEdgesToParentNode.forEach(synthEdgeWithTerminalNode => {
                    const outerParent = synthEdgeWithTerminalNode.from
                    const outerEdges = outerParent.getEdgesOut()
                    shouldUpdateParentGraph = true

                    // hide edges that point to any of this cluster's children
                    outerEdges
                        .filter(e => childrenSet.has(e.to.id))
                        .forEach(e => e.hide())
                    // show synthetic edges that point to the cluster
                    outerEdges
                        .filter(e => e.isSynthetic && e.to.id === node.id)
                        .forEach(e => e.show())
                })
            }
        }

        return shouldUpdateParentGraph
    }

    private createSubgraph(nodes: Node[], edges: Edge[], container: SVGGElement, parentNode: Node, mainGraph: Graph): Graph {

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
            },
            simulation: {
                useWorker: false,
                warmupTicks: 10,
                cooldownTime: 50,
                freezeNodesOnDrag: false,
            },
            callbacks: {
                onNodeSelect: (node) => {
                    const mainGraphNode = mainGraph.getMutableNode(node.id)
                    if (mainGraphNode) {
                        mainGraph.selectElement(mainGraphNode)
                    }
                },
                onEdgeSelect: (edge) => {
                    const mainGraphEdge = mainGraph.getMutableEdge(edge.id)
                    if (mainGraphEdge) {
                        mainGraph.selectElement(mainGraphEdge)
                    }
                },
                onNodeHoverIn: (event, node) => {
                    mainGraph.UIManager.tooltip?.openForNodeOnElement(event, node)
                },
            }
        }

        const subgraphData: RelaxedGraphData = {
            nodes: [...nodes.values()].map((n) => n.toDict(true) as RawNode),
            edges: [...edges.values()].map(e => e.toDict() as RawEdge)
        }

        const childrenProxy = new Map<string, Node>()

        const tmpHtml = document.createElement('div')
        const subgraph = new Graph(tmpHtml, subgraphData, options)
        subgraph.setParentGraph(this.nodeDrawer.graph)
        const zoomLayer = tmpHtml.querySelector('.zoom-layer') as SVGGElement
        container.appendChild(zoomLayer)

        subgraph.getMutableNodes().forEach((n: Node) => {
            childrenProxy.set(n.id, n)
            n.isChild = true
        })
        nodes.forEach((n: Node) => { // remap original parent to outer graph's node
            if (n.parentNode?.id === parentNode.id) {
                const subgraphNode = subgraph.getMutableNode(n.id)
                if (subgraphNode) {
                    subgraphNode.parentNode = parentNode
                }
            }
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

        mainGraph.renderer.getGraphInteraction().on('dragging', () => {
            this.updatePositionOnAllRealChildren(mainGraph, childrenProxy)
        })
        mainGraph.renderer.getGraphInteraction().on('simulationTick', () => {
            this.updatePositionOnAllRealChildren(mainGraph, childrenProxy)
        })
        mainGraph.renderer.getGraphInteraction().on('canvasClick', () => {
            subgraph.deselectAll()
        })

        return subgraph
    }

    private updatePositionOnAllRealChildren(graph: Graph, nodeProxy: Map<string, Node>) {
        graph.getMutableNodes().filter((node) => node.isParent && node.expanded).forEach((node: Node) => {
            const children = node.children
            children.forEach((child: Node) => {
                const childInSubgraph: Node | undefined = nodeProxy.get(child.id)
                if (!childInSubgraph || !childInSubgraph.x || !childInSubgraph.y) return
                this.updatePositionOnRealChild(childInSubgraph.x, childInSubgraph.y, child.id)
            })
        })
    }

    /**
     * Bublle up the position on the real child
     * @param x Position of the child element in the subgraph
     * @param y Position of the child element in the subgraph
     * @param id ID of the child node
     * @returns 
     */
    updatePositionOnRealChild(x: number, y: number, id: string) {
        const realChild = this.nodeDrawer.graph.getMutableNode(id)
        const clusterNode = realChild?.parentNode
        if (realChild && clusterNode) {
            realChild.x = x + (clusterNode.x ?? 0)
            realChild.y = y + (clusterNode.y ?? 0)
            this.nodeDrawer.graph.renderer.nextTickFor([realChild])
            const parentGraph = this.nodeDrawer.graph.getParentGraph()
            if (parentGraph) {
                parentGraph.renderer.nodeDrawer.clusterDrawer.updatePositionOnRealChild(x, y, id)
            }
        }
    }

    public static getRadiusForClusterNode(node: Node): number {
        let r: number = 0
        if (!node.expanded) {
            r = node.getCircleRadius() + 4
        } else {
            const padding = 50
            const childPadding = 16
            const totalRadius = node.children.reduce((sum, child) => sum + child.getCircleRadius() + childPadding, 0)
            const avgRadius = totalRadius / node.children.length
            const estimatedRadius = Math.sqrt(node.children.length) * (2 * avgRadius) + padding

            r = Math.max(50, estimatedRadius)
        }
        return r
    }

    public static updateParentGraph(parentGraph: Graph, node: Node, r: number): number | undefined {
        const realChild = parentGraph.getMutableNode(node.id)
        realChild?.setCircleRadius(r)

        const parentNode = node.parentNode
        if (parentNode) {
            const parentR = ClusterDrawer.getRadiusForClusterNode(parentNode)
            parentNode.setCircleRadius(parentR)
            parentGraph.onChange()
            parentGraph.simulation.reheat(0.1)

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

    public static buildGradientForNode(parentCircleElement: SVGCircleElement, clusterSelection: Selection<SVGCircleElement, Node, null, undefined>, node: Node): string | undefined {
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
