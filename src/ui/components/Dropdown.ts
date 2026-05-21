import type { IconClass, IconUnicode, ImagePath, SVGIcon, UIBaseVariant } from '../../interfaces/GraphUI'
import { createIcon } from '../../utils/ElementCreation'

type OptionVariant = UIBaseVariant
type OptionSize = 'sm' | 'xs' | 'xxs'

export type DropdownOption = {
    id: string
    variant?: OptionVariant
    size?: OptionSize
    iconUnicode?: IconUnicode
    iconClass?: IconClass
    svgIcon?: SVGIcon
    imagePath?: ImagePath
    text?: string
    html?: HTMLElement
    disabled?: boolean
    onClick?: (option: DropdownOption, dropdown: PivotickDropdown, target: HTMLButtonElement) => void
}

export interface DropdownOptions {
    closeOnSelect?: boolean
    placement?: 'bottom-start' | 'bottom-end'
}

export class PivotickDropdown {
    private target: HTMLElement
    private options: DropdownOption[]
    private config: DropdownOptions

    private root: HTMLDivElement
    private menu: HTMLDivElement
    private opened = false

    constructor(
        target: HTMLElement,
        options: DropdownOption[],
        config: DropdownOptions = {}
    ) {
        this.target = target
        this.options = options
        this.config = {
            closeOnSelect: true,
            placement: 'bottom-start',
            ...config
        }

        this.root = document.createElement('div')
        this.root.className = 'pvt-dropdown'

        this.menu = document.createElement('div')
        this.menu.className = 'pvt-dropdown__menu'

        this.root.appendChild(this.menu)

        this.build()
        this.attach()
    }

    private build() {
        document.body.appendChild(this.root)

        this.renderOptions()
    }

    private renderOptions() {
        this.menu.innerHTML = ''

        this.options.forEach((option) => {
            const item = document.createElement('button')
            const variant = option.variant ?? 'outline-primary'

            item.type = 'button'
            item.className = 'pvt-dropdown__item'

            item.classList.add(`${variant}`)
            if (option.disabled) {
                item.disabled = true
                item.classList.add('disabled')
            }

            // custom html
            if (option.html) {
                item.appendChild(option.html)
            } else {
                let iconEl: HTMLElement | undefined

                if (option.iconUnicode) {
                    iconEl = createIcon({ iconUnicode: option.iconUnicode })
                }

                if (option.iconClass) {
                    iconEl = createIcon({ iconClass: option.iconClass })
                }

                if (option.svgIcon) {
                    iconEl = createIcon({ svgIcon: option.svgIcon })
                }

                if (option.imagePath) {
                    iconEl = createIcon({ imagePath: option.imagePath })
                }

                if (iconEl) {
                    iconEl.classList.add('pvt-dropdown__icon')
                    item.appendChild(iconEl)
                }

                if (option.text) {
                    const label = document.createElement('span')
                    label.className = 'pvt-dropdown__label'
                    label.textContent = option.text
                    item.appendChild(label)
                }
            }

            item.addEventListener('click', (e) => {
                e.stopPropagation()

                if (option.disabled) return

                option.onClick?.(option, this, item)

                if (this.config.closeOnSelect) {
                    this.close()
                }
            })

            this.menu.appendChild(item)
        })
    }

    private attach() {
        this.target.addEventListener('click', (e) => {
            e.stopPropagation()

            if (this.opened) {
                this.close()
            } else {
                this.open()
            }
        })

        document.addEventListener('pointerdown', (e) => {
            const target = e.target as Node

            if (
                !this.root.contains(target) &&
                !this.target.contains(target)
            ) {
                this.close()
            }
        })

        window.addEventListener('resize', () => {
            if (this.opened) {
                this.position()
            }
        })

        window.addEventListener('scroll', () => {
            if (this.opened) {
                this.position()
            }
        })
    }

    private position() {
        const rect = this.target.getBoundingClientRect()

        this.root.style.position = 'fixed'
        this.root.style.zIndex = '9999'

        // make visible temporarily so dimensions are measurable
        const wasHidden = !this.root.classList.contains('open')

        if (wasHidden) {
            this.root.style.visibility = 'hidden'
            this.root.style.display = 'block'
        }

        const dropdownWidth = this.root.offsetWidth
        const dropdownHeight = this.root.offsetHeight

        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        const spacing = 8

        // default position
        let left =
            this.config.placement === 'bottom-end'
                ? rect.right - dropdownWidth
                : rect.left

        let top = rect.bottom + 6

        // prevent horizontal overflow
        if (left + dropdownWidth > viewportWidth - spacing) {
            left = viewportWidth - dropdownWidth - 2*spacing
        }

        if (left < spacing) {
            left = spacing
        }

        // prevent vertical overflow
        const wouldOverflowBottom =
            top + dropdownHeight > viewportHeight - spacing

        if (wouldOverflowBottom) {
            // open upward instead
            top = rect.top - dropdownHeight - 6
        }

        // clamp top if still overflowing
        if (top < spacing) {
            top = spacing
        }

        this.root.style.left = `${left}px`
        this.root.style.top = `${top}px`

        if (wasHidden) {
            this.root.style.visibility = ''
            this.root.style.display = ''
        }
    }

    public open() {
        if (this.opened) return

        this.opened = true

        this.root.classList.add('open')

        this.position()
    }

    public close() {
        this.opened = false

        this.root.classList.remove('open')
    }

    public toggle() {
        if (this.opened) {
            this.close()
        } else {
            this.open()
        }
    }

    public setOptions(options: DropdownOption[]) {
        this.options = options

        this.renderOptions()
    }

    public destroy() {
        this.root.remove()
    }
}