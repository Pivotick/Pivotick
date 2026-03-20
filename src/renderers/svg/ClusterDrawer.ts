import { select as d3Select, type Selection } from 'd3-selection'
import { Node } from '../../Node'
import type { GraphRendererOptions } from '../../interfaces/RendererOptions'
import { NodeDrawer } from './NodeDrawer'
import { forceConstrainParent } from '../../plugins/layout/MicroForce'
import { Edge } from '../../Edge'
import type { EdgeDrawer } from './EdgeDrawer'
import { Graph } from '../../Graph'
import type { GraphData, GraphOptions, RawEdge, RawNode, RelaxedGraphData } from '../../interfaces/GraphOptions'
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

        const r = ClusterDrawer.updateToNewRadiusExpanded(this.nodeDrawer.graph, node)

        cluster
            .attr('r', 0)
            .attr('_final_r', r)
            .attr('cx', 0)
            .attr('cy', 0)

            cluster.transition().duration(250).attr('r', r)

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

        const subgraphContainer: SVGGElement = theClusterSelection.node() as SVGGElement
        const subgraph = this.createSubgraph(node.children, childrenEdges, subgraphContainer, node, this.nodeDrawer.graph)
        node._subgraph = subgraph

        theClusterSelection.select<SVGGElement>(':scope > .zoom-layer')
            .attr('opacity', 0)
            .transition()
            .duration(250)
            .attr('opacity', 1)

        ClusterDrawer.toggleSyntheticEdges(node)
        let currParentGraph = this.nodeDrawer.graph.getParentGraph()
        while (currParentGraph) {
            currParentGraph.renderer.update(false)
            currParentGraph = currParentGraph.getParentGraph()
        }


        if (cb) {
            requestAnimationFrame(() => {
                cb(r)
            })
        }

        return cluster

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
            nodes: [...nodes].map((n) => {
                return n.toDict(true) as RawNode
            }),
            edges: [...edges].map(e => {
                return e.toDict() as RawEdge
            })
        }

        const childrenProxy = new Map<string, Node>()
        const beforeDraw = (graph: Graph) => {
            graph.getMutableNodes().forEach((n: Node) => {
                childrenProxy.set(n.id, n)

                let origObject = mainGraph.getMutableNode(n.id) as Node
                origObject = origObject._original_object ?? origObject
                n._original_object = origObject

                n.isChild = true
            })
            nodes.forEach((n: Node) => { // remap original parent to outer graph's node
                if (n.parentNode?.id === parentNode.id) {
                    const subgraphNode = graph.getMutableNode(n.id)
                    if (subgraphNode) {
                        subgraphNode.parentNode = parentNode
                    }
                }
            })
        }
        options.beforeDraw = beforeDraw
        options.parentGraph = this.nodeDrawer.graph

        const tmpHtml = document.createElement('div')
        const subgraph = new Graph(tmpHtml, subgraphData, options)
        // const normalisedData = Graph.normalizeGraphData(subgraphData)
        // const subgraph = new Graph(tmpHtml, normalisedData, options)
        // subgraph.setParentGraph(this.nodeDrawer.graph)
        const zoomLayer = tmpHtml.querySelector('.zoom-layer') as SVGGElement
        container.appendChild(zoomLayer)

        // subgraph.getMutableNodes().forEach((n: Node) => {
        //     childrenProxy.set(n.id, n)

        //     let origObject = mainGraph.getMutableNode(n.id) as Node
        //     origObject = origObject._original_object ?? origObject
        //     n._original_object = origObject

        //     n.isChild = true
        // })
        // nodes.forEach((n: Node) => { // remap original parent to outer graph's node
        //     if (n.parentNode?.id === parentNode.id) {
        //         const subgraphNode = subgraph.getMutableNode(n.id)
        //         if (subgraphNode) {
        //             subgraphNode.parentNode = parentNode
        //         }
        //     }
        // })
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

        mainGraph.renderer.getGraphInteraction().on('dragging', () => {
            this.updatePositionOnAllRealChildren(mainGraph)
        })
        mainGraph.renderer.getGraphInteraction().on('simulationTick', () => {
            this.updatePositionOnAllRealChildren(mainGraph)
        })
        mainGraph.renderer.getGraphInteraction().on('canvasClick', () => {
            subgraph.deselectAll()
        })

        return subgraph
    }

    private updatePositionOnAllRealChildren(graph: Graph) {
        graph.getMutableNodes().filter((node) => node.isParent && node.expanded).forEach((node: Node) => {
            const children = node.children
            const subgraph = node._subgraph
            const nodeProxy = new Map<string, Node>()
            if (subgraph) {
                subgraph.getMutableNodes().forEach((n: Node) => {
                    nodeProxy.set(n.id, n)
                })
                this.updatePositionOnAllRealChildren(subgraph)
            }

            children.forEach((child: Node) => {
                const childInSubgraph: Node | undefined = nodeProxy.get(child.id)
                if (!childInSubgraph || !childInSubgraph.x || !childInSubgraph.y) return
                this.updatePositionOnRealChild(childInSubgraph.x, childInSubgraph.y, child.id)
            })
        })
    }

    /**
     * Bubble up the position on the real child
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

    /**
     * Show/Hide synthetic edges based on collapse state
     * @param node The expanding/collapsing cluster node
     * @returns true if parent graph should be updated
     */
    public static toggleSyntheticEdges(node: Node) {
        if (node.expanded) {
            const currentNode = node._original_object ?? node
            // Hide synthetic edges that point to the parent node of this subgraph
            currentNode.getEdgesIn().filter((e: Edge) => e.isSynthetic === true).forEach((e: Edge) => {
                e.hide()
            })

            // Show actual edges
            currentNode.children.forEach((child: Node) => {
                console.log(child.getEdgesIn());
                child.getEdgesIn()
                    .filter((e: Edge) => !currentNode.children.includes(e.from)) // Edges are already drawn in the subgraph
                    .forEach((e: Edge) => {
                        e.show()
                    })
            })
        } else {
            const currentNode = node._original_object ?? node
            currentNode.getEdgesIn().filter((e: Edge) => e.isSynthetic === true).forEach((e: Edge) => {
                if (node.visible) {
                    e.show()
                }
            })

            // Hide nested edges
            ClusterDrawer.hideNestedEdges(currentNode)
        }
    }

    private static hideNestedEdges(node: Node) {
        node.children.forEach((child: Node) => {
            ClusterDrawer.hideNestedEdges(child)

            child.getEdgesIn()
                .filter((e: Edge) => !node.children.includes(e.from)) // Edges are already drawn in the subgraph
                .forEach((e: Edge) => {
                    e.hide()
                })
        })
    }

    public static collapseAllOpenedClusters(node: Node) {
        node.children.forEach((child: Node) => {
            ClusterDrawer.collapseAllOpenedClusters(child)
            child.collapse()
            // At that point, all children should also be collapsed
            child.setCircleRadius(child.getCircleRadiusCollapsed()) 
        })
    }

    /**
     * 
     * @param graph 
     * @param node 
     * @returns The calculated radius of the first node that expanded
     */
    public static updateToNewRadiusExpanded(graph: Graph, node: Node): number {
        const r = ClusterDrawer.getRadiusForClusterNode(node)
        if (!node.expanded) {
            node.setCircleRadiusCollapsed(node.getCircleRadius())
        }
        node.setCircleRadius(r)

        const parentGraph = graph.getParentGraph()
        if (parentGraph) { // We're in a subgraph, propagate change to upper graph
            const newParentRadius = ClusterDrawer.updateParentGraph(parentGraph, node, r)
            if (newParentRadius) {
                graph.simulation.getSimulation()
                    .force('link', null)
                    .force('constrainParent', forceConstrainParent<Node>(newParentRadius, 10))
            }

            if (parentGraph.getParentGraph() && node.parentNode) {
                ClusterDrawer.updateToNewRadiusExpanded(parentGraph, node.parentNode)
            }
        }

        return r
    }

    /**
     * 
     * @param graph 
     * @param node 
     * @returns The calculated radius of the first node that expanded
     */
    public static updateToNewRadiusCollapsed(node: Node, restoreR: boolean, graph?: Graph) {
        const newR = restoreR ? node.getCircleRadiusCollapsed() // Restore original radius before expansion
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

    public static getRadiusForClusterNode(node: Node): number {
        let r: number = 0
        if (!node.expanded) {
            r = node.getCircleRadius() + 4
        } else {
            const padding = 50
            const childPadding = 16
            // const totalRadius = node.children.reduce((sum, child) => sum + child.getCircleRadius() + childPadding, 0)
            const totalRadius = node.children.reduce((sum, child) => {
                const childRadius = child.getCircleRadius()
                return sum + childRadius + childPadding
            }, 0)
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
