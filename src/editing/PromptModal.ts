import type { Graph } from '../Graph'
import type { ConfirmOptions, PromptDataOptions } from '../interfaces/InterractionCallbacks'
import type { Modal } from '../ui/components/Modal'
import { FormFactory } from '../utils/FormFactory'

/**
 * Class every prompt/confirm modal body carries, so one set of styles covers them
 * all. Callers add their own class on top when they need to be addressed specifically.
 */
export const PROMPT_BODY_CLASS = 'pvt-prompt-modal-body'

/**
 * Generic modal runner: populate a body, collect a value on submit. Resolves the
 * collected value, or `null` on any cancel path (Cancel button, ×, overlay, Esc).
 * Enter on a single-line input submits.
 */
export function runModal<T>(
    graph: Graph,
    config: {
        title?: string
        submitLabel?: string
        cancelLabel?: string
        /** Extra class on the body, on top of {@link PROMPT_BODY_CLASS}. */
        bodyClass?: string
        /** Styling of the submit button. @default 'primary' */
        submitVariant?: 'primary' | 'danger'
        populate: (body: HTMLElement) => void
        collect: () => T
    }
): Promise<T | null> {

    return new Promise((resolve) => {

        const body = document.createElement('div')
        body.className = config.bodyClass ? `${PROMPT_BODY_CLASS} ${config.bodyClass}` : PROMPT_BODY_CLASS
        config.populate(body)

        let settled = false
        const finish = (value: T | null): void => {
            if (settled) return
            settled = true
            resolve(value)
            modal?.hide()
        }

        const modal: Modal | undefined = graph.UIManager.createModal({
            header: config.title ?? 'Details',
            body,
            rawBody: true,
            buttons: [
                { variant: 'secondary', text: config.cancelLabel ?? 'Cancel', onClick: () => finish(null) },
                { variant: config.submitVariant ?? 'primary', text: config.submitLabel ?? 'Add', onClick: () => finish(config.collect()) },
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

/**
 * Collect a whole data payload from the user via a modal — a declarative form
 * (`fields`) or custom HTML (`render` + `getValues`). Resolves to the collected
 * object, or `null` on cancel. Backs both `promptData` context helpers.
 */
export function promptData<TData>(
    graph: Graph,
    options: PromptDataOptions<TData>,
    defaults: { title: string, bodyClass?: string }
): Promise<TData | null> {

    let form: HTMLFormElement | null = null

    return runModal<TData>(graph, {
        title: options.title ?? defaults.title,
        submitLabel: options.submitLabel,
        cancelLabel: options.cancelLabel,
        bodyClass: defaults.bodyClass,
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
            if (options.render) return (options.getValues ? options.getValues() : {}) as TData
            return (form ? FormFactory.getValues(form) : {}) as TData
        }
    })
}

/**
 * Ask the user to confirm a destructive action. Resolves `true` only on the confirm
 * button; every cancel path (Cancel, ×, overlay, Esc) — and a UI mode with no modal
 * slot — resolves `false`, so a caller can treat it as "don't proceed".
 */
export function confirmModal(graph: Graph, options: ConfirmOptions = {}): Promise<boolean> {

    const result = runModal<boolean>(graph, {
        title: options.title ?? 'Confirm',
        submitLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        submitVariant: options.variant ?? 'danger',
        bodyClass: 'pvt-confirm-modal-body',
        populate: (body) => {
            if (!options.body) return
            // A string is copy, not markup — assign it as text.
            if (typeof options.body === 'string') {
                const text = document.createElement('p')
                text.className = 'pvt-confirm-modal-text'
                text.textContent = options.body
                body.appendChild(text)
                return
            }
            body.appendChild(options.body)
        },
        collect: () => true
    })

    // `null` (cancelled / no modal slot) is a refusal.
    return result.then(value => value === true)
}
