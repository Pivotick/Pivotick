import { test, expect, type Page } from '@playwright/test'

const open = (page: Page, url: string) => page.goto(url, { waitUntil: 'domcontentloaded' })

const locales = [
    { prefix: '', language: 'en', label: 'English', title: 'Getting Started', search: 'Search' },
    { prefix: 'zh/', language: 'zh-CN', label: '简体中文', title: '', search: '搜索' },
    { prefix: 'fr/', language: 'fr', label: 'Français', title: '', search: 'Rechercher' },
    { prefix: 'de/', language: 'de', label: 'Deutsch', title: '', search: 'Suchen' },
    { prefix: 'pt/', language: 'pt', label: 'Português', title: '', search: 'Pesquisar' },
]

for (const locale of locales) {
    test(`${locale.language}: translated guide, navigation, search and shared code examples`, async ({ page }) => {
        await open(page, `/Pivotick/${locale.prefix}getting-started.html`)
        await expect(page.locator('html')).toHaveAttribute('lang', locale.language)
        await expect(page.locator('head link[rel="alternate"][hreflang]')).toHaveCount(5)
        const heading = page.locator('.vp-doc h1')
        if (locale.title) await expect(heading).toHaveText(locale.title)
        else await expect(heading).not.toHaveText('Getting Started')
        await expect(page.locator('.VPNavBarSearch')).toContainText(locale.search)
        await expect(page.locator('.vp-doc')).toContainText('pivotick.es.js')
        const internal = await page.locator('.VPSidebar a[href*="configuration"]').first().getAttribute('href')
        expect(internal).toBe(`/Pivotick/${locale.prefix}configuration.html`)
    })
}

test('language switching keeps the current page and English section anchor', async ({ page }) => {
    await open(page, '/Pivotick/getting-started.html#installation')
    await page.locator('.VPNavBarTranslations button').click()
    await page.locator('.VPNavBarTranslations').getByRole('link', { name: 'Français', exact: true }).click()
    await expect(page).toHaveURL(/\/fr\/getting-started.html#installation$/)
    await expect(page.locator('#installation')).toBeVisible()
    await page.locator('.VPNavBarTranslations button').click()
    await page.locator('.VPNavBarTranslations').getByRole('link', { name: 'English', exact: true }).click()
    await expect(page).toHaveURL(/\/Pivotick\/getting-started.html#installation$/)
})

test('mobile navigation offers all five languages', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await open(page, '/Pivotick/getting-started.html')
    await page.locator('.VPNavBarHamburger').click()
    await page.locator('.VPNavScreenTranslations button').click()
    for (const label of ['简体中文', 'Français', 'Deutsch', 'Português']) {
        await expect(page.locator('.VPNavScreenTranslations').getByRole('link', { name: label, exact: true })).toBeVisible()
    }
    await page.locator('.VPNavScreenTranslations').getByRole('link', { name: 'Português', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt')
})

for (const [language, query] of [['fr', 'configuration'], ['zh', '节点']]) {
    test(`${language}: documentation search returns results in the selected language`, async ({ page }) => {
        await open(page, `/Pivotick/${language}/getting-started.html`)
        await page.locator('.VPNavBarSearch button').click()
        await page.locator('#localsearch-input').fill(query)
        const result = page.locator('.VPLocalSearchBox a.result').first()
        await expect(result).toBeVisible()
        await expect(result).toHaveAttribute('href', new RegExp(`^/Pivotick/${language}/`))
    })
}

test('translated gallery keeps translated card titles, shared thumbnails and localized links', async ({ page }) => {
    await open(page, '/Pivotick/fr/gallery.html')
    const card = page.locator('.pvt-gallery__card').first()
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('href', /\/Pivotick\/fr\/examples\/gallery\//)
    await expect(card.locator('img')).toBeVisible()
    await card.click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(page.locator('.pivotick')).toHaveAttribute('lang', 'fr')
})

test('generated API reference has translated prose and the same language selector', async ({ page }) => {
    await open(page, '/Pivotick/fr/reference/classes/Node.html')
    await expect(page.locator('.vp-doc h1')).toContainText('Node')
    await expect(page.locator('.vp-doc h1')).not.toContainText('Class:')
    await expect(page.locator('.VPNavBarTranslations')).toBeVisible()
    await expect(page.locator('.vp-doc')).toContainText('nœud')
})

test('the standalone graph tool keeps the language selector', async ({ page }) => {
    await open(page, '/Pivotick/de/tool.html')
    await expect(page.locator('.VPNavBarTranslations')).toBeVisible()
    await expect(page.locator('.pivotick')).toHaveAttribute('lang', 'de')
})
