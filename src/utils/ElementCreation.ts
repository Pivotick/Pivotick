import type { PropertyEntry } from '../GraphOptions'
import { faGlyph } from './Getters'
import type { Node } from '../Node'
import type { Edge } from '../Edge'

export type UIVariant = 'primary' | 'secondary' | 'info' | 'warning' | 'danger' |
'outline-primary' | 'outline-secondary' | 'outline-info' | 'outline-warning' | 'outline-danger' | 'outline-link'

export function createSvgElement<K extends keyof SVGElementTagNameMap>(
    tag: K,
    attributes: { [key: string]: string | number },
    children: SVGElement[] = []
): SVGElementTagNameMap[K] {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [key, value] of Object.entries(attributes)) {
        el.setAttribute(key, String(value))
    }
    children.forEach(child => el.appendChild(child))
    return el
}

export function createHtmlElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes: Record<string, string | string[]> = {},
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

export function createHtmlDL(data: Array<PropertyEntry>): HTMLDListElement {
    const dl = createHtmlElement('dl', { class: 'pivotick-property-list' })
    for (const entry of data) {
        const row = createHtmlElement('dl',
            {
                'class': 'pivotick-property-row',
            },
            [
                createHtmlElement('dt', { class: 'pivotick-property-name' }, [entry.name]),
                createHtmlElement('dd', { class: 'pivotick-property-value' }, [
                    typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)
                ]),
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
export function generateDomId(length = 8) {
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
}
export function createIcon(options: iconOptions): HTMLSpanElement {
    const span = document.createElement('span')
    span.classList.add('pivotick-icon')

    if (options.iconUnicode || options.iconClass) {
        const textEl = document.createElement('text')
        if (options.iconUnicode) {
            textEl.className = 'icon icon-unicode'
        }
        if (options.iconClass) {
            textEl.className = `icon ${options.iconClass ?? ''}`
        }
        if (options.iconUnicode) {
            textEl.innerText = options.iconUnicode ?? (faGlyph(options.iconClass ?? '') ?? '☐')
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
        span.style.width = '1em'
        span.append(svgEl)
    } else if (options.imagePath) {
        const imgEl = document.createElement('img')
        imgEl.src = options.imagePath

        span.style.display = 'inline-flex'
        span.style.alignItems = 'center'
        span.style.justifyContent = 'center'
        span.style.width = '1em'
        span.style.width = '1em'
        span.append(imgEl)
    }
    return span
}

export function makeDraggable(draggableEl: HTMLElement, handleEl: HTMLElement) {
    let isDragging = false
    let startX = 0, startY = 0, initialX = 0, initialY = 0

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
        document.addEventListener('mousemove', onMouseMove, { signal })
        document.addEventListener('mouseup', () => {
            controller.abort()
            onMouseUp()
        }, { signal })
    })

    function onMouseMove(e: MouseEvent) {
        if (!isDragging) return
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        draggableEl.style.left = initialX + dx + 'px'
        draggableEl.style.top = initialY + dy + 'px'
    }

    function onMouseUp() {
        isDragging = false
        draggableEl.style.transition = '' // restore transitions
    }
}