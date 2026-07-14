import type { UIManager } from './UIManager'

/**
 * The lifecycle phases every UI element participates in, in order. `mount`
 * is handled separately (it needs a container / slot); these three are the
 * argument-less phases the `UIManager` broadcasts.
 */
export type UIPhase = 'afterMount' | 'graphReady' | 'destroy'

/**
 * Base class for every UI element.
 *
 * It provides two things the old hand-wired pattern lacked:
 *
 * 1. **A composite tree.** A component owns `children`; the four
 *    lifecycle phases recurse into them automatically. Nested components no
 *    longer re-implement (and occasionally forget) the recursion by hand — a
 *    parent just declares its children via `addChild`.
 * 2. **A disposable registry.** Anything registered via `track` /
 *    `listen` (event unsubscribes, DOM listeners, timers) is torn down
 *    on {@link destroy}, so components stop leaking interaction subscriptions.
 *
 * Subclasses override the `on*` hooks rather than the lifecycle methods
 * themselves, so the recursion and teardown always run.
 */
export abstract class UIComponent {
    protected uiManager: UIManager
    protected readonly children: UIComponent[] = []
    private readonly disposables: Array<() => void> = []

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    /* ---------- subclass hooks (override as needed) ---------- */

    /** Build DOM and append it to `container`. Runs during {@link mount}. */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected onMount(container?: HTMLElement): void {}
    /** Post-mount wiring (query slots, mount children, add listeners). */
    protected onAfterMount(): void {}
    /** Run once the graph data is ready and the simulation has settled. */
    protected onGraphReady(): void {}
    /** Extra teardown beyond children + tracked disposables. */
    protected onDestroy(): void {}

    /* ---------- lifecycle (driven by the parent / UIManager) ---------- */

    mount(container?: HTMLElement): void {
        this.onMount(container)
    }

    afterMount(): void {
        this.onAfterMount()
        for (const child of this.children) child.afterMount()
    }

    graphReady(): void {
        this.onGraphReady()
        for (const child of this.children) child.graphReady()
    }

    destroy(): void {
        for (const child of [...this.children].reverse()) child.destroy()
        this.children.length = 0
        while (this.disposables.length) this.disposables.pop()!()
        this.onDestroy()
    }

    /* ---------- helpers for subclasses ---------- */

    /**
     * Register a child component. When `slot` is provided the child is mounted
     * into it immediately; its remaining phases are then driven by this
     * component's own {@link afterMount} / {@link graphReady} / {@link destroy}.
     */
    protected addChild<T extends UIComponent>(child: T, slot?: HTMLElement): T {
        this.children.push(child)
        if (slot !== undefined) child.mount(slot)
        return child
    }

    /** Register a teardown fn run (LIFO) on {@link destroy}. */
    protected track(dispose: () => void): void {
        this.disposables.push(dispose)
    }

    /** Add a DOM listener that is automatically removed on {@link destroy}. */
    protected listen(
        target: EventTarget,
        type: string,
        handler: EventListenerOrEventListenerObject,
        options?: AddEventListenerOptions | boolean
    ): void {
        target.addEventListener(type, handler, options)
        this.track(() => target.removeEventListener(type, handler, options))
    }
}
