import type { Graph } from './Graph'
import type { GraphSvgRendererOptions } from './GraphOptions'
import { createSvgElement } from './utils/ElementCreation'

export type RendererType = 'svg' | 'canvas'

const PROGRESS_BAR_WIDTH = 200
const PROGRESS_BAR_HEIGHT = 8

export abstract class GraphRenderer {
    protected graph: Graph
    protected container: HTMLElement
    protected options: Partial<GraphSvgRendererOptions>
    protected layoutProgress = 0
    protected progressBar: SVGRectElement | null = null

    constructor(graph: Graph, container: HTMLElement, options: Partial<GraphSvgRendererOptions>) {
        this.graph = graph
        this.container = container
        this.options = options
    }

    abstract init(): void
    abstract update(): void
    abstract updatePositions(): void

    public getCanvas(): HTMLElement | undefined {
        return this.container?.firstChild as HTMLElement
    }

    public updateLayoutProgress(progress: number): void {
        this.layoutProgress = progress
        if (this.progressBar) {
            this.progressBar.setAttribute('width', `${progress * PROGRESS_BAR_WIDTH}px`)
            this.toggleLayoutProgressVisibility()
        }
    }

    protected toggleLayoutProgressVisibility(): void {
        if (this.progressBar && this.progressBar.parentNode) {
            (this.progressBar.parentNode as Element).setAttribute(
                'visibility',
                this.layoutProgress >= 0 && this.layoutProgress < 1 ? 'visible' : 'hidden'
            )
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

        const track = createSvgElement('rect', {
            width: PROGRESS_BAR_WIDTH,
            height: PROGRESS_BAR_HEIGHT,
            fill: '#e0e0e0',
            rx: 4,
            ry: 4,
        })

        const progressFill = createSvgElement('rect', {
            width: 0,
            height: PROGRESS_BAR_HEIGHT,
            fill: '#3f51b5',
            rx: 4,
            ry: 4,
        })

        const textLabel = createSvgElement('text', {
            x: PROGRESS_BAR_WIDTH / 2,
            y: PROGRESS_BAR_HEIGHT + 16,
            'text-anchor': 'middle',
            'font-size': 12,
            fill: '#555',
        })
        textLabel.textContent = 'Optimizing node positions...'

        const loadingPb = createSvgElement('g',
            {
                transform: `translate(${centerX}, ${centerY})`,
                visibility: 'hidden',
            },
            [track, progressFill, textLabel]
        )
        loadingPb.classList.add('loading-progress-bar')

        canvas.appendChild(loadingPb)
        this.progressBar = progressFill
    }
}
