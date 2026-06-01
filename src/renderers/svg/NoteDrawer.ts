import { select as d3Select, type Selection } from 'd3-selection'
import { transition as d3Transition } from 'd3-transition'

import type { Graph } from '../../Graph'
import { GraphSvgRenderer } from './GraphSvgRenderer'

import { Note } from '../../Note'
import type { GraphRendererOptions } from '../../interfaces/RendererOptions'
import { createHtmlTemplate, createSvgElement } from '../../utils/ElementCreation'
import { checkmark, closeIcon, edit, trash } from '../../ui/icons'

d3Select.prototype.transition = d3Transition


const colors = [
    '#FDE68A',
    '#FCA5A5',
    '#93C5FD',
    '#86EFAC',
    '#C4B5FD'
]
const buttonSize = 18
const buttonSpacing = 6
const buttonMargin = 8
const iconSize = 14
const buttonTotalWidth = buttonSize * 2 + buttonSpacing


export class NoteDrawer {

    public graph: Graph
    public graphSvgRenderer: GraphSvgRenderer
    public rendererOptions: GraphRendererOptions

    private originalContentMap = new WeakMap<Note, string>()

    public constructor(rendererOptions: GraphRendererOptions, graph: Graph, graphSvgRenderer: GraphSvgRenderer, ) {
        this.rendererOptions = rendererOptions
        this.graph = graph
        this.graphSvgRenderer = graphSvgRenderer
    }

    public render(noteSelection: Selection<SVGGElement, Note, null, undefined>, note: Note): void {

        const root = noteSelection.node()

        if (!root) return

        note.setGraphElement(root)

        root.appendChild(this.createBackground(note))
        root.appendChild(this.createHeader(note))
        root.appendChild(this.createActionButtons(noteSelection, note))
        root.appendChild(this.createContent(note))
        root.appendChild(this.createColorPills(noteSelection, note))
        root.appendChild(this.createResizeHandle(note))

        this.makeDraggable(noteSelection, note)
        this.makeResizable(noteSelection, note)

        const contentDiv: HTMLDivElement = root.querySelector('.pvt-note-content')!
        this.bindEditing(contentDiv, note)
    }

    private createBackground(note: Note): SVGRectElement {

        return createSvgElement('rect', {
            class: 'pvt-note-background',
            width: note.width,
            height: note.height,
            rx: 10,
            ry: 10,
            fill: note.color,
            color: note.color,
        })
    }

    private createHeader(note: Note): SVGRectElement {

        return createSvgElement('rect', {
            class: 'pvt-note-header',
            width: note.width,
            height: 28,
            rx: 10,
            ry: 10,
            fill: 'rgba(255,255,255,0.18)',
        })
    }

    private createContent(note: Note): SVGForeignObjectElement {

        const fo = createSvgElement('foreignObject', {
            x: 12,
            y: 40,
            width: note.width - 24,
            height: note.height - 52,
        })

        const div = document.createElement('div')
        div.classList.add('pvt-note-content')

        div.style.width = '100%'
        div.style.height = '100%'
        div.style.overflow = 'hidden'
        div.style.fontSize = '14px'
        div.style.fontFamily = 'sans-serif'
        div.style.color = '#222'
        div.style.outline = 'none'
        div.style.background = 'transparent'
        div.contentEditable = 'false'

        div.innerHTML = note.content

        fo.appendChild(div)

        return fo
    }

    private createColorPills(noteSelection: Selection<SVGGElement, Note, null, undefined>, note: Note): SVGGElement {

        const group = createSvgElement('g', {
            class: 'pvt-note-color-pills',
        })

        const radius = 6
        const spacing = 18

        colors.forEach((color, i) => {

            const circle = createSvgElement('circle', {
                cx: 16 + i * spacing,
                cy: 14,
                r: radius,
                fill: color,
                class: 'pvt-note-color-pill'
            })
            

            circle.addEventListener('click', () => {

                note.setColor(color)

                const bg =
                    noteSelection.node()
                        ?.querySelector('.pvt-note-background')

                bg?.setAttribute('fill', color)
                bg?.setAttribute('color', color)
            })

            group.appendChild(circle)
        })

        return group
    }

    private createResizeHandle(note: Note): SVGRectElement {

        const size = 12

        const rect = createSvgElement('rect', {
            class: 'pvt-note-resize-handle',
            x: note.width - size,
            y: note.height - size,
            width: size,
            height: size,
            rx: 3,
            ry: 3,
        })

        return rect
    }

    private createActionButtons(noteSelection: Selection<SVGGElement, Note, null, undefined>, note: Note): SVGGElement {

        const container = createSvgElement('g', {
            class: 'pvt-note-actions',
        })

        container.setAttribute('transform', this.getActionButtonsTransform(note))

        const createButton = (className: string, label: string | SVGSVGElement, tooltip: string, offsetX: number, onClick: () => void) => {

            const group = createSvgElement('g', {
                class: className + ' pvt-note-action-button',
                transform: `translate(${offsetX}, 0)`,
                title: tooltip
            })

            const bg = createSvgElement('rect', {
                width: buttonSize,
                height: buttonSize,
                rx: 5,
                ry: 5,
            })
            group.appendChild(bg)

            if (label instanceof SVGSVGElement) {
                const iconContainer = createSvgElement('g', {
                    class: 'pvt-note-icon-container',
                    transform: `
                        translate(
                            ${(buttonSize - iconSize) / 2},
                            ${(buttonSize - iconSize) / 2}
                        )`
                })

                const icon = label
                icon.setAttribute('width', iconSize.toString())
                icon.setAttribute('height', iconSize.toString())
                iconContainer.appendChild(icon)
                group.appendChild(iconContainer)
            } else {
                const text = createSvgElement('text', {
                    x: buttonSize / 2,
                    y: buttonSize / 2,
                    'text-anchor': 'middle',
                    'dominant-baseline': 'central',
                })
                text.textContent = label
                group.appendChild(text)
            }


            group.addEventListener('click', (evt) => {
                evt.stopPropagation()
                onClick()
            })

            return group
        }


        const svgEdit = createHtmlTemplate(edit) as unknown as SVGSVGElement
        const editButton = createButton('pvt-note-edit-button', svgEdit, 'Edit the note', 0, () => {
                if (note.isEditing()) {
                    this.saveEditMode(note)
                } else {
                    this.enterEditMode(note)
                }
            }
        )

        const svgClose = createHtmlTemplate(trash) as unknown as SVGSVGElement
        const closeButton = createButton('pvt-note-remove-button', svgClose, 'Remove the note', buttonSize + buttonSpacing,
            () => {
                this.graph.noteManager.removeNote(note)
            }
        )

        container.appendChild(editButton)
        container.appendChild(closeButton)

        return container
    }

