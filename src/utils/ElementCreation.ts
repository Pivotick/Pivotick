import type { PropertyEntry } from '../GraphOptions'
import { faGlyph, tryResolveHTMLElement } from './Getters'
import type { Node } from '../Node'
import type { Edge } from '../Edge'

export type UIVariant = 'primary' | 'secondary' | 'info' | 'warning' | 'danger' | 'success' |
'outline-primary' | 'outline-secondary' | 'outline-info' | 'outline-warning' | 'outline-danger' | 'outline-success'

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
            element.setAttribute(key, value)
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
            element.setAttribute(key, value)
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

export function createHtmlDL(data: Array<PropertyEntry>, element: Node | Edge | null): HTMLDListElement {
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


type ActionItemOptions = {
    iconUnicode?: string,
    iconClass?: string,
    svgIcon?: string,
    imagePath?: string,
    text: string,
    title: string,
    variant: UIVariant,
    cb: (element: Node | Edge) => void
}
export function createActionList(actions: ActionItemOptions[]): HTMLDivElement {
    const div = createHtmlElement('div', { class: 'pivotick-action-list' })
    actions.forEach(action => {
        const row = createActionItem(action)
        div.appendChild(row)
    })
    return div
}

export function createActionItem(action: ActionItemOptions): HTMLDivElement {
    const div = createHtmlElement('div',
        {
            class: ['pivotick-action-item', `pivotick-action-item-${action.variant}`]
        },
        [
            createIcon(action),
            createHtmlElement('span', { 
                class: 'pivotick-action-text',
                title: action.title,
            }, [ action.title ]),
        ]
    )
    div.addEventListener('click', action.cb)
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
    iconUnicode?: string,
    iconClass?: string,
    svgIcon?: string,
    imagePath?: string,
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