/**
 * Regression tests for the reported XSS findings: hostile graph data must render as inert text
 * everywhere the UI echoes it back.
 *
 * Every payload in the `xss` fixture is an `<img onerror>` that appends its tag to
 * `window.__pvtXss` if it is ever parsed as markup (see `xssReport`). So the core assertion is
 * simply "nothing reported" — plus, per surface, that the payload is present *as text*, which is
 * what proves the assertion isn't passing because the field silently went missing.
 *
 * `window.__pvtXss` is global and the fixture always loads every hostile node, so one leaking
 * payload reddens the whole file rather than just its own test. The failure diff names the tags
 * that fired, which is where to look — e.g. `svg-icon` firing means the renderer, not the panel
 * whose test happened to report it.
 */
import { addNote, expect, gotoHarness, harness, loadFixture, nodeEl, openNodeTooltip, test } from '../helpers'
import { XSS_NOTE, XSS_NOTE_REFERENCE_NAME, xssPayload } from '../xssPayloads'

declare global {
    interface Window {
        /** Accumulated tags of payloads that executed. Undefined means none did. */
        __pvtXss?: string
    }
}

/** Payloads execute from a failed image load, so give those requests time to fail. */
async function settleImageLoads(page: import('@playwright/test').Page): Promise<void> {
    await page.waitForTimeout(600)
}

/** The tags of every payload that executed — empty when the data stayed inert. */
async function firedPayloads(page: import('@playwright/test').Page): Promise<string[]> {
    const fired = await page.evaluate(() => window.__pvtXss)
    return fired ? fired.split(',').filter(Boolean) : []
}

async function expectNothingExecuted(page: import('@playwright/test').Page): Promise<void> {
    await settleImageLoads(page)
    expect(await firedPayloads(page)).toEqual([])
}

/** No element from a payload ever reached the DOM (the payload's `<img>` is the tell). */
async function expectNoInjectedImage(page: import('@playwright/test').Page): Promise<void> {
    await expect(page.locator('img[src*="pvt-xss-"]')).toHaveCount(0)
}

/** The payload is still there, verbatim, as text — so it was escaped, not merely dropped. */
async function expectPayloadAsText(
    container: import('@playwright/test').Locator,
    payload: string
): Promise<void> {
    await expect(container).toContainText(payload)
}

/** The properties panel only renders in full mode with the sidebar open. */
const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

test.describe('security — hostile graph data', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'xss')
    })

    test('a node style.svgIcon payload does not execute on render', async ({ page }) => {
        // Renders with no interaction at all, so the icon is already in the DOM here.
        await expect(nodeEl(page, 'xss-icon')).toBeVisible()

        const icon = nodeEl(page, 'xss-icon').locator('svg.node-content')
        await expect(icon).toHaveCount(1)
        // The sanitizer strips the handler but keeps the <image> it was attached to.
        expect(await icon.locator('image').getAttribute('onerror')).toBeNull()
        await expectNothingExecuted(page)
    })

    test('node label and description payloads are text in the inspect modal', async ({ page }) => {
        await harness(page, 'openInspect', 'xss-label')

        const modal = page.locator('#inspect-node-modal')
        await expect(modal).toBeVisible()
        await expect(modal.locator('.nodeinfo-name')).toHaveText(xssPayload('label'))
        await expect(modal.locator('.nodeinfo-subtitle')).toHaveText(xssPayload('description'))

        await expectNoInjectedImage(page)
        await expectNothingExecuted(page)
    })

    test('a node label payload is text in the edit modal', async ({ page }) => {
        await harness(page, 'openNodeEditor', 'xss-label')

        const modal = page.locator('#edit-node-modal')
        await expect(modal).toBeVisible()
        await expect(modal.locator('.nodeinfo-name')).toHaveText(xssPayload('label'))

        await expectNoInjectedImage(page)
        await expectNothingExecuted(page)
    })

    test('property keys and values are text in the sidebar panel', async ({ page }) => {
        await loadFixture(page, 'xss', FULL)
        await harness(page, 'selectNode', 'xss-prop')

        const panel = page.locator('.pvt-sidebar .pvt-properties-body-panel .pvt-node-props')
        await expect(panel).toBeVisible()
        // The payload is used as a property *name* on one row and as a *value* on another;
        // both are attacker-controlled, and both must survive as text.
        await expect(
            panel.locator('.pvt-prop-key', { hasText: 'pvt-xss-property-key' })
        ).toHaveCount(1)
        await expectPayloadAsText(panel, xssPayload('property-key'))
        await expectPayloadAsText(panel, xssPayload('property-value'))

        await expectNoInjectedImage(page)
        await expectNothingExecuted(page)
    })

    test('property payloads are text in the tooltip', async ({ page }) => {
        const tooltip = await openNodeTooltip(page, 'xss-prop')
        await expectPayloadAsText(tooltip, xssPayload('property-value'))

        await expectNoInjectedImage(page)
        await expectNothingExecuted(page)
    })

    test('a note reference name cannot break out of its attribute', async ({ page }) => {
        const noteId = await addNote(page, { id: 'xss-note', x: 0, y: -220, content: XSS_NOTE })

        const reference = page.locator(`#note-${noteId} .pvt-node-reference`)
        await expect(reference).toHaveCount(1)
        // Had the escaping failed, the attribute would have been cut at the first quote and the
        // rest would have become sibling markup.
        expect(await reference.getAttribute('data-node-name')).toBe(XSS_NOTE_REFERENCE_NAME)
        await expect(reference).toHaveClass(/unresolved/)

        await expectNoInjectedImage(page)
        await expectNothingExecuted(page)
    })
})
