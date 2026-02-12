import type { IconClass, IconUnicode, ImagePath, SVGIcon, UIBaseVariant } from '../../interfaces/GraphUI'
import { createIcon } from '../../utils/ElementCreation'

type BadgeVariant = UIBaseVariant
type BadgeSize = 'sm' | 'xs' | 'xxs'
export type BadgeOptions = {
    variant?: BadgeVariant,
    size?: BadgeSize,
    /** closeModal can be used to close the modal */
    iconUnicode?: IconUnicode,
    iconClass?: IconClass,
    svgIcon?: SVGIcon,
    imagePath?: ImagePath,
    text?: string,
    html?: HTMLElement,
    [key: string]: unknown // allow other attributes like id, className, etc.
}

export function createBadge(options: BadgeOptions): HTMLSpanElement {
    options.variant = options.variant ?? 'primary'

    const { 
        variant,
        size,
        iconUnicode,
        iconClass,
        svgIcon,
        imagePath,
        text,
        html,
        ...attrs
    } = options
    const badge = document.createElement('span')

    badge.classList.add('pivotick-badge')
    badge.classList.add(`pivotick-badge-${variant}`)
    if (size)
        badge.classList.add(`pivotick-badge-${size}`)


    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'class') {
            if (Array.isArray(value)) {
                badge.classList.add(...value)
            } else {
                badge.classList.add(String(value))
            }
        } else if (key in badge) {
            (badge as HTMLSpanElement & Record<string, unknown>)[key] = value
        } else {
            badge.setAttribute(key, String(value))
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
        badge.append(iconEl)
    }
    const textEl = document.createElement('text')
    if (text) {
        if (iconEl)
            iconEl.style.marginRight = '0.1em'

        textEl.textContent = text
    }
    badge.append(textEl)

    if (html) {
        badge.appendChild(html)
    }

    return badge
}