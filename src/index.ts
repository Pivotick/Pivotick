import { Graph } from './Graph'
import { Node } from './Node'
import { Edge } from './Edge'
import './styles/style.scss'

// @ts-expect-error Make usage of browser build easier
Graph.Node = Node
// @ts-expect-error Make usage of browser build easier
Graph.Edge = Edge

export default Graph

// Named exports (still available for modular imports)
export { Graph as Pivotick, Node, Edge }