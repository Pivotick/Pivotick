import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    addNote,
    harness,
    noteEl,
    centerOf,
    expectCanvas,
    expectElement,
} from '../helpers'
import type { Page } from '@playwright/test'

/** Read a note's persisted surface finish from the live graph model. */
async function surfaceOf(page: Page, domID: string): Promise<string | undefined> {
    return page.evaluate((id) => {
        type NoteModel = { domID: string; surface: string }
        const graph = (window.__pivotick as unknown as {
            graph?: { noteManager: { getNotes(): NoteModel[] } }
        }).graph
        return graph?.noteManager.getNotes().find((n) => n.domID === id)?.surface
    }, domID)
}

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

// ── Area 9 — notes (deepen) ─────────────────────────────────────────────────
// These deepen the note coverage beyond add/drag: the *content* pipeline
// (markdown rendering + the `[[node]]` reference extension), the colour palette,
// resizing, and the empty-note chrome.
//
// **Screenshot target.** A note is an SVG `<g id="note-<domID>">` (carrying a
// `<foreignObject>`) inside the `<g class="notes">` layer. For the single-note
// content/sizing tests we snapshot that note element directly — the markdown
// render is then the whole frame (crisp, and independent of where the graph
// settled), mirroring how the chrome specs target their own element. The colour
// palette snapshots the whole `.notes` group (five notes in one shot).
//
// **Determinism.** Every test loads at 1:1 (`fit(1)`) so note text is crisp and a
// resize drag maps screen pixels straight to note units, and `pin()`s the fixture
// so the fit framing — which keys off the *combined* graph+note bounds — is
// exact. The markdown output is a pure function of the note content (marked +
// dompurify + the reference extension), and each note carries a fixed
// position/size, so the baselines don't depend on the force layout at all.
// Async-render guard: the rendered markdown is waited for explicitly (a child
// element of `.pvt-note-content-rendered`) before snapshotting, not left to
// Playwright's stability heuristic.
//
// **T9.5 (note attached to an edge) is descoped** — the library only implements
// *node* attachment: `NoteDrawer.refreshLink` / `updateShadowLinks` branch on
// `attached.type === 'node'` and have no edge case, so an `{ type:'edge' }`
// attachment renders no connector (it falls through to the unlinked state). There
// is nothing to snapshot; a baseline would lock in a note that simply looks
// unattached. See the PRD note.
test.describe('notes — content, colours & sizing', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // T9.1 — rich markdown: heading, list, bold/italic, inline code, blockquote,
    // a GFM table and a link, all rendered by `marked` + sanitised by dompurify.
    test('renders rich markdown content', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'pin')
        await addNote(page, {
            id: 'rich',
            x: 210,
            y: -250,
            width: 340,
            height: 320,
            content: [
                '# Release 2.0',
                '',
                'Supports **bold**, _italic_ and `inline code`.',
                '',
                '- First item',
                '- Second item',
                '- Third item',
                '',
                '> A short blockquote.',
                '',
                '| Feature | State |',
                '| ------- | ----- |',
                '| Notes   | yes   |',
                '| Tables  | yes   |',
                '',
                '[Docs](https://example.com)',
            ].join('\n'),
        })
        await harness(page, 'fit', 1)

        const note = noteEl(page, 'rich')
        await note.waitFor({ state: 'visible' })
        const body = note.locator('.pvt-note-content-rendered')
        // Verify every markdown feature actually rendered (the real outcome) before
        // snapshotting — a regression in marked/dompurify would drop one of these.
        await expect(body.locator('h1')).toHaveText('Release 2.0')
        await expect(body.locator('strong')).toHaveCount(1)
        await expect(body.locator('em')).toHaveCount(1)
        await expect(body.locator('code')).toHaveCount(1)
        await expect(body.locator('ul > li')).toHaveCount(3)
        await expect(body.locator('blockquote')).toHaveCount(1)
        await expect(body.locator('table')).toHaveCount(1)
        await expect(body.locator('a[href="https://example.com"]')).toHaveCount(1)

        await expectElement(note, 'note-markdown-rich.png')
    })

    // T9.2 — node references: `[[name]]` resolves (by id or label) to a node and
    // renders the custom reference chip, tinted to the node's colour; an unknown
    // name renders the dashed "unresolved" variant. Uses `nodeStyles` so the three
    // resolved chips pick up three distinct node colours.
    test('renders node-reference chips', async ({ page }) => {
        await loadFixture(page, 'nodeStyles')
        await harness(page, 'pin')
        await addNote(page, {
            id: 'refs',
            x: -160,
            y: 120,
            width: 320,
            height: 120,
            content: [
                'Linked: [[small]], [[medium]] and [[large]].',
                '',
                'Unknown: [[ghost]].',
            ].join('\n'),
        })
        await harness(page, 'fit', 1)

        const note = noteEl(page, 'refs')
        await note.waitFor({ state: 'visible' })
        const refs = note.locator('.pvt-node-reference')
        await expect(refs).toHaveCount(4)
        // The three real nodes resolve (chip shows the node's label); the bogus one
        // gets the dashed `unresolved` treatment.
        await expect(note.locator('.pvt-node-reference.resolved')).toHaveCount(3)
        await expect(note.locator('.pvt-node-reference.unresolved')).toHaveCount(1)
        await expect(note.locator('.pvt-node-reference.resolved').first()).toHaveText('SMALL')

        await expectElement(note, 'note-node-reference.png')
    })

    // T9.3 — colour palette: one note per built-in colour. The notes sit in a row
    // *above* the pinned graph so the `.notes` group crop is over empty grid (no
    // graph showing through the gaps). The colour swatch is the note background
    // (`--note-color`); the in-header colour pills only appear while editing.
    test('renders the note colour palette', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'pin')
        const palette = [
            ['amber', '#FDE68A'],
            ['red', '#FCA5A5'],
            ['blue', '#93C5FD'],
            ['green', '#86EFAC'],
            ['violet', '#C4B5FD'],
        ] as const
        const startX = -423
        for (let i = 0; i < palette.length; i++) {
            const [name, color] = palette[i]
            await addNote(page, {
                id: `color-${name}`,
                x: startX + i * 174,
                y: -300,
                width: 150,
                height: 90,
                color,
                content: `**${name}**\n\n${color}`,
            })
        }
        await harness(page, 'fit', 1)

        await expect(page.locator('g.pvt-note')).toHaveCount(5)
        for (const [name] of palette) {
            await noteEl(page, `color-${name}`).waitFor({ state: 'visible' })
        }
        await expectElement(page.locator('g.notes').first(), 'note-colors.png')
    })

    // T9.4 — resize: drag the corner handle and confirm the note actually grows,
    // then snapshot the resized note. At 1:1 the screen-pixel drag maps straight
    // to note units, so the new size is deterministic.
    test('resizes a note from the corner handle', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'pin')
        await addNote(page, {
            id: 'resizable',
            x: 210,
            y: -100,
            width: 200,
            height: 110,
            content: 'Drag the bottom-right corner to resize.',
        })
        await harness(page, 'fit', 1)

        const note = noteEl(page, 'resizable')
        await note.waitFor({ state: 'visible' })

        const handle = note.locator('.pvt-note-resize-handle')
        const grip = await centerOf(handle)
        await page.mouse.move(grip.x, grip.y)
        await page.mouse.down()
        await page.mouse.move(grip.x + 140, grip.y + 90, { steps: 10 })
        await page.mouse.up()
        // Move the cursor off the note so its `:hover` chrome (the action buttons)
        // doesn't leak into the baseline.
        await page.mouse.move(20, 20)

        // The foreignObject mirrors the note's width/height — assert it grew by the
        // dragged delta (1:1 at this zoom) before snapshotting.
        const fo = note.locator('foreignObject.pvt-note-fo')
        const width = Number(await fo.getAttribute('width'))
        const height = Number(await fo.getAttribute('height'))
        expect(width).toBeGreaterThanOrEqual(330)
        expect(width).toBeLessThanOrEqual(350)
        expect(height).toBeGreaterThanOrEqual(190)
        expect(height).toBeLessThanOrEqual(210)

        await expectElement(note, 'note-resized.png')
    })

    // T9.6 — empty note: `content: ''` renders no markdown body, leaving just the
    // header bar and the resize handle (the colour pills / action buttons are
    // hover/edit-only, so the default state is bare).
    test('renders an empty note', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'pin')
        await addNote(page, {
            id: 'empty',
            x: 210,
            y: -60,
            width: 200,
            height: 120,
            content: '',
        })
        await harness(page, 'fit', 1)

        const note = noteEl(page, 'empty')
        await note.waitFor({ state: 'visible' })
        await expect(note.locator('.pvt-note-content-rendered')).toBeEmpty()
        await expect(note.locator('.pvt-note-resize-handle')).toBeVisible()

        await expectElement(note, 'note-empty.png')
    })

    // T9.7 — surfaces: the same picker colour as the default *jewel* card (solid,
    // deep) and the opt-in *terminal* card (neutral panel, colour as a top-hairline
    // + mono "›" prompt), side by side. Both notes sit above the pinned graph over
    // empty grid so the crop is stable. The terminal note carries the
    // `pvt-note--terminal` modifier that drives the console surface.
    test('renders jewel and terminal note surfaces', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'pin')
        await addNote(page, {
            id: 'surf-jewel', x: -300, y: -300, width: 190, height: 110,
            color: '#93C5FD', content: '**jewel**\n\nsolid colour card',
        })
        await addNote(page, {
            id: 'surf-term', x: -90, y: -300, width: 190, height: 110,
            color: '#93C5FD', surface: 'terminal', content: '## terminal\n\nneutral console panel',
        })
        await harness(page, 'fit', 1)

        await noteEl(page, 'surf-jewel').waitFor({ state: 'visible' })
        const term = noteEl(page, 'surf-term')
        await term.waitFor({ state: 'visible' })
        // The terminal note renders with the console-surface modifier; the jewel one does not.
        await expect(term.locator('.pvt-note')).toHaveClass(/pvt-note--terminal/)
        await expect(noteEl(page, 'surf-jewel').locator('.pvt-note')).not.toHaveClass(/pvt-note--terminal/)

        await expectElement(page.locator('g.notes').first(), 'note-surfaces.png')
    })

    // T9.8 — surface toggle: in edit mode a small toggle beside the colour pills
    // flips the note between jewel and terminal, persisting the choice on the model.
    test('toggles a note between jewel and terminal surfaces', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'pin')
        const domID = await addNote(page, {
            id: 'surf-toggle', x: -95, y: -300, width: 200, height: 110,
            color: '#C4B5FD', content: 'Toggle my surface.',
        })
        await harness(page, 'fit', 1)

        const note = noteEl(page, 'surf-toggle')
        await note.waitFor({ state: 'visible' })
        const surface = note.locator('.pvt-note')

        // The toggle is an edit-mode affordance — hidden until the note is edited.
        await expect(note.locator('.pvt-note-surface-toggle')).toBeHidden()
        await note.locator('.pvt-note-content-rendered').dblclick()
        const toggle = note.locator('.pvt-note-surface-toggle')
        await expect(toggle).toBeVisible()
        await expect(surface).not.toHaveClass(/pvt-note--terminal/)
        expect(await surfaceOf(page, domID)).toBe('jewel')

        // Switch to terminal — the surface class applies and the choice persists.
        await toggle.click()
        await expect(surface).toHaveClass(/pvt-note--terminal/)
        await expect(toggle).toHaveClass(/is-active/)
        expect(await surfaceOf(page, domID)).toBe('terminal')

        // Switch back to jewel.
        await toggle.click()
        await expect(surface).not.toHaveClass(/pvt-note--terminal/)
        await expect(toggle).not.toHaveClass(/is-active/)
        expect(await surfaceOf(page, domID)).toBe('jewel')
    })
})
