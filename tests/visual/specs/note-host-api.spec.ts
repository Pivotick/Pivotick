/**
 * The host-facing note API: `Pivotick.Note`, `graph.addNote(options)`,
 * `note.toJSON()` and `graph.setNotes(options[])`.
 *
 * DOM and event assertions rather than screenshots: what is under test is whether a
 * note is drawn, which events fire, and whether a kept note stays the same object
 * bound to the same element. Drawing a note is covered by `notes.spec.ts`.
 */
import { test, expect, gotoHarness, loadFixture } from '../helpers'
import type { Page } from '@playwright/test'

interface NoteJSON {
    id?: string
    x?: number
    y?: number
    width?: number
    height?: number
    content?: string
    color?: string
    surface?: string
    attachedElement?: { type: string, id: string }
}

/** Count `noteAdd` / `noteRemove` / `noteChange` from here on, on `window.__noteEvents`. */
async function countNoteEvents(page: Page): Promise<void> {
    await page.evaluate(() => {
        const w = window as unknown as Record<string, unknown>
        const graph = (w.__pivotick as { graph: { on(e: string, h: () => void): void } }).graph
        const counts = { noteAdd: 0, noteRemove: 0, noteChange: 0 }
        w.__noteEvents = counts
        for (const event of ['noteAdd', 'noteRemove', 'noteChange'] as const) {
            graph.on(event, () => { counts[event]++ })
        }
    })
}

async function noteEvents(page: Page): Promise<{ noteAdd: number, noteRemove: number, noteChange: number }> {
    return page.evaluate(() => (window as unknown as { __noteEvents: { noteAdd: number, noteRemove: number, noteChange: number } }).__noteEvents)
}

/** Add a note through `graph.addNote` and return its domID. */
async function addNoteFromOptions(page: Page, options: NoteJSON): Promise<string | undefined> {
    return page.evaluate((o) => {
        const graph = (window.__pivotick as unknown as { graph: { addNote(o: unknown): { domID: string } | undefined } }).graph
        return graph.addNote(o)?.domID
    }, options)
}

/** The serialised notes of the harness graph, in insertion order. */
async function notesAsJSON(page: Page): Promise<NoteJSON[]> {
    return page.evaluate(() => {
        const graph = (window.__pivotick as unknown as { graph: { getNotes(): unknown[] } }).graph
        return JSON.parse(JSON.stringify(graph.getNotes())) as NoteJSON[]
    })
}

/** Run `graph.setNotes(json)` and return the domIDs of the notes it returns. */
async function setNotes(page: Page, notes: NoteJSON[]): Promise<string[]> {
    return page.evaluate((n) => {
        const graph = (window.__pivotick as unknown as { graph: { setNotes(n: unknown[]): { domID: string }[] } }).graph
        return graph.setNotes(n).map(note => note.domID)
    }, notes)
}

/** Whether the element drawn for the note still carries that very note as its datum. */
async function elementIsBoundTo(page: Page, noteId: string): Promise<boolean> {
    return page.evaluate((id) => {
        const graph = (window.__pivotick as unknown as { graph: { getNote(id: string): { domID: string } | undefined } }).graph
        const note = graph.getNote(id)
        if (!note) return false
        const el = document.getElementById(`note-${note.domID}`) as (Element & { __data__?: unknown }) | null
        return !!el && el.__data__ === note
    }, noteId)
}

