import type { EdgeData } from '../Edge'
import type { Graph } from '../Graph'
import type { EdgeLabelPromptOptions, EdgePromptDataOptions } from '../interfaces/InterractionCallbacks'
import type { Modal } from '../ui/components/Modal'
import { FormFactory } from '../utils/FormFactory'

/** Screen-space point the inline input is centred on (the edge midpoint). */
export interface PromptAnchor {
    x: number
    y: number
}

/**
 * Collect an edge label from the user, resolving to the entered string or `null`
 * if they cancelled. `mode` picks the inline floating input (default) or a modal;
 * both settle the same promise, so a caller writes one line regardless of skin.
 */
export function promptEdgeLabel(
    graph: Graph,
    anchor: PromptAnchor | null,
    options: EdgeLabelPromptOptions = {}
): Promise<string | null> {

    if (options.mode === 'modal') {
        // viewer/static modes have no modal slot (createModal returns undefined),
        // which would make the modal prompt resolve as a silent cancel. Fall back
        // to the inline input — it works in every mode — so the edge is still created.
        if (!graph.UIManager.layout?.modal) {
            console.warn('Pivotick: modal label prompt unavailable in this UI mode; using the inline prompt instead.')
            return promptInline(graph, anchor, options)
        }
        return promptLabelModal(graph, options)
    }
    return promptInline(graph, anchor, options)
}

/**
 * Collect a whole data payload from the user via a modal — a declarative form
 * (`fields`) or custom HTML (`render` + `getValues`). Resolves to the collected
 * object, or `null` on cancel.
 */
export function promptEdgeData(graph: Graph, options: EdgePromptDataOptions): Promise<EdgeData | null> {

    let form: HTMLFormElement | null = null

    return runModal<EdgeData>(graph, {
        title: options.title ?? 'Edge details',
        submitLabel: options.submitLabel,
        cancelLabel: options.cancelLabel,
        populate: (body) => {
            // Custom HTML wins over the declarative form when both are supplied.
            if (options.render) {
                options.render(body)
                return
            }
            if (options.fields?.length) {
                form = FormFactory.createForm({ fields: options.fields })
                body.appendChild(form)
            }
        },
        collect: () => {
            if (options.render) return options.getValues ? options.getValues() : {}
            return form ? FormFactory.getValues(form) : {}
        }
    })
}

function makeInput(options: EdgeLabelPromptOptions): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'pvt-edge-label-input'
    input.value = options.initial ?? ''
    input.placeholder = options.placeholder ?? 'Label…'
    // Shielding graph key handlers is done by each caller: the inline prompt in its
    // own keydown handler, the modal in its body-level handler. A blanket
    // stopPropagation here would also stop the modal's Enter/Escape from bubbling.
    return input
}

/** Floating input anchored at the edge midpoint. Enter commits, Esc / blur cancels. */
function promptInline(graph: Graph, anchor: PromptAnchor | null, options: EdgeLabelPromptOptions): Promise<string | null> {

    return new Promise((resolve) => {

        const canvas = graph.UIManager.layout?.canvas
        if (!canvas) return resolve(null)

        const input = makeInput(options)

        const rect = canvas.getBoundingClientRect()
        const x = (anchor?.x ?? rect.left + rect.width / 2) - rect.left
        const y = (anchor?.y ?? rect.top + rect.height / 2) - rect.top
        input.style.left = `${x}px`
        input.style.top = `${y}px`

        let settled = false
        const finish = (value: string | null): void => {
            if (settled) return
            settled = true
            input.removeEventListener('keydown', onKeyDown)
            input.removeEventListener('blur', onBlur)
            input.remove()
            resolve(value)
        }
        const onKeyDown = (e: KeyboardEvent): void => {
            e.stopPropagation() // keep typing (incl. shortcuts) from reaching the graph key handlers
            if (e.key === 'Enter') { e.preventDefault(); finish(input.value) }
            else if (e.key === 'Escape') { e.preventDefault(); finish(null) }
        }
        const onBlur = (): void => finish(null)

        input.addEventListener('keydown', onKeyDown)
        input.addEventListener('blur', onBlur)
        canvas.appendChild(input)

        // Focus next frame so the click/drag that opened the prompt doesn't blur it.
        requestAnimationFrame(() => { input.focus(); input.select() })
    })
}

/** Single-field label modal — shares the generic modal runner. */
function promptLabelModal(graph: Graph, options: EdgeLabelPromptOptions): Promise<string | null> {

    const input = makeInput(options)
    return runModal<string>(graph, {
        title: options.title ?? 'Edge label',
        populate: (body) => body.appendChild(input),
        collect: () => input.value
    })
}

/**
 * Generic modal runner: populate a body, collect a value on submit. Resolves the
 * collected value, or `null` on any cancel path (Cancel button, ×, overlay, Esc).
 * Enter on a single-line input submits; the shadow-edge preview stays up meanwhile.
 */
function runModal<T>(
    graph: Graph,
    config: {
        title?: string
        submitLabel?: string
        cancelLabel?: string
        populate: (body: HTMLElement) => void
        collect: () => T
    }
): Promise<T | null> {

    return new Promise((resolve) => {

        const body = document.createElement('div')
        body.className = 'pvt-edge-prompt-modal-body'
        config.populate(body)

        let settled = false
        const finish = (value: T | null): void => {
            if (settled) return
            settled = true
            resolve(value)
            modal?.hide()
        }

        const modal: Modal | undefined = graph.UIManager.createModal({
            header: config.title ?? 'Edge details',
            body,
            rawBody: true,
            buttons: [
                { variant: 'secondary', text: config.cancelLabel ?? 'Cancel', onClick: () => finish(null) },
                { variant: 'primary', text: config.submitLabel ?? 'Add', onClick: () => finish(config.collect()) },
            ],
            // Any other close path (×, overlay click, Esc) resolves as a cancel.
            onHidden: () => finish(null),
        })

        if (!modal) {
            // No modal slot in this UI mode (viewer/static). A data/form prompt can't
            // render inline, so cancel — but warn rather than veto silently.
            console.warn('Pivotick: modal prompt unavailable in this UI mode; the prompt was cancelled.')
            return resolve(null)
        }

        body.addEventListener('keydown', (e) => {
            e.stopPropagation() // shield the graph key handlers while typing
            if (e.key === 'Escape') { e.preventDefault(); finish(null) }
            // Submit on Enter from a single-line input (leaves textarea newlines alone).
            else if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName === 'INPUT') {
                e.preventDefault()
                finish(config.collect())
            }
        })
        // A declarative form would otherwise submit-and-reload the page.
        body.querySelector('form')?.addEventListener('submit', (e) => {
            e.preventDefault()
            finish(config.collect())
        })

        requestAnimationFrame(() => {
            const first = body.querySelector<HTMLElement>('input, select, textarea')
            first?.focus()
            if (first instanceof HTMLInputElement) first.select()
        })
    })
}
