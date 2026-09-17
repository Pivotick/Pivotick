/**
 * What a cross-faded tier swap costs over a plain one (scratch, not shipped).
 *
 * Runs the shipped path: one `tiers` entry holding a 140x44 `html` card, crossed by zooming
 * either side of the threshold, so the drawer picks the tier, coalesces the redraw and
 * refreshes the edges exactly as a wheel gesture makes it.
 *
 * Both directions are measured, because they are not the same job:
 *   in  — N foreign objects are created, and N cheap shapes are held as ghosts
 *   out — N cheap shapes are created, and N foreign objects are held and animated
 *
 * A fresh page per mode, so nothing the first run warms up flatters the second.
 *
 * Usage: node lod-bench-fade.mjs [port] [sizes] [fadeDurations]
 *   e.g. node lod-bench-fade.mjs 5199 300 0,80,160,320
 */
import { chromium } from '@playwright/test'

const PORT = process.argv[2] ?? '5199'
const SIZES = (process.argv[3] ?? '300,1000').split(',').map(Number)
const FADES = (process.argv[4] ?? '0,160').split(',').map(Number)
const FRAME_BUDGET = 16.7
/**
 * Either side of the card tier's threshold at zoom 1, clear of the 0.85 hysteresis band:
 * 140 x 1.05 engages it, 140 x 0.8 = 112 is under the 119 it takes to hold it.
 */
const ZOOM_CARDS = 1.05
const ZOOM_SHAPES = 0.8
const RUNS = 3

/**
 * Big enough to hold 300 cards at the zoom that turns them on, so the worst case — every
 * node crossing at once — is actually reachable. On a 1280-wide screen the card tier only
 * ever engages for the couple of dozen nodes that fit, and the drawer skips the rest.
 */
const VIEWPORT = { width: 3200, height: 1800 }
const PITCH = '150,60'
const COLS = 15

const frameStats = (deltas) => {
    // The first interval is the gap since the call returned, not a rendered frame.
    const xs = deltas.slice(1)
    if (!xs.length) return { n: 0, median: 0, worst: 0, over: 0 }
    const sorted = [...xs].sort((a, b) => a - b)
    return {
        n: xs.length,
        median: +sorted[Math.floor(sorted.length / 2)].toFixed(1),
        worst: +Math.max(...xs).toFixed(1),
        over: xs.filter((d) => d > FRAME_BUDGET).length,
    }
}

/** The median run, by worst frame — the middle of three, not the luckiest. */
const median = (runs) => [...runs].sort((a, b) => a.frames.worst - b.frames.worst)[Math.floor(runs.length / 2)]

const browser = await chromium.launch()
const results = []

for (const n of SIZES) {
    for (const fade of FADES) {
        const page = await browser.newPage({ viewport: VIEWPORT })
        const errors = []
        page.on('pageerror', (e) => errors.push(String(e)))
        await page.goto(`http://localhost:${PORT}/lod-bench.html`
            + `?n=${n}&tiers=1&fade=${fade}&pitch=${PITCH}&cols=${COLS}`)
        await page.waitForFunction(() => window.__bench?.ready === true, null, { timeout: 60000 })
        // The initial fit lands seconds after `ready` and rewrites the zoom, so a crossing
        // driven before it settles is quietly overwritten and measures nothing. Two polls
        // agreeing is not enough — it agrees with itself before the fit has run at all.
        await page.waitForTimeout(4000)
        await page.waitForFunction(() => {
            const k = window.__bench.zoomK()
            const seen = (window.__kSeen = (window.__kSeen ?? []))
            seen.push(k)
            return seen.length >= 3 && seen.slice(-3).every((v) => v === k)
        }, null, { timeout: 30000, polling: 500 })

        const inRuns = []
        const outRuns = []
        for (let i = 0; i < RUNS; i++) {
            // Start from shapes every time, so the measured crossing is the same one.
            await page.evaluate((k) => window.__bench.crossTo(k), ZOOM_SHAPES)
            await page.waitForTimeout(400)

            const into = await page.evaluate((k) => window.__bench.crossTo(k), ZOOM_CARDS)
            await page.waitForTimeout(400)
            const out = await page.evaluate((k) => window.__bench.crossTo(k), ZOOM_SHAPES)
            await page.waitForTimeout(400)

            inRuns.push({ ...into, frames: frameStats(into.frames) })
            outRuns.push({ ...out, frames: frameStats(out.frames) })
        }

        const entry = {
            n,
            mode: fade ? `cross-fade ${fade}ms` : 'plain',
            toCards: median(inRuns),
            toShapes: median(outRuns),
            errors: errors.slice(0, 3),
        }
        // The raw frame arrays are long and the stats above stand in for them.
        delete entry.toCards.frames.raw
        results.push(entry)
        console.log(`${n} ${entry.mode}: cards ${entry.toCards.cardsBefore}->${entry.toCards.cardsAfter}`
            + ` (k=${entry.toCards.reachedK.toFixed(2)}) worst ${entry.toCards.frames.worst}ms`
            + ` | shapes ${entry.toShapes.cardsBefore}->${entry.toShapes.cardsAfter}`
            + ` (k=${entry.toShapes.reachedK.toFixed(2)}) worst ${entry.toShapes.frames.worst}ms`)
        const crossed = Math.abs(entry.toCards.cardsAfter - entry.toCards.cardsBefore)
        console.log(`  ${crossed} nodes crossed, ghosts peaked at ${entry.toCards.ghostsPeak}`)
        if (crossed === 0) console.log('  !! no crossing measured — the zoom did not change the tier')
        await page.close()
    }
}

await browser.close()

const pad = (s, w) => String(s).padEnd(w)
console.log('\n=== SUMMARY (median of ' + RUNS + ' runs, by worst frame) ===')
console.log(pad('n', 6) + pad('mode', 18) + pad('direction', 12) + pad('worst frame', 13)
    + pad('median frame', 14) + pad('frames > 16.7', 15) + pad('ghosts', 8) + 'settled ms')
for (const e of results) {
    for (const [key, label] of [['toCards', 'to cards'], ['toShapes', 'to shapes']]) {
        const r = e[key]
        console.log(pad(e.n, 6) + pad(e.mode, 18) + pad(label, 12) + pad(r.frames.worst, 13)
            + pad(r.frames.median, 14) + pad(`${r.frames.over} of ${r.frames.n}`, 15)
            + pad(r.ghostsPeak, 8) + r.settled.toFixed(0))
    }
}

console.log('\n=== OVERHEAD (cross-fade vs plain) ===')
for (const n of SIZES) {
    const plain = results.find((r) => r.n === n && r.mode === 'plain')
    if (!plain) continue
    for (const faded of results.filter((r) => r.n === n && r.mode !== 'plain')) {
        for (const [key, label] of [['toCards', 'to cards'], ['toShapes', 'to shapes']]) {
            const dw = faded[key].frames.worst - plain[key].frames.worst
            console.log(`${pad(n, 6)}${pad(faded.mode, 18)}${pad(label, 12)}worst frame `
                + `${plain[key].frames.worst}ms -> ${faded[key].frames.worst}ms`
                + `  (${dw >= 0 ? '+' : ''}${dw.toFixed(1)}ms)`)
        }
    }
}
