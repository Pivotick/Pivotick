import { select as d3Select, type Selection } from 'd3-selection'
import { transition as d3Transition } from 'd3-transition'

import type { Graph } from '../../Graph'
import { GraphSvgRenderer } from './GraphSvgRenderer'
import { NoteContentRenderer } from '../../plugins/noteContentRenderers/NoteContentRenderer'
import { Note } from '../../Note'
import { Node } from '../../Node'
import type { GraphRendererOptions, NodeStyle } from '../../interfaces/RendererOptions'
import { createHtmlElement, createHtmlTemplate, createIcon, createSvgElement } from '../../utils/ElementCreation'
import { checkmark, closeIcon, contrast, edit, link, magnifyingGlass, trash } from '../../ui/icons'
import { pickNode } from '../../ui/components/NodePickers'
import { nodeNameGetter } from '../../utils/GraphGetters'
import { applyNodeReferenceColor } from '../../utils/NoteReferenceStyle'
import { createButton } from '../../ui/components/Button'

d3Select.prototype.transition = d3Transition


const colors = [
    '#FDE68A',
    '#FCA5A5',
    '#93C5FD',
    '#86EFAC',
    '#C4B5FD'
]

export class NoteDrawer {

    public graph: Graph
    public graphSvgRenderer: GraphSvgRenderer
    public rendererOptions: GraphRendererOptions
    private noteContentRenderer: NoteContentRenderer

    private originalContentMap = new WeakMap<Note, string>()

    public constructor(rendererOptions: GraphRendererOptions, graph: Graph, graphSvgRenderer: GraphSvgRenderer, ) {
        this.rendererOptions = rendererOptions
        this.graph = graph
        this.graphSvgRenderer = graphSvgRenderer
        this.noteContentRenderer = new NoteContentRenderer(this.graph)
    }

    public render(noteSelection: Selection<SVGGElement, Note, null, undefined>, note: Note): void {

        const root = noteSelection.node()

        if (!root) return

        note.setGraphElement(root)

        const fo = this.createNoteForeignObject(note)

        root.appendChild(fo)

        this.makeDraggable(noteSelection, note)
        this.makeResizable(noteSelection, note)

        const contentDiv: HTMLDivElement = root.querySelector('.pvt-note-content')!
        this.bindEditing(contentDiv, note)
    }

    private createNoteForeignObject(note: Note): SVGForeignObjectElement {

        const fo = createSvgElement('foreignObject', {
            class: 'pvt-note-fo',
            width: note.width,
            height: note.height,
        })

        const container = document.createElement('div')
        container.classList.add('pvt-note')
        container.style.setProperty('--note-color', note.color)
        container.classList.toggle('pvt-note--terminal', note.surface === 'terminal')

        if (note.isEditing()) {
            container.classList.add('editing')
        }

        container.appendChild(this.createHeader(container, note))
        container.appendChild(this.createLink(note))
        container.appendChild(this.createContent(note))
        container.appendChild(this.createResizeHandle())

        fo.appendChild(container)

        requestAnimationFrame(() => {
            this.refreshLink(note)
        })

        return fo
    }

    private createHeader(container: HTMLDivElement, note: Note): HTMLDivElement {
        const header = createHtmlElement('div', {
            class: 'pvt-note-header',
        })

        // Left cluster: colour pills + the surface toggle (both edit-only), so
        // the restyle affordances stay grouped away from the right-hand actions.
        const left = createHtmlElement('div', { class: 'pvt-note-head-left' })
        left.appendChild(this.createColorPills(container, note))
        left.appendChild(this.createSurfaceToggle(container, note))

        header.appendChild(left)
        header.appendChild(this.createActionButtons(note))

        return header
    }

