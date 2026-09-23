import type { EmptyStateContext, EmptyStateOptions } from '../../../interfaces/GraphUI'
import type { RenderContext } from '../../../interfaces/AsyncContent'
import { AsyncRenderScope } from '../../../utils/AsyncRender'
import { toRenderedElement } from '../../../utils/Getters'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import './emptyState.scss'

const DEFAULT_MESSAGE = 'Nothing on the canvas yet'

/**
 * The card an empty canvas shows: up while the graph holds no node and no note, down
 * as soon as it holds either. Filtered-out nodes still count, since the graph is not
 * empty, only narrowed.
 *
 * `render` runs on each appearance rather than on each change, and is told whether the
 * graph has ever held a node.
 */
export class EmptyState extends UIComponent {
    private slot?: HTMLElement
    private readonly scope: AsyncRenderScope
    private shown = false
    private heldNode = false
    /** Reads wait until the constructor has handed the graph its initial data. */
    private armed = false

    constructor(uiManager: UIManager) {
        super(uiManager)
        this.scope = new AsyncRenderScope('emptyState', () => this.uiManager.getOptions().asyncContent)
    }

    protected onMount(container?: HTMLElement) {
        this.slot = container
    }

    protected onAfterMount() {
        const graph = this.uiManager.graph
        const sync = () => this.sync()
        for (const event of ['dataBatchChanged', 'noteAdd', 'noteRemove'] as const) {
            graph.on(event, sync)
            this.track(() => graph.off(event, sync))
        }
        // `noteManager.clear()` announces itself no other way.
        this.track(graph.onVisibleChange(sync))

        // This runs inside the graph's constructor, before its data is set.
        let destroyed = false
        this.track(() => { destroyed = true })
        queueMicrotask(() => {
            if (destroyed) return
            this.armed = true
            this.sync()
        })
    }

    protected onDestroy() {
        this.scope.supersede()
        this.slot?.replaceChildren()
        this.slot = undefined
        this.shown = false
    }

    private sync() {
        if (!this.armed || !this.slot) return
        const graph = this.uiManager.graph
        const hasNode = graph.getNodeCount() > 0
        if (hasNode) this.heldNode = true
        const empty = !hasNode && graph.noteManager.count() === 0

        if (empty === this.shown) return
        if (empty) this.show()
        else this.hide()
    }

    private show() {
        if (!this.slot) return
        this.scope.supersede()

        const render = this.declared().render ?? DEFAULT_MESSAGE
        const initial = !this.heldNode
        const graph = this.uiManager.graph
        const content = this.scope.resolve(
            (ctx: RenderContext) => {
                if (typeof render !== 'function') return render
                const context: EmptyStateContext = {
                    get signal() { return ctx.signal },
                    isStale: () => ctx.isStale(),
                    graph,
                    initial,
                }
                return render(context)
            },
            toRenderedElement,
        )

        const card = document.createElement('div')
        card.className = 'pvt-empty-state-card'
        if (content) card.appendChild(content)
        this.slot.replaceChildren(card)
        this.shown = true
    }

    private hide() {
        this.scope.supersede()
        this.slot?.replaceChildren()
        this.shown = false
    }

    private declared(): EmptyStateOptions {
        const option = this.uiManager.getOptions().emptyState
        return typeof option === 'object' ? option : {}
    }
}
