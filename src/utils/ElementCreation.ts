import { faGlyph, tryResolveBoolean, tryResolveHTMLElement } from './Getters'
import type { Node } from '../Node'
import type { Edge } from '../Edge'
import { createButton } from '../ui/components/Button'
import type { UIElement } from '../ui/UIManager'
import type { IconClass, IconUnicode, ImagePath, MenuActionItemOptions, MenuQuickActionItemOptions, PropertyEntry, SVGIcon } from '../interfaces/GraphUI'


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

export function createHtmlDL(data: PropertyEntry[], element: Node | Edge | null): HTMLDListElement {
    const dl = createHtmlElement('dl', { class: 'pivotick-property-list' })
    for (const entry of data) {
        const resolvedName = tryResolveHTMLElement(entry.name, element) || ''
        const resolvedValue = tryResolveHTMLElement(entry.value, element) || ''

        const row = createHtmlElement('dl',
            {
                'class': 'pivotick-property-row',
            },
            [
                createHtmlElement('dt', { class: 'pivotick-property-name' }, [resolvedName]),
                createHtmlElement('dd', { class: 'pivotick-property-value' }, [resolvedValue]),
            ]
        )
        dl.append(row)
    }
    return dl
}


export function createQuickActionList<TThis extends UIElement = UIElement>(thisContext: TThis, actions: MenuQuickActionItemOptions[], element: Node[] | Node | Edge | null): HTMLDivElement {
        const div = createHtmlElement('div', { class: 'pivotick-quickaction-list' })
        const firstElement = Array.isArray(element) ? element[0] : element
        actions.forEach(action => {
            const isVisible = tryResolveBoolean(action.visible, firstElement) ?? true
            if (isVisible) {
                const row = createQuickActionItem(thisContext, action, element)
                div.appendChild(row)
            }
        })
        return div
    }

export function createActionList<TThis extends UIElement = UIElement>(thisContext: TThis, actions: MenuActionItemOptions[], element: Node[] | Node | Edge | null): HTMLDivElement {
    const div = createHtmlElement('div', { class: 'pivotick-action-list' })
    const firstElement = Array.isArray(element) ? element[0] : element
    actions.forEach(action => {
        const isVisible = tryResolveBoolean(action.visible, firstElement) ?? true
        if (isVisible) {
            const row = createActionItem(thisContext, action, element)
            div.appendChild(row)
        }
    })
    return div
}

export function createQuickActionItem<TThis extends UIElement = UIElement>(thisContext: TThis, action: MenuQuickActionItemOptions, element: Node[] | Node | Edge | null): HTMLSpanElement {
    const { onclick, ...actionWithoutCb } = action
    const span = createHtmlElement('span',
        {
            class: ['pivotick-quickaction-item', `pivotick-quickaction-item-${action.variant}`],
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

export function createActionItem<TThis extends UIElement = UIElement>(thisContext: TThis, action: MenuActionItemOptions, element: Node[] | Node | Edge | null): HTMLDivElement {
    const div = createHtmlElement('div',
        {
            class: ['pivotick-action-item', `pivotick-action-item-${action.variant}`]
        },
        [
            createIcon({ fixedWidth: true, ...action }),
            createHtmlElement('span', { 
                class: 'pivotick-action-text',
                title: action.title,
            }, [ action.text ?? '' ])
        ]
    )
    if (typeof action.onclick === 'function') {
        div.addEventListener('click', (event: MouseEvent) => {
            action.onclick.call(thisContext, event, element)
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
export function generateSafeDomId(length = 8) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    const chars = letters + '0123456789-_'

    let id = letters.charAt(Math.floor(Math.random() * letters.length))

    for (let i = 1; i < length; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    return `id-${id}`
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
    span.classList.add('pivotick-icon')
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
            textEl.textContent = options.iconUnicode ?? (faGlyph(options.iconClass ?? '') ?? '☐')
        }
        span.append(textEl)
    } else if (options.svgIcon) {
        const templateEl = document.createElement('template')
        templateEl.innerHTML = options.svgIcon.trim()
        const svgEl = templateEl.content.firstElementChild as HTMLElement
        svgEl.setAttribute('width', '100%')
        svgEl.setAttribute('height', '100%')

        span.style.display = 'inline-flex'
        span.style.alignItems = 'center'
        span.style.justifyContent = 'center'
        span.style.width = '1em'
        span.append(svgEl)
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

interface DraggableCallbacks {
    onDragStart?: (e: MouseEvent, draggableEl: HTMLElement) => void
    onDrag?: (e: MouseEvent, draggableEl: HTMLElement) => void
    onDragStop?: (e: MouseEvent, draggableEl: HTMLElement) => void
}
export function makeDraggable(draggableEl: HTMLElement, handleEl: HTMLElement, callbacks: DraggableCallbacks = {}) {
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
        appBox =  document.getElementById('pivotick-app')!.getBoundingClientRect()
        callbacks.onDragStart?.(e, draggableEl)
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