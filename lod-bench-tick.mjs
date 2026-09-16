/**
 * What a fixed-screen-size mode would have to pay per zoom event: one full
 * reposition of every node transform and every edge path. (scratch, not shipped)
 */
import { chromium } from '@playwright/test'

const PORT = process.argv[2] ?? '5199'
const SIZES = [200, 500, 1000, 2000]
const browser = await chromium.launch()

for (const n of SIZES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`http://localhost:${PORT}/lod-bench.html?n=${n}&graph=connected`)
    await page.waitForFunction(() => window.__bench?.ready === true, null, { timeout: 60000 })
    await page.waitForTimeout(2000)
    const r = await page.evaluate(() => window.__bench.tickCost(30))
    const perGesture = (r.median * 60).toFixed(0)
    console.log(JSON.stringify({
        n,
        edges: r.edges,
        tickMedianMs: +r.median.toFixed(2),
        msPerSecondAt60Events: +perGesture,
        errors: errors.slice(0, 2),
    }))
    await page.close()
}

await browser.close()
