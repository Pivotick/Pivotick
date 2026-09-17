import type { GraphRendererOptions } from '../../interfaces/RendererOptions'
import type { GraphSvgRenderer } from './GraphSvgRenderer'

/**
 * How far below its threshold a drawing has to fall before it is taken away again.
 *
 * Everything sharing a threshold is parked on the same line at the same moment — every node
 * on one `tiers` array, every label at one font size — so without a band a slow pinch across
 * it flickers all of them at once.
 */
export const DETAIL_HYSTERESIS = 0.85

/**
 * Whether a label is worth drawing at the current zoom.
 *
 * The answer is keyed to the font size, never to the label: two labels drawn at the same size
 * have to agree however long ago each was last looked at, and holding the band per element
 * lets two of them enter it from opposite sides and then disagree with nothing to reconcile
 * them.
 */
export class LabelGate {

    private rendererOptions: GraphRendererOptions
    private renderer: GraphSvgRenderer
    /** Whether a label at each font size is currently drawn — what the band remembers. */
    private showing = new Map<number, boolean>()

    public constructor(rendererOptions: GraphRendererOptions, renderer: GraphSvgRenderer) {
        this.rendererOptions = rendererOptions
        this.renderer = renderer
    }

    /** The rendered font size, in CSS pixels, a label has to reach to be drawn. */
    public get threshold(): number {
        const declared = this.rendererOptions.minLabelFontSize
        return typeof declared === 'number' && declared > 0 ? declared : 0
    }

    /** Whether the gate is on at all. Off, every label is drawn at every zoom. */
    public isEnabled(): boolean {
        return this.threshold > 0
    }

    /**
     * Whether a label declared at `fontSize` graph units is drawn at the current zoom.
     *
     * A graph unit is a CSS pixel at zoom 1, so the rendered size is the declared size times
     * the zoom — and it is the rendered size that decides, never the zoom scalar, which
     * means a different apparent size on every dataset.
     */
    public shows(fontSize: number): boolean {
        // A label whose size cannot be read is drawn: the gate hides what it can prove is
        // too small, and proves nothing here.
        if (!this.isEnabled() || !(fontSize > 0)) return true

        const rendered = fontSize * this.renderer.getZoomTransform().k
        // A label already on screen holds until it shrinks well past the threshold.
        const engageAt = this.showing.get(fontSize) ? this.threshold * DETAIL_HYSTERESIS : this.threshold
        const show = rendered >= engageAt
        this.showing.set(fontSize, show)
        return show
    }
}

/** The font size a label style asks for, as a number the gate can multiply. */
export function labelStyleFontSize(fontSize: number | string | undefined): number {
    const size = typeof fontSize === 'number' ? fontSize : Number.parseFloat(String(fontSize))
    return Number.isFinite(size) ? size : 0
}
