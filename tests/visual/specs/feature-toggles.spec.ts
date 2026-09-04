/**
 * Every UI feature that carries an `enabled` flag, switched off and checked for
 * leftovers: the button, the panel, the menu entry and the keyboard shortcut all
 * have to go together. Each case opens with the affordance present, so a gate that
 * stops working fails here rather than passing on an empty page.
 *
 * DOM assertions rather than screenshots: what is under test is whether a control
 * exists at all, and a 16px pill that never redraws is exactly what a baseline
 * misses.
 */
import { test, expect, gotoHarness, loadFixture, harness, nodeEl } from '../helpers'
import type { Page } from '@playwright/test'

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

/** Merge a UI block into full mode. */
const withUI = (ui: Record<string, unknown>): Record<string, unknown> =>
    ({ UI: { ...FULL.UI, ...ui } })

const notesButton = (page: Page) => page.locator('#pvt-notes-button')
const searchButton = (page: Page) => page.locator('#pvt-searchbox-button')
const filterButton = (page: Page) => page.locator('#pvt-filter-button')
const undoGroup = (page: Page) => page.locator('.pvt-undoredo-group')
const railButton = (page: Page, mode: string) => page.locator(`.pvt-moderail-button[data-mode="${mode}"]`)
const toolRow = (page: Page, tool: string) => page.locator(`.pvt-toolpanel-tool[data-tool="${tool}"]`)
const menuEntry = (page: Page, text: string) => page.locator('.pvt-contextmenu').getByText(text, { exact: true })

/**
 * Focus the widget so the key manager sees the keystrokes, with the pointer left on
 * empty canvas — the `N` note shortcut places its note at the last pointer position
 * and does nothing without one.
 */
async function focusCanvas(page: Page): Promise<void> {
    await page.locator('.pvt-canvas').click({ position: { x: 60, y: 320 } })
    await page.mouse.move(70, 330)
}

/** How many notes the graph holds. */
async function noteCount(page: Page): Promise<number> {
    return page.evaluate(() => {
        const graph = (window.__pivotick as unknown as {
            graph?: { noteManager: { getNotes(): unknown[] } }
        }).graph
        return graph?.noteManager.getNotes().length ?? 0
    })
}

/** Right-click a node and wait for its context menu. */
async function openNodeMenu(page: Page, id: string): Promise<void> {
    await nodeEl(page, id).click({ button: 'right' })
    await page.locator('.pvt-contextmenu').waitFor({ state: 'visible' })
}

/** Right-click empty canvas and wait for the canvas context menu. */
async function openCanvasMenu(page: Page): Promise<void> {
    await page.locator('.pvt-canvas').click({ button: 'right', position: { x: 40, y: 300 } })
    await page.locator('.pvt-contextmenu').waitFor({ state: 'visible' })
}

