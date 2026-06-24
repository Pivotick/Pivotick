import {
    test,
    gotoHarness,
    loadFixture,
    addNote,
    harness,
    noteEl,
    centerOf,
    expectCanvas,
} from '../helpers'

test.describe('notes', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('adds a note at runtime', async ({ page }) => {
        await addNote(page, {
            id: 'runtime',
            x: -60,
            y: -40,
            width: 200,
            height: 110,
            content: '## TODO\n\n- review layout\n- ship it',
        })
        // A runtime note isn't part of the initial fit; re-fit so it's in view.
        await harness(page, 'fit')
        await noteEl(page, 'runtime').waitFor({ state: 'visible' })
        await expectCanvas(page, 'note-added.png')
    })

    test('drags a note to a new position', async ({ page }) => {
        // Add via the harness so the note gets a stable domID (`#note-draggable`);
        // fixture notes are normalised with a random domID and aren't locatable.
        await addNote(page, {
            id: 'draggable',
            x: -60,
            y: -40,
            width: 200,
            height: 110,
            content: 'Drag me by the header.',
        })
        await harness(page, 'fit')
        const note = noteEl(page, 'draggable')
        await note.waitFor({ state: 'visible' })

        const header = note.locator('.pvt-note-header')
        const start = await centerOf(header)
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await page.mouse.move(start.x + 180, start.y + 90, { steps: 8 })
        await page.mouse.up()

        await expectCanvas(page, 'note-dragged.png')
    })
})
