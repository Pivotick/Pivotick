/**
 * What spacing does the shipped physics actually produce, and at what zoom would
 * each tier unlock under rule B? (scratch, not shipped)
 */
import { chromium } from '@playwright/test'

const PORT = process.argv[2] ?? '5199'
const TIERS = { M: 140, XL: 280 }
const CASES = [
    { n: 50, physics: 'auto' },
    { n: 200, physics: 'auto' },
    { n: 500, physics: 'auto' },
    { n: 1500, physics: 'auto' },
    { n: 200, physics: 'manual' },
    { n: 500, physics: 'manual' },
]

const browser = await chromium.launch()

for (const c of CASES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    const url = `http://localhost:${PORT}/lod-bench.html`
        + `?n=${c.n}&sim=1&graph=connected&physics=${c.physics}`
    await page.goto(url)
    await page.waitForFunction(() => window.__bench?.ready === true, null, { timeout: 60000 })
    // Let the layout settle fully before measuring spacing.
    await page.waitForTimeout(9000)
    const r = await page.evaluate((t) => window.__bench.spacing(t), TIERS)
    console.log(JSON.stringify({ ...c, ...r, errors: errors.slice(0, 2) }))
    await page.close()
}

await browser.close()
