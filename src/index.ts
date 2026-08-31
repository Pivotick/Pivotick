import { Graph } from './Graph'
import { Node } from './Node'
import { Edge } from './Edge'
import { ColorPaletteMapper } from './plugins/colors/ColorPaletteMapper'
import { UIComponent } from './ui/UIComponent'
import { Flyout } from './ui/elements/Flyout/Flyout'
import { minimap } from './plugins/minimap'
import { tableColumns } from './ui/elements/Table/TableColumns'
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
Graph.Flyout = Flyout
// @ts-expect-error Make usage of browser build easier
Graph.minimap = minimap
// @ts-expect-error Make usage of browser build easier
Graph.tableColumns = tableColumns

// export default Graph

// Named exports (still available for modular imports)
export { Graph as Pivotick, Node, Edge, ColorPaletteMapper, UIComponent, Flyout, minimap, tableColumns }
export type { UIPhase } from './ui/UIComponent'
export type { PivotickPlugin, PluginContext } from './interfaces/Plugin'
export type { MinimapOptions, MinimapPosition } from './plugins/minimap'
export type { GraphBounds, ViewportTarget } from './GraphRenderer'
export type { TableOptions, TableColumn, TableTab, TableSortDirection, TableExportFormat } from './interfaces/GraphUI'
export type { DockTab, DockTabHandle } from './interfaces/GraphUI'
export type { RailModeDefinition, RailTool } from './interfaces/GraphUI'
export type { RailMode, RailModeKind, ModeState } from './ui/ModeStore'
export type { TableVisibility } from './ui/elements/Table/TableColumns'
export type { NodeBorderBox } from './Node'