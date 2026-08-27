/**
 * The UI surfaces that can render consumer-supplied content asynchronously.
 * Handed to {@link AsyncContentOptions.placeholder} / `.error` so one factory
 * can serve every surface and still tell them apart.
 *
 * @category UI Options
 */
export type AsyncSurface = 'tooltip' | 'properties' | 'neighbors' | 'mainHeader' | 'extraPanel'

/**
 * Content a consumer hook may return. A `string` renders as plain **text**;
 * return an `HTMLElement` to render your own markup.
 *
 * @category UI Options
 */
export type Renderable = HTMLElement | string

/**
 * What a content hook may return: the content itself, or a promise of it.
 *
 * When a hook returns a promise the library mounts a placeholder in its slot,
 * swaps in the resolved content, and drops the result if the slot has since
 * gone away (the tooltip moved to another node, the selection changed, the
 * panel was torn down). See {@link RenderContext} for cancelling the work that
 * produced it.
 *
 * @category UI Options
 */
export type RenderResult = Renderable | Promise<Renderable>

/**
 * Passed as the **last** argument to every async-capable content hook, so a
 * consumer can abandon work the UI no longer needs.
 *
 * Existing synchronous hooks simply ignore it — a one-argument callback stays
 * assignable, and nothing about its timing changes.
 *
 * @example
 * ```ts
 * renderNodeExtra: async (node, { signal }) => {
 *     const res = await fetch(`/enrich/${node.id}`, { signal })
 *     return renderChips(await res.json())
 * }
 * ```
 *
 * @category UI Options
 */
export interface RenderContext {
    /**
     * Aborted when this render is superseded — the tooltip hid or reopened for
     * another element, the selection changed, the panel was refreshed or
     * removed, the graph was destroyed. Forward it to `fetch` and in-flight
     * requests are cancelled instead of leaked.
     */
    readonly signal: AbortSignal
    /**
     * `true` once this render has been superseded. A cheap guard for consumers
     * doing non-abortable work, so they can bail out between steps without
     * touching {@link RenderContext.signal}.
     */
    isStale(): boolean
}

/**
 * What the library shows while a content hook's promise is in flight, and what
 * it shows if that promise rejects. Both are optional — the built-in skeleton
 * and error affordance follow the active theme.
 *
 * Synchronous hooks never see either of these: they commit in the same frame,
 * exactly as they always did.
 *
 * @example
 * ```ts
 * UI: {
 *     asyncContent: {
 *         placeholder: (surface) => surface === 'tooltip' ? 'Loading…' : mySkeleton(),
 *         error: 'Could not load',
 *     },
 * }
 * ```
 *
 * @category UI Options
 */
export interface AsyncContentOptions {
    /**
     * Shown in the slot while an async hook is pending.
     * @default a themed skeleton
     */
    placeholder?: Renderable | ((surface: AsyncSurface) => Renderable)
    /**
     * Shown in the slot when an async hook rejects. An aborted render is not a
     * failure and never reaches this.
     * @default a compact themed error line
     */
    error?: Renderable | ((surface: AsyncSurface, error: unknown) => Renderable)
}
