import type { Graph } from '../Graph'
import type { GraphRenderer } from '../GraphRenderer'
import { GraphSvgRenderer } from './svg/GraphSvgRenderer'

export type RendererType = 'svg' | 'canvas'
import type { GraphSvgRendererOptions } from '../GraphOptions'

export function createGraphRenderer(
  type: RendererType,
  graph: Graph,
  container: HTMLElement,
  options: Partial<GraphSvgRendererOptions>
): GraphRenderer {
    if (type === 'svg') {
        return new GraphSvgRenderer(graph, container, options)
    } else {
        throw new Error(`${type} renderer is not implemented yet.`)
    }
  }