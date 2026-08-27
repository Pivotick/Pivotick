import type { EdgeData } from '../Edge'
import type { Graph } from '../Graph'
import type { EdgeLabelPromptOptions, EdgePromptDataOptions } from '../interfaces/InterractionCallbacks'
import { promptData, runModal } from './PromptModal'

/** Body class the edge prompts carry on top of the shared one, for their own styling. */
const EDGE_PROMPT_BODY_CLASS = 'pvt-edge-prompt-modal-body'

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
    return promptData<EdgeData>(graph, options, { title: 'Edge details', bodyClass: EDGE_PROMPT_BODY_CLASS })
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
        bodyClass: EDGE_PROMPT_BODY_CLASS,
        populate: (body) => body.appendChild(input),
        collect: () => input.value
    })
}
