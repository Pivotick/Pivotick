/** One look at the explainer page before publishing (scratch, not shipped). */
import { chromium } from '@playwright/test'

const OUT = '/home/sami/.claude/jobs/985b959c/tmp'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

await page.goto('file://' + OUT + '/node-tiers-spacing.html')
await page.waitForTimeout(2500)
await page.locator('#try').screenshot({ path: OUT + '/shot-try.png' })

await page.mouse.move(600, 500)
for (let i = 0; i < 9; i++) {
    await page.mouse.wheel(0, -120)
    await page.waitForTimeout(40)
}
await page.waitForTimeout(400)
await page.locator('#try').screenshot({ path: OUT + '/shot-zoomed.png' })

const hud = await page.evaluate(() => ({
    zoom: document.getElementById('live-zoom').textContent,
    tier: document.getElementById('live-tier').textContent,
    gap: document.getElementById('live-gap').textContent,
    foot: document.getElementById('live-foot').textContent,
}))
console.log('HUD after zoom:', JSON.stringify(hud))
console.log('errors:', errs.slice(0, 5))

await browser.close()