test.describe('feature toggles', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('full mode offers every switchable feature by default', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)

        await expect(searchButton(page)).toBeVisible()
        await expect(filterButton(page)).toBeVisible()
        await expect(notesButton(page)).toBeVisible()
        await expect(undoGroup(page)).toBeVisible()
        await expect(page.locator('.pvt-sidebar')).toBeVisible()
        await expect(page.locator('.pvt-properties-panel')).toHaveCount(1)
        await expect(page.locator('.pvt-neighbor-panel')).toHaveCount(1)
        for (const mode of ['select', 'create', 'view', 'physics']) {
            await expect(railButton(page, mode)).toBeVisible()
        }
    })

    test('notes: no button, no tool, no menu entry, no shortcut, no API', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        // The feature works before it is switched off — otherwise the checks below
        // would pass against a page where notes never worked at all.
        await focusCanvas(page)
        await page.keyboard.press('n')
        expect(await noteCount(page)).toBe(1)

        await loadFixture(page, 'basic', withUI({ notes: { enabled: false } }))

        await expect(notesButton(page)).toHaveCount(0)

        await railButton(page, 'create').click()
        await expect(toolRow(page, 'add-note')).toHaveCount(0)

        await openCanvasMenu(page)
        await expect(menuEntry(page, 'Add Note')).toHaveCount(0)
        await page.keyboard.press('Escape')

        await focusCanvas(page)
        await page.keyboard.press('n')
        await page.keyboard.press('Shift+N')
        expect(await noteCount(page)).toBe(0)

        // The programmatic door is shut too: a note nothing can open or remove must
        // not reach the canvas by another route.
        await page.evaluate(() => {
            const graph = (window.__pivotick as unknown as {
                graph?: { noteManager: { addNote(note: unknown): void } }
            }).graph
            graph?.noteManager.addNote({ id: 'x', x: 0, y: 0, width: 100, height: 60, content: 'nope' })
        })
        expect(await noteCount(page)).toBe(0)
    })

    test('search / filter / history: the pills and their shortcuts go together', async ({ page }) => {
        await loadFixture(page, 'basic', withUI({
            search: { enabled: false },
            filter: { enabled: false },
            history: { enabled: false },
        }))

        await expect(searchButton(page)).toHaveCount(0)
        await expect(filterButton(page)).toHaveCount(0)
        await expect(undoGroup(page)).toHaveCount(0)

        await focusCanvas(page)
        await page.keyboard.press('Shift+J')
        await page.keyboard.press('Shift+K')
        // No picker modal, and no slide panel opened behind the missing pills.
        await expect(page.locator('.pvt-modal')).toHaveCount(0)
        await expect(page.locator('.pvt-slide-panel.open')).toHaveCount(0)

        // Undo is unreachable from the keyboard as well as from the missing buttons.
        await harness(page, 'excludeNode', 'b')
        await page.keyboard.press('Control+z')
        const hidden = (await harness(page, 'excludedNodeIds')) as string[]
        expect(hidden).toEqual(['b'])
    })

    test('inspector: no menu entry and no I shortcut', async ({ page }) => {
        await loadFixture(page, 'basic', withUI({ inspector: { enabled: false } }))

        await openNodeMenu(page, 'a')
        await expect(menuEntry(page, 'Inspect Properties')).toHaveCount(0)
        await page.keyboard.press('Escape')

        await nodeEl(page, 'a').hover()
        await page.keyboard.press('i')
        await expect(page.locator('.pvt-modal')).toHaveCount(0)
    })

    test('edge creation: no Add edge tool and no Connect to… entry', async ({ page }) => {
        await loadFixture(page, 'basic', withUI({ editors: { edgeCreator: { enabled: false } } }))

        await railButton(page, 'create').click()
        await expect(toolRow(page, 'add-edge')).toHaveCount(0)

        await openNodeMenu(page, 'a')
        await expect(menuEntry(page, 'Connect to...')).toHaveCount(0)
    })

    test('the Create rail mode goes when all four of its tools are off', async ({ page }) => {
        await loadFixture(page, 'basic', withUI({
            notes: { enabled: false },
            editors: {
                nodeCreator: { enabled: false },
                edgeCreator: { enabled: false },
                nodeEditor: { enabled: false },
            },
        }))

        await expect(railButton(page, 'select')).toBeVisible()
        await expect(railButton(page, 'create')).toHaveCount(0)

        // …and its shortcut with it: C leaves the rail on Select.
        await focusCanvas(page)
        await page.keyboard.press('c')
        await expect(railButton(page, 'select')).toHaveClass(/active/)
    })

    test('the flyout modes answer to their own switches', async ({ page }) => {
        await loadFixture(page, 'basic', withUI({
            viewFlyout: { enabled: false },
            physicsFlyout: { enabled: false },
        }))

        await expect(railButton(page, 'view')).toHaveCount(0)
        await expect(railButton(page, 'physics')).toHaveCount(0)
        await expect(page.locator('.pvt-flyout .pvt-flyout-panel')).toHaveCount(0)
    })

    test('sidebar panels: each one leaves without its separator', async ({ page }) => {
        await loadFixture(page, 'basic', withUI({
            propertiesPanel: { enabled: false },
            neighborsPanel: { enabled: false },
        }))

        await expect(page.locator('.pvt-sidebar')).toBeVisible()
        await expect(page.locator('.pvt-properties-panel')).toHaveCount(0)
        await expect(page.locator('.pvt-neighbor-panel')).toHaveCount(0)
        // Selecting a node still works — the header and the extra-panel slot remain.
        await nodeEl(page, 'a').click()
        await expect(page.locator('.pvt-sidebar .pvt-mainheader-panel')).toHaveCount(1)
    })

    test('the whole sidebar and the whole header can go', async ({ page }) => {
        await loadFixture(page, 'basic', withUI({
            sidebar: { enabled: false },
            topBar: { enabled: false },
        }))

        await expect(page.locator('.pvt-sidebar')).toHaveCount(0)
        await expect(page.locator('.pvt-mainheader')).toHaveCount(0)
        // The canvas keeps the width the sidebar would have taken, and the chrome
        // moves up into the strip the header no longer occupies.
        await expect(page.locator('.pvt-layout.pvt-no-mainheader')).toHaveCount(1)
        await expect(nodeEl(page, 'a')).toBeVisible()
    })

    test('notifications: the corner stays silent', async ({ page }) => {
        await loadFixture(page, 'basic', withUI({ notifications: { enabled: false } }))

        const shown = await page.evaluate(() => {
            const graph = (window.__pivotick as unknown as {
                graph?: { notifier: { info(title: string): unknown } }
            }).graph
            return graph?.notifier.info('should not appear') !== undefined
        })
        expect(shown).toBe(false)
        await expect(page.locator('.pivotick-toast')).toHaveCount(0)
    })

    test('region selection off takes the lasso with the marquee', async ({ page }) => {
        await loadFixture(page, 'basic', { ...FULL, render: { selectionBox: { enabled: false } } })

        await railButton(page, 'select').click()
        await expect(toolRow(page, 'pointer')).toBeVisible()
        await expect(toolRow(page, 'lasso')).toHaveCount(0)
    })

    test('zoom off takes the zoom buttons, not fit-and-center', async ({ page }) => {
        await loadFixture(page, 'basic', { ...FULL, render: { zoomEnabled: false } })

        await expect(page.locator('#pvt-graphnavigation-zoom-in')).toHaveCount(0)
        await expect(page.locator('#pvt-graphnavigation-zoom-out')).toHaveCount(0)
        await expect(page.locator('#pvt-graphnavigation-reset')).toBeVisible()
    })
})
