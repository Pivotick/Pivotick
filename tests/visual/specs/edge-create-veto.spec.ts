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
    expectCanvas,
} from '../helpers'
import type { RecordedEdge } from '../harness/harness'

// The before-create edge hook (`onBeforeEdgeCreate`) and the live-validity
// predicate (`isValidConnection`). These gate the *interactive* connect gesture
// — click-to-connect and drag-to-connect — so the tests drive the same editing
// session the app does and assert on the *outcome* (model counts, the recorded
// `edgeAdd` payload, the note attachment), not just that a callback ran.
//
// The logic cases use click-to-connect (`startClickConnect` + `pickConnectNode`),
// which is fully deterministic — no pointer timing. The live-predicate case needs
// a real drag, so it mirrors the drag setup in `edge-creation.spec.ts`
// (`dragEnabled:false` + `pin` + `startEdgeConnect`).

const SHADOW_EDGE = '.pvt-shadow-edge'

// ── small, self-documenting readers over the serialisable harness API ────────
const edgeCount = async (page: Page): Promise<number> =>
    ((await harness(page, 'counts')) as { edges: number }).edges

/** How many times `onBeforeEdgeCreate` was invoked (0 when absent / not consulted). */
const edgeHookCalls = async (page: Page): Promise<number> =>
    ((await harness(page, 'hookCalls')) as { edge: number }).edge

/** Edges that actually entered the model (empty ⇒ nothing was created / no `edgeAdd`). */
const recordedEdges = async (page: Page): Promise<RecordedEdge[]> =>
    (await harness(page, 'edgeEvents')) as RecordedEdge[]

/** Drive click-to-connect: pick `from` as source, then `to` as target. */
async function clickConnect(page: Page, from: string, to: string): Promise<void> {
    await harness(page, 'pickConnectNode', from)
    await harness(page, 'pickConnectNode', to)
}

/**
 * Assert the shadow-edge preview is drawn and on-screen (see `edge-creation.spec.ts`):
 * a horizontal preview has a zero-height box that `toBeVisible()` treats as hidden,
 * so check the path data is set and the element isn't `display:none`.
 */
async function expectShadowShown(page: Page): Promise<void> {
    const shadow = canvas(page).locator(SHADOW_EDGE)
    await expect(shadow).toHaveAttribute('d', /^\s*M/)
    await expect(shadow).not.toHaveCSS('display', 'none')
}

test.describe('edge creation — before-create hook (onBeforeEdgeCreate)', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'pair')
    })

    test('veto (sync) creates no edge and fires no edgeAdd', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'veto' })
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        // The hook ran once and refused: nothing entered the model, no edgeAdd.
        await expect.poll(() => edgeHookCalls(page)).toBe(1)
        expect(await edgeCount(page)).toBe(0)
        expect(await recordedEdges(page)).toHaveLength(0)
    })

    test('veto (async) creates no edge and fires no edgeAdd', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'veto-async', asyncDelayMs: 120 })
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        await expect.poll(() => edgeHookCalls(page)).toBe(1)
        expect(await edgeCount(page)).toBe(0)
        expect(await recordedEdges(page)).toHaveLength(0)
    })

    test('after a veto the consumer can retry and accept', async ({ page }) => {
        // `veto-once` refuses the first attempt, then accepts — proving connect
        // mode stays armed after a veto.
        await harness(page, 'configureConnect', { edgeHook: 'veto-once' })
        await harness(page, 'startClickConnect')

        await clickConnect(page, 'a', 'b')
        await expect.poll(() => edgeHookCalls(page)).toBe(1)
        expect(await edgeCount(page)).toBe(0)

        await clickConnect(page, 'a', 'b')
        await expect.poll(() => edgeCount(page)).toBe(1)
        expect(await edgeHookCalls(page)).toBe(2)
    })

    test('accept (true) creates the edge with defaults', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'accept' })
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        await expect.poll(() => edgeCount(page)).toBe(1)
        const events = await recordedEdges(page)
        expect(events).toHaveLength(1)
        expect(events[0].data).toEqual({})
        expect(events[0].directed).toBeNull()
    })

    test('accept-with-data creates the edge carrying the supplied data + direction', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'accept-data' })
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        await expect.poll(() => edgeCount(page)).toBe(1)
        const events = await recordedEdges(page)
        expect(events).toHaveLength(1)
        expect(events[0].data.label).toBe('linked-to')
        expect(events[0].directed).toBe(true)
    })

    test('locks out new gestures while an async decision is pending', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'accept-async', asyncDelayMs: 400 })
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        // The hook was invoked once (synchronously, up to its await) and is now pending.
        expect(await edgeHookCalls(page)).toBe(1)

        // A second gesture during the pending window is ignored — the hook is not re-entered.
        await clickConnect(page, 'a', 'b')
        expect(await edgeHookCalls(page)).toBe(1)

        // Once it settles, exactly one edge lands and the hook was still called only once.
        await expect.poll(() => edgeCount(page)).toBe(1)
        expect(await edgeHookCalls(page)).toBe(1)
    })

    test('absent callback: creation is unchanged and edgeAdd still fires', async ({ page }) => {
        // Record edgeAdd but install no hook — the regression-safety case.
        await harness(page, 'configureConnect', {})
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        await expect.poll(() => edgeCount(page)).toBe(1)
        expect(await recordedEdges(page)).toHaveLength(1)
        expect(await edgeHookCalls(page)).toBe(0)
    })

    test('no hook: a duplicate same-pair connect is skipped (dedup)', async ({ page }) => {
        await harness(page, 'startClickConnect')

        await clickConnect(page, 'a', 'b')
        await expect.poll(() => edgeCount(page)).toBe(1)

        await clickConnect(page, 'a', 'b')
        // Give the (microtask) decision a beat, then confirm the duplicate was skipped.
        await expect.poll(() => edgeCount(page)).toBe(1)
    })

    test('with hook: the consumer owns dedup — a second accepted a→b is a distinct edge', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'accept' })
        await harness(page, 'startClickConnect')

        await clickConnect(page, 'a', 'b')
        await expect.poll(() => edgeCount(page)).toBe(1)

        await clickConnect(page, 'a', 'b')
        await expect.poll(() => edgeCount(page)).toBe(2)
    })
})

