/**
 * Capture the README hero shot (`docs/pictures/graph-full-ui.png`) from the dev
 * demo page, so it shows the real, current full-mode chrome rather than whatever
 * the UI looked like when someone last took a manual screenshot.
 *
 * Boots the Vite dev server, waits for the graph to actually finish rendering
 * (the graph reveals `.zoom-layer:not(.hidden)` only once layout is done), then
 * selects a well-connected node so the sidebar is populated the way a user sees
 * it, and shoots the layout root — top bar, mode rail, tool panel and sidebar.
 *
 *   npm run docs:hero
 *   HERO_PORT=5191 npm run docs:hero    # if the default port is taken
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { chromium } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.HERO_PORT) || 5191
const ORIGIN = `http://localhost:${PORT}`
const OUT = path.resolve(REPO_ROOT, 'docs/pictures/graph-full-ui.png')

/** The demo node the shot selects — well-connected, so the sidebar has content. */
const HERO_NODE = 'D2' // "Trent"

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

console.log(`Starting Vite dev server on :${PORT} …`)
const server = spawn(
    'npx',
    ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: REPO_ROOT, stdio: 'ignore' }
)

const browser = await chromium.launch()
try {
    await waitForServer(ORIGIN)
    const page = await browser.newPage({
        viewport: { width: 1600, height: 900 },
        deviceScaleFactor: 2, // crisp on HiDPI READMEs
        // The UI follows `prefers-color-scheme` unless `UI.theme` forces one.
        // Emulate a dark-mode visitor rather than restyling the page.
        colorScheme: 'dark',
    })
    // `?hero` drops the demo's opt-in "coming soon" rail modes, so the shot shows
    // the rail as it ships by default.
    await page.goto(`${ORIGIN}/?hero`, { waitUntil: 'networkidle' })

    await page
        .locator('.zoom-layer:not(.hidden)')
        .first()
        .waitFor({ state: 'attached', timeout: 30_000 })

    // Stable text metrics, then a settle window: the demo graph carries notes and
    // a sizeable force layout that keeps moving well past first paint.
    await page.evaluate(() => document.fonts?.ready)
    await page.waitForTimeout(2500)

    await page.evaluate((id) => {
        const graph = window.pivotick
        const node = graph?.getMutableNode(id)
        if (node) graph.selectElement(node)
    }, HERO_NODE)
    await page.waitForTimeout(1800)

    // Opening the sidebar narrows the canvas, so re-fit against the real box.
    // No `forceScale` — that pins the zoom at 1 instead of fitting the content.
    // The fit has to swallow the demo's far-flung notes, which leaves the graph
    // itself small, so take one zoom step back in: the graph reads, and the notes
    // still frame it from the lower edge.
    await page.evaluate(() => {
        window.pivotick?.renderer?.fitAndCenter()
        window.pivotick?.renderer?.zoomIn()
    })
    await page.waitForTimeout(1200)

    const layout = page.locator('.pvt-layout').first()
    await layout.waitFor({ state: 'visible', timeout: 10_000 })
    await layout.screenshot({ path: OUT })
    console.log(`  ✓ ${path.relative(REPO_ROOT, OUT)}`)
} finally {
    await browser.close()
    server.kill('SIGTERM')
}
