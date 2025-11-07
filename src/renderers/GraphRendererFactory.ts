import type { Graph } from '../Graph'
import type { GraphRenderer } from '../GraphRenderer'
import { GraphSvgRenderer } from './svg/GraphSvgRenderer'
import { GraphCanvasRenderer } from './canvas/GraphCanvasRenderer'
import type { GraphRendererOptions } from '../interfaces/RendererOptions'
import { GraphInteractions } from '../GraphInteractions'



export function createGraphRenderer(
  graph: Graph,
  container: HTMLElement,
  options: Partial<GraphRendererOptions>
): GraphRenderer {
    const type = options.type ?? 'svg'
    let renderer
    if (type === 'svg') {
        const graphInteraction = new GraphInteractions<SVGGElement | SVGPathElement>(graph)
        renderer = new GraphSvgRenderer(graph, container, graphInteraction, options)
    } else if (type === 'canvas') {
        const graphInteraction = new GraphInteractions<CanvasRenderingContext2D>(graph)
        renderer = new GraphCanvasRenderer(graph, container, graphInteraction, options)
    } else {
        throw new Error(`\`${type}\` renderer is not implemented yet.`)
    }
    return renderer as GraphRenderer
  }