    /** Small toggle beside the colour pills: switches jewel ↔ terminal surface. */
    private createSurfaceToggle(container: HTMLDivElement, note: Note): HTMLButtonElement {
        const toggle = createButton({
            title: 'Toggle terminal look',
            svgIcon: contrast,
            class: ['pvt-note-surface-toggle'],
            variant: 'outline-secondary',
            size: 'xs',
            onClick: () => {
                const next = note.surface === 'terminal' ? 'jewel' : 'terminal'
                note.setSurface(next)
                container.classList.toggle('pvt-note--terminal', next === 'terminal')
                toggle.classList.toggle('is-active', next === 'terminal')
                this.graph.noteManager.editNote(note)
            }
        })

        toggle.classList.toggle('is-active', note.surface === 'terminal')

        return toggle
    }

    private createLink(note: Note): HTMLDivElement {

        const container = createHtmlElement('div', {
            class: 'pvt-note-link-container',
        })

        const div = document.createElement('div')
        div.classList.add('pvt-note-link-subcontainer')

        const linkIcon = createIcon({ svgIcon: link })
        linkIcon.classList.add('pvt-note-link-placeholder-icon')
        div.appendChild(linkIcon)

        const searchBtn = createButton({
            title: 'Search for a note',
            svgIcon: magnifyingGlass,
            class: ['pvt-node-search-button'],
            variant: 'outline-secondary',
            size: 'xs',
            onClick: async (evt: MouseEvent) => {
                const target = evt.target as HTMLElement

                if (!target.closest('.editing') || target.closest('.unlink-note') || target.closest('.pvt-node-reference')) {
                    return
                }

                evt.stopPropagation()
                const node = await pickNode(
                    this.graph.UIManager,
                    'Select a node to link to this note'
                )
                if (!node) return
                note.setAttachedElement({ type: 'node', 'id': ((node as unknown) as Node).id })
                this.graph.noteManager.editNote(note)
                this.refreshLink(note)
            }
        })
        div.appendChild(searchBtn)

        const content = document.createElement('div')
        content.classList.add('pvt-note-link-content')

        div.appendChild(content)

        container.appendChild(div)

        return container
    }

    public refreshLink(note: Note): void {
        const root = note.getGraphElement()
        if (!root) return
        const linkContainer = root.querySelector('.pvt-note-link-container')
        if (!linkContainer) return
        const linkContent = root.querySelector('.pvt-note-link-content')
        if (!linkContent) return

        linkContent.replaceChildren()

        const attached = note.getAttachedElement()
        if (attached && attached.type === 'node') {
            linkContainer.classList.add('has-link')
            const node = this.graph.getMutableNode(attached.id)
            if (node) {
                const row = document.createElement('div')
                row.classList.add('pvt-note-link-row')

                const ref = document.createElement('span')
                ref.classList.add(
                    'pvt-node-reference',
                    'resolved'
                )
                ref.dataset.nodeId = node.id
                const nodeStyle: NodeStyle = this.graphSvgRenderer.nodeDrawer.getNodeStyle(node)
                applyNodeReferenceColor(ref, nodeStyle.color as string)
                const mainLabel = nodeNameGetter(node, this.graph.UIManager.getOptions().mainHeader).trim()
                ref.textContent = mainLabel
                row.appendChild(ref)

                const unlinkButton = createButton({
                    variant: 'outline-danger',
                    svgIcon: closeIcon,
                    size: 'xs',
                    class: ['ms-auto', 'unlink-note'],
                    onClick: () => {
                        note.setAttachedElement(undefined)
                        this.graph.noteManager.editNote(note)
                        this.refreshLink(note)
                    },
                })

                row.appendChild(unlinkButton)

                linkContent.appendChild(row)
            } else {
                const unresolved = document.createElement('span')
                unresolved.classList.add('pvt-node-reference', 'unresolved')
                unresolved.textContent =
                    `Missing node: ${attached.id}`
                linkContent.appendChild(unresolved)
            }
        } else {
            linkContainer.classList.remove('has-link')
            const empty = document.createElement('div')
            empty.classList.add('pvt-note-link-placeholder')

            const text = document.createElement('span')
            text.textContent = 'Link this note to a node'

            empty.appendChild(text)

            linkContent.appendChild(empty)
        }
    }

