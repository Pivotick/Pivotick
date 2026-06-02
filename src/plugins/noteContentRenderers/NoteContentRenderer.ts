import { Note } from '../../Note'
import { renderMarkdown } from '../../utils/MarkdownRenderer'


export class NoteContentRenderer {

    public render(note: Note, container: HTMLElement): void {
        const safeHtml = renderMarkdown(note.content as string)
        container.innerHTML = safeHtml
    }
}