import { chromium } from '@playwright/test'
const b = await chromium.launch()
const p = await b.newPage()
await p.goto('http://localhost:5199/lod-bench.html?n=10')
await p.waitForFunction(() => window.__bench?.ready === true, null, { timeout: 60000 })
const r = await p.evaluate(async () => {
  const { parseSvgIconMarkup } = await import('/src/utils/SvgSanitizer.ts')
  const markup = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 9 L22 20 L10 20 Z" fill="currentColor"/></svg>'
  parseSvgIconMarkup(markup)
  const t0 = performance.now()
  for (let i = 0; i < 2000; i++) parseSvgIconMarkup(markup)
  return (performance.now() - t0) / 2000
})
console.log('ms per sanitize:', r.toFixed(4))
await b.close()
