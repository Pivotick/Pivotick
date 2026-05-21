import '../../styles/components/jsonViewer.scss'
import { createButton } from './Button'

type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue }

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function createPrimitive(value: JsonValue): string {
    if (typeof value === 'string') {
        return `<span class="json-string">"${escapeHtml(value)}"</span>`
    }

    if (typeof value === 'number') {
        return `<span class="json-number">${value}</span>`
    }

    if (typeof value === 'boolean') {
        return `<span class="json-boolean">${value}</span>`
    }

    return '<span class="json-null">null</span>'
}

function createLineNumber(lineNumber: number): HTMLDivElement {
    const el = document.createElement('div')
    el.className = 'pvt-json-viewer__line-number'
    el.textContent = String(lineNumber)
    return el
}

function createLine(
    content: HTMLElement,
    lineNumber: number,
    depth = 0
): HTMLDivElement {
    const line = document.createElement('div')
    line.className = 'pvt-json-viewer__line'

    line.appendChild(createLineNumber(lineNumber))

    const body = document.createElement('div')
    body.className = 'pvt-json-viewer__line-content'

    body.style.paddingLeft = `${12 + depth * 18}px`

    body.appendChild(content)

    line.appendChild(body)

    return line
}

function renderValue(
    value: JsonValue,
    container: HTMLElement,
    lineCounter: { value: number },
    depth = 0,
    key?: string,
    isLast = true
): void {
    const wrapper = document.createElement('div')
    wrapper.className = 'pvt-json-viewer__node'
    wrapper.style.setProperty('--json-depth', String(depth))

    const comma = isLast ? '' : ','

    const isPrimitive =
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'

    if (isPrimitive) {
        const content = document.createElement('div')

        if (key !== undefined) {
            content.innerHTML += `
                <span class="json-key">"${escapeHtml(key)}"</span>: 
            `
        }

        content.innerHTML += createPrimitive(value) + comma

        wrapper.appendChild(createLine(content, lineCounter.value++, depth))
        container.appendChild(wrapper)

        return
    }

    const isArray = Array.isArray(value)

    const entries = isArray
        ? value.map((v, i) => [String(i), v] as const)
        : Object.entries(value)

    const details = document.createElement('details')
    details.className = 'pvt-json-viewer__details'
    details.open = true

    const summaryContent = document.createElement('div')

    if (key !== undefined) {
        summaryContent.innerHTML += `
            <span class="json-key">"${escapeHtml(key)}"</span>: 
        `
    }

    summaryContent.innerHTML += `
        <span class="json-bracket">${isArray ? '[' : '{'}</span>
        <span class="pvt-json-viewer__meta">
            ${entries.length} ${isArray ? 'items' : 'properties'}
        </span>
    `

    const summary = document.createElement('summary')
    summary.className = 'pvt-json-viewer__summary'

    summary.appendChild(
        createLine(summaryContent, lineCounter.value++, depth)
    )

    details.appendChild(summary)

    const children = document.createElement('div')
    children.className = 'pvt-json-viewer__children'

    entries.forEach(([childKey, childValue], index) => {
        renderValue(
            childValue,
            children,
            lineCounter,
            depth + 1,
            isArray ? undefined : childKey,
            index === entries.length - 1
        )
    })

    details.appendChild(children)

    const closingContent = document.createElement('div')
    closingContent.innerHTML = `
        <span class="json-bracket">${isArray ? ']' : '}'}</span>${comma}
    `

    details.appendChild(
        createLine(closingContent, lineCounter.value++, depth)
    )

    wrapper.appendChild(details)
    container.appendChild(wrapper)
}

export function createJsonViewer(data: JsonValue): HTMLDivElement {
    const container = document.createElement('div')
    container.className = 'pvt-json-viewer'

    const toolbar = document.createElement('div')
    toolbar.className = 'pvt-json-viewer__toolbar'

    const copyBtn = createButton({
        text: 'Copy JSON',
        variant: 'secondary',
        size: 'sm',
        onClick: async () => {
            await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
            const old = copyBtn.textContent
            copyBtn.textContent = 'Copied!'
            setTimeout(() => {
                copyBtn.textContent = old
            }, 1200)
    }
    })

    toolbar.appendChild(copyBtn)

    const body = document.createElement('div')
    body.className = 'pvt-json-viewer__body'

    renderValue(data, body, { value: 1 })

    container.appendChild(toolbar)
    container.appendChild(body)

    return container
}