test.describe('edge creation — before-create hook, drag-to-connect', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'pair', { render: { dragEnabled: false } })
        await harness(page, 'configureConnect', { edgeHook: 'accept-data' })
        await harness(page, 'pin')
        await harness(page, 'startEdgeConnect')
    })

    test('fires on a drag gesture (origin "drag") and creates the edge with data', async ({ page }) => {
        const a = await centerOf(nodeEl(page, 'a'))
        const b = await centerOf(nodeEl(page, 'b'))

        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.mouse.move(b.x, b.y, { steps: 12 })
        await expectShadowShown(page)
        await page.mouse.up()

        await expect.poll(() => edgeCount(page)).toBe(1)
        const events = await recordedEdges(page)
        expect(events[0].data.label).toBe('linked-to')

        const contexts = (await harness(page, 'hookContexts')) as Array<{ origin: string; kind: string }>
        expect(contexts[0]).toEqual({ origin: 'drag', kind: 'edge' })
    })
})

test.describe('edge creation — live isValidConnection predicate', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'pair', { render: { dragEnabled: false } })
        // Reject every target, and also install an accepting before-create hook —
        // so the test proves the invalid target is refused *before* the hook, not by it.
        await harness(page, 'configureConnect', { validConnection: 'reject-all', edgeHook: 'accept' })
        await harness(page, 'pin')
        await harness(page, 'startEdgeConnect')
    })

    test('marks an invalid hovered target and refuses it without consulting the before-create hook', async ({ page }) => {
        const a = await centerOf(nodeEl(page, 'a'))
        const b = await centerOf(nodeEl(page, 'b'))

        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.mouse.move(b.x, b.y, { steps: 12 })

        // The shadow edge renders in the invalid style while hovering the rejected target.
        const shadow = canvas(page).locator(SHADOW_EDGE)
        await expectShadowShown(page)
        await expect(shadow).toHaveClass(/pvt-shadow-edge--invalid/)
        await expectCanvas(page, 'drag-invalid-target.png')

        await page.mouse.up()

        // Releasing on an invalid target creates nothing, and the before-create hook
        // was never consulted (the live predicate short-circuited it).
        expect(await edgeCount(page)).toBe(0)
        expect(await edgeHookCalls(page)).toBe(0)
        expect(((await harness(page, 'hookCalls')) as { validConnection: number }).validConnection).toBeGreaterThan(0)
    })
})

