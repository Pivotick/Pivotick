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
    /** B3 mode rail + contextual tool panel + settings-flyout slots. */
    public moderail?: HTMLDivElement
    public toolpanel?: HTMLDivElement
    public flyout?: HTMLDivElement
    /** Canvas-docked legend slot (its corner is set by the legend itself). */
    public legend?: HTMLDivElement
    /**
     * The bottom dock: a grid row under the canvas, spanning the canvas column only so
     * the sidebar stays full height beside it. `full` mode only.
     */
    public dock?: HTMLDivElement

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

            // Always present, even with no `UI.table`, so the dock has a slot to mount
            // into later. It occupies no height until the dock puts something in it.
            this.dock = document.createElement('div')
            this.dock.className = 'pvt-dock-slot'
            this.layout.appendChild(this.dock)
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

            // One slot for every settings flyout (View / Physics) — the rail keeps
            // them mutually exclusive, so at most one is ever displayed.
            this.flyout = document.createElement('div')
            this.flyout.className = 'pvt-flyout'
            this.canvas.appendChild(this.flyout)

            // Always present in these modes, even with no `UI.legend`, so a later
            // `graph.setLegend()` has a slot to mount into.
            this.legend = document.createElement('div')
            this.legend.className = 'pvt-legend'
            this.canvas.appendChild(this.legend)
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
