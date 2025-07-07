import { Pivotick, Node, Edge } from './index'

/**
 * Example of creating a graph instance and adding nodes/edges.
 * This is just a simple demo usage; your users will build on this.
 */
export function createSampleGraph(): Pivotick {
    const container = document.getElementById('app')!

    // const N = 10
    // const nodes = [...Array(N).keys()].map(i => (
    //     new Node(i.toString(),
    //         {
    //             label: `Node ${i}`,
    //             type: Math.random() < 0.8 ? 'leaf' : 'hub'
    //         },
    //         {
    //         }
    //     )
    // ))
    // const edges = [...Array(N).keys()]
    //     .filter(id => id)
    //     .map(id => {
    //         const source = nodes[id]
    //         const target = nodes[Math.round(Math.random() * (id - 1))]
    //         return new Edge(`${id}-${target.id}`, source, target, { relation: 'connects to' })
    //     })
    // const edges = []
    // edges.push(new Edge('0-0', nodes[0], nodes[0], { relation : 'self-loop'}))
    // edges.push(new Edge('a-b', nodes[3], nodes[2], { relation : 'a'}))
    // edges.push(new Edge('b-a', nodes[2], nodes[3], { relation : 'b'}))
    // edges.push(new Edge('0-1', nodes[0], nodes[1], { relation : 'a'}))
    // edges.push(new Edge('1-0', nodes[1], nodes[0], { relation : 'b'}))


    const N = 5
    const createNodes = (): Node[] => {
        return Array.from({ length: N }, (_, i) => new Node(`n${i + 1}`))
    }
    const topologies = {
        custom: (() => {
            const nodes = [...Array(N).keys()].map(i => (
                new Node(i.toString(),
                    {
                        label: `Node ${i}`,
                        type: Math.random() < 0.8 ? 'leaf' : 'hub'
                    },
                    {
                    }
                )
            ))
            const edges = [...Array(N).keys()]
                .filter(id => id)
                .map(id => {
                    const source = nodes[id]
                    const target = nodes[Math.round(Math.random() * (id - 1))]
                    return new Edge(`${id}-${target.id}`, source, target, { relation: 'connects to' })
                })
            // edges = []
            edges.push(new Edge('0-0', nodes[0], nodes[0], { relation : 'self-loop'}))
            edges.push(new Edge('a-b', nodes[3], nodes[2], { relation : 'a'}))
            edges.push(new Edge('b-a', nodes[2], nodes[3], { relation : 'b'}))
            edges.push(new Edge('0-1', nodes[0], nodes[1], { relation : 'a'}))
            edges.push(new Edge('1-0', nodes[1], nodes[0], { relation : 'b'}))

            return { nodes, edges }
        })(),
        tree: (() => {
            const nodes = createNodes()
            const edges: Edge[] = []

            for (let i = 0; i < nodes.length/2; i++) {
                const left = 2 * i + 1
                const right = 2 * i + 2
                if (left < nodes.length) edges.push(new Edge(`e${edges.length}`, nodes[i], nodes[left], {}, {}, true))
                if (right < nodes.length) edges.push(new Edge(`e${edges.length}`, nodes[i], nodes[right], {}, {}, true))
            }

            return { nodes, edges }
        })(),

        ring: (() => {
            const nodes = createNodes()
            const edges: Edge[] = []

            for (let i = 0; i < nodes.length; i++) {
                const next = (i + 1) % nodes.length
                edges.push(new Edge(`e${i}`, nodes[i], nodes[next], {}, {}, true))
            }

            return { nodes, edges }
        })(),

        star: (() => {
            const nodes = createNodes()
            const edges: Edge[] = []

            const center = nodes[0]
            for (let i = 1; i < nodes.length; i++) {
                edges.push(new Edge(`e${i}`, center, nodes[i], {}, {}, true))
            }

            return { nodes, edges }
        })(),

        mesh: (() => {
            const nodes = createNodes()
            const edges: Edge[] = []

            let edgeId = 0
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    edges.push(new Edge(`e${edgeId++}`, nodes[i], nodes[j], {}, {}, true))
                    edges.push(new Edge(`e${edgeId++}`, nodes[j], nodes[i], {}, {}, true))
                }
            }

            return { nodes, edges }
        })(),

        line: (() => {
            const nodes = createNodes()
            const edges: Edge[] = []

            for (let i = 0; i < nodes.length - 1; i++) {
                edges.push(new Edge(`e${i}`, nodes[i], nodes[i + 1], {}, {}, true))
            }

            return { nodes, edges }
        })(),

        random: (() => {
            const nodes = createNodes()
            const edges: Edge[] = []
            const edgeSet = new Set<string>()

            const getEdgeKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`

            while (edges.length < nodes.length*2) {
                const from = Math.floor(Math.random() * nodes.length)
                const to = Math.floor(Math.random() * nodes.length)
                if (from === to) continue

                const key = getEdgeKey(from, to)
                if (!edgeSet.has(key)) {
                    edgeSet.add(key)
                    edges.push(new Edge(`e${edges.length}`, nodes[from], nodes[to], {}, {}, true))
                }
            }

            return { nodes, edges }
        })(),
    }

    const topo = 'custom'
    const graph = new Pivotick(container, {nodes: topologies[topo].nodes, edges: topologies[topo].edges}, {
        // isDirected: false,
        simulation: {
            // warmupTicks: 5000,
            // d3ManyBodyStrength: -500,
            // d3LinkStrength: 0.1,
            // d3LinkDistance: 50,
        },
        layout: {
            // type: 'tree',
            // radial: true
        },
        callbacks: {
            // onNodeClick: (e, node) => console.log(`onNodeClick: ${node.id}`),
            // onNodeDbclick: (e, node) => console.log(`onNodeDbclick: ${node.id}`),
            onNodeSelect: (node) => console.log(`onNodeSelect: ${node.id}`),
            onNodeBlur: (node) => console.log(`onNodeBlur: ${node.id}`),
            onEdgeSelect: (edge) => console.log(`onEdgeSelect: ${edge.id}`),
            onEdgeBlur: (edge) => console.log(`onEdgeBlur: ${edge.id}`),
            // onNodeHoverIn: (e, node) => console.log(`nodeHoverIn: ${node.id}`),
            // onNodeHoverOut: (e, node) => console.log(`nodeHoverOut: ${node.id}`),
            // onNodeExpansion: (e, node) => console.log(`nodeExpansion: ${node.id}`),
            // onEdgeClick: (e, edge) => console.log(`onEdgeClick: ${edge.id}`),
        },
        render: {
            type: 'svg',
            // nodeTypeAccessor: (node: Node) => node.getData()?.type,
            // nodeStyleMap: {
            //     'hub': { shape: 'hexagon', color: '#aaa', size: 30 },
            //     'leaf': { shape: 'triangle', color: '#f00' },
            // },
            // defaultNodeStyle: {
            //     // shape: 'hexagon'
            //     color: '#aaaaaa33',
            //     strokeColor: '#ffffff33',
            // }
            // defaultEdgeStyle: {
            //     curveStyle: 'bidirectional',
            // }
            // renderNode: (node: Node, nodeSelection: d3.Selection<SVGForeignObjectElement, Node, null, undefined>): HTMLElement | string | void => {
            //     const size = 12
            //     const style = [
            //         'display:block',
            //         `width:${size}px`,
            //         `height:${size}px`,
            //         'background-color:#907acc',
            //         'border: 2px solid #fff',
            //         'border-radius:50%',
            //         'opacity: 1',
            //     ].join(';')

            //     return `<span style="${style}"></span>`
            // }
            // renderEdge: (edge: Edge, edgeSelection: d3.Selection<SVGPathElement, Edge, null, undefined>): HTMLElement | string | void => {
            //     edgeSelection
            //         .attr("stroke", "#a07")
            //         .attr("stroke-opacity", 0.8)
            //         .attr("stroke-width", 1)
            // },
        }
    })
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

const graph = createSampleGraph()
// let counter = 0
// setInterval(() => {
//     addRandomNode(counter, graph)
//     counter++
// }, 1000)

// setInterval(() => {
//     const randomNode = graph.getNodes()[Math.floor(Math.random() * graph.getNodes().length)]
//     randomNode.setData({type: 'circle'})
//     graph.updateData([randomNode])

//     // const firstNode = graph.getNodes()[0]
//     // firstNode.setData({ type: 'circle' })
//     // graph.updateData([firstNode])
//     // console.log(graph.getNodes()[0].getData())
    
// }, 1000)