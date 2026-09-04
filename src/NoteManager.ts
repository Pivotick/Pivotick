import type { Graph } from './Graph'
import { Note } from './Note'

export class NoteManager {

    private notes = new Map<string, Note>()
    private hiddenNotes: Set<Note> = new Set()
    private graph: Graph
    /** One warning per page for a refused note, not one per call. */
    private static warnedDisabled = false

    constructor(graph: Graph) {
        this.graph = graph
    }

    /**
     * Register a note and draw it. Refused while `UI.notes.enabled` is `false`: with
     * the feature off there is no panel to read a note in and no menu to remove one
     * with, so a note that got in would be unreachable. The warning names the option
     * rather than letting the call vanish quietly.
     */
    public addNote(note: Note, noEmit=false): void {
        if (this.graph.UIManager?.isFeatureEnabled('notes') === false) {
            if (!NoteManager.warnedDisabled) {
                NoteManager.warnedDisabled = true
                console.warn('Notes are disabled (UI.notes.enabled === false); addNote() is a no-op.')
            }
            return
        }
        this.notes.set(note.id, note)
        if (!noEmit) {
            this.graph.noteAdd(note)
            this.graph.onChange()
        }
    }

    public removeNote(noteOrId: Note | string): void {
        const id = typeof noteOrId === 'string'
            ? noteOrId
            : noteOrId.id

        const note = this.getNote(id)
        if (!note) return

        this.hiddenNotes.delete(note)

        this.notes.delete(id)
        this.graph.noteRemove(note)
        this.graph.onChange()
    }

    public editNote(note: Note): void {
        if (!this.notes.has(note.id)) {
            return
        }

        this.notes.set(note.id, note)
        this.graph.noteChange(note)
        this.graph.onChange()
    }

    public getNote(id: string): Note | undefined {
        return this.notes.get(id)
    }

    public getNotes(): Note[] {
        return Array.from(this.notes.values())
    }

    public getHiddenNotes(): Note[] {
        return Array.from(this.hiddenNotes)
    }

    public getVisibleNotes(): Note[] {
        return this.getNotes().filter(note => !this.hiddenNotes.has(note))
    }

    public clear(): void {
        this.notes.clear()
        this.hiddenNotes.clear()
        this.graph.onChange()
    }

    public hideAll(): void {
        this.getNotes().forEach((note) => {
            note.visible = false
            this.hiddenNotes.add(note)
            this.graph.noteChange(note)
        }) 
        this.graph.onChange()
    }

    public showAll(): void {
        this.hiddenNotes.forEach((note) => {
            note.visible = true
            this.hiddenNotes.delete(note)
            this.graph.noteChange(note)
        }) 
        this.graph.onChange()
    }

    public hasNote(id: string): boolean {
        return this.notes.has(id)
    }

    public isVisible(note: Note): boolean {
        return !this.hiddenNotes.has(note)
    }

    public isHidden(note: Note): boolean {
        return this.hiddenNotes.has(note)
    }

    public count(): number {
        return this.notes.size
    }

    public hideNote(note: Note): void {
        this.hiddenNotes.add(note)
        note.visible = false
        this.graph.noteChange(note)
        this.graph.onChange()
    }

    public showNote(note: Note): void {
        this.hiddenNotes.delete(note)
        note.visible = true
        this.graph.noteChange(note)
        this.graph.onChange()
    }
}