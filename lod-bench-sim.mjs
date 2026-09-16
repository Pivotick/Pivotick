/**
 * Does a tier swap disturb the layout? (scratch, not shipped)
 * Physics on, 300 nodes, swap S -> M and watch alpha and node drift.
 */
import { chromium } from '@playwright/test'

const PORT = process.argv[2] ?? '5199'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(`http://localhost:${PORT}/lod-bench.html?n=300&sim=1`)
await page.waitForFunction(() => window.__bench?.ready === true, null, { timeout: 60000 })
// Let the initial layout cool right down.
await page.waitForTimeout(6000)

const before = await page.evaluate(() => ({
    alpha: window.__bench.alpha(),
    layout: window.__bench.layout(),
}))

const swap = await page.evaluate(() => window.__bench.swap('card'))
// Sample alpha and drift right after the swap and once the sim has cooled again.
const immediate = await page.evaluate((pos) => ({
    alpha: window.__bench.alpha(),
    drift: window.__bench.drift(pos),
}), before.layout.pos)

await page.waitForTimeout(6000)
const after = await page.evaluate((pos) => ({
    alpha: window.__bench.alpha(),
    drift: window.__bench.drift(pos),
    layout: window.__bench.layout(),
}), before.layout.pos)

const radii = (l) => {
    const vs = Object.values(l.radius)
    return { min: Math.min(...vs), max: Math.max(...vs) }
}

console.log(JSON.stringify({
    swap,
    alphaBefore: before.alpha,
    alphaImmediatelyAfterSwap: immediate.alpha,
    alphaAfterCooling: after.alpha,
    driftImmediate: +immediate.drift.toFixed(1),
    driftAfterCooling: +after.drift.toFixed(1),
    radiusBefore: radii(before.layout),
    radiusAfter: radii(after.layout),
    errors: errors.slice(0, 3),
}, null, 2))

await browser.close()