    private updateEditButtonState(isEditing: boolean, note: Note): void {

        const noteContainer = note.getGraphElement()
        if (!noteContainer) return
        const editIconContainer = noteContainer.querySelector<SVGGElement>('.pvt-note-edit-button .pvt-note-icon-container')

        if (!editIconContainer) return

        editIconContainer.replaceChildren()

        const icon = createHtmlTemplate(
            isEditing
                ? checkmark
                : edit
        ) as unknown as SVGSVGElement

        icon.setAttribute('width', iconSize.toString())
        icon.setAttribute('height', iconSize.toString())

        editIconContainer.appendChild(icon)
    }


    public updatePositions(noteSelection: Selection<SVGGElement, Note, SVGGElement, unknown>): void {

        noteSelection.attr('transform', d => {
            const x = isFinite(d.x) ? d.x : 0
            const y = isFinite(d.y) ? d.y : 0
            return `translate(${x},${y})`
        })
    }

    private getActionButtonsTransform(note: Note): string {
        return `translate(${note.width - buttonTotalWidth - buttonMargin}, 5)`
    }

    private updateNoteSize(
        noteSelection: Selection<SVGGElement, Note, null, undefined>,
        note: Note
    ): void {

        noteSelection
            .select('.pvt-note-background')
            .attr('width', note.width)
            .attr('height', note.height)

        noteSelection
            .select('.pvt-note-header')
            .attr('width', note.width)

        noteSelection
            .select('foreignObject')
            .attr('width', note.width - 24)
            .attr('height', note.height - 52)

        noteSelection
            .select('.pvt-note-resize-handle')
            .attr('x', note.width - 12)
            .attr('y', note.height - 12)

        noteSelection
            .select('.pvt-note-actions')
            .attr(
                'transform',
                this.getActionButtonsTransform(note)
            )
    }

    private enterEditMode(note: Note): void {
        const noteContainer = note.getGraphElement()
        if (!noteContainer) return
        const contentDiv = noteContainer.querySelector<HTMLDivElement>('.pvt-note-content')
        if (!contentDiv) return

        this.originalContentMap.set(note, note.content)
        note.setEditing(true)
        noteContainer.classList.add('editing')
        contentDiv.contentEditable = 'true'
        this.updateEditButtonState(true, note)
        requestAnimationFrame(() => {
            contentDiv.focus()
        })
    }

    private saveEditMode(note: Note): void {
        const noteContainer = note.getGraphElement()
        if (!noteContainer) return
        const contentDiv = noteContainer.querySelector<HTMLDivElement>('.pvt-note-content')
        if (!contentDiv) return

        note.setEditing(false)
        noteContainer.classList.remove('editing')
        contentDiv.contentEditable = 'false'
        this.updateEditButtonState(false, note)
        note.setContent(contentDiv.innerHTML)
        this.graph.noteManager.editNote(note)
    }

    private cancelEditMode(note: Note): void {
        const noteContainer = note.getGraphElement()
        if (!noteContainer) return
        const contentDiv = noteContainer.querySelector<HTMLDivElement>('.pvt-note-content')
        if (!contentDiv) return

        note.setEditing(false)
        noteContainer.classList.remove('editing')
        contentDiv.contentEditable = 'false'
        const original = this.originalContentMap.get(note)
        if (original !== undefined) {
            contentDiv.innerHTML = original
        }
    }

    private bindEditing(contentDiv: HTMLDivElement, note: Note): void {

        contentDiv.addEventListener('dblclick', () => {
            this.enterEditMode(note)
        })

        contentDiv.addEventListener('keydown', (evt) => {

            if (evt.key === 'Escape') {
                this.cancelEditMode(note)
            }

            if ((evt.metaKey || evt.ctrlKey) && evt.key === 'Enter') {
                this.saveEditMode(note)
            }
        })
    }

    private makeDraggable(noteSelection: Selection<SVGGElement, Note, null, undefined>, note: Note): void {

        const header = noteSelection.select<SVGRectElement>('.pvt-note-header')

        let isDragging = false

        let startMouseX = 0
        let startMouseY = 0

        let startNoteX = 0
        let startNoteY = 0

        header
            .style('cursor', 'move')
            .on('mousedown', (evt: MouseEvent) => {

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

                    note.setPosition(startNoteX + dx, startNoteY + dy)
                    noteSelection.attr('transform', `translate(${note.x},${note.y})`)
                    noteSelection.classed('dragging', true)
                    window.getSelection()?.removeAllRanges()
                    document.body.classList.add('pvt-disable-selection') // disable selection globally
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

                note.width = Math.max(160, startWidth + dx)
                note.height = Math.max(80, startHeight + dy)

                this.updateNoteSize(noteSelection, note)
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