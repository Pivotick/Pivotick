import { select as d3Select, type Selection } from 'd3-selection'
import { transition as d3Transition } from 'd3-transition'

import type { Graph } from '../../Graph'
import { GraphSvgRenderer } from './GraphSvgRenderer'

import { Note } from '../../Note'
import type { GraphRendererOptions } from '../../interfaces/RendererOptions'
import { createSvgElement } from '../../utils/ElementCreation'

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
        this.bindEditing(root, note, contentDiv)
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

    private createActionButtons(
        noteSelection: Selection<SVGGElement, Note, null, undefined>,
        note: Note
    ): SVGGElement {

        const container = createSvgElement('g', {
            class: 'pvt-note-actions',
        })

        const buttonSize = 18
        const spacing = 6
        const margin = 8

        const totalWidth = buttonSize * 2 + spacing

        container.setAttribute(
            'transform',
            `translate(${note.width - totalWidth - margin}, 5)`
        )

        const createButton = (
            className: string,
            label: string,
            offsetX: number,
            onClick: () => void
        ) => {

            const group = createSvgElement('g', {
                class: className + ' pvt-note-action-button',
                transform: `translate(${offsetX}, 0)`
            })

            const bg = createSvgElement('rect', {
                width: buttonSize,
                height: buttonSize,
                rx: 5,
                ry: 5,
            })

            const text = createSvgElement('text', {
                x: buttonSize / 2,
                y: buttonSize / 2,
                'text-anchor': 'middle',
                'dominant-baseline': 'central',
            })

            text.textContent = label

            group.appendChild(bg)
            group.appendChild(text)

            group.addEventListener('click', (evt) => {
                evt.stopPropagation()
                onClick()
            })

            return {
                group,
                text,
            }
        }

        const editButton = createButton('pvt-note-edit-button', '✎', 0,
            () => {

                const root = noteSelection.node()
                if (!root) return

                const contentDiv =
                    root.querySelector<HTMLDivElement>('.pvt-note-content')

                if (!contentDiv) return

                if (note.isEditing()) {
                    this.saveEditMode(root, note, contentDiv)
                } else {
                    this.enterEditMode(root, note, contentDiv)
                }
            }
        )

        const closeButton = createButton('pvt-note-close-button', '×', buttonSize + spacing,
            () => {
                this.graph.noteManager.removeNote(note)
            }
        )

        container.appendChild(editButton.group)
        container.appendChild(closeButton.group)

        return container
    }

    private updateEditButtonState(root: SVGGElement, isEditing: boolean): void {

        const editButtonText =
            root.querySelector<SVGTextElement>(
                '.pvt-note-edit-button text'
            )

        if (!editButtonText) return

        editButtonText.textContent = isEditing
            ? '✓'
            : '✎'
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
            .select('.pvt-note-close-button')
            .attr(
                'transform',
                `translate(${note.width - 26}, 5)`
            )
    }

    private enterEditMode(root: SVGGElement, note: Note, contentDiv: HTMLDivElement): void {

        this.originalContentMap.set(note, note.content)
        note.setEditing(true)
        root.classList.add('editing')
        contentDiv.contentEditable = 'true'
        this.updateEditButtonState(root, true)
        contentDiv.focus()
    }

    private saveEditMode(root: SVGGElement, note: Note, contentDiv: HTMLDivElement): void {
        note.setEditing(false)
        root.classList.remove('editing')
        contentDiv.contentEditable = 'false'
        this.updateEditButtonState(root, false)
        note.setContent(contentDiv.innerHTML)
        this.graph.noteManager.editNote(note)
    }

    private cancelEditMode(root: SVGGElement, note: Note, contentDiv: HTMLDivElement): void {
        note.setEditing(false)
        root.classList.remove('editing')
        contentDiv.contentEditable = 'false'
        const original = this.originalContentMap.get(note)
        if (original !== undefined) {
            contentDiv.innerHTML = original
        }
    }

    private bindEditing(root: SVGGElement, note: Note, contentDiv: HTMLDivElement): void {

        root.addEventListener('dblclick', () => {
            this.enterEditMode(root, note, contentDiv)
        })

        contentDiv.addEventListener('keydown', (evt) => {

            if (evt.key === 'Escape') {
                this.cancelEditMode(root, note, contentDiv)
            }

            if ((evt.metaKey || evt.ctrlKey) && evt.key === 'Enter') {
                this.saveEditMode(root, note, contentDiv)
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

                note.width = Math.max(120, startWidth + dx)
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