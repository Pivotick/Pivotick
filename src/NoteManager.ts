import type { Graph } from './Graph'
import { Note } from './Note'

export class NoteManager {

    private notes = new Map<string, Note>()
    private graph: Graph

    constructor(graph: Graph) {
        this.graph = graph
    }


    public addNote(note: Note): void {
        this.notes.set(note.id, note)
        this.graph.noteAdd(note)
        this.graph.onChange()
    }

    public removeNote(noteOrId: Note | string): void {
        const id = typeof noteOrId === 'string'
            ? noteOrId
            : noteOrId.id

        const note = this.getNote(id)
        if (!note) return
        this.graph.noteRemove(note)
        this.notes.delete(id)
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

    public clear(): void {
        this.notes.clear()
    }

    public hasNote(id: string): boolean {
        return this.notes.has(id)
    }

    public count(): number {
        return this.notes.size
    }
}

