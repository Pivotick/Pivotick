import type { UIManager } from './UIManager'
import type { GraphInteractionContext } from '../interfaces/GraphInteractions'

/**
 * The canvas lasso, and the guards that make it usable: a lasso drag must not pan or
 * zoom, and the click that ends the drag must not clear the selection it just made.
 *
 * Shared by Select mode's *Lasso* tool and Pivot mode's *Lasso origin*, which want the
 * same gesture and differ only in what they do with the result.
 */
export class LassoArm {
    private armed = false
    private readonly uiManager: UIManager
    private readonly onComplete: () => void

    /**
     * @param onComplete - Called once the lasso has produced a selection, deferred past
     * the gesture that made it. The arm stays armed: the caller decides whether a lasso
     * is one-shot.
     */
    constructor(uiManager: UIManager, onComplete: () => void) {
        this.uiManager = uiManager
        this.onComplete = onComplete
    }

    public isArmed(): boolean {
        return this.armed
    }

    public set(enabled: boolean): void {
        if (enabled === this.armed) return
        this.armed = enabled

        const canvas = this.uiManager.layout?.canvas
        const interaction = this.uiManager.graph.renderer.getGraphInteraction()
        canvas?.classList.toggle('canvas--lasso-mode', enabled)
        this.uiManager.graph.renderer.toggleLassoMode(enabled)

        if (enabled) {
            interaction.on('canvasBeforeZoom', this.cancelPan)
            interaction.on('canvasClick', this.cancelClick)
            // One selection is one lasso: it fires for a single hit (selectNode) as well
            // as for a group (selectNodes).
            interaction.on('selectNode', this.complete)
            interaction.on('selectNodes', this.complete)
        } else {
            interaction.off('canvasBeforeZoom', this.cancelPan)
            interaction.off('canvasClick', this.cancelClick)
            interaction.off('selectNode', this.complete)
            interaction.off('selectNodes', this.complete)
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private cancelPan = (event: any, context: GraphInteractionContext) => {
        if (event?.type === 'wheel' || event?.button === 1) return
        context.cancel()
    }

    private cancelClick = (_event: PointerEvent, context: GraphInteractionContext) => context.cancel()

    // Deferred past the current gesture: disarming synchronously would drop the
    // cancelClick guard, so the trailing canvas click that follows the drag would clear
    // the selection we just made. A macrotask lets that click be swallowed by the
    // still-armed guard first.
    private complete = () => { setTimeout(() => this.onComplete(), 0) }
}
