import type { Graph } from '../Graph'
import type { BusyIndicatorOptions } from '../interfaces/GraphUI'
import './hookBusy.scss'

type Point = { x: number, y: number }

/**
 * Where the spinner sits: `'canvas'` is the bottom-centre of the canvas, a point or a
 * function returning one is in graph space. A function is re-read every frame, and a
 * `null` from it falls back to the bottom-centre.
 */
export type BusyAnchor = 'canvas' | Point | (() => Point | null)

/** Wraps a context prompt so the indicator steps aside while it is open. */
export type PromptWrap = <A extends unknown[], R>(prompt: (...args: A) => Promise<R>) => (...args: A) => Promise<R>

const DEFAULTS = { delay: 200, label: 'Waiting…' }

/** Waits currently on screen, per graph, so the root carries `data-pvt-busy` while any is. */
const shownPerGraph = new WeakMap<Graph, Set<HookBusy>>()

/**
 * Await a consumer hook with a busy cue on screen: after `delay`, the graph's root gets
 * `data-pvt-busy` and a spinner appears at `anchor`. Every prompt the hook opens through
 * `wrap` takes the cue down while it is open. The cue goes for good when the hook
 * settles or `signal` aborts.
 */
export async function runHook<T>(
    graph: Graph,
    anchor: BusyAnchor,
    call: (wrap: PromptWrap) => T | Promise<T>,
    signal?: AbortSignal,
): Promise<T> {

    const options = resolveOptions(graph)
    if (!options) return call(prompt => prompt)

    const busy = new HookBusy(graph, anchor, options)
    const end = () => busy.end()
    signal?.addEventListener('abort', end, { once: true })

    const wrap: PromptWrap = prompt => async (...args) => {
        busy.pause()
        try {
            return await prompt(...args)
        } finally {
            busy.resume()
        }
    }

    busy.resume()
    try {
        return await call(wrap)
    } finally {
        signal?.removeEventListener('abort', end)
        busy.end()
    }
}

function resolveOptions(graph: Graph): Required<Omit<BusyIndicatorOptions, 'enabled'>> | null {
    const declared = graph.UIManager?.getOptions().busyIndicator
    if (declared === false) return null
    const options = typeof declared === 'object' ? declared : {}
    if (options.enabled === false) return null
    return {
        delay: options.delay ?? DEFAULTS.delay,
        label: options.label ?? DEFAULTS.label,
    }
}

class HookBusy {

    private graph: Graph
    private anchor: BusyAnchor
    private options: { delay: number, label: string }

    /** Prompts open right now; the cue is down while any is. */
    private pauses = 1
    private ended = false
    private timer: ReturnType<typeof setTimeout> | null = null
    private frame: number | null = null
    private element: HTMLElement | null = null

    constructor(graph: Graph, anchor: BusyAnchor, options: { delay: number, label: string }) {
        this.graph = graph
        this.anchor = anchor
        this.options = options
    }

    public pause(): void {
        if (this.ended) return
        this.pauses++
        this.hide()
    }

    /** Busy again once the last open prompt closes, shown after the delay. */
    public resume(): void {
        if (this.ended) return
        this.pauses = Math.max(0, this.pauses - 1)
        if (this.pauses > 0 || this.timer || this.element) return
        this.timer = setTimeout(() => {
            this.timer = null
            this.show()
        }, this.options.delay)
    }

    public end(): void {
        this.ended = true
        this.hide()
    }

    private show(): void {
        const canvas = this.graph.UIManager.layout?.canvas
        if (!canvas) return

        const element = document.createElement('div')
        element.className = 'pvt-busy-indicator'
        element.setAttribute('role', 'status')
        element.setAttribute('aria-busy', 'true')
        const spinner = document.createElement('span')
        spinner.className = 'pvt-busy-spinner'
        spinner.setAttribute('aria-hidden', 'true')
        const label = document.createElement('span')
        label.className = 'pvt-busy-label'
        label.textContent = this.options.label
        element.append(spinner, label)
        canvas.appendChild(element)
        this.element = element

        let shown = shownPerGraph.get(this.graph)
        if (!shown) shownPerGraph.set(this.graph, shown = new Set())
        shown.add(this)
        this.root()?.setAttribute('data-pvt-busy', '')

        this.place()
    }

    private hide(): void {
        if (this.timer) clearTimeout(this.timer)
        this.timer = null
        if (this.frame !== null) cancelAnimationFrame(this.frame)
        this.frame = null
        if (!this.element) return

        this.element.remove()
        this.element = null
        const shown = shownPerGraph.get(this.graph)
        shown?.delete(this)
        if (!shown?.size) this.root()?.removeAttribute('data-pvt-busy')
    }

    /** Follow the anchor through zoom, pan and a moving target, a frame at a time. */
    private place(): void {
        const element = this.element
        const canvas = this.graph.UIManager.layout?.canvas
        if (!element || !canvas) return

        const point = this.anchor === 'canvas'
            ? null
            : typeof this.anchor === 'function' ? this.anchor() : this.anchor

        element.classList.toggle('pvt-busy-indicator--at-point', Boolean(point))
        if (point) {
            const screen = this.graph.renderer.graphToScreenCoordinates(point.x, point.y)
            const rect = canvas.getBoundingClientRect()
            element.style.left = `${screen.x - rect.left}px`
            element.style.top = `${screen.y - rect.top}px`
        } else {
            element.style.left = ''
            element.style.top = ''
        }

        if (this.anchor !== 'canvas') this.frame = requestAnimationFrame(() => this.place())
    }

    private root(): HTMLElement | undefined {
        return this.graph.UIManager.getRootContainer()
    }
}