    private createContent(note: Note): HTMLDivElement {
        const div = document.createElement('div')
        div.classList.add('pvt-note-content')

        const rendered = document.createElement('div')
        rendered.classList.add('pvt-note-content-rendered', 'pvt-markdown')
        this.noteContentRenderer.render(note, rendered)

        const textarea = document.createElement('textarea')
        textarea.classList.add('pvt-note-editor')
        textarea.value = note.content

        div.appendChild(rendered)
        div.appendChild(textarea)

        return div
    }

    private createColorPills(nodeContainer: HTMLDivElement, note: Note): HTMLSpanElement {

        const group = createHtmlElement('span', {
            class: 'pvt-note-color-pills',
        })

        colors.forEach((color) => {

            const pill = createHtmlElement('span', {
                style: `background: ${color}`,
                class: ['pvt-note-color-pill', note.color === color ? 'pill-active' : '']
            })

            pill.addEventListener('click', () => {
                const pills = nodeContainer.querySelectorAll('.pvt-note-color-pill')
                pills.forEach((p) => p.classList.remove('pill-active'))
                pill.classList.add('pill-active')
                nodeContainer.style.setProperty('--note-color', color)
                note.setColor(color)
                this.graph.noteManager.editNote(note)

            })

            group.appendChild(pill)
        })

        return group
    }

    private createResizeHandle(): HTMLSpanElement {

        const handle = createHtmlElement('span', {
            class: 'pvt-note-resize-handle',
        })

        return handle
    }

    private createActionButtons(note: Note): HTMLDivElement {

        const container = createHtmlElement('div', {
            class: 'pvt-note-actions',
        })

        const editButton = createButton({
            title: 'Edit the note',
            svgIcon: edit,
            class: ['pvt-note-edit-button'],
            variant: 'outline-secondary',
            size: 'xs',
            onClick: () => {
                if (note.isEditing()) {
                    this.saveEditMode(note)
                } else {
                    this.enterEditMode(note)
                }
            }
        })
        const closeButton = createButton({
            title: 'Remove the note',
            svgIcon: trash,
            class: ['pvt-node-remove-button'],
            variant: 'outline-danger',
            size: 'xs',
            onClick: () => {
                this.graph.noteManager.removeNote(note)
            }
        })

        container.appendChild(editButton)
        container.appendChild(closeButton)

        return container
    }

    private updateEditButtonState(isEditing: boolean, note: Note): void {

        const noteContainer = note.getGraphElement()
        if (!noteContainer) return

        const editButton = noteContainer.querySelector<HTMLButtonElement>('.pvt-note-edit-button')
        if (!editButton ) return
        const editIconContainer = editButton.querySelector<HTMLDivElement>('.pvt-note-edit-button .pvt-icon')
        if (!editIconContainer) return

        editIconContainer.replaceChildren()

        const icon = createHtmlTemplate(
            isEditing
                ? checkmark
                : edit
        ) as unknown as SVGSVGElement

        if (isEditing) {
            editButton.classList.add('pivotick-button-success')
            editButton.classList.remove('pivotick-button-outline-secondary')
            editIconContainer.setAttribute('title', 'Edit the note')
        } else {
            editButton.classList.add('pivotick-button-outline-secondary')
            editButton.classList.remove('pivotick-button-success')
            editIconContainer.setAttribute('title', 'Save changes')
        }

        editIconContainer.appendChild(icon)
    }


    public updatePositions(noteSelection: Selection<SVGGElement, Note, SVGGElement, unknown>): void {

        noteSelection.attr('transform', d => {
            const x = isFinite(d.x) ? d.x : 0
            const y = isFinite(d.y) ? d.y : 0
            return `translate(${x},${y})`
        })
    }

