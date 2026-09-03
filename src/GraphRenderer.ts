import type { Node } from './Node'
import type { Edge } from './Edge'
import type { Graph } from './Graph'
import type { EdgeStyle, GraphRendererOptions, NodeStyle } from './interfaces/RendererOptions'
import type { GraphInteractions } from './GraphInteractions'
import type { Point } from './utils/GeometryHelper'
import type { Note } from './Note'


export type ProgressType = 'simulation' | 'rendering' | 'done'

/** A rectangle in graph coordinates. */
export interface GraphBounds {
    x: number
    y: number
    width: number
    height: number
}

/**
 * One element a forecast has to *outline* because it is not on the canvas: where it
 * would land, and how big it would be.
 */
export interface ForecastNode {
    id: string
    x: number
    y: number
    /** The radius it was last drawn at, so the outline is the size of what returns. */
    radius: number
}

/** An edge a forecast outlines, as the two points it would run between. */
export interface ForecastEdge {
    id: string
    from: { x: number, y: number }
    to: { x: number, y: number }
}

/**
 * What an action would do to the canvas, ready to paint.
 *
 * A forecast leaves the graph exactly as it is — nothing dims, nothing moves — and
 * marks only what the action would change: what would go, what would be hidden, and
 * an outline of what would come back. That is the difference between a forecast and
 * {@link GraphRenderer.emphasiseElements}, which reads a set *out* of the canvas by
 * receding everything else.
 *
 * {@link GraphHistoryLike.preview} hands one over ready-made, which is how hovering
 * a history row shows what the click would do.
 */
export interface GraphForecast {
    /** Touched by the action and staying: ringed, otherwise left alone. */
    touching?: (Node | Edge)[]
    /** On their way out: still in place, drained. */
    removing?: (Node | Edge)[]
    /** Staying in the graph, but about to be hidden. */
    hiding?: Node[]
    /** Not on the canvas at all — drawn as an outline where it would land. */
    arriving?: { nodes: ForecastNode[], edges: ForecastEdge[] }
}

/**
 * Where to point the view. `x` / `y` is the graph-space point to put in the middle
 * of the canvas.
 */
export interface ViewportTarget {
    x: number
    y: number
    /** Absolute zoom scale. @default the current scale */
    scale?: number
    /** Animate the move rather than jumping. @default false */
    animate?: boolean
}

export abstract class GraphRenderer {
    protected graph: Graph
    protected container: HTMLElement
    protected options: Partial<GraphRendererOptions>
    protected layoutProgress = 0
    protected layoutProgressType: ProgressType = 'done'
    protected progressBar: HTMLDivElement | null = null
    protected timerLabel: HTMLSpanElement | null = null
    protected textLabel: HTMLSpanElement | null = null
    protected loadingPb: HTMLDivElement | null = null

    constructor(graph: Graph, container: HTMLElement, options: Partial<GraphRendererOptions>) {
        this.graph = graph
        this.container = container
        this.options = options
    }

    abstract init(): void
    abstract update(dataChanged: boolean): void
    abstract getNodeStyle(node: Node): NodeStyle
    abstract getEdgeStyle(edge: Edge): EdgeStyle
    abstract getOptions(): GraphRendererOptions
    abstract nextTick(): void
    abstract nextTickFor(nodes: Node[]): void
    abstract getZoomBehavior(): unknown
    abstract screenToGraphCoordinates(screenX: number, screenY: number): Point
    abstract graphToScreenCoordinates(graphX: number, graphY: number): Point
    abstract toggleLassoMode(enabled: boolean): void
    abstract getClosestElementToCursor(maxDistance?: number): Node | Edge | Note | null
    abstract getNodeClosestToCursor(maxDistance?: number): Node | null
    abstract getSelectionBox(): AbstractSelectionBox | null
    abstract getGraphInteraction(): GraphInteractions<unknown>
    abstract getCanvasSelection(): unknown
    abstract getZoomGroup(): HTMLElement | SVGElement | null
    abstract zoomIn(): void
    abstract zoomOut(): void
    abstract fitAndCenter(forceScale?: number): void
    abstract getContentBounds(): GraphBounds | null
    abstract setViewport(target: ViewportTarget): void
    abstract focusElement(element: Node | Edge | Note): void
    abstract highlightElement(element: Node | Edge): void
    abstract unHighlightElement(element: Node | Edge): void
    abstract clearHighlightedElements(): void
    abstract emphasiseElements(elements: (Node | Edge)[]): void
    abstract clearEmphasis(): void
    abstract showForecast(forecast: GraphForecast): void
    abstract clearForecast(): void
    abstract showShadowEdge(params: { source: Node | Note, targetNode?: Node, targetPosition?: { x: number, y: number }, invalid?: boolean }): void
    abstract hideShadowEdge(): void
    abstract enterNoteEditMode(note: Note): void

