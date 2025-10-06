import { createIcon } from '../../utils/ElementCreation'
import type { UIVariant } from '../../utils/ElementCreation.ts'

type ButtonVariant = UIVariant
type ButtonSize = 'sm' | 'xs'
type ButtonOptions = {
    variant: ButtonVariant,
    size?: ButtonSize,
    onClick?: (event: MouseEvent) => void
    iconUnicode?: string,
    iconClass?: string,
    svgIcon?: string,
    imagePath?: string,
    text?: string,
    [key: string]: unknown // allow other attributes like id, className, etc.
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
    const { 
        variant,
        size,
        onClick,
        iconUnicode,
        iconClass,
        svgIcon,
        imagePath,
        text,
        ...attrs
    } = options
    const btn = document.createElement('button')

    btn.classList.add('pivotick-button')
    btn.classList.add(`pivotick-button-${variant}`)
    if (size)
        btn.classList.add(`pivotick-button-${size}`)


    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'class') {
            if (Array.isArray(value)) {
                btn.classList.add(...value)
            } else {
                btn.classList.add(String(value))
            }
        } else if (key in btn) {
            (btn as HTMLButtonElement & Record<string, unknown>)[key] = value
        } else {
            btn.setAttribute(key, String(value))
        }
    }

    let iconEl
    if (iconUnicode) {
        iconEl = createIcon({iconUnicode: iconUnicode})
    }
    if (iconClass) {
        iconEl = createIcon({ iconClass: iconClass })
    }
    if (svgIcon) {
        iconEl = createIcon({ svgIcon: svgIcon })
    }
    if (imagePath) {
        iconEl = createIcon({ imagePath: imagePath })
    }
    if (iconEl) {
        btn.append(iconEl)
    }
    const textEl = document.createElement('text')
    if (text) {
        if (iconEl)
            iconEl.style.marginRight = '0.1em'

        textEl.innerText = text
    }
    btn.append(textEl)

    if (typeof onClick === 'function') {
        btn.addEventListener('click', (evt) => { onClick(evt) })
    }

    return btn
}