    private updateNoteSize(
        noteSelection: Selection<SVGGElement, Note, null, undefined>,
        note: Note
    ): void {

        noteSelection
            .select('foreignObject')
            .attr('width', note.width)
            .attr('height', note.height)

    }

    public enterEditMode(note: Note): void {
        const noteContainer = note.getGraphElement()
        if (!noteContainer) return
        
        const rendered = noteContainer.querySelector<HTMLDivElement>('.pvt-note-content-rendered')
        const editor = noteContainer.querySelector<HTMLTextAreaElement>('.pvt-note-editor')
        if (!rendered || !editor) return

        this.originalContentMap.set(note, note.content)
        note.setEditing(true)
        noteContainer.classList.add('editing')

        editor.value = note.content

        rendered.style.display = 'none'
        editor.style.display = 'block'

        this.updateEditButtonState(true, note)

        this.graph.editing.connectManager.startNoteClickConnection()

        requestAnimationFrame(() => {
            editor.focus()
            editor.setSelectionRange(
                editor.value.length,
                editor.value.length
            )
        })
    }

    private saveEditMode(note: Note): void {
        const noteContainer = note.getGraphElement()
        if (!noteContainer) return

        const rendered = noteContainer.querySelector<HTMLDivElement>('.pvt-note-content-rendered')
        const editor = noteContainer.querySelector<HTMLTextAreaElement>('.pvt-note-editor')
        if (!rendered || !editor) return

        note.setEditing(false)
        noteContainer.classList.remove('editing')
        note.setContent(editor.value)

        this.noteContentRenderer.render(note, rendered)

        rendered.style.display = 'block'
        editor.style.display = 'none'

        this.graph.editing.connectManager.cancel()

        this.updateEditButtonState(false, note)

        this.graph.noteManager.editNote(note)

        // Catch up any content change made programmatically while the editor was
        // open — its rebuild was deferred (see GraphSvgRenderer note branch).
        this.graphSvgRenderer.dataUpdate()
    }

    private cancelEditMode(note: Note): void {
        const noteContainer = note.getGraphElement()
        if (!noteContainer) return

        const rendered = noteContainer.querySelector<HTMLDivElement>('.pvt-note-content-rendered')
        const editor = noteContainer.querySelector<HTMLTextAreaElement>('.pvt-note-editor')
        if (!rendered || !editor) return

        note.setEditing(false)
        noteContainer.classList.remove('editing')

        const original = this.originalContentMap.get(note)
        if (original !== undefined) {
            editor.value = original
        }

        rendered.style.display = 'block'
        editor.style.display = 'none'

        this.graph.editing.connectManager.cancel()

        // Cancel discards the user's in-progress edit; a content change made
        // programmatically mid-edit was deferred, so rebuild to surface it.
        this.graphSvgRenderer.dataUpdate()
    }

    private bindEditing(contentContainer: HTMLDivElement, note: Note): void {
        const rendered = contentContainer.querySelector('.pvt-note-content-rendered')
        const textarea = contentContainer.querySelector<HTMLTextAreaElement>('.pvt-note-editor')
        if (!rendered || !textarea) return

        rendered.addEventListener('dblclick', () => {
            this.enterEditMode(note)
        })

        textarea.addEventListener('keydown', (evt) => {

            if (evt.key === 'Escape') {
                this.cancelEditMode(note)
            }

            if ((evt.metaKey || evt.ctrlKey) && evt.key === 'Enter') {
                this.saveEditMode(note)
            }
        })
    }

