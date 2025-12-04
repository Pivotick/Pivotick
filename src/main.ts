/* eslint-disable */
// @ts-nocheck
import { Pivotick, Node, Edge } from './index'

import {graph as vtGraph} from './vt-graph'
import { graph as ailGraph } from './ail-graph'


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


    // const N = 63
    const N = 6
    const createNodes = (): Node[] => {
        return Array.from({ length: N }, (_, i) => new Node(`n${i + 1}`, { label: `Node ${i}`, type: 'node'}))
    }
    const topologies = {
        custom: (() => {
            const nodes = [...Array(N).keys()].map(i => (
                new Node(i.toString(),
                    {
                        label: `Node ${i}`,
                        type: Math.random() < 0.8 ? 'leaf' : 'hub',
                    },
                    {
                        // iconUnicode: `\uf007`,
                        // iconClass: `fa-solid fa-user`,
                        svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 14h1v-1.5H19v-1h-1.5V10h-1v1.5H15v1h1.5zM11 15h1.5v-2.25L14.25 15h1.825l-2.325-3l2.325-3H14.25l-1.75 2.25V9H11zm-5 0h4v-3.5H7.5v-1H10V9H6v3.5h2.5v1H6zm-3 6V3h18v18zm2-2h14V5H5zm0 0V5z" /></svg>',
                        // imagePath: '/vite.svg'
                    }
                )
            ))
            const edges = [...Array(N).keys()]
                .filter(id => id)
                .map(id => {
                    const source = nodes[id]
                    const target = nodes[Math.round(Math.random() * (id - 1))]
                    return new Edge(`${id}-${target.id}`, source, target, { label: 'connected-to', mstart: Math.random() < 0.5 ? 'circle' : 'diamond', mend: Math.random() < 0.5 ? 'arrow' : 'circle', data: '' }, { edge: { dashed: Math.random() < 0.5 }})
                })
            if (!nodes[0] || !nodes[1] || !nodes[2]) {
                return { nodes, edges }
            }
            // edges = []
            edges.push(new Edge('0-0', nodes[0], nodes[0], { label : 'self-loop'}))
            // edges.push(new Edge('a-b', nodes[3], nodes[2], { label : 'a'}))
            // edges.push(new Edge('b-a', nodes[2], nodes[3], { label : 'b'}))
            edges.push(new Edge('0-1', nodes[0], nodes[1], { label : 'A'}, {label: {backgroundColor: '#ff0044', color: '#fff'}}))
            edges.push(new Edge('1-2', nodes[1], nodes[2], { label: 'a' }, {label: {backgroundColor: '#ff0044', color: '#fff'}}))
            // edges.push(new Edge('1-0', nodes[1], nodes[0], { label : 'b'}))

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

        vt: (() => {
            const nodes = vtGraph.nodes.map(n => new Node(n.entity_id, {
                label: n.text,
                type: n.type,
                ...n.entity_attributes
            }))
            const edges = []
            for (let i = 0; i < vtGraph.links.length - 1; i++) {
                const e = vtGraph.links[i]
                edges.push(new Edge(`e${i}`, nodes.find(n => n.id === e.source)!, nodes.find(n => n.id === e.target)!, {
                    label: e.connection_type || '?'
                }, {}))
            }
            return { nodes, edges }
        })(),

        ail: (() => {
            const nodes = ailGraph.nodes.map(n => new Node(n.id, {
                label: n.text,
                custom_field: Math.random() < 0.5 ? 'fusion' : 'fission',
                useless_field: '',
                ...n
            }, {
                ...n.style,
                textColor: '#000',
                iconClass: n.style.icon_class,
                iconUnicode: n.style.icon,
            }))
            const edges = []
            for (let i = 0; i < ailGraph.links.length - 1; i++) {
                const e = ailGraph.links[i]
                edges.push(new Edge(`e${i}`, nodes.find(n => n.id === e.source)!, nodes.find(n => n.id === e.target)!, {
                    label: e.relationship || '?'
                }, {}))
            }
            return { nodes, edges }
        })(),

        ail_reversed: (() => {
            const nodes = ailGraph.nodes.map(n => new Node(n.id, {
                label: n.text,
                custom_field: Math.random() < 0.5 ? 'fusion' : 'fission',
                useless_field: '',
                ...n
            }, {
                ...n.style,
                textColor: '#000',
                iconClass: n.style.icon_class,
                iconUnicode: n.style.icon,
            }))
            const edges = []
            for (let i = 0; i < ailGraph.links.length - 1; i++) {
                const e = ailGraph.links[i]
                edges.push(new Edge(`e${i}`, nodes.find(n => n.id === e.target)!, nodes.find(n => n.id === e.source)!, {
                    label: e.relationship || '?'
                }, {}))
            }
            return { nodes, edges }
        })(),

    }

    const topo = 'random'

    const graph = new Pivotick(container, {nodes: topologies[topo].nodes, edges: topologies[topo].edges}, {
        // isDirected: false,
        simulation: {
            // warmupTicks: 5000,
            // d3ManyBodyStrength: -500,
            // d3LinkStrength: 0.1,
            d3LinkDistance: 90,
        },
        layout: {
            // type: 'tree',
            // radial: true
        },
        callbacks: {
            // onNodeClick: (e, node) => console.log(`onNodeClick: ${node.id}`),
            // onNodeDbclick: (e, node) => console.log(`onNodeDbclick: ${node.id}`),
            // onNodeSelect: (node) => console.log(`onNodeSelect: ${node.id}`),
            // onNodeBlur: (node) => console.log(`onNodeBlur: ${node.id}`),
            // onEdgeSelect: (edge) => console.log(`onEdgeSelect: ${edge.id}`),
            // onEdgeBlur: (edge) => console.log(`onEdgeBlur: ${edge.id}`),
            // onNodeHoverIn: (e, node) => console.log(`nodeHoverIn: ${node.id}`),
            // onNodeHoverOut: (e, node) => console.log(`nodeHoverOut: ${node.id}`),
            // onNodeExpansion: (e, node) => console.log(`nodeExpansion: ${node.id}`),
            // onEdgeClick: (e, edge) => console.log(`onEdgeClick: ${edge.id}`),
        },
        render: {
            type: 'svg',
            nodeTypeAccessor: (node: Node) => node.getData()?.type,
            nodeStyleMap: {
                'hub': { shape: 'hexagon', color: '#aaa', size: 30 },
                // 'leaf': { shape: 'triangle', color: '#f00' },
            },
            // defaultNodeStyle: {
            //     shape: 'hexagon',
            //     color: '#aa33aa33',
            //     strokeColor: '#ffffff33',
            //     size: 20,
            // }
            defaultEdgeStyle: {
                markerStart: (edge: Edge) => edge.getData().mstart,
                markerEnd: (edge: Edge) => edge.getData().mend,
                // curveStyle: 'bidirectional',
            },
            markerStyleMap: {
                'diamond': {
                    fill: '#44c77f',
                }
            },
            // renderNode: (node: Node): HTMLElement | string | void => {
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
            // renderLabel: (edge: Edge): HTMLElement | string | void => {
            //         const style = [
            //             'display:inline-block',
            //             'background-color:#907acc',
            //             'border: 2px solid #fff',
            //             'border-radius:50%',
            //             'opacity: 1',
            //         ].join(';')
            //         const text = edge.getData().label

            //         // return `<span style="${style}">${text}</span>`
            // },
        },
        UI: {
            mode: 'static',
            // mainHeader: {
            //     // nodeHeaderMap: {
            //     //     subtitle: (node: Node | Edge) => node.getData().type,
            //     // },
            //     render: (element) => {
            //         const div = document.createElement('div')
            //         div.textContent = 'Main Header Container'
            //         div.style.fontWeight = 'bold'
            //         return div 
            //     }
            // },
            // propertiesPanel: {
            //     render: (element) => {
            //         const div = document.createElement('div')
            //         div.textContent = 'Properties Panel Container'
            //         div.style.fontWeight = 'bold'
            //         return div
            //     }
            // },
            // extraPanels: [
            //     {
            //         title: "Extra panel #1",
            //         render: (node: Node): HTMLElement => {
            //             const div = document.createElement('div')
            //             div.textContent = 'Extra Panel Container'
            //             div.style.fontWeight = 'bold'
            //             return div
            //         },
            //     }
            // ]
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
window.pivotick = graph
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