import { createButton, type ButtonOptions } from '../../components/Button'
import type { UIElement, UIManager } from '../../UIManager'
import './modal.scss'


export interface ModalEvents {
    onShow?: () => void
    onShown?: () => void
    onHide?: () => void
    onHidden?: () => void
}

export interface ModalOptions extends Partial<ModalEvents> {
    /**
     * Title or header of the modal. Encode passed string by default
     */
    header?: string;
    /**
     * Skip the encoding of the header to allow raw html.
     * @default false
     */
    rawHeader?: boolean;
    /**
     * Content or body of the modal. Encode passed string by default
     */
    body?: string;
    /**
     * Skip the encoding of the body to allow raw html.
     * @default false
     */
    rawBody?: boolean;
    buttons?: ButtonOptions<[() => void]>[];
    /** @default 'center' */
    position?: 'center' | 'top';
}

export class Modal implements UIElement {
    private uiManager: UIManager
    private options: ModalOptions

    private overlay: HTMLDivElement | undefined
    private modal: HTMLDivElement | undefined
    private header: HTMLDivElement | undefined
    private body: HTMLDivElement | undefined
    private footer: HTMLDivElement | undefined
    private modalOpen = true

    private DEFAULT_HEADER = ''
    private DEFAULT_BODY = ''
    private DEFAULT_BUTTON_CONFIG = {
        text: 'Ok',
        variant: 'primary',
        onClick: (_event: MouseEvent, hideModal: () => void) => {
            hideModal()
        },
    } as ButtonOptions<[() => void]>

    constructor(uiManager: UIManager, options: ModalOptions) {
        this.uiManager = uiManager
        this.options = options

        if (!this.options.header) {
            this.options.header = this.DEFAULT_HEADER
        }

        if (!this.options.body) {
            this.options.body = this.DEFAULT_BODY
        }

        if (!this.options.buttons) {
            this.options.buttons = [this.DEFAULT_BUTTON_CONFIG]
        }

        this.options.position = options.position ?? 'center'
    }

    public mount(rootContainer: HTMLElement | undefined) {
        if (!rootContainer) return

        this.overlay = document.createElement('div')
        this.overlay.className = 'pvt-modal-overlay'
        this.overlay.classList.add(
            this.options.position === 'center' ? 'pvt-modal-overlay-center' : 'pvt-modal-overlay-top'
        )

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.overlay.remove()
        })


        this.modal = document.createElement('div')
        this.modal.className = 'pvt-modal'

        this.header = document.createElement('div')
        this.header.className = 'pvt-modal__header'
        if (this.options.rawHeader) {
            this.header.innerHTML = this.options.header!
        } else {
            this.header.textContent = this.options.header!
        }

        const closeBtn = createButton({
            text: '×',
            variant: 'outline-primary',
            size: 'sm',
            onClick: () => {
                this.hide()
            },
            style: 'margin-left: auto;',
        })
        this.header.appendChild(closeBtn)

        this.body = document.createElement('div')
        this.body.className = 'pvt-modal__body'
        if (this.options.rawBody) {
            this.body.innerHTML = this.options.body!
        } else {
            this.body.textContent = this.options.body!
        }

        this.footer = document.createElement('div')
        this.footer.className = 'pvt-modal__footer'

        this.setButtons(this.options.buttons!)

        this.modal.appendChild(this.header)
        this.modal.appendChild(this.body)
        this.modal.appendChild(this.footer)

        this.overlay.appendChild(this.modal)
        rootContainer.appendChild(this.overlay)
    }

    public destroy() {
    }

    public afterMount() {
    }

    public graphReady() {
    }

    public setButtons(btnConfigs: ButtonOptions<[() => void]>[]): void {
        if (!this.modal || !this.footer) return

        this.footer.innerHTML = ''
        btnConfigs.forEach((config) => {
            if (typeof config['onClick'] === 'function') {
                const passedCb = config['onClick']
                config['onClick'] = (event: MouseEvent, hideModal: () => void) => {
                    if (passedCb) 
                        passedCb(event, hideModal)
                }
                config['onClickArgs'] = [this.hide.bind(this)]
            }
            const btn = createButton<[() => void]>(config)
            this.footer!.appendChild(btn)
        })
    }

    public show(): void {
        if (!this.modal || !this.overlay) return

        this.dispatchEvent('show')
        this.modal.classList.add('pvt-modal-open')
        this.modalOpen = true
        const onAnimationEnd = (evt: AnimationEvent) => {
            if (evt.target === this.modal) {
                this.modal?.removeEventListener('animationend', onAnimationEnd)
                this.dispatchEvent('shown')
            }
        }
        this.modal.addEventListener('animationend', onAnimationEnd)
    }

    public hide(): void {
        if (!this.modal || !this.overlay) return

        this.dispatchEvent('hide')
        this.modalOpen = false
        this.modal.classList.remove('pvt-modal-open')
        this.overlay?.remove()
        requestAnimationFrame(() => {
            this.dispatchEvent('hidden')
        })
    }

    private dispatchEvent(name: string): void {
        if (!this.modal) return

        const evt = new CustomEvent(name, { bubbles: true, cancelable: true })
        this.modal.dispatchEvent(evt)

        const callbackName = `on${name.charAt(0).toUpperCase()}${name.slice(1)}` as keyof ModalEvents
        const cb = this.options[callbackName]
        if (typeof cb === 'function') cb()
    }

}