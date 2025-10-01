import type { PropertyEntry } from '../GraphOptions'
import { faGlyph } from './Getters'

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
    attributes: Record<string, string> = {},
    children: Array<HTMLElement | Text | string> = []
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag)

    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value)
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

type iconOptions = {
    iconUnicode?: string,
    iconClass?: string,
    svgIcon?: string,
    imagePath?: string,
}
export function createIcon(options: iconOptions): HTMLSpanElement {
    const span = document.createElement('span')
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