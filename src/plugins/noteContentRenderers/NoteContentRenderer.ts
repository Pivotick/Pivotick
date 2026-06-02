import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Note } from '../../Note'


export class NoteContentRenderer {

    public render(note: Note, container: HTMLElement): void {

        const rawHtml = marked.parse(note.content) as string

        const safeHtml = DOMPurify.sanitize(rawHtml)

        container.innerHTML = safeHtml
    }
}