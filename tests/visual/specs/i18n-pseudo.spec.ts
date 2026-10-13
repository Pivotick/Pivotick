import type { Locator, Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { test, expect, gotoHarness, harness, canvas, openNodeTooltip, waitForViewSettled } from '../helpers'
import type { UntranslatedText } from '../harness/harness'
import { pseudo } from '../harness/pseudoLocale'
import { messagesEn } from '../../../src/i18n/en'
import type { MessageKey } from '../../../src/interfaces/I18n'

/**
 * The guard that every word the library writes goes through the catalogue (D11).
 *
 * The graph runs under a pseudo-locale: each message accented letter by letter and
 * wrapped in ⟦markers⟧, so no ASCII letter is left in it. The host's data is Greek, and
 * the locale is `el`, so what `Intl` writes is Greek too. Each test opens a surface and
 * asks for every text node, `title`, `aria-label` and `placeholder` on the page that
 * still holds a Latin letter outside the markers: text that skipped the catalogue, or a
 * format that ignored the graph's locale.
 */

/**
 * Latin text the library writes on purpose. Each entry is tied to where it sits, so the
 * same word anywhere else still fails.
 */
const ON_PURPOSE: Array<{ why: string, text: RegExp, where: string }> = [
    { why: 'a shortcut names a key, which is the same key in every language', text: /^[⇧⌃⌥⌘+\s]*[A-Za-z0-9]$/, where: 'pvt-keyboard-shortcut' },
    { why: 'the export formats are file types', text: /^(CSV|JSON)$/, where: 'button.pvt-table-export' },
    { why: 'the data key `label`, title-cased: data is never translated', text: /^Label$/, where: 'form.pvt-form' },
    // `label` is the host's data key; `id` names the element's own id field (D19).
    ...['pvt-prop-key', 'pvt-facet-label-name', 'pvt-search-result__info_key', 'json-key'].map((where) => ({
        why: 'a key, written as the data writes it', text: /^(@title: )?"?\.?(id|label)"?:?$/, where,
    })),
]

const onPurpose = ({ text, where }: UntranslatedText): boolean =>
    ON_PURPOSE.some((allowed) => allowed.text.test(text) && where.includes(allowed.where))

/** Each piece of text that skipped the catalogue, with where it sits. Empty when all went through. */
async function untranslated(page: Page): Promise<string[]> {
    const found = await harness(page, 'untranslatedText') as UntranslatedText[]
    return found.filter((piece) => !onPurpose(piece)).map(({ text, where }) => `${text}   ← ${where}`)
}

/**
 * What the pseudo-locale shows for a plain message: how a test finds a control by its
 * words. Params are written as given, which is what the page shows for a small count.
 */
const said = (key: MessageKey, params: Record<string, string | number> = {}): string => {
    const english = messagesEn[key]
    if (typeof english !== 'string') throw new Error(`${key} is not a plain message`)
    return pseudo(english).replace(/\{(\w+)\}/g, (placeholder, name: string) => String(params[name] ?? placeholder))
}

async function loadPseudo(page: Page, overrides: Record<string, unknown> = {}): Promise<void> {
    await harness(page, 'loadPseudo', overrides)
    await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
}

const menu = (page: Page): Locator => page.locator('.pvt-contextmenu:not(.pvt-contextmenu-flyout)')

async function rightClick(page: Page, target: Locator | { x: number, y: number }): Promise<void> {
    await waitForViewSettled(page)
    if ('x' in target) await page.mouse.click(target.x, target.y, { button: 'right' })
    else await target.click({ button: 'right' })
    await expect(menu(page)).toHaveClass(/shown/)
}

const onCanvas = (page: Page, id: string): Locator => canvas(page).locator(`#node-${id}`)

const railMode = (page: Page, mode: string): Locator => page.locator(`.pvt-moderail-button[data-mode="${mode}"]`)

test.describe('i18n: the pseudo-locale sweep', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadPseudo(page)
    })

    test('the sweep catches a message left in English', async ({ page }) => {
        await loadPseudo(page, { i18n: { messages: { 'topBar.search': 'Search' } } })
        expect(await untranslated(page)).toEqual([
            'Search   ← div#pvt-searchbox-button > div.action-container > span.action-text',
        ])
    })

    test.describe('chrome', () => {
        test('on load: top bar, rail, navigation, legend, minimap, dock bar, sidebar', async ({ page }) => {
            expect(await untranslated(page)).toEqual([])
        })

        test('the empty canvas', async ({ page }) => {
            await page.evaluate(() => window.__pivotick.graph!.setData())
            await expect(page.locator('.pvt-empty-state-card')).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('search, with results and without', async ({ page }) => {
            await page.locator('#pvt-searchbox-button').click()
            await page.locator('#pvt-search-input').fill('δρομολογητής')
            await expect(page.locator('.pvt-searchbox .pvt-search-result')).toHaveCount(2)
            expect(await untranslated(page)).toEqual([])

            await page.locator('#pvt-search-input').fill('τίποτα')
            await expect(page.locator('.pvt-searchbox .pvt-search-result')).toHaveCount(0)
            expect(await untranslated(page)).toEqual([])
        })

        test('the filter panel', async ({ page }) => {
            await page.locator('#pvt-filter-button').click()
            await expect(page.locator('.pvt-slide-panel.open')).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('the notes panel', async ({ page }) => {
            await page.locator('#pvt-notes-button').click()
            await expect(page.locator('.pvt-note-sidebar-item').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('the history menu, both sides', async ({ page }) => {
            await harness(page, 'excludeNode', 'β')
            await harness(page, 'excludeNode', 'γ')
            await page.locator('#pvt-undo-caret').click()
            await expect(page.locator('.pvt-history')).toHaveClass(/open/)
            await page.locator('.pvt-history-row').first().hover()
            expect(await untranslated(page)).toEqual([])

            await page.keyboard.press('Escape')
            await page.locator('#pvt-undo-button').click()
            await page.locator('#pvt-redo-caret').click()
            await expect(page.locator('.pvt-history-row.undone').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })
    })

    test.describe('selection', () => {
        test('a node in the sidebar: header, properties, the neighbours graph, list and stats', async ({ page }) => {
            await onCanvas(page, 'α').click()
            await expect(page.locator('.main-egograph-container .node').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])

            for (const tab of ['list', 'stats']) {
                await page.locator(`.pvt-neighbors-header-panel [data-tab-control="${tab}"]`).click()
                await expect(page.locator(`.pvt-neighbor-panel [data-tab-panel="${tab}"]`)).toBeVisible()
                expect(await untranslated(page)).toEqual([])
            }
        })

        test('an edge in the sidebar', async ({ page }) => {
            await harness(page, 'selectEdge', 'α-β')
            expect(await untranslated(page)).toEqual([])
        })

        test('several nodes in the sidebar, with the bulk actions', async ({ page }) => {
            await harness(page, 'multiSelect', ['α', 'β', 'ε'])
            await expect(page.locator('.pvt-sidebar-bulkaction').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('the node and edge tooltips', async ({ page }) => {
            await openNodeTooltip(page, 'α')
            expect(await untranslated(page)).toEqual([])

            await page.mouse.move(5, 5)
            await page.evaluate(() => {
                const graph = window.__pivotick.graph!
                graph.UIManager.tooltip!.edgeHovered(new MouseEvent('mousemove', { clientX: 600, clientY: 300 }), graph.getMutableEdge('α-β')!)
            })
            await expect(page.locator('.pvt-tooltip')).toHaveClass(/shown/)
            expect(await untranslated(page)).toEqual([])
        })

        test('an expanded cluster', async ({ page }) => {
            await harness(page, 'expand', 'ζ')
            await expect(onCanvas(page, 'ζ').locator('.pvt-cluster-area')).toBeAttached()
            await onCanvas(page, 'ζ').click()
            expect(await untranslated(page)).toEqual([])
        })
    })

    test.describe('context menus', () => {
        test('a node, with the Pivot submenu', async ({ page }) => {
            await rightClick(page, onCanvas(page, 'α'))
            expect(await untranslated(page)).toEqual([])

            await menu(page).locator('.pvt-action-item', { hasText: said('contextMenu.pivot') }).first().hover()
            await expect(page.locator('.pvt-contextmenu-flyout').first()).toHaveClass(/shown/)
            expect(await untranslated(page)).toEqual([])
        })

        test('an edge', async ({ page }) => {
            await rightClick(page, await harness(page, 'edgePoint', 'α-β') as { x: number, y: number })
            expect(await untranslated(page)).toEqual([])
        })

        test('the canvas', async ({ page }) => {
            await rightClick(page, canvas(page).locator('.pvt-canvas-element').first())
            expect(await untranslated(page)).toEqual([])
        })

        test('a note', async ({ page }) => {
            await rightClick(page, page.locator('.pvt-note').first().locator('.pvt-note-content-rendered'))
            expect(await untranslated(page)).toEqual([])
        })

        test('a selection', async ({ page }) => {
            await harness(page, 'multiSelect', ['α', 'β'])
            await rightClick(page, onCanvas(page, 'α'))
            expect(await untranslated(page)).toEqual([])
        })

        test('a cluster', async ({ page }) => {
            await rightClick(page, onCanvas(page, 'ζ'))
            expect(await untranslated(page)).toEqual([])
        })
    })

    test.describe('rail modes', () => {
        test('the Select and Create panels', async ({ page }) => {
            await page.evaluate(() => window.__pivotick.graph!.UIManager.modeStore.setPanelOpen('select', true))
            await expect(page.locator('.pvt-toolpanel-panel:not(.pvt-collapsed)')).toBeVisible()
            expect(await untranslated(page)).toEqual([])

            await railMode(page, 'create').click()
            await expect(page.locator('.pvt-toolpanel-tool[data-tool="add-edge"]')).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        for (const mode of ['view', 'physics', 'simplify']) {
            test(`the ${mode} flyout`, async ({ page }) => {
                await railMode(page, mode).click()
                await expect(page.locator(`.pvt-flyout-panel.pvt-flyout-${mode}`)).toHaveClass(/open/)
                expect(await untranslated(page)).toEqual([])
            })
        }

        test('the pivot panel', async ({ page }) => {
            await harness(page, 'selectNode', 'α')
            await railMode(page, 'pivot').click()
            await expect(page.locator('.pvt-pivot-entry').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })
    })

    test.describe('dock', () => {
        test('the table, its column picker and a row menu', async ({ page }) => {
            await page.locator('.pvt-dock-toggle').click()
            await expect(page.locator('.pvt-table-row').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])

            await page.locator('.pvt-table-columns-button').click()
            await expect(page.locator('.pvt-table-columns-row').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])
            await page.keyboard.press('Escape')

            await rightClick(page, page.locator('.pvt-dock .pvt-table-row[data-id="α"]'))
            expect(await untranslated(page)).toEqual([])
        })

        test('the review pane after a pivot, and the toast after ingesting', async ({ page }) => {
            await harness(page, 'runPivot', 'συσχετίσεις', ['α'])
            await expect(page.locator('.pvt-triage-row').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])

            await page.locator('.pvt-triage-foot button', { hasText: said('pivot.triage.foot.ingestAll', { count: 3 }) }).click()
            await expect(page.locator('.pivotick-toast').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })
    })

    test.describe('modals', () => {
        test('editing a node', async ({ page }) => {
            await harness(page, 'openNodeEditor', 'α')
            await expect(page.locator('#edit-node-modal')).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('inspecting a node, both tabs', async ({ page }) => {
            await harness(page, 'openInspect', 'α')
            await expect(page.locator('#inspect-node-modal')).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('editing an edge', async ({ page }) => {
            await harness(page, 'openEdgeSession', 'α-β')
            await expect(page.locator('#edit-edge-modal')).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('the prompt a new node asks through', async ({ page }) => {
            await railMode(page, 'create').click()
            await page.locator('.pvt-toolpanel-tool[data-tool="add-node"]').click()
            await expect(page.locator('.pvt-prompt-modal-body')).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('the confirmation before a delete', async ({ page }) => {
            await page.evaluate(() => { void window.__pivotick.requestDelete({ nodes: ['β'] }) })
            await expect(page.locator('.pvt-modal__footer button', { hasText: said('confirm.submit') })).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })
    })

    test.describe('notes', () => {
        test('editing a note', async ({ page }) => {
            await page.locator('.pvt-note').first().locator('.pvt-note-content-rendered').dblclick()
            await expect(page.locator('.pvt-note-editor')).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })
    })

    test.describe('groups', () => {
        /** Group nodes, as the bulk action does, and return the group's DOM id. */
        const groupOf = (page: Page, ids: string[]): Promise<string> => page.evaluate((members) => {
            const simplify = window.__pivotick.graph!.simplify
            return simplify.getGroupNode(simplify.groupNodes(members)!)!.domID
        }, ids)
        test('a group from the bulk action', async ({ page }) => {
            await harness(page, 'multiSelect', ['γ', 'ε'])
            await page.locator('.pvt-sidebar-bulkaction[data-action="group"]').click()
            expect(await untranslated(page)).toEqual([])
        })

        test('a group: its tooltip, sidebar, menu, and open', async ({ page }) => {
            const group = await groupOf(page, ['γ', 'ε'])
            await waitForViewSettled(page)
            // Before selecting it: the sidebar header then holds a copy with the same id.
            await openNodeTooltip(page, group)
            expect(await untranslated(page)).toEqual([])
            await page.mouse.move(5, 5)

            await onCanvas(page, group).click()
            await expect(page.locator('.pvt-sidebar-group')).toBeVisible()
            expect(await untranslated(page)).toEqual([])

            await rightClick(page, onCanvas(page, group))
            expect(await untranslated(page)).toEqual([])
            await menu(page).locator('.pvt-action-item', { hasText: said('contextMenu.group.open') }).first().click()
            await expect(page.locator('.pvt-group-chip').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('the simplify flyout with a rule on', async ({ page }) => {
            await railMode(page, 'simplify').click()
            await page.locator('.pvt-simplifyflyout-rule .pvt-simplifyflyout-rule-switch').first().click()
            expect(await untranslated(page)).toEqual([])
        })
    })

    test.describe('pivots', () => {
        const entry = (page: Page, id: string): Locator => page.locator(`.pvt-pivot-entry[data-pivot="${id}"]`)

        test('narrowing, fetching, ingesting and saving from the panel', async ({ page }) => {
            await harness(page, 'selectNode', 'α')
            await railMode(page, 'pivot').click()
            const correlations = entry(page, 'συσχετίσεις')
            await expect(correlations.locator('.pvt-pivot-count')).toBeVisible()
            await correlations.locator('.pvt-checkbox-option', { hasText: 'τομέας' }).locator('input[type="checkbox"]').check()
            expect(await untranslated(page)).toEqual([])

            await correlations.locator('button', { hasText: said('pivot.entry.fetch') }).first().click()
            await expect(page.locator('.pvt-triage-row').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])

            await page.locator('.pvt-triage-row').first().click()
            expect(await untranslated(page)).toEqual([])
            await page.locator('.pvt-triage-foot button', { hasText: said('pivot.triage.foot.rejectRemaining') }).click()
            expect(await untranslated(page)).toEqual([])
        })

        test('the save bar and its toast, after an ingest', async ({ page }) => {
            await harness(page, 'runPivot', 'συσχετίσεις', ['α'])
            await harness(page, 'markPivotCandidates', 'συσχετίσεις', 'all')
            await harness(page, 'ingestPivot', 'συσχετίσεις')
            await harness(page, 'selectNode', 'α')
            await railMode(page, 'pivot').click()
            await expect(page.locator('.pvt-pivot-unsaved button')).toBeVisible()
            expect(await untranslated(page)).toEqual([])

            await page.locator('.pvt-pivot-unsaved button').click()
            await expect(page.locator('.pivotick-toast').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])

            await page.locator('#pvt-undo-caret').click()
            await expect(page.locator('.pvt-history')).toHaveClass(/open/)
            expect(await untranslated(page)).toEqual([])
        })

        test('a pivot that failed and one its cap refused', async ({ page }) => {
            await harness(page, 'selectNode', 'α')
            await railMode(page, 'pivot').click()
            await expect(entry(page, 'αποτυχία').locator('.pvt-pivot-error')).toBeVisible()
            await expect(entry(page, 'πληθώρα').locator('.pvt-pivot-gate')).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('two providers in the review pane', async ({ page }) => {
            await harness(page, 'runPivot', 'συσχετίσεις', ['α'])
            await harness(page, 'runPivot', 'αρχείο', [])
            await expect(page.locator('.pvt-triage-row').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('a one-click pivot from the menu', async ({ page }) => {
            await rightClick(page, onCanvas(page, 'α'))
            await menu(page).locator('.pvt-action-item', { hasText: said('contextMenu.pivot') }).first().hover()
            const flyout = page.locator('.pvt-contextmenu-flyout').first()
            await expect(flyout).toHaveClass(/shown/)
            await flyout.locator('.pvt-action-item', { hasText: 'Συσχετίσεις' }).first().click()
            await expect(page.locator('.pivotick-toast, .pvt-triage-row').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })
    })

    test.describe('states', () => {
        test('the legend filtering a category, then folded', async ({ page }) => {
            await page.locator('.pvt-legend-entry').first().click()
            expect(await untranslated(page)).toEqual([])
            await page.locator('.pvt-legend-action[data-action="collapse"]').first().click()
            expect(await untranslated(page)).toEqual([])
        })

        test('each layout from the physics flyout', async ({ page }) => {
            await railMode(page, 'physics').click()
            const tiles = page.locator('.pvt-physicsflyout-layout')
            for (let i = 0; i < await tiles.count(); i++) {
                await tiles.nth(i).click()
                expect(await untranslated(page)).toEqual([])
            }
        })

        test('the notes panel with no notes', async ({ page }) => {
            await page.locator('#pvt-notes-button').click()
            await page.evaluate(() => window.__pivotick.graph!.setData())
            await expect(page.locator('.pvt-note-sidebar-empty')).toBeAttached()
            expect(await untranslated(page)).toEqual([])
        })

        test('an edge layer turned off', async ({ page }) => {
            await page.locator('#pvt-filter-button').click()
            await page.locator('.pvt-edge-layer-list > *').first().click()
            expect(await untranslated(page)).toEqual([])
        })

        test('the minimap folded', async ({ page }) => {
            await page.locator('.pvt-minimap-toggle').click()
            expect(await untranslated(page)).toEqual([])
        })

        test('the filter panel with a hidden node and a filter on', async ({ page }) => {
            await harness(page, 'excludeNode', 'β')
            await page.locator('.pvt-legend-entry').first().click()
            await page.locator('#pvt-filter-button').click()
            await expect(page.locator('.pvt-slide-panel.open')).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('the CSV export header row', async ({ page }) => {
            await page.locator('.pvt-dock-toggle').click()
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.locator('.pvt-table-export[data-format="csv"]').click(),
            ])
            const csv = readFileSync(await download.path(), 'utf8')
            const header = csv.split(/\r?\n/)[0].split(',').map((field) => field.replace(/^"|"$/g, ''))
            // The built-in columns are named in the graph's language, as on screen.
            expect(header.some((field) => field.startsWith('⟦'))).toBe(true)
            expect(header.filter((field) => /[A-Za-z]/.test(field.replace(/⟦[^⟧]*⟧/g, '')))).toEqual([])
        })

        test('the table filtered, with Apply to graph', async ({ page }) => {
            await page.locator('.pvt-dock-toggle').click()
            const filter = page.locator('.pvt-table-th[data-column="είδος"] .pvt-table-filter[data-role="value"]')
            await filter.selectOption('τομέας')
            await expect(page.locator('.pvt-table-apply')).toBeVisible()
            expect(await untranslated(page)).toEqual([])
            await page.locator('.pvt-table-apply').click()
            expect(await untranslated(page)).toEqual([])
        })

        test('the view flyout with its switches on', async ({ page }) => {
            await railMode(page, 'view').click()
            for (const toggle of await page.locator('.pvt-flyout-toggle').all()) await toggle.click()
            expect(await untranslated(page)).toEqual([])
        })

        test('a pinned tooltip', async ({ page }) => {
            const tip = await openNodeTooltip(page, 'α')
            await tip.locator('.pin-button').click()
            await expect(page.locator('.pvt-tooltip-floating').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })
    })

    // What clips when a language runs longer: the pseudo-locale is ~35% longer than English.
    test.describe('longer text', () => {
        test('the sidebar', async ({ page }) => {
            await onCanvas(page, 'α').click()
            await expect(page.locator('.main-egograph-container .node').first()).toBeVisible()
            await expect(page.locator('.pvt-sidebar')).toHaveScreenshot('pseudo-sidebar.png', {
                mask: [page.locator('.main-egograph-container')],
            })
        })

        test('a node menu', async ({ page }) => {
            await rightClick(page, onCanvas(page, 'α'))
            await expect(menu(page)).toHaveScreenshot('pseudo-node-menu.png')
        })

        test('the physics flyout', async ({ page }) => {
            await railMode(page, 'physics').click()
            const flyout = page.locator('.pvt-flyout-panel.pvt-flyout-physics')
            await expect(flyout).toHaveClass(/open/)
            await expect(flyout).toHaveScreenshot('pseudo-physics-flyout.png')
        })

        test('the pivot panel', async ({ page }) => {
            await harness(page, 'selectNode', 'α')
            await railMode(page, 'pivot').click()
            await expect(page.locator('.pvt-pivot-entry[data-pivot="συσχετίσεις"] .pvt-pivot-count')).toBeVisible()
            await expect(page.locator('.pvt-pivot-entry[data-pivot="αποτυχία"] .pvt-pivot-error')).toBeVisible()
            await expect(page.locator('.pvt-pivot-panel')).toHaveScreenshot('pseudo-pivot-panel.png')
        })
    })

    test.describe('editing', () => {
        test('creating an edge: the armed tool, then the busy indicator while the host decides', async ({ page }) => {
            await railMode(page, 'create').click()
            await page.locator('.pvt-toolpanel-tool[data-tool="add-edge"]').click()
            expect(await untranslated(page)).toEqual([])

            await harness(page, 'startClickConnect')
            await harness(page, 'pickConnectNode', 'β')
            expect(await untranslated(page)).toEqual([])
            await harness(page, 'pickConnectNode', 'ε')
            await expect(page.locator('.pvt-busy-indicator')).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })

        test('the [[ typeahead in a note', async ({ page }) => {
            await page.locator('.pvt-note').first().locator('.pvt-note-content-rendered').dblclick()
            const editor = page.locator('.pvt-note-editor')
            await expect(editor).toBeVisible()
            await editor.focus()
            await page.keyboard.press('Control+End')
            await page.keyboard.type('[[')
            await expect(page.locator('.pvt-typeahead__item').first()).toBeVisible()
            expect(await untranslated(page)).toEqual([])
        })
    })
})
