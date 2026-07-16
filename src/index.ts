import { Graph } from './Graph'
import { Node } from './Node'
import { Edge } from './Edge'
import { ColorPaletteMapper } from './plugins/colors/ColorPaletteMapper'
import './styles/style.scss'

// @ts-expect-error Make usage of browser build easier
Graph.Node = Node
// @ts-expect-error Make usage of browser build easier
Graph.Edge = Edge
// @ts-expect-error Make usage of browser build easier
Graph.ColorPaletteMapper = ColorPaletteMapper

// export default Graph

// Named exports (still available for modular imports)
export { Graph as Pivotick, Node, Edge, ColorPaletteMapper }
export { UIComponent } from './ui/UIComponent'
export type { UIPhase } from './ui/UIComponent'
export type { PivotickPlugin, PluginContext } from './interfaces/Plugin'