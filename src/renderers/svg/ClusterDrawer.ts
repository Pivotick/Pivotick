import { select as d3Select, type Selection } from 'd3-selection'
import { Node } from '../../Node'
import type { GraphRendererOptions } from '../../interfaces/RendererOptions'
import { NodeDrawer } from './NodeDrawer'
import { simulateChildrenInsideParent } from '../../plugins/layout/MicroForce'

export class ClusterDrawer {

    private renderCB?: GraphRendererOptions['renderCluster']

    public nodeDrawer: NodeDrawer

    public constructor(nodeDrawer: NodeDrawer) {
        this.nodeDrawer = nodeDrawer
        this.renderCB = this.nodeDrawer.rendererOptions?.renderNode
    }

    public render(theClusterSelection: Selection<SVGGElement, Node, null, undefined>, node: Node, cb: () => void): Selection<SVGCircleElement, Node, null, undefined> {
        let cluster = theClusterSelection.select<SVGCircleElement>('.parent-bubble')

        if (cluster.empty()) {
            cluster = theClusterSelection.append('circle')
                .classed('parent-bubble', true)
                .lower()
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

            const childGroup = theClusterSelection.selectAll<SVGGElement, Node>('.pvt-child-node')
                .data(node.children, d => d.id)
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

            childGroup.style('opacity', 0)
                .transition().duration(200).style('opacity', 1)

            simulateChildrenInsideParent(
                childGroup,
                node.children,
                node.x ?? 0,
                node.y ?? 0,
                node.getCircleRadius(),
                {
                    repulsion: -15,
                    iterations: 8,
                    parentPadding: 8
                }
            )
        }

        if (cb) {
            requestAnimationFrame(() => {
                cb()
            })
        }

        return cluster

    }
}
