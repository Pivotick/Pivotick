import { tryResolveBoolean } from './Getters'
import { parseSvgIconMarkup } from './SvgSanitizer'
import type { Node } from '../Node'
import type { Edge } from '../Edge'
import type { Note } from '../Note'
import { createButton } from '../ui/components/Button'
import { chevronRight } from '../ui/icons'
import type { UIElement } from '../ui/UIManager'
import type { IconClass, IconUnicode, ImagePath, MenuActionItemOptions, MenuQuickActionItemOptions, SVGIcon } from '../interfaces/GraphUI'

const ACTION_DEFAULT_VARIANT = 'outline-primary'

export function createSvgElement<K extends keyof SVGElementTagNameMap>(
    tag: K,
    attributes: Record<string, string | string[] | number> = {},
    children: SVGElement[] = []
): SVGElementTagNameMap[K] {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag)

    for (const [key, value] of Object.entries(attributes)) {
        if (Array.isArray(value)) {
            element.setAttribute(key, value.join(' '))
        } else {
            element.setAttribute(key, value.toString())
        }
    }

    for (const child of children) {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child))
        } else {
            element.appendChild(child)
        }
    }
    return element
}

export function createHtmlElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes: Record<string, string | string[] | number> = {},
    children: Array<HTMLElement | Text | string> = []
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag)

    for (const [key, value] of Object.entries(attributes)) {
        if (Array.isArray(value)) {
            element.setAttribute(key, value.join(' '))
        } else {
            element.setAttribute(key, value.toString())
        }
    }

    for (const child of children) {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child))
        } else {
            element.appendChild(child)
        }
    }

    return element
}

export function createHtmlTemplate(template: string): HTMLElement {
    const templateEl = document.createElement('template')
    templateEl.innerHTML = template.trim()
    return templateEl.content.firstElementChild as HTMLElement
}


export function createShortcutBadge(keyCombo: string, classString?: string | string[]): HTMLElement {
    const MODIFIER_ICONS: Record<string, string> = {
        ctrl: '⌃',
        shift: '⇧',
        alt: '⌥',
        cmd: '⌘',
    }

    const badge = document.createElement('span')

    badge.classList.add('pvt-keyboard-shortcut')

    if (classString) {
        if (!Array.isArray(classString)) {
            classString = classString.split(' ')
        }
        badge.classList.add(...(Array.isArray(classString) ? classString : [classString]))
    }

    const formatted = keyCombo
        .split('+')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
            const normalized = part.toLowerCase()
            return MODIFIER_ICONS[normalized] ?? part.toUpperCase()
        })
        .join(' ')

    badge.textContent = formatted

    return badge
}

export function createQuickActionList<TThis extends UIElement = UIElement>(thisContext: TThis, actions: MenuQuickActionItemOptions[], element: Node[] | Node | Edge | Note | null): HTMLDivElement {
        const div = createHtmlElement('div', { class: 'pvt-action-list' })
        const firstElement = Array.isArray(element) ? element[0] : element
        actions.forEach(action => {
            action.visible = action.visible ?? true

            const isVisible = tryResolveBoolean(action.visible, firstElement) ?? true
            if (isVisible) {
                const row = createQuickActionItem(thisContext, action, element)
                div.appendChild(row)
            }
        })
        return div
    }

/**
 * `decorate` is called with each row that was drawn and the entry it came from — the
 * pairing a host needs to wire behaviour the row itself cannot carry, such as opening
 * a {@link MenuActionItemOptions.submenu} panel it has to position on screen.
 */
export function createActionList<TThis extends UIElement = UIElement>(
    thisContext: TThis,
    actions: MenuActionItemOptions[],
    element: Node[] | Node | Edge | Note | null,
    decorate?: (row: HTMLDivElement, action: MenuActionItemOptions) => void
): HTMLDivElement {
    const div = createHtmlElement('div', { class: 'pvt-action-list' })
    const firstElement = Array.isArray(element) ? element[0] : element
    actions.forEach(action => {
        action.visible = action.visible ?? true

        const isVisible = tryResolveBoolean(action.visible, firstElement) ?? true
        if (isVisible) {
            const row = createActionItem(thisContext, action, element)
            decorate?.(row, action)
            div.appendChild(row)
        }
    })
    return div
}

