import { Graph } from './Graph'
import { Node } from './Node'
import { Edge } from './Edge'
import { ColorPaletteMapper } from './plugins/colors/ColorPaletteMapper'
import { UIComponent } from './ui/UIComponent'
import { minimap } from './plugins/minimap'
import './styles/style.scss'

// @ts-expect-error Make usage of browser build easier
Graph.Node = Node
// @ts-expect-error Make usage of browser build easier
Graph.Edge = Edge
// @ts-expect-error Make usage of browser build easier
Graph.ColorPaletteMapper = ColorPaletteMapper
// @ts-expect-error Make usage of browser build easier
Graph.UIComponent = UIComponent
// @ts-expect-error Make usage of browser build easier
Graph.minimap = minimap

// export default Graph

// Named exports (still available for modular imports)
export { Graph as Pivotick, Node, Edge, ColorPaletteMapper, UIComponent, minimap }
export type { UIPhase } from './ui/UIComponent'
export type { PivotickPlugin, PluginContext } from './interfaces/Plugin'
export type { MinimapOptions, MinimapPosition } from './plugins/minimap'
export type { GraphBounds, ViewportTarget } from './GraphRenderer'