test.describe('note host API', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('Note is exported on Pivotick and as a named export', async ({ page }) => {
        await loadFixture(page, 'basic')
        const json = await page.evaluate(async () => {
            const mod = await import('/src/index.ts' as string) as {
                Pivotick: { Note: new (o: unknown) => { toJSON(): unknown } }
                Note: new (o: unknown) => { toJSON(): unknown }
            }
            if (mod.Pivotick.Note !== mod.Note) return null
            return new mod.Pivotick.Note({ id: 'n', content: 'x' }).toJSON()
        })
        expect(json).toEqual({
            id: 'n', x: 0, y: 0, width: 220, height: 160, content: 'x', color: '#FDE68A', surface: 'jewel',
        })
    })

    test('addNote draws a note from plain options and fires noteAdd once', async ({ page }) => {
        await loadFixture(page, 'basic')
        await countNoteEvents(page)

        const domID = await addNoteFromOptions(page, { content: 'x', x: 10, y: 20 })

        expect(domID).toBeTruthy()
        await expect(page.locator(`#note-${domID}`)).toHaveAttribute('transform', 'translate(10,20)')
        expect(await noteEvents(page)).toEqual({ noteAdd: 1, noteRemove: 0, noteChange: 0 })
    })

    test('addNote refuses an id already on the graph', async ({ page }) => {
        await loadFixture(page, 'withNote')
        const error = await page.evaluate(() => {
            const graph = (window.__pivotick as unknown as { graph: { addNote(o: unknown): unknown } }).graph
            try {
                graph.addNote({ id: 'note1', content: 'again' })
                return null
            } catch (e) {
                return (e as Error).message
            }
        })
        expect(error).toBe('Note with id note1 already exists.')
        expect((await notesAsJSON(page)).map(n => n.content)).toEqual(['# Release notes\n\nSupports **bold**, _italic_ and `code`.'])
    })

    test('addNote returns undefined while notes are disabled', async ({ page }) => {
        await loadFixture(page, 'basic', { UI: { notes: { enabled: false } } })
        expect(await addNoteFromOptions(page, { content: 'x' })).toBeUndefined()
        expect(await notesAsJSON(page)).toEqual([])
    })

    test('toJSON is the plain round-trippable shape, attachment included', async ({ page }) => {
        await loadFixture(page, 'withLinkedNote')
        expect(await notesAsJSON(page)).toEqual([{
            id: 'linked', x: 230, y: 120, width: 200, height: 110,
            content: 'Annotation attached to node C.', color: '#FDE68A', surface: 'jewel',
            attachedElement: { type: 'node', id: 'c' },
        }])
    })

    test('addNote(note.toJSON()) reproduces the note and its link on a second graph', async ({ page }) => {
        await loadFixture(page, 'withLinkedNote')
        const copied = await page.evaluate(async () => {
            type G = {
                getNotes(): { toJSON(): unknown }[]
                getNote(id: string): { toJSON(): unknown } | undefined
                addNote(o: unknown): unknown
                on(e: string, h: () => void): void
            }
            const graph = (window.__pivotick as unknown as { graph: G }).graph
            const host = document.createElement('div')
            host.id = 'second-graph'
            host.style.cssText = 'position:fixed;left:0;top:0;width:500px;height:400px'
            document.body.appendChild(host)
            const GraphClass = graph.constructor as new (el: HTMLElement, data: unknown, options: unknown) => G
            const second = new GraphClass(host, { nodes: [{ id: 'c' }], edges: [] }, { UI: { mode: 'viewer' } })
            await new Promise<void>(resolve => second.on('ready', resolve))
            second.addNote(graph.getNotes()[0].toJSON())
            return second.getNote('linked')?.toJSON()
        })
        expect(copied).toEqual({
            id: 'linked', x: 230, y: 120, width: 200, height: 110,
            content: 'Annotation attached to node C.', color: '#FDE68A', surface: 'jewel',
            attachedElement: { type: 'node', id: 'c' },
        })
        await expect(page.locator('#second-graph .pvt-note')).not.toHaveCount(0)
        await expect(page.locator('#second-graph path.pvt-note-edge')).toHaveCount(1)
    })

    test('setNotes keeps, updates, removes and adds by id', async ({ page }) => {
        await loadFixture(page, 'withNote')
        await setNotes(page, [{ id: 'gone', content: 'to be removed', x: -200, y: 0 }, ...await notesAsJSON(page)])
        await countNoteEvents(page)
        const keptDomID = await page.evaluate(() =>
            (window.__pivotick as unknown as { graph: { getNote(id: string): { domID: string } } }).graph.getNote('note1').domID)

        const domIDs = await setNotes(page, [
            { id: 'note1', content: 'Rewritten', x: 40, y: 50, width: 220, height: 130 },
            { id: 'fresh', content: 'New one', x: -100, y: -100 },
        ])

        expect(domIDs[0]).toBe(keptDomID)
        expect(await elementIsBoundTo(page, 'note1')).toBe(true)
        await expect(page.locator(`#note-${keptDomID}`)).toContainText('Rewritten')
        await expect(page.locator(`#note-${keptDomID}`)).toHaveAttribute('transform', 'translate(40,50)')
        await expect(page.locator(`#note-${domIDs[1]}`)).toContainText('New one')
        expect((await notesAsJSON(page)).map(n => n.id)).toEqual(['note1', 'fresh'])
        expect(await noteEvents(page)).toEqual({ noteAdd: 1, noteRemove: 1, noteChange: 1 })
    })

    test('setNotes with the current set changes nothing', async ({ page }) => {
        await loadFixture(page, 'withLinkedNote')
        await countNoteEvents(page)
        await setNotes(page, await notesAsJSON(page))
        expect(await noteEvents(page)).toEqual({ noteAdd: 0, noteRemove: 0, noteChange: 0 })
    })

    test('setNotes refuses a repeated id and leaves the notes alone', async ({ page }) => {
        await loadFixture(page, 'withNote')
        const before = await notesAsJSON(page)
        const error = await page.evaluate(() => {
            const graph = (window.__pivotick as unknown as { graph: { setNotes(n: unknown[]): unknown } }).graph
            try {
                graph.setNotes([{ id: 'twice' }, { id: 'twice' }])
                return null
            } catch (e) {
                return (e as Error).message
            }
        })
        expect(error).toBe('Note id twice appears twice.')
        expect(await notesAsJSON(page)).toEqual(before)
    })
})
