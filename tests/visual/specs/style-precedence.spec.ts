import { test, expect, gotoHarness, harness } from '../helpers'
import type { Page } from '@playwright/test'
import type { EdgeSwatchSnapshot } from '../harness/harness'

/**
 * Where a `styleCb` sits, depending on which style block declares it.
 *
 * There are two of them and they are not the same thing. On an **element's own** style
 * a `styleCb` wins outright and the style map is skipped entirely. On
 * `render.default*Style` it is the computed form of the *default* slot: it fills what
 * nothing narrower set, and loses to both the element's own style and the style map.
 *
 * The default callbacks were declared in `RendererOptions` but never invoked by either
 * renderer until now, so every case here is a new guarantee rather than a refactor.
 */

/** The colour the default callbacks paint — read from the harness, not duplicated here. */
async function callbackColor(page: Page): Promise<string> {
    return (await harness(page, 'defaultCallbackColor')) as string
}

async function callbackWidth(page: Page): Promise<number> {
    return (await harness(page, 'defaultCallbackWidth')) as number
}

async function strokeOf(page: Page, id: string): Promise<string> {
    const style = (await harness(page, 'edgeStyleOf', id)) as EdgeSwatchSnapshot | null
    return style?.stroke ?? ''
}

async function widthOf(page: Page, id: string): Promise<number | null> {
    return (await harness(page, 'edgeStrokeWidth', id)) as number | null
}

test.beforeEach(async ({ page }) => {
    await gotoHarness(page)
})

test.describe('a default styleCb', () => {
    test('paints edges that declare nothing of their own', async ({ page }) => {
        await harness(page, 'loadWithStyleCallbacks', 'edgeLayers', { edge: true })

        const expected = await callbackColor(page)
        expect(await strokeOf(page, 'hub-a')).toBe(expected)
        expect(await strokeOf(page, 'a-b')).toBe(expected)
        expect(await widthOf(page, 'hub-a')).toBe(await callbackWidth(page))
    })

    test('paints nodes that declare nothing of their own', async ({ page }) => {
        await harness(page, 'loadWithStyleCallbacks', 'edgeLayers', { node: true })

        expect(await harness(page, 'nodeColor', 'hub')).toBe(await callbackColor(page))
    })

    test('paints edge labels', async ({ page }) => {
        // `basic` carries exactly one labelled edge, so the one fill read is unambiguous.
        await harness(page, 'loadWithStyleCallbacks', 'basic', { label: true })

        // An inline `fill` reads back through the CSSOM, which normalises the hex.
        const expected = (await harness(page, 'cssColor', await callbackColor(page))) as string
        await expect.poll(() => harness(page, 'edgeLabelFills')).toEqual([expected])
    })

    test('loses each property the style map names, and fills the rest', async ({ page }) => {
        await harness(page, 'loadWithStyleCallbacks', 'edgeLayers',
            { edge: true, edgeStyleMap: true })

        // `edgeStyleMap` names the kind, which is narrower than a graph-wide default, so
        // it takes the colour — but it sets no width, so the callback's still lands.
        expect(await strokeOf(page, 'a-b')).toBe('#888888')
        expect(await widthOf(page, 'a-b')).toBe(await callbackWidth(page))
    })

    test('loses to an edge\'s own styleCb, and fills what that left out', async ({ page }) => {
        await harness(page, 'loadWithStyleCallbacks', 'edgeLayers',
            { edge: true, edgeStyleMap: true, edgeOwn: true })

        // The edge's own callback wins outright on colour — over the map *and* over the
        // default callback — while the width it never mentioned still comes from the default.
        expect(await strokeOf(page, 'a-b')).toBe('#ff00ff')
        expect(await widthOf(page, 'a-b')).toBe(await callbackWidth(page))
    })

    test('declaring none of them leaves the graph exactly as it was', async ({ page }) => {
        await harness(page, 'loadWithStyleCallbacks', 'edgeLayers')
        const untouched = await strokeOf(page, 'hub-a')

        // The theme default, not the callback colour — nothing was declared.
        expect(untouched).not.toBe(await callbackColor(page))
        expect(await strokeOf(page, 'a-b')).toBe(untouched)
    })
})
