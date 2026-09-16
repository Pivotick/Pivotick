/**
 * Driver for the zoom-LOD cost bench (scratch, not shipped).
 * Usage: node lod-bench-run.mjs [port]
 */
import { chromium } from '@playwright/test'

const PORT = process.argv[2] ?? '5199'
const SIZES = [200, 500, 1000, 2000]

const stats = (xs) => {
    const s = [...xs].sort((a, b) => a - b)
    return {
        median: +s[Math.floor(s.length / 2)].toFixed(2),
        p95: +s[Math.floor(s.length * 0.95)].toFixed(2),
        mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2),
    }
}

const browser = await chromium.launch()
const results = []

for (const n of SIZES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`http://localhost:${PORT}/lod-bench.html?n=${n}`)
    await page.waitForFunction(() => window.__bench?.ready === true, null, { timeout: 60000 })
    await page.waitForTimeout(1500)

    const row = { n }
    row.counts = await page.evaluate(() => window.__bench.counts())

    // The fixed tax of a redraw pass with nothing dirty.
    row.noop = await page.evaluate(() => window.__bench.noop(20))

    // Pan cost with plain shapes on canvas.
    row.panShapes = stats(await page.evaluate(() => window.__bench.panFrames(60)))
    row.zoomShapes = stats(await page.evaluate(() => window.__bench.zoomFrames(60)))

    // S -> M: every node becomes a card.
    row.toCard = await page.evaluate(() => window.__bench.swap('card'))
    await page.waitForTimeout(500)
    row.countsAfter = await page.evaluate(() => window.__bench.counts())

    // Pan cost with the same graph drawn as cards.
    row.panCards = stats(await page.evaluate(() => window.__bench.panFrames(60)))
    row.zoomCards = stats(await page.evaluate(() => window.__bench.zoomFrames(60)))

    // M -> S: back to shapes.
    row.toShape = await page.evaluate(() => window.__bench.swap('shape'))
    await page.waitForTimeout(500)

    // A realistic partial swap: only the ~10% of nodes crossing the threshold.
    row.partial = await page.evaluate((k) => window.__bench.swap('card', k), Math.ceil(n / 10))
    await page.waitForTimeout(500)

    // Real wheel gesture: how many zoom events one user action produces.
    await page.evaluate(() => window.__bench.resetZoomCount())
    await page.mouse.move(640, 400)
    for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, -120)
        await page.waitForTimeout(16)
    }
    await page.waitForTimeout(300)
    row.zoomEventsPerGesture = await page.evaluate(() => window.__bench.zoomEventCount())

    row.errors = errors.slice(0, 3)
    results.push(row)
    console.log(JSON.stringify(row))
    await page.close()
}

await browser.close()
console.log('\n=== SUMMARY ===')
console.log(JSON.stringify(results, null, 2))
