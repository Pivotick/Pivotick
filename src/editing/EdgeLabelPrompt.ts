import type { Graph } from '../Graph'
import type { EdgeLabelPromptOptions } from '../interfaces/InterractionCallbacks'
import type { Modal } from '../ui/components/Modal'

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

    return options.mode === 'modal'
        ? promptModal(graph, options)
        : promptInline(graph, anchor, options)
}

function makeInput(options: EdgeLabelPromptOptions): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'pvt-edge-label-input'
    input.value = options.initial ?? ''
    input.placeholder = options.placeholder ?? 'Label…'
    // Keep typing (incl. shortcuts like backspace) from reaching the graph key handlers.
    input.addEventListener('keydown', (e) => e.stopPropagation())
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

/** Modal with a single label field. Add commits, Cancel / close / Esc cancels. */
function promptModal(graph: Graph, options: EdgeLabelPromptOptions): Promise<string | null> {

    return new Promise((resolve) => {

        const input = makeInput(options)
        const body = document.createElement('div')
        body.className = 'pvt-edge-label-modal-body'
        body.appendChild(input)

        let settled = false
        const finish = (value: string | null): void => {
            if (settled) return
            settled = true
            resolve(value)
            modal?.hide()
        }

        const modal: Modal | undefined = graph.UIManager.createModal({
            header: options.title ?? 'Edge label',
            body,
            rawBody: true,
            buttons: [
                { variant: 'secondary', text: 'Cancel', onClick: () => finish(null) },
                { variant: 'primary', text: 'Add', onClick: () => finish(input.value) },
            ],
            // Any other close path (×, overlay click, Esc) resolves as a cancel.
            onHidden: () => finish(null),
        })

        if (!modal) return resolve(null)

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); finish(input.value) }
            else if (e.key === 'Escape') { e.preventDefault(); finish(null) }
        })

        requestAnimationFrame(() => { input.focus(); input.select() })
    })
}
