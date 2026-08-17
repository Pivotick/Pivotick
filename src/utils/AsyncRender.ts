import type { AsyncContentOptions, AsyncSurface, RenderContext, Renderable } from '../interfaces/AsyncContent'
import { isThenable, toRenderedElement } from './Getters'

/**
 * Marks a slot waiting on an async render. It is the commit target *and* the
 * staleness token: a resolution only lands in slots still carrying its id, and
 * {@link AsyncRenderScope.supersede} strips the id from the live slot precisely
 * so a late arrival cannot overwrite newer content.
 */
const SLOT_ATTRIBUTE = 'data-pvt-async-slot'

let slotCounter = 0

/** One in-flight render: its slot, and the means to call it off. */
interface PendingRender {
    slotId: string
    slot: HTMLElement
    stale: boolean
    controller?: AbortController
}

/** A themed three-line skeleton — the default "content is on its way" affordance. */
function defaultPlaceholder(): HTMLElement {
    const skeleton = document.createElement('div')
    skeleton.className = 'pvt-async-skeleton'
    skeleton.setAttribute('aria-busy', 'true')
    for (let line = 0; line < 3; line++) skeleton.appendChild(document.createElement('span'))
    return skeleton
}

/** A compact themed error line — deliberately quiet, the console carries the detail. */
function defaultError(): HTMLElement {
    const error = document.createElement('div')
    error.className = 'pvt-async-error'
    error.textContent = 'Content could not be loaded'
    return error
}

/** An abort is the library calling the render off, not the consumer failing. */
function isAbortError(error: unknown): boolean {
    return (error as { name?: string } | null)?.name === 'AbortError'
}

let neverAbortedSignal: AbortSignal | undefined

/**
 * The context for a resolve that nothing can supersede — a one-shot read
 * outside any render pass (the inspect modal, a facet-filter lookup). Its
 * signal never aborts and it is never stale.
 */
export const DETACHED_RENDER_CONTEXT: RenderContext = {
    get signal(): AbortSignal {
        return (neverAbortedSignal ??= new AbortController().signal)
    },
    isStale: () => false,
}

/**
 * Owns the placeholder, the swap and the staleness guard for one UI surface's
 * consumer-supplied content — the three parts a consumer cannot get right on
 * its own, because they depend on lifecycle it can't observe.
 *
 * A surface calls {@link supersede} when it begins a new render pass, then
 * resolves each of its hooks through {@link resolve} / {@link content}.
 *
 * **A synchronous hook is handed straight back**: same call, same frame, no
 * wrapper element, no placeholder. Nothing changes for consumers who were
 * always sync. A hook that returns a promise gets a placeholder slot now and
 * its content when it settles — and only if that slot is still on the page.
 */
export class AsyncRenderScope {

    private pending = new Set<PendingRender>()

    private readonly surface: AsyncSurface
    private readonly options: () => AsyncContentOptions | undefined
    private readonly onSettle?: () => void

    /**
     * @param surface - Which surface this scope renders, reported to the consumer's
     *                  placeholder / error factories.
     * @param options - Read lazily, so a scope built at construction time still sees
     *                  options merged later.
     * @param onSettle - Run after content lands in a slot, for surfaces whose geometry
     *                   depends on their content (the tooltip repositions itself).
     */
    constructor(
        surface: AsyncSurface,
        options: () => AsyncContentOptions | undefined,
        onSettle?: () => void,
    ) {
        this.surface = surface
        this.options = options
        this.onSettle = onSettle
    }

    /**
     * Abandon every render in flight: abort their signals and release their
     * slots, so a late resolution can no longer commit.
     *
     * Call it at the top of a render pass (and on teardown), before the old
     * content is cleared.
     */
    public supersede(): void {
        for (const render of this.pending) {
            render.stale = true
            render.controller?.abort()
            // Releasing the id is what makes the commit a no-op. A *copy* of the
            // slot keeps its id (a pinned tooltip, say) and still gets filled in.
            render.slot.removeAttribute(SLOT_ATTRIBUTE)
        }
        this.pending.clear()
    }

