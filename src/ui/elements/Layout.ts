import type { GraphMode } from '../../GraphOptions'
import type { UIElement } from '../UIManager'

export class Layout implements UIElement {
    public layout?: HTMLDivElement
    public canvas?: HTMLDivElement
    public sidebar?: HTMLDivElement
    public toolbar?: HTMLDivElement
    public notification?: HTMLDivElement
    // public slidePanel?: HTMLDivElement;
    public graphnavigation?: HTMLDivElement
    public graphcontrols?: HTMLDivElement

    constructor() { }

    mount(container: HTMLElement, mode: GraphMode = 'full') {
        this.layout = document.createElement('div')
        this.layout.className = `pivotick-layout mode-${mode}`

        this.canvas = document.createElement('div')
        this.canvas.className = 'pivotick-canvas-container'
        this.layout.appendChild(this.canvas)

        this.notification = document.createElement('div')
        this.notification.className = 'pivotick-notification-container'
        this.canvas.appendChild(this.notification)

        if (mode === 'full') {
            this.sidebar = document.createElement('div')
            this.sidebar.className = 'pivotick-sidebar-container'
            this.layout.appendChild(this.sidebar)
        }

        if (mode === 'light' || mode === 'full') {
            this.toolbar = document.createElement('div')
            this.toolbar.className = 'pivotick-toolbar-container'
            this.layout.appendChild(this.toolbar)
        }

        if (mode !== 'static') {
            this.graphnavigation = document.createElement('div')
            this.graphnavigation.className = 'pivotick-graphnavigation-container'
            this.canvas.appendChild(this.graphnavigation)

            this.graphcontrols = document.createElement('div')
            this.graphcontrols.className = 'pivotick-graphcontrols-container'
            this.canvas.appendChild(this.graphcontrols)
        }

        container.appendChild(this.layout)
    }

    destroy() {
        this.layout?.remove()
        this.layout = undefined
    }

    afterMount() { }

}