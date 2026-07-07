import { createHtmlElement } from '../../../../utils/ElementCreation'
import type { ModalHTMLElement } from '../../../components/Modal'
import type { UIManager } from '../../../UIManager'
import './imageLightboxModal.scss'

const LIGHTBOX_MODAL_ID = 'pvt-image-lightbox-modal'

/**
 * Open a picture at full resolution in a modal "lightbox". The image is shown at its natural
 * size, capped to the viewport (aspect preserved), so a compact image node never has to grow.
 * Reuses the shared {@link Modal} (fluid, chrome-free) and replaces any lightbox already open.
 *
 * @param src   The picture URL (or data-URI) to display.
 * @param title Optional caption shown as the modal header.
 */
export function openImageLightbox(uiManager: UIManager, src: string, title?: string): void {
    if (!src) return

    const previousInstance = document.querySelector(`#${LIGHTBOX_MODAL_ID}`) as ModalHTMLElement | null
    previousInstance?.__modalInstance?.destroy()

    const image = createHtmlElement('img', { class: 'pvt-image-lightbox__img', src, alt: title ?? '' }) as HTMLImageElement
    const body = createHtmlElement('div', { class: 'pvt-image-lightbox' }, [image]) as HTMLDivElement

    // No explicit `size`: the CSS below lets the modal shrink-wrap the picture (capped to
    // the viewport) rather than sit in a fixed-width box.
    uiManager.createModal({
        id: LIGHTBOX_MODAL_ID,
        header: title ?? null,
        body,
        rawBody: true,
        buttons: null,
        position: 'center',
        noBodyPadding: true,
    })
}