    /**
     * Resolve a maybe-async value and build an element from it.
     *
     * @param produce - Runs the consumer's hook. Receives the {@link RenderContext}
     *                  to forward to it.
     * @param build - Turns the resolved value into the element to mount. Runs on the
     *                sync path immediately, on the async path once the promise settles.
     * @returns The built element when `produce` was synchronous, otherwise a
     *          placeholder slot that fills itself in.
     */
    public resolve<T>(
        produce: (ctx: RenderContext) => T | Promise<T>,
        build: (value: T) => HTMLElement | undefined,
    ): HTMLElement | undefined {
        const render: PendingRender = { slotId: '', slot: undefined as unknown as HTMLElement, stale: false }
        const ctx: RenderContext = {
            // Lazy: a sync hook that never touches `signal` costs no controller.
            get signal(): AbortSignal {
                render.controller ??= new AbortController()
                if (render.stale) render.controller.abort()
                return render.controller.signal
            },
            isStale: () => render.stale,
        }

        let produced: T | Promise<T>
        try {
            produced = produce(ctx)
        } catch (error) {
            this.report(error)
            return this.errorElement(error)
        }

        if (!isThenable(produced)) return build(produced as T)

        render.slotId = `pvt-async-${++slotCounter}`
        render.slot = this.placeholderSlot(render.slotId)
        this.pending.add(render)

        void Promise.resolve(produced).then(
            (value) => {
                this.pending.delete(render)
                this.commit(render, () => build(value))
            },
            (error) => {
                this.pending.delete(render)
                if (render.stale || isAbortError(error)) return
                this.report(error)
                this.commit(render, () => this.errorElement(error))
            },
        )
        return render.slot
    }

    /**
     * Resolve a consumer content hook — static content, or a function of the
     * surface's own arguments plus a trailing {@link RenderContext}.
     */
    public content<A extends unknown[]>(
        input: Renderable | ((...args: [...A, RenderContext]) => Renderable | Promise<Renderable>) | undefined,
        ...args: A
    ): HTMLElement | undefined {
        if (input === undefined) return undefined

        return this.resolve(
            (ctx) => (typeof input === 'function' ? input(...args, ctx) : input),
            toRenderedElement,
        )
    }

    /* ---------- internals ---------- */

    /**
     * Write the settled content into every slot still carrying this render's id
     * — the live one, plus any copy made while it was pending (a tooltip pinned
     * mid-fetch). No slots left means the render was superseded: drop it.
     */
    private commit(render: PendingRender, build: () => HTMLElement | undefined): void {
        const targets = document.querySelectorAll<HTMLElement>(`[${SLOT_ATTRIBUTE}="${render.slotId}"]`)
        if (targets.length === 0) return

        const content = build()
        targets.forEach((target, index) => {
            // The same element cannot live in two slots; copies get a deep clone.
            const value = index === 0 ? content : content?.cloneNode(true) as HTMLElement | undefined
            target.removeAttribute(SLOT_ATTRIBUTE)
            target.classList.remove('pvt-async-pending')
            target.replaceChildren()
            if (value) target.appendChild(value)
        })
        this.onSettle?.()
    }

    private placeholderSlot(slotId: string): HTMLElement {
        const slot = document.createElement('div')
        slot.className = 'pvt-async-slot pvt-async-pending'
        slot.setAttribute(SLOT_ATTRIBUTE, slotId)

        const placeholder = this.options()?.placeholder
        const resolved = typeof placeholder === 'function' ? placeholder(this.surface) : placeholder
        slot.appendChild(toRenderedElement(resolved) ?? defaultPlaceholder())
        return slot
    }

    private errorElement(error: unknown): HTMLElement | undefined {
        const configured = this.options()?.error
        const resolved = typeof configured === 'function' ? configured(this.surface, error) : configured
        return toRenderedElement(resolved) ?? defaultError()
    }

    private report(error: unknown): void {
        console.error(`[pivotick] async ${this.surface} content failed to render.`, error)
    }
}
