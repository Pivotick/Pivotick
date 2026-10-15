import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'

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
