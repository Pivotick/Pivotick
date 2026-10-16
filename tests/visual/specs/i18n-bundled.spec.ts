import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, loadFixture, harness, nodeEl, waitForViewSettled } from '../helpers'

const languages = [
    { locale: 'zh-CN', search: '搜索', zoom: '放大', empty: '画布上还没有内容' },
    { locale: 'fr-CA', search: 'Rechercher', zoom: 'Zoom avant', empty: 'Le canevas est encore vide' },
    { locale: 'de-CH', search: 'Suchen', zoom: 'Vergrößern', empty: 'Noch nichts auf der Arbeitsfläche' },
    { locale: 'pt-BR', search: 'Pesquisar', zoom: 'Ampliar', empty: 'Ainda não há nada na tela' },
]

test.beforeEach(async ({ page }) => { await gotoHarness(page) })

for (const language of languages) {
    test(`${language.locale}: locale alone translates chrome, titles and empty state`, async ({ page }) => {
        await loadFixture(page, 'empty', { UI: { mode: 'full' }, i18n: { locale: language.locale } })
        await expect(page.locator('#pvt-searchbox-button .action-text')).toHaveText(language.search)
        await expect(page.locator('#pvt-graphnavigation-zoom-in')).toHaveAttribute('title', language.zoom)
        await expect(page.locator('.pvt-empty-state-card')).toHaveText(language.empty)
        await expect(page.locator('.pivotick').first()).toHaveAttribute('lang', language.locale)
    })
}

test('two graphs render different bundled languages without supplying messages', async ({ page }) => {
    await harness(page, 'loadBesideAnotherGraph', 'empty', { i18n: { locale: 'fr' }, otherI18n: { locale: 'de' } })
    await expect(page.locator('.pivotick[lang="de"] #pvt-graphnavigation-zoom-in')).toHaveAttribute('title', 'Vergrößern')
    await expect(page.locator('.pivotick[lang="fr"] #pvt-graphnavigation-zoom-in')).toHaveAttribute('title', 'Zoom avant')
})

test('custom translated content is inserted as text above the bundled language', async ({ page }) => {
    const text = '<img src=x onerror="window.translationInjected = true">'
    await loadFixture(page, 'empty', { i18n: { locale: 'zh', messages: { 'emptyState.message': text } } })
    await expect(page.locator('.pvt-empty-state-card')).toHaveText(text)
    await expect(page.locator('.pvt-empty-state-card img')).toHaveCount(0)
})

/** How far each rail label runs past its button's edges, in px; 0 when it fits. */
async function railLabelOverflow(page: Page): Promise<number[]> {
    return page.locator('.pvt-moderail-button').evaluateAll(buttons => buttons.map(button => {
        const label = button.querySelector('.pvt-moderail-label')!.getBoundingClientRect()
        const box = button.getBoundingClientRect()
        return Math.max(0, box.left - label.left, label.right - box.right)
    }))
}

/** Horizontal space between the mode rail's right edge and the open flyout's left edge. */
async function gapRailToFlyout(page: Page): Promise<number> {
    const rail = await page.locator('.pvt-moderail-rail').boundingBox()
    const flyout = await page.locator('.pvt-flyout').boundingBox()
    return flyout!.x - (rail!.x + rail!.width)
}

/** Horizontal space between a context-menu row's label and its shortcut chip. */
async function gapLabelToShortcut(page: Page, rowText: string): Promise<number> {
    const row = page.locator('.pvt-contextmenu.shown .pvt-action-item', { hasText: rowText }).first()
    const label = await row.locator('.pvt-action-text').boundingBox()
    const chip = await row.locator('.pvt-keyboard-shortcut').boundingBox()
    return chip!.x - (label!.x + label!.width)
}

for (const { locale, longest } of [{ locale: 'de', longest: 'Vereinfachen' }, { locale: 'fr', longest: 'Sélectionner' }]) {
    test(`${locale}: a long rail label widens the rail, and the flyout beside it moves over`, async ({ page }) => {
        await loadFixture(page, 'basic', { UI: { mode: 'full' }, i18n: { locale } })
        await expect(page.locator('.pvt-moderail-label', { hasText: longest })).toBeVisible()
        expect(Math.max(...await railLabelOverflow(page))).toBe(0)
        await page.locator('.pvt-moderail-button[data-mode="view"]').click()
        await expect(page.locator('.pvt-flyout')).toBeVisible()
        // 6px, plus under a pixel from rounding the rail's width up.
        const gap = await gapRailToFlyout(page)
        expect(gap).toBeGreaterThanOrEqual(6)
        expect(gap).toBeLessThan(7)
    })
}

test('de: a long context-menu label keeps its distance from the shortcut chip', async ({ page }) => {
    await loadFixture(page, 'basic', { i18n: { locale: 'de' } })
    await waitForViewSettled(page)
    await nodeEl(page, 'a').click({ button: 'right' })
    await expect(page.locator('.pvt-contextmenu.shown')).toBeVisible()
    expect(await gapLabelToShortcut(page, 'Eigenschaften untersuchen')).toBeGreaterThanOrEqual(10)
})
