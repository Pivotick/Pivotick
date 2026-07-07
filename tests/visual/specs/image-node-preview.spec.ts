import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    nodeEl,
    centerOf,
    canvas,
    expectElement,
} from '../helpers'
import type { Locator, Page } from '@playwright/test'

// ── image nodes: compact on canvas, full picture on demand ───────────────────
// A picture node stays small on the canvas (here `imageFit: 'cover'` crops the
// 2:1 landscape to a square). The library then surfaces the *actual* picture on
// demand: large in the hover tooltip, and full-resolution in a lightbox opened
// from the tooltip picture or the node context menu. These tests drive those
// real entry points (hover / click / right-click), not internal helpers.

/** The canvas node (not the same-id preview clone the tooltip injects into <body>). */
function canvasNode(page: Page, id: string): Locator {
    return canvas(page).locator(`#node-${id}`)
}

/** Hover a node the way a user would: prime just above its top edge, then glide down onto
 * it in small steps so the tooltip's proximity guard (last mousemove within 50px of the
 * hover-in point) passes regardless of node size, then return the shown tooltip. */
async function openNodeTooltip(page: Page, id: string): Promise<Locator> {
    const nb = await nodeEl(page, id).boundingBox()
    if (!nb) throw new Error(`node ${id} has no bounding box`)
    const cx = nb.x + nb.width / 2
    await page.mouse.move(cx, nb.y - 10)
    await page.mouse.move(cx, nb.y + nb.height / 2, { steps: 25 })
    const tip = page.locator('.pvt-tooltip')
    await expect(tip).toHaveClass(/shown/)
    return tip
}

/** True once the <img> has actually decoded its source (not empty/broken). */
function imageLoaded(img: Locator): Promise<boolean> {
    return img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)
}

test.describe('image-node-preview', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // Hovering a picture node shows the real picture at a readable size — not the
    // ~32px node clone — with its aspect preserved, alongside the small header icon.
    test('hover shows the actual picture large, aspect preserved', async ({ page }) => {
        await loadFixture(page, 'imageNode')
        await harness(page, 'pin')

        const tip = await openNodeTooltip(page, 'shot')
        const picture = tip.locator('.pvt-tooltip-image')

        await expect(picture).toBeVisible()
        // It is the node's own source picture, fully decoded (not a broken <img>).
        await expect.poll(() => imageLoaded(picture)).toBe(true)

        const pictureBox = await picture.boundingBox()
        const headerPreview = tip.locator('.pvt-mainheader-nodepreview .pvt-node-preview-icon')
        const headerBox = await headerPreview.boundingBox()
        // Readable size: clearly larger than the small header preview vignette...
        expect(pictureBox!.width).toBeGreaterThan(headerBox!.width * 2)
        // ...and the whole 2:1 landscape shows (aspect preserved → wider than tall).
        expect(pictureBox!.width).toBeGreaterThan(pictureBox!.height)
        // The small header icon is kept too, and (being an image node) is the real
        // picture rather than a cloned node <g>.
        await expect(headerPreview.locator('.pvt-node-preview-image')).toHaveCount(1)

        await expectElement(tip, 'tooltip-image-node.png')
    })

    // Clicking the large picture opens the full-resolution lightbox.
    test('clicking the tooltip picture opens the lightbox', async ({ page }) => {
        await loadFixture(page, 'imageNode')
        await harness(page, 'pin')

        const tip = await openNodeTooltip(page, 'shot')
        await tip.locator('.pvt-tooltip-image').click()

        const lightbox = page.locator('#pvt-image-lightbox-modal .pvt-image-lightbox__img')
        await expect(lightbox).toBeVisible()
        await expect.poll(() => imageLoaded(lightbox)).toBe(true)
    })

    // The node context menu offers a "View Image" entry that opens the same lightbox.
    test('context-menu "View Image" opens the lightbox', async ({ page }) => {
        await loadFixture(page, 'imageNode')
        await harness(page, 'pin')

        await canvasNode(page, 'shot').click({ button: 'right' })
        const menu = page.locator('.pvt-contextmenu')
        await expect(menu).toHaveClass(/shown/)

        const viewImage = menu.locator('.pvt-action-item', { hasText: 'View Image' })
        await expect(viewImage).toBeVisible()
        await viewImage.click()

        await expect(page.locator('#pvt-image-lightbox-modal .pvt-image-lightbox__img')).toBeVisible()
    })

    // Non-image nodes are untouched: no large picture, header stays a cloned <g>
    // (not an <image>), and no "View Image" action.
    test('non-image nodes keep the clone-based preview', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'pin')

        const tip = await openNodeTooltip(page, 'a')
        await expect(tip.locator('.pvt-tooltip-image')).toHaveCount(0)

        const headerPreview = tip.locator('.pvt-mainheader-nodepreview .pvt-node-preview-icon')
        await expect(headerPreview).toBeVisible()
        await expect(headerPreview.locator('.pvt-node-preview-image')).toHaveCount(0)
        await expect(headerPreview.locator('g')).not.toHaveCount(0)

        await canvasNode(page, 'a').click({ button: 'right' })
        await expect(page.locator('.pvt-contextmenu')).toHaveClass(/shown/)
        await expect(
            page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'View Image' })
        ).toHaveCount(0)
    })
})
