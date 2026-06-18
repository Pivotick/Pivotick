import type { Edge } from '../../Edge'
import type { Node } from '../../Node'
import { createSvgElement } from '../../utils/ElementCreation'

export class ShadowLinkManager {

    private shadowlinkMap = new WeakMap<HTMLElement, SVGPathElement>()
    private shadowlinkBoundingBoxesMap = new WeakMap<HTMLElement, { source: DOMRect, target: DOMRect }>()
    private shadowLinkContainer?: SVGSVGElement

    constructor(shadowlinkContainer: SVGSVGElement) {
        this.shadowLinkContainer = shadowlinkContainer
    }

    public setBoundingBox(pinnedTt: HTMLElement, boxes: { source: DOMRect, target: DOMRect}) {
        this.shadowlinkBoundingBoxesMap.set(pinnedTt, boxes)
    }

    public addShadowLink(pinnedTt: HTMLElement) {
        const shadowLink = createSvgElement('path', {
            class: 'pivotick-shadowlink',
        })
        this.shadowlinkMap.set(pinnedTt, shadowLink)
        this.shadowLinkContainer?.appendChild(shadowLink)
    }

    public updateShadowLink(pinnedTt: HTMLElement) {

        const bboxes = this.shadowlinkBoundingBoxesMap.get(pinnedTt)!
        const {width: ttWidth, height: ttHeight } = bboxes.source
        const { x: nx, y: ny, width: nWidth, height: nHeight } = bboxes.target
        const shadowLink = this.shadowlinkMap.get(pinnedTt)

        const ttx = parseFloat(pinnedTt.style.left)
        const tty = parseFloat(pinnedTt.style.top)

        if (!shadowLink) return
        shadowLink.setAttribute('d', `M ${ttx + ttWidth / 2} ${tty + ttHeight / 2} L ${nx + nWidth / 2} ${ny + nHeight / 2}`)
    }

    public removeShadowLink(pinnedTt: HTMLElement) {
        const shadowLink = this.shadowlinkMap.get(pinnedTt)
        if (!shadowLink) return
        shadowLink.remove()
    }
}