test.describe('edge creation — note-link before-create hook', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'withNote')
    })

    test('veto blocks the note→node link and fires the hook with kind note-link', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'veto' })
        await harness(page, 'linkNote', 'note1', 'e')

        await expect.poll(() => edgeHookCalls(page)).toBe(1)
        expect(await harness(page, 'noteAttachment', 'note1')).toBeNull()

        const contexts = (await harness(page, 'hookContexts')) as Array<{ origin: string; kind: string }>
        expect(contexts[0]).toEqual({ origin: 'click', kind: 'note-link' })
    })

    test('accept links the note to the node', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'accept' })
        await harness(page, 'linkNote', 'note1', 'e')

        await expect
            .poll(async () => (await harness(page, 'noteAttachment', 'note1')) !== null)
            .toBe(true)
        expect(await harness(page, 'noteAttachment', 'note1')).toEqual({ type: 'node', id: 'e' })
    })
})

// The label prompt: an interactive way to enter an edge's label mid-gesture, via
// either `ctx.promptLabel({ mode })` inside `onBeforeEdgeCreate` (per-event choice
// of inline vs modal) or the hook-less static `editors.edgeEditor.labelPrompt`
// option. Both drive the same prompt primitive and stamp `data.label`.

/** The floating inline label input (0 count when it isn't open). */
const inlineLabelInput = (page: Page) => page.locator('.pvt-edge-label-input')
/** The label input rendered inside the modal skin. */
const modalLabelInput = (page: Page) => page.locator('.pvt-edge-prompt-modal-body .pvt-edge-label-input')

/** Type into the (already-open) inline input and commit with Enter. */
async function commitInlineLabel(page: Page, text: string): Promise<void> {
    const input = inlineLabelInput(page)
    await input.waitFor({ state: 'visible' })
    await input.fill(text)
    await input.press('Enter')
}

test.describe('edge creation — label prompt (ctx.promptLabel + static option)', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'pair')
    })

    test('hook: the inline prompt commits the typed label onto the new edge', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'prompt-inline' })
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        await commitInlineLabel(page, 'knows')

        await expect.poll(() => edgeCount(page)).toBe(1)
        const events = await recordedEdges(page)
        expect(events).toHaveLength(1)
        expect(events[0].data.label).toBe('knows')
        expect(await edgeHookCalls(page)).toBe(1)
        // The floating input is torn down once the decision settles.
        await expect(inlineLabelInput(page)).toHaveCount(0)
    })

    test('hook: cancelling the inline prompt (Esc) vetoes — no edge is created', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'prompt-inline' })
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        await inlineLabelInput(page).waitFor({ state: 'visible' })
        await inlineLabelInput(page).press('Escape')

        // Hook ran (once) but the cancel resolved to a veto: nothing lands.
        await expect.poll(() => edgeHookCalls(page)).toBe(1)
        expect(await edgeCount(page)).toBe(0)
        expect(await recordedEdges(page)).toHaveLength(0)
        await expect(inlineLabelInput(page)).toHaveCount(0)
    })

    test('hook: the modal prompt commits the typed label via the Add button', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'prompt-modal' })
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        await modalLabelInput(page).waitFor({ state: 'visible' })
        await modalLabelInput(page).fill('reports-to')
        await page.locator('.pvt-modal__footer button', { hasText: 'Add' }).click()

        await expect.poll(() => edgeCount(page)).toBe(1)
        const events = await recordedEdges(page)
        expect(events[0].data.label).toBe('reports-to')
    })

    test('static option (no hook): the inline prompt stamps data.label with no callback', async ({ page }) => {
        await harness(page, 'configureConnect', {}) // record edgeAdd, install no hook
        await harness(page, 'setEdgeLabelPrompt', 'inline')
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        await commitInlineLabel(page, 'friend')

        await expect.poll(() => edgeCount(page)).toBe(1)
        const events = await recordedEdges(page)
        expect(events[0].data.label).toBe('friend')
        expect(await edgeHookCalls(page)).toBe(0) // proves the static path, not a hook
    })

    test('static option (no hook): cancelling the prompt vetoes the create', async ({ page }) => {
        await harness(page, 'configureConnect', {})
        await harness(page, 'setEdgeLabelPrompt', 'inline')
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        await inlineLabelInput(page).waitFor({ state: 'visible' })
        await inlineLabelInput(page).press('Escape')

        // Give the (microtask) decision a beat, then confirm nothing was created.
        await expect.poll(() => edgeCount(page)).toBe(0)
        expect(await recordedEdges(page)).toHaveLength(0)
    })

    test('hook: promptData with a declarative form collects a whole payload', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'prompt-data-fields' })
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        // FormFactory renders each field as #pvt-form-element-<key>.
        await page.locator('.pvt-edge-prompt-modal-body #pvt-form-element-label').fill('reports-to')
        await page.locator('.pvt-edge-prompt-modal-body #pvt-form-element-note').fill('since Q3')
        await page.locator('.pvt-modal__footer button', { hasText: 'Add' }).click()

        await expect.poll(() => edgeCount(page)).toBe(1)
        const events = await recordedEdges(page)
        expect(events[0].data).toMatchObject({ label: 'reports-to', note: 'since Q3' })
    })

    test('hook: promptData with custom HTML collects via getValues', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'prompt-data-render' })
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        await page.locator('.pvt-edge-prompt-modal-body .test-label').fill('owns')
        await page.locator('.pvt-edge-prompt-modal-body .test-note').fill('custom-html')
        await page.locator('.pvt-modal__footer button', { hasText: 'Add' }).click()

        await expect.poll(() => edgeCount(page)).toBe(1)
        const events = await recordedEdges(page)
        expect(events[0].data).toMatchObject({ label: 'owns', note: 'custom-html' })
    })

    test('hook: cancelling promptData (Cancel button) vetoes — no edge', async ({ page }) => {
        await harness(page, 'configureConnect', { edgeHook: 'prompt-data-render' })
        await harness(page, 'startClickConnect')
        await clickConnect(page, 'a', 'b')

        await page.locator('.pvt-edge-prompt-modal-body .test-label').waitFor({ state: 'visible' })
        await page.locator('.pvt-modal__footer button', { hasText: 'Cancel' }).click()

        await expect.poll(() => edgeHookCalls(page)).toBe(1)
        expect(await edgeCount(page)).toBe(0)
        expect(await recordedEdges(page)).toHaveLength(0)
    })
})

