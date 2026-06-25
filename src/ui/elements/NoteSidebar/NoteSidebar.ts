import './noteSidebar.scss'
import { createButton } from '../../components/Button'
import { hide, show, stickyNote, trash } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import type { NoteManager } from '../../../NoteManager'
import { Note } from '../../../Note'
import { createHtmlElement, createHtmlTemplate } from '../../../utils/ElementCreation'
import type { Graph } from '../../../Graph'
import { renderMarkdown, renderMarkdownInline } from '../../../plugins/noteContentRenderers/markdown/markdown'
import { resolveReferences } from '../../../plugins/noteContentRenderers/markdown/markdownResolvers'

export class NoteSidebar implements UIElement {

    public uiManager: UIManager
    private graph: Graph
    private noteManager: NoteManager

    private rootElement: HTMLDivElement | null = null
    private listElement: HTMLDivElement | null = null
    private hiddenContainer: HTMLDivElement | null = null

    public constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.graph = this.uiManager.graph
        this.noteManager = this.graph.noteManager
    }

    public mount(container: HTMLElement): void {
        if (!container) return

        this.build()
        if (this.rootElement) {
            container.appendChild(this.rootElement)
        }
    }

    public afterMount(): void {
        this.bindEvents()
        requestAnimationFrame(() => {
            this.refresh()
        })
    }

    public graphReady(): void {
    }

    public destroy(): void {

        if (!this.rootElement) return

        this.unbindEvents()

        this.rootElement.remove()

        this.rootElement = null
        this.listElement = null
    }

    public build(): HTMLDivElement {
        this.rootElement = this.createRoot()
        this.refresh()
        return this.rootElement!
    }

    private refresh(): void {
        if (!this.rootElement) return
        this.rootElement.innerHTML = ''

        const separator = createHtmlElement('div', { class: 'pvt-sidebar-separator' })

        this.listElement = this.createList()
        this.hiddenContainer = this.createHiddenContainer()

        this.rootElement.appendChild(this.createHeader())
        this.rootElement.appendChild(this.listElement)
        this.rootElement.appendChild(separator)
        this.rootElement.appendChild(this.hiddenContainer)
    }

    private renderNotes(container: HTMLDivElement, notes: Note[]): void {
        if (notes.length === 0) {
            const emptyState = document.createElement('div')
            emptyState.classList.add('pvt-note-sidebar-empty')
            emptyState.textContent = 'No notes yet'
            container.appendChild(emptyState)
            return
        }

        notes.forEach(note => {
            const noteEl = this.renderNote(note)
            container?.appendChild(noteEl)
        })
    }

    private renderNote(note: Note): HTMLDivElement {
        const noteEl = document.createElement('div')
        noteEl.classList.add('pvt-note-sidebar-item')

        const contentWrapper = document.createElement('div')
        contentWrapper.classList.add('pvt-note-sidebar-content')

        const colorPill = document.createElement('span')
        colorPill.classList.add('pvt-note-color-pill')
        colorPill.style.backgroundColor = note.color

        // Render the first line as markdown
        const textEl = document.createElement('span')
        textEl.classList.add('pvt-note-sidebar-text')
        textEl.classList.add('pvt-markdown')
        const firstLine = note.content?.split('\n').find(line => line.trim().length > 0) ?? 'Untitled note'
        const safeHtml = renderMarkdownInline(firstLine)
        textEl.innerHTML = safeHtml
        // Resolve `[[node]]` references so they pick up their node color, matching the
        // main canvas rendering (NoteContentRenderer.render also calls resolveReferences).
        resolveReferences(textEl, this.graph)

        const buttonWrapper = document.createElement('div')
        buttonWrapper.classList.add('pvt-note-sidebar-button-wrapper')

        contentWrapper.appendChild(colorPill)
        contentWrapper.appendChild(textEl)

        let showHideButton
        if (this.noteManager.isVisible(note)) {
            showHideButton = createButton({
                variant: 'outline-secondary',
                size: 'sm',
                title: 'Hide note',
                svgIcon: hide,
                onClick: () => {
                    this.noteManager.hideNote(note)
                }
            })
        } else {
            showHideButton = createButton({
                variant: 'outline-secondary',
                size: 'sm',
                title: 'Restore hidden note',
                svgIcon: show,
                onClick: () => {
                    this.noteManager.showNote(note)
                }
            })
        }
        const removeButton = createButton({
            variant: 'outline-danger',
            size: 'sm',
            title: 'Remove note',
            svgIcon: trash,
            onClick: () => {
                this.noteManager.removeNote(note)
            }
        })

        buttonWrapper.appendChild(showHideButton)
        buttonWrapper.appendChild(removeButton)
        noteEl.appendChild(contentWrapper)
        noteEl.appendChild(buttonWrapper)

        return noteEl
    }

    private refreshCb = () => {
        this.refresh()
    }

    private bindEvents(): void {
        this.graph.on('noteAdd', this.refreshCb)
        this.graph.on('noteRemove', this.refreshCb)
        this.graph.on('noteChange', this.refreshCb)
    }

    private unbindEvents(): void {
        this.graph.off('noteAdd', this.refreshCb)
        this.graph.off('noteRemove', this.refreshCb)
        this.graph.off('noteChange', this.refreshCb)
    }

    // -------------------------------------------------------------------------
    // Element creation
    // -------------------------------------------------------------------------

    private createRoot(): HTMLDivElement {

        const root = document.createElement('div')

        root.classList.add('pvt-note-sidebar')

        return root
    }

    private createHeader(): HTMLDivElement {

        const header = document.createElement('div')

        header.classList.add('pvt-note-sidebar-header')

        header.appendChild(createButton({
            variant: 'secondary',
            text: 'Add Note',
            size: 'sm',
            svgIcon: stickyNote,
            onClick: (evt: MouseEvent) => {
                const renderer = this.uiManager.graph.renderer
                const bcr = this.uiManager.layout!.canvas!.getBoundingClientRect()
                const { x, y } = renderer.screenToGraphCoordinates(
                    bcr.x + bcr.width / 2 - 200,
                    bcr.y + bcr.height / 2 - 170,
                )
                const note: Note = new Note({
                    content: 'This is not a note.',
                    x,
                    y
                })
                this.uiManager.graph.noteManager.addNote(note)
            }
        }))

        header.appendChild(createButton({
            variant: 'secondary',
            text: 'Hide all',
            size: 'sm',
            title: 'Hide all notes',
            svgIcon: hide,
            onClick: () => {
                this.noteManager.hideAll()
            }
        }))

        return header
    }

    private createList(): HTMLDivElement {

        const list = document.createElement('div')
        list.classList.add('pvt-note-sidebar-list')
        const renderedNotes = this.noteManager.getVisibleNotes()
        this.renderNotes(list, renderedNotes)
        return list
    }

    private createHiddenContainer(): HTMLDivElement {
        const hiddenContainer = createHtmlTemplate(`<div class="pvt-hidden-nodes-container">
                <h4>Hidden notes</h4>
                <div class="pvt-hidden-nodes-container-list"></div>
            </div>`) as HTMLDivElement

        const resetHiddenButton = createButton({
            variant: 'secondary',
            text: 'Show all notes',
            size: 'sm',
            style: 'align-self: end;',
            svgIcon: show,
            onClick: () => {
                this.noteManager.showAll()
            },
            title: 'Restore hidden notes',
        })
        hiddenContainer.querySelector('h4')?.appendChild(resetHiddenButton)

        if (this.noteManager.getHiddenNotes().length == 0) {
            hiddenContainer.classList.add('hidden')
        }
        const renderedNotes = this.noteManager.getHiddenNotes()
        const list: HTMLDivElement = hiddenContainer.querySelector('.pvt-hidden-nodes-container-list')!
        this.renderNotes(list, renderedNotes)

        return hiddenContainer
    }
}