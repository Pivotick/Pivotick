import type { Graph } from './Graph'
import type { GraphRendererOptions } from './GraphOptions'
import { createSvgElement } from './utils/ElementCreation'

export type RendererType = 'svg' | 'canvas'

const PROGRESS_BAR_WIDTH = 200
const PROGRESS_BAR_HEIGHT = 8

export abstract class GraphRenderer {
    protected graph: Graph
    protected container: HTMLElement
    protected options: Partial<GraphRendererOptions>
    protected layoutProgress = 0
    protected progressBar: SVGRectElement | null = null

    constructor(graph: Graph, container: HTMLElement, options: Partial<GraphRendererOptions>) {
        this.graph = graph
        this.container = container
        this.options = options
    }

    abstract init(): void
    abstract dataUpdate(): void
    abstract tickUpdate(): void
    abstract getZoomBehavior(): any
    abstract getSelectionBox(): any
    abstract getGraphInteraction(): any
    abstract getCanvasSelection(): any
    abstract getZoomGroup(): any
    abstract zoomIn(): void
    abstract zoomOut(): void
    abstract fitAndCenter(): void

    public getCanvasContainer(): HTMLElement {
        return this.container.querySelector('.pivotick-canvas-container') as HTMLElement
    }

    public getCanvas(): HTMLElement {
        return this.container.querySelector('.pivotick-canvas') as HTMLElement
    }

    public updateLayoutProgress(progress: number): void {
        this.layoutProgress = progress
        if (this.progressBar) {
            this.progressBar.setAttribute('width', `${progress * PROGRESS_BAR_WIDTH}`)
            this.toggleLayoutProgressVisibility()
        }
    }

    protected toggleLayoutProgressVisibility(): void {
        const zoomGroup = this.getZoomGroup()
        if (zoomGroup) {
            zoomGroup.classList.toggle('hidden', this.layoutProgress < 1)
        }
        if (this.progressBar && this.progressBar.parentNode) {
            (this.progressBar.parentNode as SVGGElement).classList.toggle('hidden', this.layoutProgress >= 1)
        }
    }

    public setupRendering(): void {
        this.createSvgProgressBar()
    }

    protected createSvgProgressBar(): void {
        const canvas = this.getCanvas()
        if (!canvas)
            throw new Error('Canvas element is not defined in the graph renderer.')

        const bbox = canvas.getBoundingClientRect()
        const centerX = bbox.width / 2 - PROGRESS_BAR_WIDTH / 2
        const centerY = bbox.height / 2 - PROGRESS_BAR_HEIGHT / 2

        const bg = createSvgElement('rect', {
            class: 'background',
            width: PROGRESS_BAR_WIDTH + 2 * 10,
        })

        const track = createSvgElement('rect', {
            class: 'track',
            width: PROGRESS_BAR_WIDTH,
        })

        const progressFill = createSvgElement('rect', {
            class: 'fill',
            width: 0,
        })

        const textLabel = createSvgElement('text', {
            class: 'label',
            x: PROGRESS_BAR_WIDTH / 2,
            y: PROGRESS_BAR_HEIGHT + 20,
        })
        textLabel.textContent = 'Optimizing node positions...'

        const loadingPb = createSvgElement('g',
            {
                transform: `translate(${centerX}, ${centerY})`,
            },
            [bg, track, progressFill, textLabel]
        )
        loadingPb.classList.add('pivotick-loading-progress-bar')

        canvas.appendChild(loadingPb)
        this.progressBar = progressFill
    }
}
