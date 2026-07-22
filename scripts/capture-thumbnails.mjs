/**
 * Capture gallery card thumbnails (`pic.png`) straight from the rendered docs,
 * so the picture is WYSIWYG with the code shown on the card.
 *
 * Boots the VitePress dev server, visits each card's page, waits for the graph
 * to *actually* finish rendering — the graph reveals `.zoom-layer:not(.hidden)`
 * only once layout is done, then we also wait on web fonts + a short settle so
 * asynchronously drawn content (markdown notes, clusters) is present — and
 * screenshots the graph viewport into the card folder.
 *
 *   node scripts/capture-thumbnails.mjs            # every discovered card
 *   node scripts/capture-thumbnails.mjs b2 b5      # only these slugs
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { chromium } from '@playwright/test'
import { discoverCards } from '../docs/.vitepress/gallery-files.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const GALLERY_DIR = path.resolve(REPO_ROOT, 'docs/examples/gallery')
const BASE = '/Pivotick/'
const PORT = Number(process.env.THUMB_PORT) || 5180
const ORIGIN = `http://localhost:${PORT}`

/** Poll an URL until it answers (server boot) or we give up. */
async function waitForServer(url, timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url)
            if (res.ok || res.status === 404) return
        } catch {
            /* not up yet */
        }
        await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error(`Dev server did not start within ${timeoutMs}ms`)
}

async function captureCard(page, slug) {
    const url = `${ORIGIN}${BASE}examples/gallery/${slug}/content.html`
    await page.goto(url, { waitUntil: 'networkidle' })

    // The graph un-hides its zoom layer only when the initial layout is "done"
    // (mirrors the visual-test harness's render-complete signal).
    await page
        .locator('.zoom-layer:not(.hidden)')
        .first()
        .waitFor({ state: 'attached', timeout: 30_000 })

    // Stable text metrics + a settle window for async note/markdown/cluster draw.
    // Cluster cards re-fit ~1s after load via fitAndCenterWhenSettled (it waits for
    // badges/radius to settle), so leave a little room past that for the final framing.
    await page.evaluate(() => document.fonts?.ready)
    await page.waitForTimeout(1300)

    const canvas = page.locator('.pvt-canvas').first()
    await canvas.waitFor({ state: 'visible', timeout: 10_000 })
    const out = path.join(GALLERY_DIR, slug, 'pic.png')
    await canvas.screenshot({ path: out })
    return out
}

async function main() {
    const requested = process.argv.slice(2).map((s) => s.toLowerCase())
    const cards = discoverCards().filter(
        (c) => requested.length === 0 || requested.includes(c.slug.toLowerCase())
    )

    if (cards.length === 0) {
        console.log('No gallery cards to capture (empty gallery or no slug matched).')
        return
    }

    console.log(`Starting VitePress dev server on :${PORT} …`)
    const server = spawn(
        'npx',
        ['vitepress', 'dev', 'docs', '--port', String(PORT), '--host', '127.0.0.1'],
        { cwd: REPO_ROOT, stdio: 'ignore' }
    )

    const browser = await chromium.launch()
    let failures = 0
    try {
        await waitForServer(`${ORIGIN}${BASE}`)
        const page = await browser.newPage({
            viewport: { width: 900, height: 600 },
            deviceScaleFactor: 2, // crisp thumbnails
        })
        for (const card of cards) {
            try {
                const out = await captureCard(page, card.slug)
                console.log(`  ✓ ${card.slug} → ${path.relative(REPO_ROOT, out)}`)
            } catch (err) {
                failures++
                console.error(`  ✗ ${card.slug}: ${err.message}`)
            }
        }
    } finally {
        await browser.close()
        server.kill('SIGTERM')
    }

    if (failures > 0) {
        console.error(`\n${failures} card(s) failed to capture.`)
        process.exitCode = 1
    } else {
        console.log(`\nCaptured ${cards.length} thumbnail(s).`)
    }
}

main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
