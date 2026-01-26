import { createButton } from '../../components/Button'
import type { UIElement, UIManager } from '../../UIManager'
import './slidePanel.scss'


export interface SlidepanelEvents {
    onShow?: () => void
    onShown?: () => void
    onHide?: () => void
    onHidden?: () => void
}

export interface SlidepanelOptions extends Partial<SlidepanelEvents> {
    /**
     * Title or header of the slidepanel. Encode passed string by default
     */
    header?: string | HTMLElement | null;
    /**
     * Skip the encoding of the header to allow raw html.
     * @default false
     */
    rawHeader?: boolean;
    /**
     * Content or body of the slidepanel. Encode passed string by default
     */
    body?: string | HTMLElement | null;
    /**
     * Skip the encoding of the body to allow raw html.
     * @default false
     */
    rawBody?: boolean;
    noBodyPadding?: boolean
}

export class SlidePanel implements UIElement {
    public uiManager: UIManager
    private options: SlidepanelOptions


    public slidePanel?: HTMLDivElement
    private header?: HTMLDivElement
    private body?: HTMLDivElement

    private isOpen = false

    private DEFAULT_HEADER = null
    private DEFAULT_BODY = '- empty panel -'

    constructor(uiManager: UIManager, options: SlidepanelOptions = {}) {
        this.uiManager = uiManager
        this.options = options

        if (!this.options.header) {
            this.options.header = this.DEFAULT_HEADER
        }

        if (!this.options.body) {
            this.options.body = this.DEFAULT_BODY
        }
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return

        const templateSlidePanel = document.createElement('template')
        templateSlidePanel.innerHTML = `
  <div class="pvt-slide-panel" id="pvt-side-panel">
  </div>
`
        this.slidePanel = templateSlidePanel.content.firstElementChild as HTMLDivElement
        this.slidePanel.innerHTML = ''

        if (this.options.header != null) {
            this.header = document.createElement('div')
            this.header.className = 'pvt-slide-panel__header'
            this.setHeader(this.options.header)
            this.slidePanel.appendChild(this.header)

            const closeBtn = createButton({
                text: '×',
                onClick: () => {
                    this.close()
                },
                id: 'pvt-sidePanel-close',
                class: 'pvt-close-button',
                style: 'margin-left: auto;',
            })
            this.header.appendChild(closeBtn)
        }

        this.body = document.createElement('div')
        this.body.className = 'pvt-slide-panel__content'
        this.setBody(this.options.body)
        this.slidePanel.appendChild(this.body)
        if (this.options.noBodyPadding) {
            this.body.style.padding = '0'
        } else {
            this.body.style.padding = '' // fallback to CSS default
        }

        container.appendChild(this.slidePanel)
    }

    destroy() {
        this.slidePanel?.remove()
        this.slidePanel = undefined
    }

    afterMount() {
    }

    graphReady(): void { }

    open(): void {
        this.isOpen = true
        this.slidePanel?.classList.add('open')
    }

    close(): void {
        this.isOpen = false
        this.slidePanel?.classList.remove('open')
    }

    toggle(): void {
        if (this.isOpen) {
            this.close()
        } else {
            this.open()
        }
    }

    public setHeader(header: string | HTMLElement | null | undefined): void {
        if (!this.header) return

        this.header.innerHTML = ''
        if (!header) return

        if (this.options.header instanceof HTMLElement) {
            this.header.appendChild(this.options.header)
        } else if (this.options.rawHeader) {
            this.header.innerHTML = this.options.header!
        } else {
            this.header.textContent = this.options.header!
        }
    }

    public setBody(body: string | HTMLElement | null | undefined): void {
        if (!this.body) return

        this.body.innerHTML = ''
        if (!body) return

        if (body instanceof HTMLElement) {
            this.body.appendChild(body)
        } else if (this.options.rawBody) {
            this.body.innerHTML = body
        } else {
            this.body.textContent = body
        }
    }

}