    /**
     * Fit-and-centre once the content has stopped resizing. Renderers that lay
     * out over several frames after the sim stops (e.g. expanded clusters)
     * override this to wait for a stable bbox; the default fits immediately.
     */
    public fitAndCenterWhenSettled(forceScale?: number): void {
        this.fitAndCenter(forceScale)
    }

    /**
     * Release renderer-owned resources (observers, listeners) on teardown.
     * No-op by default; renderers that hold such resources override this.
     */
    public destroy(): void {}

    public getCanvas(): HTMLElement {
        return this.container.querySelector('.pvt-canvas') as HTMLElement
    }

    /**
     * The graph's root container — everything, chrome included. Deliberately distinct
     * from {@link getCanvas}: the canvas shrinks whenever chrome opens (a sidebar, the
     * data dock), the container only changes when the page around it does. Anything
     * that must not react to chrome measures this instead.
     */
    public getRootContainer(): HTMLElement {
        return this.container
    }

    public updateLayoutProgress(progress: number, elapsedTime: number, progressType: ProgressType): void {
        this.layoutProgress = progress
        this.layoutProgressType = progressType
        if (!this.progressBar || !this.timerLabel || !this.textLabel) return

        this.progressBar.style.width = `${progress * 100}%`
        this.timerLabel.textContent = `Elapsed time: ${(elapsedTime / 1000).toFixed(1)} sec`
        if (this.layoutProgressType === 'simulation') {
            this.textLabel.textContent = 'Optimizing node positions...'
        } else if (this.layoutProgressType === 'rendering') {
            this.progressBar.style.width = '100%'
            this.textLabel.textContent = 'Rendering in progress'
        } else if (this.layoutProgressType === 'done') {
            this.progressBar.style.width = '100%'
            this.timerLabel.textContent = 'All done'
        }
        this.toggleLayoutProgressVisibility()
    }

    protected toggleLayoutProgressVisibility(): void {
        const zoomGroup = this.getZoomGroup()
        if (zoomGroup) {
            zoomGroup.classList.toggle('hidden', this.layoutProgressType !== 'done')
        }
        if (this.loadingPb) {
            this.loadingPb.classList.toggle('hidden', this.layoutProgressType === 'done')
        }
    }

    public setupRendering(): void {
        this.createHtmlProgressBar()
    }

    protected createHtmlProgressBar(): void {
        const canvas = this.getCanvas()
        if (!canvas)
            throw new Error('Canvas element is not defined in the graph renderer.')

        const loadingPb = document.createElement('div')
        loadingPb.classList.add('pvt-loading-progress-bar')
        loadingPb.style.position = 'absolute'
        loadingPb.style.left = '50%'
        loadingPb.style.top = '50%'
        loadingPb.style.transform = 'translate(-50%, -50%)'

        const bg = document.createElement('div')
        bg.classList.add('background')
        bg.style.width = '100%'

        const track = document.createElement('div')
        track.classList.add('track')
        bg.style.width = '100%'

        const progressFill = document.createElement('div')
        progressFill.classList.add('fill')
        progressFill.style.width = '0px'

        const textLabel = document.createElement('span')
        textLabel.classList.add('label')
        textLabel.textContent = 'Optimizing node positions...'

        const timerLabel = document.createElement('span')
        timerLabel.classList.add('label')
        timerLabel.textContent = 'Elapsed time: 0 sec'

        track.appendChild(progressFill)
        bg.appendChild(track)
        loadingPb.append(bg, textLabel, timerLabel)
        canvas.appendChild(loadingPb)

        this.progressBar = progressFill
        this.timerLabel = timerLabel
        this.textLabel = textLabel
        this.loadingPb = loadingPb
    }
}


export abstract class AbstractSelectionBox {
    abstract selectionInProgress(): boolean
}