    private makeDraggable(noteSelection: Selection<SVGGElement, Note, null, undefined>, note: Note): void {

        // The whole card is the drag surface now (there is no header band).
        const card = noteSelection.select<HTMLElement>('.pvt-note')

        let isDragging = false

        let startMouseX = 0
        let startMouseY = 0

        let startNoteX = 0
        let startNoteY = 0

        card
            .on('mousedown', (evt: MouseEvent) => {

                // Never drag from interactive chrome, the editor, links or refs.
                const target = evt.target as HTMLElement
                if (target.closest('button, a, .pvt-note-resize-handle, .pvt-node-reference, .pvt-note-color-pill, .pvt-note-editor')) return
                // At rest the whole card is the drag surface; while editing only
                // the header band drags (the body is the textarea then).
                if (note.isEditing() && !target.closest('.pvt-note-header')) return

                evt.preventDefault()
                evt.stopPropagation()

                isDragging = true

                startMouseX = evt.clientX
                startMouseY = evt.clientY

                startNoteX = note.x
                startNoteY = note.y

                const onMouseMove = (moveEvt: MouseEvent) => {
                    if (!isDragging) return

                    const renderer = this.graphSvgRenderer
                    const startGraph = renderer.screenToGraphCoordinates(startMouseX, startMouseY)
                    const currentGraph = renderer.screenToGraphCoordinates(moveEvt.clientX, moveEvt.clientY)

                    const dx = currentGraph.x - startGraph.x
                    const dy = currentGraph.y - startGraph.y

                    // Snap to the same grid as nodes when grid-snapping is on.
                    const sim = this.graph.simulation
                    note.setPosition(sim.snapToGrid(startNoteX + dx), sim.snapToGrid(startNoteY + dy))
                    noteSelection.attr('transform', `translate(${note.x},${note.y})`)
                    noteSelection.classed('dragging', true)
                    window.getSelection()?.removeAllRanges()
                    document.body.classList.add('pvt-disable-selection') // disable selection globally

                    // Only the note moved: re-anchor its connector, not every node/edge.
                    this.graphSvgRenderer.updateNoteEdgePositions()
                }

                const onMouseUp = () => {
                    isDragging = false

                    document.removeEventListener('mousemove', onMouseMove)
                    document.removeEventListener('mouseup', onMouseUp)

                    noteSelection.style('user-select', 'all')
                    noteSelection.classed('dragging', false)
                    document.body.classList.remove('pvt-disable-selection') // restore selection globally
                }

                document.addEventListener('mousemove', onMouseMove)
                document.addEventListener('mouseup', onMouseUp)
            })
    }

    private makeResizable(
        noteSelection: Selection<SVGGElement, Note, null, undefined>,
        note: Note
    ): void {

        const handle =
            noteSelection.node()
                ?.querySelector<SVGRectElement>('.pvt-note-resize-handle')

        if (!handle) return

        let isResizing = false

        let startMouseX = 0
        let startMouseY = 0

        let startWidth = 0
        let startHeight = 0

        handle.addEventListener('mousedown', (evt: MouseEvent) => {

            evt.preventDefault()
            evt.stopPropagation()

            isResizing = true

            startMouseX = evt.clientX
            startMouseY = evt.clientY

            startWidth = note.width
            startHeight = note.height

            const onMouseMove = (moveEvt: MouseEvent) => {

                if (!isResizing) return

                const renderer = this.graphSvgRenderer

                const startGraph =
                    renderer.screenToGraphCoordinates(
                        startMouseX,
                        startMouseY
                    )

                const currentGraph =
                    renderer.screenToGraphCoordinates(
                        moveEvt.clientX,
                        moveEvt.clientY
                    )

                const dx = currentGraph.x - startGraph.x
                const dy = currentGraph.y - startGraph.y

                note.width = Math.max(180, startWidth + dx)
                note.height = Math.max(80, startHeight + dy)

                this.updateNoteSize(noteSelection, note)

                // Only this note's box changed: re-anchor its connector, not everything.
                this.graphSvgRenderer.updateNoteEdgePositions()
            }

            const onMouseUp = () => {

                isResizing = false

                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
            }

            document.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
        })
    }
}