import type { Node } from '../Node'

/** Default side length (px) of the square node-preview viewport. */
export const DEFAULT_NODE_PREVIEW_SIZE = 32

/** Class applied to the wrapping <svg> when none is supplied. */
const DEFAULT_NODE_PREVIEW_CLASS = 'pvt-node-preview-icon'

/** The selection-highlight ring drawn around a selected node's rendered group. */
const SELECTION_HIGHLIGHT_SELECTOR = 'circle.pvt-node-selected-highlight'

export interface NodePreviewOptions {
    /** Side length (px) of the square preview. Defaults to {@link DEFAULT_NODE_PREVIEW_SIZE}. */
    size?: number
    /** Class set on the wrapping <svg>. Defaults to `'pvt-node-preview-icon'`. */
    className?: string
    /** Strip the selection-highlight ring from the clone (the tooltip wants this). Defaults to `false`. */
    removeSelectionHighlight?: boolean
}

/**
 * Clone a node's rendered <g> group and scale/center it to fit a `size`×`size` box.
 *
 * The bounding box is read from the live `element` (which is laid out in the DOM); the
 * returned clone carries the centering transform and is not yet attached anywhere.
 */
function buildScaledClone(element: SVGGElement, size: number, removeSelectionHighlight: boolean): SVGGElement {
    const clonedGroup = element.cloneNode(true) as SVGGElement
    if (removeSelectionHighlight) {
        clonedGroup.querySelector(SELECTION_HIGHLIGHT_SELECTOR)?.remove()
    }
    const bbox = element.getBBox()
    const scale = size / Math.max(bbox.width, bbox.height)
    clonedGroup.setAttribute(
        'transform',
        `translate(${(size - bbox.width * scale) / 2 - bbox.x * scale}, ${(size - bbox.height * scale) / 2 - bbox.y * scale}) scale(${scale})`
    )
    return clonedGroup
}

/**
 * Build the standard node-preview "vignette": a square <svg> viewport containing the node's
 * rendered graphic, scaled to fit. Shared by the sidebar header, tooltip, search box,
 * neighbors list and node modals so the cloning/scaling logic lives in one place.
 *
 * The wrapping <svg> is always returned (so callers get a stable element to attach), even
 * when the node has not been rendered yet — in that case it is simply empty.
 *
 * @param source A node, or its rendered group directly. `null`/`undefined` yields an empty preview.
 */
export function createNodePreview(source: Node | SVGGElement | null | undefined, options: NodePreviewOptions = {}): SVGSVGElement {
    const size = options.size ?? DEFAULT_NODE_PREVIEW_SIZE
    const className = options.className ?? DEFAULT_NODE_PREVIEW_CLASS
    const removeSelectionHighlight = options.removeSelectionHighlight ?? false

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', className)
    svg.setAttribute('width', size.toString())
    svg.setAttribute('height', size.toString())
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`)
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')

    const element = source instanceof SVGGElement ? source : (source?.getGraphElement() ?? null)
    if (element instanceof SVGGElement) {
        svg.appendChild(buildScaledClone(element, size, removeSelectionHighlight))
    }

    return svg
}
