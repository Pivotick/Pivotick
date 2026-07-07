import type { Node } from '../Node'

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

/** Default side length (px) of the square node-preview viewport. */
export const DEFAULT_NODE_PREVIEW_SIZE = 32

/** Class applied to the wrapping <svg> when none is supplied. */
const DEFAULT_NODE_PREVIEW_CLASS = 'pvt-node-preview-icon'

/** The rendered `<image>` an `imagePath` node carries (regardless of `imageFit`). */
const NODE_IMAGE_SELECTOR = 'image.node-content'

/** The selection-highlight ring drawn around a selected node's rendered group. */
const SELECTION_HIGHLIGHT_SELECTOR = 'circle.pvt-node-selected-highlight'

/**
 * The node's label text. The renderer wraps the label (text + optional background) in a
 * dedicated `<g>`, so its parent group is what we drop to frame the node graphic only.
 */
const NODE_LABEL_SELECTOR = 'text.pvt-node-label'

export interface NodePreviewOptions {
    /** Side length (px) of the square preview. Defaults to {@link DEFAULT_NODE_PREVIEW_SIZE}. */
    size?: number
    /** Class set on the wrapping <svg>. Defaults to `'pvt-node-preview-icon'`. */
    className?: string
    /** Strip the selection-highlight ring from the clone (the tooltip wants this). Defaults to `false`. */
    removeSelectionHighlight?: boolean
}

/**
 * Measure a not-yet-attached clone's bounding box. `getBBox()` only reports real geometry for
 * elements living in a rendered SVG tree, so the clone is briefly attached to the source's
 * owning `<svg>`, measured, then detached again — all synchronously, so it never paints.
 *
 * Falls back to measuring the (detached) clone directly when the source has no owning `<svg>`.
 */
function measureBBox(clone: SVGGElement, source: SVGGElement): DOMRect {
    const svg = source.ownerSVGElement
    if (!svg) return clone.getBBox()
    svg.appendChild(clone)
    const bbox = clone.getBBox()
    svg.removeChild(clone)
    return bbox
}

/**
 * Clone a node's rendered <g> group and scale/center it to fit a `size`×`size` box.
 *
 * The label (text + its optional background) is stripped so the preview frames only the node
 * graphic. Because the clone — not the live `element` — is what gets measured, the centering
 * reflects the de-labeled graphic rather than reserving space for the removed label. The
 * returned clone carries the centering transform and is not yet attached anywhere.
 */
function buildScaledClone(element: SVGGElement, size: number, removeSelectionHighlight: boolean): SVGGElement {
    const clonedGroup = element.cloneNode(true) as SVGGElement
    if (removeSelectionHighlight) {
        clonedGroup.querySelector(SELECTION_HIGHLIGHT_SELECTOR)?.remove()
    }
    clonedGroup.querySelector(NODE_LABEL_SELECTOR)?.parentElement?.remove()

    const bbox = measureBBox(clonedGroup, element)
    const scale = size / Math.max(bbox.width, bbox.height)
    clonedGroup.setAttribute(
        'transform',
        `translate(${(size - bbox.width * scale) / 2 - bbox.x * scale}, ${(size - bbox.height * scale) / 2 - bbox.y * scale}) scale(${scale})`
    )
    return clonedGroup
}

/**
 * Resolve the picture URL an `imagePath` node is showing, read straight off its rendered
 * `<image>` (so it reflects the *resolved* path — whatever a per-node function, style map or
 * default produced — without re-running style resolution). Returns `null` for non-image
 * nodes and for nodes not yet rendered.
 *
 * @param source A node, or its rendered group directly.
 */
export function getNodeImageHref(source: Node | SVGGElement | null | undefined): string | null {
    const element = source instanceof SVGGElement ? source : (source?.getGraphElement() ?? null)
    if (!(element instanceof SVGGElement)) return null
    const image = element.querySelector<SVGImageElement>(NODE_IMAGE_SELECTOR)
    if (!image) return null
    // d3 writes the src as a namespaced `xlink:href`; fall back to the plain attr / property.
    return image.getAttributeNS(XLINK_NS, 'href') ?? image.getAttribute('href') ?? image.href?.baseVal ?? null
}

/** An `<image>` of the source picture, fit (aspect-preserved, letterboxed) into the preview box. */
function buildImagePreview(href: string, size: number): SVGImageElement {
    const image = document.createElementNS(SVG_NS, 'image') as SVGImageElement
    image.setAttribute('class', 'pvt-node-preview-image')
    image.setAttribute('x', '0')
    image.setAttribute('y', '0')
    image.setAttribute('width', size.toString())
    image.setAttribute('height', size.toString())
    image.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    image.setAttributeNS(XLINK_NS, 'href', href)
    image.setAttribute('href', href)
    return image
}

/**
 * Build the standard node-preview "vignette": a square <svg> viewport containing the node's
 * rendered graphic, scaled to fit. Shared by the sidebar header, tooltip, search box,
 * neighbors list and node modals so the cloning/scaling logic lives in one place.
 *
 * For an `imagePath` node the actual picture is shown (fit to the box, aspect preserved),
 * rather than a shrunk clone of the framed node graphic. Every other node keeps the clone.
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

    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('class', className)
    svg.setAttribute('width', size.toString())
    svg.setAttribute('height', size.toString())
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`)
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')

    const element = source instanceof SVGGElement ? source : (source?.getGraphElement() ?? null)
    if (element instanceof SVGGElement) {
        const imageHref = getNodeImageHref(element)
        svg.appendChild(imageHref ? buildImagePreview(imageHref, size) : buildScaledClone(element, size, removeSelectionHighlight))
    }

    return svg
}
