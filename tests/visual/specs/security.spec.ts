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
 *
 * The later tests cover what gets through a sanitizer that already blocks script: CSS and markup
 * injected into the host page, a colour that is really a request, and a scheme-less URL that
 * leaves the origin anyway. Those payloads report by their effect rather than through
 * `window.__pvtXss` — a `<style>` that leaked hides the canvas or every note, so that is what the
 * assertions reach for.
 */
import {
    addNote, canvas, expect, gotoHarness, harness, loadFixture, nodeEl, openNodeTooltip, test,
} from '../helpers'
import {
    BENIGN_NOTE, CSS_BEACON, NOTE_PAGE_MARKUP, OFF_ORIGIN_RELATIVE, XSS_NOTE,
    XSS_NOTE_REFERENCE_NAME, xssPayload,
} from '../xssPayloads'

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

/** The swatch a note falls back to when its own colour does not parse. */
const DEFAULT_NOTE_COLOR = '#FDE68A'

/** Read an inline custom property — the form every colour payload here arrives in. */
async function customProperty(
    locator: import('@playwright/test').Locator,
    name: string
): Promise<string> {
    return locator.evaluate((el, prop) => (el as HTMLElement).style.getPropertyValue(prop), name)
}

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

    test('note markup that would restyle or phish the page is dropped', async ({ page }) => {
        const noteId = await addNote(page, { id: 'xss-markup', x: 0, y: -260, content: NOTE_PAGE_MARKUP })

        const content = page.locator(`#note-${noteId} .pvt-note-content`)
        await expect(content).toBeVisible()
        await expect(content.locator('style')).toHaveCount(0)
        await expect(content.locator('form')).toHaveCount(0)
        await expect(content.locator('input')).toHaveCount(0)
        // An inline stylesheet is not scoped to the note it sits in, so a surviving one would
        // have taken the whole canvas with it.
        await expect(canvas(page)).toBeVisible()

        await expectNothingExecuted(page)
    })

    test('ordinary note markdown still renders', async ({ page }) => {
        const noteId = await addNote(page, {
            id: 'ok-note', x: 0, y: -260, content: `${BENIGN_NOTE} and [[Colour node]]`,
        })

        const content = page.locator(`#note-${noteId} .pvt-note-content`)
        await expect(content.locator('strong')).toHaveText('bold')
        await expect(content.locator('code')).toHaveText('code')
        await expect(content.locator('a')).toHaveAttribute('href', 'https://example.test/x')
        // The allow-list has to keep the reference span and its data attribute, or notes lose
        // their link to the graph.
        await expect(content.locator('.pvt-node-reference.resolved')).toHaveText('Colour node')
    })

    test('a node colour that is really a request never reaches the CSSOM', async ({ page }) => {
        const noteId = await addNote(page, { id: 'ref-note', x: 0, y: -260, content: 'see [[Colour node]]' })

        const reference = page.locator(`#note-${noteId} .pvt-node-reference.resolved`)
        await expect(reference).toHaveCount(1)
        // The pill resolves and keeps its stylesheet defaults: the custom property the stylesheet
        // substitutes into `background` was never written, so there is nothing to fetch.
        expect(await customProperty(reference, '--pvt-note-node-reference-dot')).toBe('')

        await expectNothingExecuted(page)
    })

    test('a note colour that is really a request falls back to the default swatch', async ({ page }) => {
        const noteId = await addNote(page, {
            id: 'colour-note', x: 0, y: -260, content: 'x', color: CSS_BEACON, surface: 'terminal',
        })

        // `--note-color` is the one custom property a rule substitutes whole into `background`.
        const note = page.locator(`#note-${noteId} .pvt-note`)
        expect(await customProperty(note, '--note-color')).toBe(DEFAULT_NOTE_COLOR)

        await expectNothingExecuted(page)
    })

    test('an icon cannot style the page or turn its node into a link', async ({ page }) => {
        const icon = nodeEl(page, 'xss-chrome').locator('svg.node-content')
        await expect(icon).toHaveCount(1)
        await expect(icon.locator('style')).toHaveCount(0)
        await expect(icon.locator('a')).toHaveCount(0)
        // Dropping the `<a>` keeps what it wrapped, so the icon still draws.
        await expect(icon.locator('circle')).toHaveCount(1)

        // That icon's rule aimed at notes: a surviving `<style>` would hide this one.
        const noteId = await addNote(page, { id: 'witness', x: 0, y: -260, content: 'still here' })
        await expect(page.locator(`#note-${noteId} .pvt-note`)).toBeVisible()
    })

    test('a scheme-less off-origin property link opens away from the app', async ({ page }) => {
        await loadFixture(page, 'xss', FULL)
        await harness(page, 'selectNode', 'xss-link')

        const link = page.locator('.pvt-sidebar .pvt-properties-body-panel .pvt-node-props')
            .locator('a.pvt-prop-value--link')
        await expect(link).toHaveAttribute('href', OFF_ORIGIN_RELATIVE)
        // `//host/path` carries no scheme but is not a relative path: untreated it would replace
        // the tab the app is running in.
        await expect(link).toHaveAttribute('target', '_blank')
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    test('a null property renders as an empty field instead of throwing', async ({ page }) => {
        await harness(page, 'openNodeEditor', 'xss-link')

        // `null.toString()` used to throw out of the form builder, and the session was already
        // stored by then — so the throw left this node uneditable for the graph's lifetime.
        const modal = page.locator('#edit-node-modal')
        await expect(modal).toBeVisible()
        await expect(modal.locator('input[data-field-key="asn"]')).toHaveValue('')
    })
})
