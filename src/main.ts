import { Pivotick, Node, Edge } from './index'

/**
 * Example of creating a graph instance and adding nodes/edges.
 * This is just a simple demo usage; your users will build on this.
 */
export function createSampleGraph(): Pivotick {
    const container = document.getElementById('app')!
    const graph = new Pivotick(container, {
        width: 600,
        height: 400,
        autoResize: true,
        callbacks: {
            onNodeSelect: (nodeId) => console.log(`Node selected: ${nodeId}`),
        },
        render: {
            // renderNode: (node: Node, nodeSelection: d3.Selection<SVGCircleElement, Node, null, undefined>): HTMLElement | string | void => {
            //     nodeSelection
            //         .attr("r", 10)
            //         .attr("fill", '#907acc')
            // }
            // renderEdge: (edge: Edge, edgeSelection: d3.Selection<SVGLineElement, Edge, null, undefined>): HTMLElement | string | void => {
            //     edgeSelection
            //         .attr("stroke", "#a07")
            //         .attr("stroke-opacity", 0.8)
            //         .attr("stroke-width", 1)
            // },
        }
    })

    const nodeA = new Node('A', { label: 'Node A' })
    const nodeB = new Node('B', { label: 'Node B' })
    const nodeC = new Node('C', { label: 'Node C' })

    graph.addNode(nodeA)
    graph.addNode(nodeB)
    graph.addNode(nodeC)

    const edgeAB = new Edge('AB', nodeA, nodeB, { relation: 'connects to' })
    const edgeBC = new Edge('BC', nodeB, nodeC, { relation: 'connects to' })

    graph.addEdge(edgeAB)
    graph.addEdge(edgeBC)

    // let counter = 1;
    // setInterval(() => {
    //     addRandomNode(++counter, graph)
    // }, 1000);

    // const N = 300;
    // const nodes = [...Array(N).keys()].map(i => (new Node(i, { label: `Node ${i}` })))
    // const edges = [...Array(N).keys()]
    //     .filter(id => id)
    //     .map(id => {
    //         const source = nodes[id]
    //         const target = nodes[Math.round(Math.random() * (id - 1))]
    //         return new Edge(`${id}-${target}`, source, target, { relation: 'connects to' })
    //     })
    // graph.graphData(nodes, edges)

    return graph
}

function addRandomNode(counter: number, graph: Pivotick) {
    const newNode = new Node(`N${Date.now()}ID${counter}`, { label: `Node ${counter}` })

    const existingNodes = graph.getNodes()
    const randomNode = existingNodes[Math.floor(Math.random() * existingNodes.length)]

    const newEdge = new Edge(`E${Date.now()}ID${counter}`, randomNode, newNode, { relation: 'auto-linked' })

    graph.addNode(newNode)
    graph.addEdge(newEdge)
}

createSampleGraph()