import type { Graph } from '../../Graph'
import { Note } from '../../Note'
import { renderMarkdown } from './markdown/markdown'
import { bindInteractions } from './markdown/markdownInteractions'
import { resolveReferences } from './markdown/markdownResolvers'


export class NoteContentRenderer {

    private graph: Graph

    constructor(graph: Graph) {
        this.graph = graph
    }

    public render(note: Note, container: HTMLElement): void {
        const safeHtml = renderMarkdown(note.content as string)
        container.innerHTML = safeHtml

        resolveReferences(
            container,
            this.graph
        )

        bindInteractions(
            container,
            this.graph
        )
    }
}