export function createQuickActionItem<TThis extends UIElement = UIElement>(thisContext: TThis, action: MenuQuickActionItemOptions, element: Node[] | Node | Edge | Note | null): HTMLSpanElement {

    action.variant = action.variant ?? ACTION_DEFAULT_VARIANT

    const { onclick, ...actionWithoutCb } = action
    const span = createHtmlElement('span',
        {
            class: ['pvt-action-item', `pvt-action-item-${action.variant}`],
            style: `${action.flushRight ? 'margin-left: auto;' : ''}`
        },
        [
            createButton({
                size: 'sm',
                ...actionWithoutCb,
            })
        ]
    )
    if (typeof onclick === 'function') {
        span.addEventListener('click', (event: MouseEvent) => {
            onclick.call(thisContext, event, element)
        })
    }
    return span
}

export function createActionItem<TThis extends UIElement = UIElement>(thisContext: TThis, action: MenuActionItemOptions, element: Node[] | Node | Edge | Note | null): HTMLDivElement {
    const suffix = action.suffix ?? ''
    if (action.suffix) action.suffix.classList.add('pvt-action-suffix')
    const shortcut = createShortcut(action.shortcut)
    if (shortcut instanceof HTMLSpanElement) {
        shortcut.classList.add('pvt-ms-auto')
        shortcut.style.borderColor = 'var(--pvt-bg-color-8)'
    }
    const classes = ['pvt-action-item', `pvt-action-item-${action.variant}`]
    if (action.submenu) classes.push('pvt-has-submenu')
    if (action.dividerBefore) classes.push('pvt-action-item-divided')
    const div = createHtmlElement('div',
        {
            class: classes
        },
        [
            createIcon({ fixedWidth: true, ...action }),
            createHtmlElement('span', { 
                class: 'pvt-action-text',
                title: action.title ?? '',
            }, [ action.text ?? '' ]),
            // Classed here rather than by whoever passed it: where it sits on the row is
            // the row's business, and the caller only owns what it says.
            suffix,
            shortcut,
            // The affordance is part of what a submenu row *is*; opening the panel is
            // the host's, since only it knows where on screen the panel can go.
            action.submenu
                ? createHtmlElement('span', { class: 'pvt-submenu-caret', 'aria-hidden': 'true' }, [createIcon({ svgIcon: chevronRight })])
                : '',
        ]
    )
    if (action.submenu) div.setAttribute('aria-haspopup', 'true')
    const onclick = action.onclick
    if (typeof onclick === 'function') {
        div.addEventListener('click', (event: MouseEvent) => {
            onclick.call(thisContext, event, element)
        })
    }
    return div
}

/**
 * Generate a random DOM-safe unique ID string.
 *
 * Rules:
 * - Always starts with a letter (to be a valid HTML id).
 * - Contains only [A-Za-z0-9-_].
 * 
 * @param {number} length - Length of the random part (default: 8)
 * @returns {string} Random DOM-safe ID
 */