// Mirrors the `label-edge-on-create` gallery card: the before-create hook chooses the
// UI by gesture — a drag gets the inline free-text field, a click-click connect gets a
// modal with a dropdown of predefined labels. Uses the real drag setup (dragEnabled
// off + pin) so both gesture kinds drive the actual session, à la edge-creation.spec.
test.describe('edge creation — label prompt chosen per gesture origin', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'pair', { render: { dragEnabled: false } })
        await harness(page, 'configureConnect', { edgeHook: 'prompt-by-origin' })
        await harness(page, 'pin')
        await harness(page, 'startEdgeConnect')
    })

    test('click-click connect opens the modal dropdown and picks a predefined label', async ({ page }) => {
        await clickConnect(page, 'a', 'b')

        // The dropdown is the custom PivotickPicker (.pvt-picker) inside the modal:
        // open the control, then click the option row.
        await page.locator('.pvt-edge-prompt-modal-body .pvt-picker__control').click()
        await page.locator('.pvt-edge-prompt-modal-body .pvt-picker__option', { hasText: 'manages' }).click()
        await page.locator('.pvt-modal__footer button', { hasText: 'Add' }).click()

        await expect.poll(() => edgeCount(page)).toBe(1)
        expect((await recordedEdges(page))[0].data.label).toBe('manages')
    })

    test('click-click connect: the preselected default label is used when untouched', async ({ page }) => {
        await clickConnect(page, 'a', 'b')

        await page.locator('.pvt-edge-prompt-modal-body .pvt-picker__control').waitFor({ state: 'visible' })
        await page.locator('.pvt-modal__footer button', { hasText: 'Add' }).click()

        await expect.poll(() => edgeCount(page)).toBe(1)
        expect((await recordedEdges(page))[0].data.label).toBe('mentors')
    })

    test('drag-to-connect opens the inline free-text field instead', async ({ page }) => {
        const a = await centerOf(nodeEl(page, 'a'))
        const b = await centerOf(nodeEl(page, 'b'))

        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.mouse.move(b.x, b.y, { steps: 12 })
        await page.mouse.up()

        // No modal — the inline field appears at the edge midpoint.
        await expect(page.locator('.pvt-edge-prompt-modal-body')).toHaveCount(0)
        await commitInlineLabel(page, 'pairs with')

        await expect.poll(() => edgeCount(page)).toBe(1)
        expect((await recordedEdges(page))[0].data.label).toBe('pairs with')
    })
})
