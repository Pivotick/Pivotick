import { UIComponent } from '../UIComponent'

export class Layout extends UIComponent {
    public layout?: HTMLDivElement
    public canvas?: HTMLDivElement
    public sidebar?: HTMLDivElement
    public mainheader?: HTMLDivElement
    public notification?: HTMLDivElement
    public modal?: HTMLDivElement
    public slidePanel?: HTMLDivElement
    public graphnavigation?: HTMLDivElement
    /** B3 mode rail + contextual tool panel + View flyout slots. */
    public moderail?: HTMLDivElement
    public toolpanel?: HTMLDivElement
    public viewflyout?: HTMLDivElement

    protected onMount(container?: HTMLElement) {
        if (!container) return
        const mode = this.uiManager.getOptions().mode ?? 'full'

        this.layout = document.createElement('div')
        this.layout.className = `pvt-layout mode-${mode}`

        this.canvas = document.createElement('div')
        this.canvas.className = 'pvt-canvas'
        this.layout.appendChild(this.canvas)

        this.notification = document.createElement('div')
        this.notification.className = 'pvt-notification'
        this.canvas.appendChild(this.notification)

        if (mode === 'full') {
            this.sidebar = document.createElement('div')
            this.sidebar.className = 'pvt-sidebar'
            this.layout.appendChild(this.sidebar)
        }

        if (mode === 'light' || mode === 'full') {
            this.mainheader = document.createElement('div')
            this.mainheader.className = 'pvt-mainheader'
            this.layout.appendChild(this.mainheader)

            this.modal = document.createElement('div')
            this.modal.className = 'pvt-modalcontainer'
            container.appendChild(this.modal)

            this.slidePanel = document.createElement('div')
            this.slidePanel.className = 'pvt-slidepanel-container'
            this.canvas.appendChild(this.slidePanel)
        }

        if (mode !== 'static') {
            this.graphnavigation = document.createElement('div')
            this.graphnavigation.className = 'pvt-graphnavigation'
            this.canvas.appendChild(this.graphnavigation)
        }

        // B3 chrome slots: the mode rail and its contextual panel overlay the
        // canvas (left edge), positioned right of the sidebar.
        if (mode === 'full' || mode === 'light') {
            this.moderail = document.createElement('div')
            this.moderail.className = 'pvt-moderail'
            this.canvas.appendChild(this.moderail)

            this.toolpanel = document.createElement('div')
            this.toolpanel.className = 'pvt-toolpanel'
            this.canvas.appendChild(this.toolpanel)

            this.viewflyout = document.createElement('div')
            this.viewflyout.className = 'pvt-viewflyout'
            this.canvas.appendChild(this.viewflyout)
        }

        container.appendChild(this.layout)
    }

    protected onDestroy() {
        this.layout?.remove()
        this.layout = undefined
        this.modal?.remove()
        this.modal = undefined
    }
}