export function generateSafeDomId(length = 8, prefix = 'id-') {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    const chars = letters + '0123456789-_'

    let id = letters.charAt(Math.floor(Math.random() * letters.length))

    for (let i = 1; i < length; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    return `${prefix}${id}`
}


type iconOptions = {
    iconUnicode?: IconUnicode,
    iconClass?: IconClass,
    svgIcon?: SVGIcon,
    imagePath?: ImagePath,
    fixedWidth?: boolean,
}
export function createIcon(options: iconOptions): HTMLSpanElement {
    const span = document.createElement('span')
    span.classList.add('pvt-icon')
    if (options.fixedWidth) {
        span.classList.add('fixed-width')
    }

    if (options.iconUnicode || options.iconClass) {
        const textEl = document.createElement('text')
        if (options.iconUnicode) {
            textEl.className = 'icon icon-unicode'
        }
        if (options.iconClass) {
            textEl.className = `icon ${options.iconClass ?? ''}`
        }
        if (options.iconUnicode) {
            // UI icons render as HTML, where ::before generated content works; the iconClass
            // path is handled purely by CSS. Only the explicit-unicode override needs text.
            textEl.textContent = options.iconUnicode
        }
        span.append(textEl)
    } else if (options.svgIcon) {
        // Sanitized as defence in depth: svgIcon is caller config, but nothing stops an
        // integrator deriving it from untrusted data.
        const svgEl = parseSvgIconMarkup(options.svgIcon).firstElementChild
        if (svgEl) {
            svgEl.setAttribute('width', '100%')
            svgEl.setAttribute('height', '100%')
            span.append(svgEl)
        }

        span.style.display = 'inline-flex'
        span.style.alignItems = 'center'
        span.style.justifyContent = 'center'
        span.style.width = '1em'
    } else if (options.imagePath) {
        const imgEl = document.createElement('img')
        imgEl.src = options.imagePath

        span.style.display = 'inline-flex'
        span.style.alignItems = 'center'
        span.style.justifyContent = 'center'
        span.style.width = '1em'
        span.append(imgEl)
    }
    return span
}

export function createShortcut(key?: string): HTMLSpanElement | '' {
    if (!key) return ''

    const span = document.createElement('span')
    span.classList.add('pvt-keyboard-shortcut')
    span.textContent = key
    return span
}

interface DraggableCallbacks {
    onDragStart?: (e: MouseEvent, draggableEl: HTMLElement) => void
    onDrag?: (e: MouseEvent, draggableEl: HTMLElement) => void
    onDragStop?: (e: MouseEvent, draggableEl: HTMLElement) => void
}
export function makeDraggable(draggableEl: HTMLElement, handleEl: HTMLElement, box: HTMLElement, callbacks: DraggableCallbacks = {}) {
    let isDragging = false
    let startX = 0, startY = 0, initialX = 0, initialY = 0
    let bbox: DOMRect | null = null
    let appBox: DOMRect | null = null

    handleEl.classList.add('draggable')

    handleEl.addEventListener('mousedown', (e: MouseEvent) => {
        const controller = new AbortController()
        const { signal } = controller
        isDragging = true
        handleEl.style.transition = 'none' // disable smooth transitions while dragging
        startX = e.clientX
        startY = e.clientY
        initialX = draggableEl.offsetLeft
        initialY = draggableEl.offsetTop
        bbox = draggableEl.getBoundingClientRect()
        appBox = box.getBoundingClientRect()
        callbacks.onDragStart?.(e, draggableEl)
        window.getSelection()?.removeAllRanges()
        document.addEventListener('mousemove', onMouseMove, { signal })
        document.addEventListener('mouseup', (e: MouseEvent) => {
            controller.abort()
            onMouseUp(e)
        }, { signal })
    })

    function onMouseMove(e: MouseEvent) {
        if (!isDragging || !appBox || !bbox) return
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        let posX = initialX + dx
        let posY = initialY + dy

        const elWidth = bbox.width
        const elHeight = bbox.height

        posX = Math.max(appBox.left, Math.min(posX, appBox.right - elWidth))
        posY = Math.max(appBox.top, Math.min(posY, appBox.bottom - elHeight))

        draggableEl.style.left = posX + 'px'
        draggableEl.style.top = posY + 'px'
        callbacks.onDrag?.(e, draggableEl)
    }

    function onMouseUp(e: MouseEvent) {
        isDragging = false
        draggableEl.style.transition = '' // restore transitions
        callbacks.onDragStop?.(e, draggableEl)
    }
}