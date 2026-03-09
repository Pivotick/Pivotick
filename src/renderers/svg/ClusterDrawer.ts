import { select as d3Select, type Selection } from 'd3-selection'
import { Node } from '../../Node'
import type { GraphRendererOptions } from '../../interfaces/RendererOptions'
import { NodeDrawer } from './NodeDrawer'
import { simulateChildrenInsideParent } from '../../plugins/layout/MicroForce'
import { Edge } from '../../Edge'
import type { EdgeDrawer } from './EdgeDrawer'

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
        let childrenNodeGroup = theClusterSelection.select<SVGGElement>('g.children-node-group')
        let childrenEdgeGroup = theClusterSelection.select<SVGGElement>('g.children-edge-group')

        if (cluster.empty()) {
            cluster = theClusterSelection.append('circle')
                .classed('parent-bubble', true)
                .lower()
            childrenNodeGroup = theClusterSelection.append('g')
                .classed('children-node-group', true)
            childrenEdgeGroup = theClusterSelection.append('g')
                .classed('children-edge-group', true)
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

            const childGroup = childrenNodeGroup.selectAll<SVGGElement, Node>('.pvt-child-node')
                .data(clonedChildren, d => d.id)
                .join(
                    enter => enter.append('g')
                        .classed('pvt-child-node', true)
                        .each((childNode: Node, i: number, nodes: ArrayLike<SVGGElement>) => {
                            childNode.clearDirty()
                            const selection = d3Select<SVGGElement, Node>(nodes[i])
                            selection.attr('id', `node-${childNode.domID}`)
                            this.nodeDrawer.render(selection, childNode)
                        }),
                    update => update.each((child: Node, j: number, elems) => {
                        const s = d3Select<SVGGElement, Node>(elems[j])
                        s.selectChildren().remove()
                        this.nodeDrawer.render(s, child)
                    }),
                    exit => exit.remove()
                )

            const edgeGroup = childrenEdgeGroup.selectAll<SVGPathElement, Edge>('g.pvt-child-edge')
                    .data(childrenEdges, (edge: Edge) => edge.id)
                    .join(
                        (enter) => enter
                            .append('g').classed('pvt-edge-group', true)
                            .each((edge: Edge, i: number, edges: ArrayLike<SVGGElement>) => {
                                edge.clearDirty()
                                const selection = d3Select<SVGGElement, Edge>(edges[i])
                                selection.attr('id', `edge-${edge.domID}`)
                                this.edgeDrawer!.render(selection, edge)
                            }),
                        update => update
                            .each((edge: Edge, i: number, edges: ArrayLike<SVGPathElement>) => {
                                if (edge.isDirty()) {
                                    edge.clearDirty()
                                    const selection = d3Select<SVGGElement, Edge>(edges[i])
                                    selection.selectChildren().remove()
                                    this.edgeDrawer!.render(selection, edge)
                                }
                            }),
                        exit => exit.remove()
                    )

            childGroup.style('opacity', 0)
                .transition().delay(50).duration(200).style('opacity', 1)
            edgeGroup.style('opacity', 0)
                .transition().delay(50).duration(200).style('opacity', 1)

            simulateChildrenInsideParent(
                childGroup,
                edgeGroup,
                clonedChildren,
                node.getCircleRadius(),
                {
                    repulsion: -15,
                    iterations: 8,
                    parentPadding: 8
                },
                this.edgeDrawer,
                this.nodeDrawer.graph
            )

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
}
