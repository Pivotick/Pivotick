import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    addNote,
    harness,
    noteEl,
} from '../helpers'
import type { Page, Locator } from '@playwright/test'

// The `[[node]]` typeahead (ui/components/Typeahead.ts, wired in svg/NoteDrawer.ts).
// These are behavioural, not visual: they drive the real editor textarea and assert the
// reached outcome (the inserted text, the resolved chip) rather than snapshotting — the
// dropdown is caret-anchored/body-attached, so its exact pixels aren't a stable baseline.

/** The body-attached suggestion menu and its rows. */
const menu = (page: Page): Locator => page.locator('.pvt-typeahead')
const rows = (page: Page): Locator => page.locator('.pvt-typeahead .pvt-typeahead__item')

/**
 * Enter a note's edit mode and return its focused editor textarea with the caret at the very
 * end of the existing content, ready to receive typed input.
 */
async function editNote(page: Page, id: string): Promise<{ note: Locator; editor: Locator }> {
    const note = noteEl(page, id)
    await note.waitFor({ state: 'visible' })
    await note.locator('.pvt-note-content-rendered').dblclick()
    const editor = note.locator('.pvt-note-editor')
    await expect(editor).toBeVisible()
    await editor.focus()
    await page.keyboard.press('Control+End')
    return { note, editor }
}

test.describe('typeahead — [[node]] autocomplete in notes', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        // nodeStyles carries four nodes with distinct labels: SMALL, MEDIUM, LARGE, THIN.
        await loadFixture(page, 'nodeStyles')
        await harness(page, 'pin')
    })

    test('opens on `[[` and filters the node list as you type', async ({ page }) => {
        await addNote(page, { id: 'ta', x: -160, y: 160, width: 300, height: 120, content: 'Ref: ' })
        await harness(page, 'fit', 1)
        const { editor } = await editNote(page, 'ta')

        // The trigger alone lists every node.
        await page.keyboard.type('[[')
        await expect(menu(page)).toBeVisible()
        await expect(rows(page)).toHaveCount(4)

        // Narrowing to `med` leaves only MEDIUM, shown with its node preview.
        await page.keyboard.type('med')
        await expect(rows(page)).toHaveCount(1)
        await expect(rows(page).first()).toContainText('MEDIUM')
        await expect(rows(page).first().locator('.pvt-typeahead__node-preview')).toBeVisible()

        // Nothing chosen yet — the raw trigger text is still in the field.
        expect(await editor.inputValue()).toBe('Ref: [[med')
    })

    test('Enter inserts `[[name]]` and it resolves to a node chip on save', async ({ page }) => {
        await addNote(page, { id: 'ta2', x: -160, y: 160, width: 300, height: 120, content: 'Ref: ' })
        await harness(page, 'fit', 1)
        const { note, editor } = await editNote(page, 'ta2')

        await page.keyboard.type('[[med')
        await expect(rows(page)).toHaveCount(1)
        await page.keyboard.press('Enter')

        // The query is replaced with the full reference (closing `]]` added) and the list closes.
        expect(await editor.inputValue()).toBe('Ref: [[MEDIUM]]')
        await expect(menu(page)).toHaveCount(0)

        // Saving renders it through the markdown reference pipeline into a resolved chip.
        await page.keyboard.press('Control+Enter')
        await expect(note.locator('.pvt-node-reference.resolved')).toHaveText('MEDIUM')
    })

    test('arrow keys move the highlight and a row click selects', async ({ page }) => {
        await addNote(page, { id: 'ta3', x: -160, y: 160, width: 300, height: 120, content: 'Pick: ' })
        await harness(page, 'fit', 1)
        const { editor } = await editNote(page, 'ta3')

        await page.keyboard.type('[[')
        await expect(rows(page)).toHaveCount(4)

        // The first row is highlighted by default; ArrowDown advances the highlight.
        await expect(rows(page).nth(0)).toHaveClass(/active/)
        await page.keyboard.press('ArrowDown')
        await expect(rows(page).nth(1)).toHaveClass(/active/)

        // A click selects the clicked row regardless of the current highlight.
        await rows(page).filter({ hasText: 'LARGE' }).click()
        expect(await editor.inputValue()).toBe('Pick: [[LARGE]]')
        await expect(menu(page)).toHaveCount(0)
    })

    test('Escape closes the list without cancelling the edit', async ({ page }) => {
        await addNote(page, { id: 'ta4', x: -160, y: 160, width: 300, height: 120, content: 'Keep ' })
        await harness(page, 'fit', 1)
        const { editor } = await editNote(page, 'ta4')

        await page.keyboard.type('[[sm')
        await expect(menu(page)).toBeVisible()
        await page.keyboard.press('Escape')

        // The list closes but the editor stays open with the typed text intact — Escape was
        // swallowed by the typeahead and never reached the note's cancel handler.
        await expect(menu(page)).toHaveCount(0)
        await expect(editor).toBeVisible()
        expect(await editor.inputValue()).toBe('Keep [[sm')
    })
})
