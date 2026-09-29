import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, harness, canvas, waitForViewSettled } from '../helpers'

/**
 * A portaled tooltip hangs off `<body>`, so any theme variable it inherits comes from `:root`,
 * whose palette follows the OS scheme. A forced `UI.theme` must still win: the header must
 * not take the other theme's background.
 *
 * The `simplify` fixture with the neighbour rule: `hub` stays a plain node, and the six IPs
 * fold into one group.
 */

type Theme = 'light' | 'dark'

async function load(page: Page, theme: Theme): Promise<void> {
    await harness(page, 'loadSimplify', {
        UI: { mode: 'full', theme, simplify: { rules: [{ kind: 'neighbours' }] } },
    })
    await waitForViewSettled(page)
}

async function groupDomId(page: Page, member: string): Promise<string> {
    return page.evaluate((id) => {
        const simplify = window.__pivotick.graph!.simplify
        return simplify.getGroupNode(simplify.groupOf(id)!.id)!.domID
    }, member)
}

async function nodeDomId(page: Page, id: string): Promise<string> {
    return page.evaluate((id) => window.__pivotick.graph!.getMutableNode(id)!.domID, id)
}

/** Bring the pointer onto a drawn node from just above it, in steps the proximity guard accepts. */
async function hover(page: Page, domId: string): Promise<void> {
    const box = (await canvas(page).locator(`#node-${domId} .node`).first().boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y - 10)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 })
    await expect(page.locator('.pvt-tooltip')).toHaveClass(/shown/)
}

/** The header's own background, and the title's contrast against what is painted behind it. */
async function readHeader(page: Page): Promise<{ background: string, contrast: number }> {
    return page.evaluate(() => {
        const parse = (c: string): number[] => (c.match(/[\d.]+/g) ?? []).map(Number)
        const luminance = ([r, g, b]: number[]): number => {
            const channel = (v: number): number => {
                const s = v / 255
                return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
            }
            return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
        }
        const painted = (el: Element | null): string => {
            for (; el; el = el.parentElement) {
                const bg = getComputedStyle(el).backgroundColor
                const alpha = parse(bg)[3]
                if (alpha === undefined || alpha > 0) return bg
            }
            return 'rgb(255, 255, 255)'
        }
        const header = document.querySelector('.pvt-tooltip .pvt-mainheader-container')!
        const title = header.querySelector('.pvt-mainheader-nodeinfo-name')!
        const [lighter, darker] = [luminance(parse(getComputedStyle(title).color)), luminance(parse(painted(header)))]
            .sort((a, b) => b - a)
        return {
            background: getComputedStyle(header).backgroundColor,
            contrast: (lighter + 0.05) / (darker + 0.05),
        }
    })
}

const CASES: { theme: Theme, os: Theme, background: string }[] = [
    { theme: 'dark', os: 'light', background: 'rgba(0, 0, 0, 0)' },
    { theme: 'light', os: 'dark', background: 'rgb(250, 250, 250)' },
]

for (const { theme, os, background } of CASES) {
    test.describe(`portaled tooltip, theme ${theme} under a ${os} OS`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width: 1400, height: 900 })
            await page.emulateMedia({ colorScheme: os })
            await gotoHarness(page)
            await load(page, theme)
        })

        test('a node\'s header takes the forced theme', async ({ page }) => {
            await hover(page, await nodeDomId(page, 'hub'))
            const header = await readHeader(page)
            expect(header.background).toBe(background)
            expect(header.contrast).toBeGreaterThanOrEqual(4.5)
        })

        test('a group\'s header takes the forced theme', async ({ page }) => {
            await hover(page, await groupDomId(page, 'ip-0'))
            const header = await readHeader(page)
            expect(header.background).toBe(background)
            expect(header.contrast).toBeGreaterThanOrEqual(4.5)
        })
    })
}
