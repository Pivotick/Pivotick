import type { IconClass, IconUnicode, ImagePath, SVGIcon, UIOutlineVariant, UIBaseVariant, UIOutlineSoftVariant } from '../../interfaces/GraphUI'
import { createIcon } from '../../utils/ElementCreation'

type ButtonVariant = UIBaseVariant | UIOutlineVariant | UIOutlineSoftVariant
type ButtonSize = 'sm' | 'xs' | 'block'
export type ButtonOptions<TArgs extends unknown[] = []> = {
    variant?: ButtonVariant,
    size?: ButtonSize,
    /** closeModal can be used to close the modal */
    onClick?: (event: MouseEvent, ...args: TArgs) => void
    onClickArgs?: TArgs
    iconUnicode?: IconUnicode,
    iconClass?: IconClass,
    svgIcon?: SVGIcon,
    imagePath?: ImagePath,
    text?: string,
    childElement?: HTMLElement,
    disabled?: boolean,
    [key: string]: unknown // allow other attributes like id, className, etc.
}

export function createButton<TArgs extends unknown[] = []>(options: ButtonOptions<TArgs>): HTMLButtonElement {
    options.variant = options.variant ?? 'primary'

    const { 
        variant,
        size,
        onClick,
        onClickArgs,
        iconUnicode,
        iconClass,
        svgIcon,
        imagePath,
        disabled,
        text,
        childElement,
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

    if(disabled !== undefined) {
        btn.disabled = disabled
    }

    if (text) {
        const textEl = document.createElement('text')
        textEl.textContent = text
        btn.append(textEl)
    }

    if (childElement) {
        btn.append(childElement)
    } 

    if (typeof onClick === 'function') {
        const args = (onClickArgs ?? []) as TArgs
        btn.addEventListener('click', (evt) => { onClick(evt, ...args) })
    }

    return btn
}