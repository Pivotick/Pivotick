import type { Node } from './Node'
import type { Edge } from './Edge'
import type { Graph } from './Graph'
import type { GraphRendererOptions } from './interfaces/RendererOptions'
import type { GraphInteractions } from './GraphInteractions'


export abstract class GraphRenderer {
    protected graph: Graph
    protected container: HTMLElement
    protected options: Partial<GraphRendererOptions>
    protected layoutProgress = 0
    protected progressBar: HTMLDivElement | null = null
    protected timerLabel: HTMLSpanElement | null = null
    protected loadingPb: HTMLDivElement | null = null

    constructor(graph: Graph, container: HTMLElement, options: Partial<GraphRendererOptions>) {
        this.graph = graph
        this.container = container
        this.options = options
    }

    abstract init(): void
    abstract update(dataChanged: boolean): void
    abstract nextTick(): void
    abstract getZoomBehavior(): unknown
    abstract getSelectionBox(): AbstractSelectionBox | null
    abstract getGraphInteraction(): GraphInteractions<unknown>
    abstract getCanvasSelection(): unknown
    abstract getZoomGroup(): HTMLElement | SVGElement | null
    abstract zoomIn(): void
    abstract zoomOut(): void
    abstract fitAndCenter(fitAndCenter?: number): void
    abstract focusElement(element: Node | Edge): void

    public getCanvas(): HTMLElement {
        return this.container.querySelector('.pvt-canvas') as HTMLElement
    }

    public updateLayoutProgress(progress: number, elapsedTime: number): void {
        this.layoutProgress = progress
        if (this.progressBar && this.timerLabel) {
            this.progressBar.style.width = `${progress * 100}%`
            this.timerLabel.textContent = `Elapsed time: ${(elapsedTime / 1000).toFixed(1)} sec`
            this.toggleLayoutProgressVisibility()
        }
    }

    protected toggleLayoutProgressVisibility(): void {
        const zoomGroup = this.getZoomGroup()
        if (zoomGroup) {
            zoomGroup.classList.toggle('hidden', this.layoutProgress < 1)
        }
        if (this.loadingPb) {
            this.loadingPb.classList.toggle('hidden', this.layoutProgress >= 1)
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
        this.loadingPb = loadingPb
    }
}


export abstract class AbstractSelectionBox {
    abstract selectionInProgress(): boolean
}