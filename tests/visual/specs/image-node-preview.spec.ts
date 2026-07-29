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
    expectCanvas,
    openNodeTooltip,
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

    // When the picture's source can't be loaded, every surface degrades to a tidy
    // "image unavailable" placeholder instead of the browser's broken-image glyph.
    test('a missing picture degrades to an "image unavailable" fallback', async ({ page }) => {
        await loadFixture(page, 'imageNodeBroken')
        await harness(page, 'pin')

        const tip = await openNodeTooltip(page, 'shot')

        // Large tooltip picture: the broken <img> is swapped for the placeholder.
        await expect(tip.locator('.pvt-image-unavailable')).toBeVisible()
        await expect(tip.locator('.pvt-tooltip-image')).toHaveCount(0)
        // Small header preview: the broken <image> is swapped for the SVG fallback glyph.
        const headerPreview = tip.locator('.pvt-mainheader-nodepreview .pvt-node-preview-icon')
        await expect(headerPreview.locator('.pvt-node-preview-image-fallback')).toHaveCount(1)
        await expect(headerPreview.locator('.pvt-node-preview-image')).toHaveCount(0)

        await expectElement(tip, 'tooltip-image-node-broken.png')

        // The lightbox also shows the placeholder rather than a broken image.
        await canvasNode(page, 'shot').click({ button: 'right' })
        await page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'View Image' }).click()
        const modal = page.locator('#pvt-image-lightbox-modal')
        await expect(modal.locator('.pvt-image-unavailable')).toBeVisible()
        await expect(modal.locator('.pvt-image-lightbox__img')).toHaveCount(0)
    })

    // The canvas node degrades too: the broken picture is hidden and a crossed-out-picture
    // glyph is drawn on the node shape, instead of the browser's broken-image placeholder.
    test('a broken canvas image shows the fallback glyph on the node', async ({ page }) => {
        await loadFixture(page, 'imageNodeBroken')
        await harness(page, 'pin')

        const node = canvasNode(page, 'shot')
        await expect(node.locator('.pvt-node-image-fallback')).toHaveCount(1)
        // the broken <image> is kept (for detection) but hidden, so no broken picture shows
        await expect(node.locator('image.node-content')).toHaveCSS('display', 'none')

        await expectCanvas(page, 'canvas-image-fallback.png')
    })
})
