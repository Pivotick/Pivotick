import { select as d3Select, type Selection } from 'd3-selection'
import { Node } from '../../Node'
import type { GraphRendererOptions } from '../../interfaces/RendererOptions'
import { NodeDrawer } from './NodeDrawer'
import { forceConstrainParent, simulateChildrenInsideParent } from '../../plugins/layout/MicroForce'
import { Edge } from '../../Edge'
import type { EdgeDrawer } from './EdgeDrawer'
import { Graph } from '../../Graph'
import type { GraphOptions, RawEdge, RawNode, RelaxedGraphData } from '../../interfaces/GraphOptions'
import { forceCenter, forceCollide, forceLink, forceManyBody } from 'd3-force'

export class ClusterDrawer {

    private renderCB?: GraphRendererOptions['renderCluster']

    public nodeDrawer: NodeDrawer
    public edgeDrawer?: EdgeDrawer

    public constructor(nodeDrawer: NodeDrawer) {
        this.nodeDrawer = nodeDrawer
        this.renderCB = this.nodeDrawer.rendererOptions?.renderNode
    }

    public render(theClusterSelection: Selection<SVGGElement, Node, null, undefined>, node: Node, cb: () => void): Selection<SVGCircleElement, Node, null, undefined> {
        if (!this.edgeDrawer) {
            this.edgeDrawer = this.nodeDrawer.graphSvgRenderer.edgeDrawer
        }

        let cluster = theClusterSelection.select<SVGCircleElement>('.parent-bubble')
        // let childrenNodeGroup = theClusterSelection.select<SVGGElement>('g.children-node-group')
        // let childrenEdgeGroup = theClusterSelection.select<SVGGElement>('g.children-edge-group')

        if (cluster.empty()) {
            cluster = theClusterSelection.append('circle')
                .classed('parent-bubble', true)
                .lower()
            // childrenNodeGroup = theClusterSelection.append('g')
            //     .classed('children-node-group', true)
            // childrenEdgeGroup = theClusterSelection.append('g')
            //     .classed('children-edge-group', true)
        }

        let r
        if (!node.expanded) {
            r = node.getCircleRadius() + 4
        } else {
            const padding = 20
            const childPadding = 8
            const totalRadius = node.children.reduce((sum, child) => sum + child.getCircleRadius() + childPadding, 0)
            const avgRadius = totalRadius / node.children.length
            const estimatedRadius = Math.sqrt(node.children.length) * (2 * avgRadius) + padding
    
            r = Math.max(50, estimatedRadius)
        }
        node.setCircleRadius(r)


        cluster
            .attr('r', 0)
            .attr('_final_r', r)
            .attr('cx', 0)
            .attr('cy', 0)
            .classed('pvt-cluster-area', true)

        if (node.expanded) {
            cluster.transition().duration(200).attr('r', r)

            const clonedChildren = node.children.map((n) => n.clone())

            const childrenEdges: Edge[] =
                node.children.flatMap(child => child.getEdgesOut() ?? [])
                .map((e) => new Edge(
                    e.id,
                    clonedChildren.filter(n => n.id === e.from.id)[0],
                    clonedChildren.filter(n => n.id === e.to.id)[0],
                    e.getData(),
                    e.getStyle(),
                    e.directed,
                    e.isSynthetic
                ))

            const subgraphContainer: SVGGElement = theClusterSelection.node() as SVGGElement
            const subgraph = this.createSubgraph(clonedChildren, childrenEdges, subgraphContainer, node, this.nodeDrawer.graph)
            node._subgraph = subgraph

            ClusterDrawer.toggleSyntheticEdges(node)

        }

        if (cb) {
            requestAnimationFrame(() => {
                cb()
            })
        }

        return cluster

    }

    public static toggleSyntheticEdges(node: Node): void {
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
        }
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
                warmupTicks: 0,
                cooldownTime: 0,
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
        const zoomLayer = tmpHtml.querySelector('.zoom-layer') as SVGGElement
        container.appendChild(zoomLayer)

        subgraph.getMutableNodes().forEach((n: Node) => {
            childrenProxy.set(n.id, n)
        })

        subgraph.on('ready', () => {
            subgraph.simulation.getSimulation()
                .force('link', null)
                .force('charge', null)
                .force('center', null)
                .force('collide', null)
                .force('gravity', null)
                .force('charge', forceManyBody().strength(-10))
                .force('collide', forceCollide<Node>().radius(d => (d.getCircleRadius?.() ?? 10) + 2))
                .force('center', forceCenter(0, 0))
                .force('link', forceLink<Node, Edge>())
                .force('constrainParent', forceConstrainParent<Node>(parentNode.getCircleRadius(), 10))
        })
        subgraph.renderer.getGraphInteraction().on('dragended', () => {
        })
        subgraph.renderer.getGraphInteraction().on('simulationTick', () => {
            subgraph.getMutableNodes().forEach((node: Node) => {
                const x = node.x ?? 0
                const y = node.y ?? 0
                this.updatePositionOnRealChild(x, y, node.id)
            })
        })

        mainGraph.renderer.getGraphInteraction().on('dragging', () => {
            mainGraph.getMutableNodes().filter((node) => node.isParent && node.expanded).forEach((node: Node) => {
                const children = node.children
                children.forEach((child: Node) => {
                    const childInSubgraph: Node | undefined = childrenProxy.get(child.id)
                    if (!childInSubgraph || !childInSubgraph.x || !childInSubgraph.y) return
                    this.updatePositionOnRealChild(childInSubgraph.x, childInSubgraph.y, child.id)
                })
            })
        })
        mainGraph.renderer.getGraphInteraction().on('canvasClick', () => {
            subgraph.deselectAll()
        })

        return subgraph
    }

    private updatePositionOnRealChild(x: number, y: number, id: string) {
        const realChild = this.nodeDrawer.graph.getMutableNode(id)
        const clusterNode = realChild?.parentNode
        if (realChild && clusterNode) {
            realChild.x = x + (clusterNode.x ?? 0)
            realChild.y = y + (clusterNode.y ?? 0)
            this.nodeDrawer.graph.renderer.nextTickFor([realChild])
        }
    }
}
