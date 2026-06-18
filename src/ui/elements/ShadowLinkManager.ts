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

    public updateShadowLink(pinnedTt: HTMLElement, sourcePoint: {x: number, y: number}, offsetSourceToCenter = true) {

        const bboxes = this.shadowlinkBoundingBoxesMap.get(pinnedTt)
        if (!bboxes) return

        const {width: ttWidth, height: ttHeight } = bboxes.source
        const { x: nx, y: ny, width: nWidth, height: nHeight } = bboxes.target
        const shadowLink = this.shadowlinkMap.get(pinnedTt)

        let sourceX
        let sourceY
        if (sourcePoint) {
            sourceX = sourcePoint.x
            sourceY = sourcePoint.y
        } else {
            sourceX = parseFloat(pinnedTt.style.left)
            sourceY = parseFloat(pinnedTt.style.top)
        }

        if (!shadowLink) return

        if (offsetSourceToCenter) {
            shadowLink.setAttribute('d', `M ${sourceX + ttWidth / 2} ${sourceY + ttHeight / 2} L ${nx + nWidth / 2} ${ny + nHeight / 2}`)
        } else {
            shadowLink.setAttribute('d', `M ${sourceX} ${sourceY} L ${nx + nWidth / 2} ${ny + nHeight / 2}`)
        }
    }

    public removeShadowLink(pinnedTt: HTMLElement) {
        const shadowLink = this.shadowlinkMap.get(pinnedTt)
        if (!shadowLink) return
        shadowLink.remove()
    }
}