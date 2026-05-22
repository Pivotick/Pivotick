import { select as d3Select, type Selection } from 'd3-selection'
import { transition as d3Transition } from 'd3-transition'

import type { Graph } from '../../Graph'
import { GraphSvgRenderer } from './GraphSvgRenderer'

import { Note } from '../../Note'
import type { GraphRendererOptions } from '../../interfaces/RendererOptions'
import { createSvgElement } from '../../utils/ElementCreation'

d3Select.prototype.transition = d3Transition

export class NoteDrawer {

    public graph: Graph
    public graphSvgRenderer: GraphSvgRenderer
    public rendererOptions: GraphRendererOptions

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
        root.appendChild(this.createCloseButton(noteSelection, note))
        root.appendChild(this.createContent(note))
        root.appendChild(this.createColorPills(noteSelection, note))
        root.appendChild(this.createResizeHandle(note))

        this.makeDraggable(noteSelection, note)
    }

    public updatePositions(noteSelection: Selection<SVGGElement, Note, SVGGElement, unknown>): void {

        noteSelection.attr('transform', d => {
            const x = isFinite(d.x) ? d.x : 0
            const y = isFinite(d.y) ? d.y : 0
            return `translate(${x},${y})`
        })
    }

    private createBackground(note: Note): SVGRectElement {

        return createSvgElement('rect', {
            class: 'pvt-note-background',
            width: note.width,
            height: note.height,
            rx: 10,
            ry: 10,
            fill: note.color,
            stroke: 'rgba(0,0,0,0.15)',
            'stroke-width': 1,
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

        div.style.width = '100%'
        div.style.height = '100%'
        div.style.overflow = 'hidden'
        div.style.fontSize = '14px'
        div.style.fontFamily = 'sans-serif'
        div.style.color = '#222'
        div.style.outline = 'none'
        div.style.background = 'transparent'

        div.innerHTML = note.content

        fo.appendChild(div)

        return fo
    }

    private createColorPills(noteSelection: Selection<SVGGElement, Note, null, undefined>, note: Note): SVGGElement {

        const colors = [
            '#FDE68A',
            '#FCA5A5',
            '#93C5FD',
            '#86EFAC',
            '#C4B5FD'
        ]

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
                stroke: 'rgba(0,0,0,0.2)',
                'stroke-width': 1,
            })

            circle.style.cursor = 'pointer'

            circle.addEventListener('click', () => {

                note.setColor(color)

                const bg =
                    noteSelection.node()
                        ?.querySelector('.pvt-note-background')

                bg?.setAttribute('fill', color)
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
            fill: 'rgba(0,0,0,0.2)',
            rx: 3,
            ry: 3,
        })

        rect.style.cursor = 'nwse-resize'

        return rect
    }

    private createCloseButton(
        noteSelection: Selection<SVGGElement, Note, null, undefined>,
        note: Note
    ): SVGGElement {

        const buttonSize = 18
        const margin = 8

        const group = createSvgElement('g', {
            class: 'pvt-note-close-button',
            transform: `translate(${note.width - buttonSize - margin}, 5)`,
        })

        group.style.cursor = 'pointer'

        const bg = createSvgElement('rect', {
            width: buttonSize,
            height: buttonSize,
            rx: 5,
            ry: 5,
            fill: 'rgba(0,0,0,0.15)',
        })

        const text = createSvgElement('text', {
            x: buttonSize / 2,
            y: buttonSize / 2,
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
            'font-size': 12,
            'font-family': 'sans-serif',
            fill: '#222',
        })

        text.textContent = '×'

        group.appendChild(bg)
        group.appendChild(text)

        group.addEventListener('mouseenter', () => {
            bg.setAttribute('fill', 'rgba(0,0,0,0.28)')
        })

        group.addEventListener('mouseleave', () => {
            bg.setAttribute('fill', 'rgba(0,0,0,0.15)')
        })

        group.addEventListener('click', (evt) => {

            evt.stopPropagation()

            this.graph.noteManager.removeNote(note)
        })

        return group
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
                    noteSelection.style('user-select', 'none')
                }

                const onMouseUp = () => {
                    isDragging = false

                    document.removeEventListener('mousemove', onMouseMove)
                    document.removeEventListener('mouseup', onMouseUp)

                    noteSelection.style('user-select', 'all')
                }

                document.addEventListener('mousemove', onMouseMove)

                document.addEventListener('mouseup', onMouseUp)
            })
    }
}