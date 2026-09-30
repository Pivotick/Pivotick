import type { Page } from '@playwright/test'
import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    nodeEl,
    centerOf,
    canvas,
    waitForViewSettled,
    expectCanvas,
} from '../helpers'
import type { EdgeHookBehavior } from '../harness/harness'

// The busy cue shown while an awaited consumer hook is in flight: `data-pvt-busy` on
// the graph's root after a delay, a spinner at the anchor, and nothing while a prompt
// the hook opened is on screen.

const INDICATOR = '.pvt-busy-indicator'

type Transition = { ms: number; busy: boolean }

const busyLog = async (page: Page): Promise<Transition[]> =>
    (await harness(page, 'busyLog')) as Transition[]

const edgeCount = async (page: Page): Promise<number> =>
    ((await harness(page, 'counts')) as { edges: number }).edges

/** The sequence of states the root went through, without the timings. */
const busyStates = async (page: Page): Promise<boolean[]> =>
    (await busyLog(page)).map(t => t.busy)

async function isBusy(page: Page): Promise<boolean> {
    return page.locator('.pivotick').evaluate(el => el.hasAttribute('data-pvt-busy'))
}

async function armHook(page: Page, edgeHook: EdgeHookBehavior, asyncDelayMs: number): Promise<void> {
    await harness(page, 'configureConnect', { edgeHook, asyncDelayMs })
    await harness(page, 'watchBusy')
    await harness(page, 'startClickConnect')
}

/** Drag a connection from a and release it on b, so the preview edge ends at b. */
async function dragConnect(page: Page): Promise<void> {
    const a = await centerOf(nodeEl(page, 'a'))
    const b = await centerOf(nodeEl(page, 'b'))
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 10 })
    await page.mouse.up()
}

test.describe('busy indicator while a hook is awaited', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'pair')
        await waitForViewSettled(page)
    })

    test('shows only after the delay, then goes when the hook resolves', async ({ page }) => {
        await armHook(page, 'accept-async', 500)
        await harness(page, 'pickConnectNode', 'a')
        await harness(page, 'pickConnectNode', 'b')

        await expect.poll(() => edgeCount(page)).toBe(1)
        await expect.poll(() => busyStates(page)).toEqual([true, false])

        const [on, off] = await busyLog(page)
        expect(on.ms, 'nothing is shown during the first 200 ms').toBeGreaterThanOrEqual(190)
        expect(on.ms, 'shown well before the hook settles').toBeLessThan(400)
        expect(off.ms, 'cleared once the hook settles').toBeGreaterThanOrEqual(490)
        await expect(page.locator(INDICATOR)).toHaveCount(0)
    })

    test('a fast hook never shows anything', async ({ page }) => {
        await armHook(page, 'accept-async', 50)
        await harness(page, 'pickConnectNode', 'a')
        await harness(page, 'pickConnectNode', 'b')

        await expect.poll(() => edgeCount(page)).toBe(1)
        await page.waitForTimeout(300)
        expect(await busyStates(page)).toEqual([])
    })

    test('steps aside while the hook\'s prompt is open', async ({ page }) => {
        await armHook(page, 'slow-prompt-slow', 400)
        await harness(page, 'pickConnectNode', 'a')
        await harness(page, 'pickConnectNode', 'b')

        const modal = page.locator('.pvt-modal.pvt-modal-open')
        await expect(modal).toBeVisible()
        expect(await busyStates(page), 'busy before the form, cleared once it opens').toEqual([true, false])
        expect(await isBusy(page)).toBe(false)

        await modal.locator('input').fill('knows')
        await modal.getByRole('button', { name: 'Add' }).click()

        await expect.poll(() => edgeCount(page)).toBe(1)
        expect(await busyStates(page), 'busy again during the save, cleared once it lands').toEqual([true, false, true, false])
    })

    test('a hook that rejects clears busy', async ({ page }) => {
        await armHook(page, 'reject-async', 500)
        await harness(page, 'pickConnectNode', 'a')
        await harness(page, 'pickConnectNode', 'b')

        await expect.poll(() => busyStates(page)).toEqual([true, false])
        expect(await edgeCount(page)).toBe(0)
    })

    test('Escape during the wait clears busy', async ({ page }) => {
        await armHook(page, 'accept-async', 3000)
        await harness(page, 'pickConnectNode', 'a')
        await harness(page, 'pickConnectNode', 'b')

        await expect.poll(() => isBusy(page)).toBe(true)
        await page.locator('.pivotick').focus()
        await page.keyboard.press('Escape')

        expect(await isBusy(page)).toBe(false)
        await expect(page.locator(INDICATOR)).toHaveCount(0)
    })

    test('busyIndicator: false shows nothing', async ({ page }) => {
        await harness(page, 'setBusyIndicator', false)
        await armHook(page, 'accept-async', 500)
        await harness(page, 'pickConnectNode', 'a')
        await harness(page, 'pickConnectNode', 'b')

        await expect.poll(() => edgeCount(page)).toBe(1)
        expect(await busyStates(page)).toEqual([])
    })

    test('without a preview edge, a labelled pill sits at the bottom-centre', async ({ page }) => {
        await armHook(page, 'accept-async', 3000)
        await harness(page, 'pickConnectNode', 'a')
        await harness(page, 'pickConnectNode', 'b')

        const pill = page.locator(INDICATOR)
        await expect(pill).toBeVisible()
        await expect(pill).toHaveAttribute('role', 'status')
        await expect(pill).toHaveAttribute('aria-busy', 'true')
        await expect(pill.locator('.pvt-busy-label')).toHaveText('Waiting…')

        const box = (await pill.boundingBox())!
        const area = (await canvas(page).boundingBox())!
        expect(Math.abs(box.x + box.width / 2 - (area.x + area.width / 2)), 'horizontally centred').toBeLessThan(2)
        expect(area.y + area.height - (box.y + box.height), 'near the bottom edge').toBeLessThan(40)
    })
})

// The drag setup of `edge-creation.spec.ts`: drag off and nodes pinned, so the
// gesture and the snapshot depend on the fixture alone.
test.describe('busy indicator on a dragged connection', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'pair', { render: { dragEnabled: false } })
        await harness(page, 'pin')
    })

    test('the spinner sits at the target end of the preview edge', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'accept-async', asyncDelayMs: 3000 })
        await harness(page, 'startEdgeConnect')
        await dragConnect(page)

        const spinner = page.locator(`${INDICATOR}.pvt-busy-indicator--at-point`)
        await expect(spinner).toBeVisible()

        const end = await page.evaluate(() => {
            const path = document.querySelector<SVGPathElement>('.pvt-shadow-edge')!
            const point = path.getPointAtLength(path.getTotalLength())
            const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM()!)
            return { x: screen.x, y: screen.y }
        })
        const centre = await centerOf(spinner)
        expect(Math.hypot(centre.x - end.x, centre.y - end.y), 'centred on the preview\'s end').toBeLessThan(2)

        await expectCanvas(page, 'busy-at-preview-end.png')
    })
})
