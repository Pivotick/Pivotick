import { select as d3Select, type Selection } from 'd3-selection'
import { transition as d3Transition } from 'd3-transition'

import type { Graph } from '../../Graph'
import { GraphSvgRenderer } from './GraphSvgRenderer'

import { Note } from '../../Note'
import type { GraphRendererOptions } from '../../interfaces/RendererOptions'

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

        note.setGraphElement(noteSelection.node() ?? undefined as never)

        this.renderBackground(noteSelection, note)
        this.renderHeader(noteSelection, note)
        this.renderContent(noteSelection, note)
        this.renderColorPills(noteSelection, note)
        this.renderResizeHandle(noteSelection, note)
    }

    public updatePositions(noteSelection: Selection<SVGGElement, Note, SVGGElement, unknown>): void {

        noteSelection.attr('transform', d => {
            const x = isFinite(d.x) ? d.x : 0
            const y = isFinite(d.y) ? d.y : 0
            return `translate(${x},${y})`
        })
    }

    private renderBackground(noteSelection: Selection<SVGGElement, Note, null, undefined>, note: Note): void {

        noteSelection
            .append('rect')
            .classed('pvt-note-background', true)
            .attr('width', note.width)
            .attr('height', note.height)
            .attr('rx', 10)
            .attr('ry', 10)
            .attr('fill', note.color)
            .attr('stroke', 'rgba(0,0,0,0.15)')
            .attr('stroke-width', 1)
    }

    private renderHeader(noteSelection: Selection<SVGGElement, Note, null, undefined>, note: Note): void {

        noteSelection
            .append('rect')
            .classed('pvt-note-header', true)
            .attr('width', note.width)
            .attr('height', 28)
            .attr('rx', 10)
            .attr('ry', 10)
            .attr('fill', 'rgba(255,255,255,0.18)')
    }

    private renderContent(noteSelection: Selection<SVGGElement, Note, null, undefined>, note: Note): void {

        noteSelection
            .append('foreignObject')
            .attr('x', 12)
            .attr('y', 40)
            .attr('width', note.width - 24)
            .attr('height', note.height - 52)
            .append('xhtml:div')
            .style('width', '100%')
            .style('height', '100%')
            .style('overflow', 'hidden')
            .style('font-size', '14px')
            .style('font-family', 'sans-serif')
            .style('color', '#222')
            .style('outline', 'none')
            .style('background', 'transparent')
            .html(note.content)
    }

    private renderColorPills(noteSelection: Selection<SVGGElement, Note, null, undefined>, note: Note): void {

        const colors = [
            '#FDE68A',
            '#FCA5A5',
            '#93C5FD',
            '#86EFAC',
            '#C4B5FD'
        ]

        const pills = noteSelection
            .append('g')
            .classed('pvt-note-color-pills', true)

        const radius = 6
        const spacing = 18

        pills.selectAll('circle')
            .data(colors)
            .enter()
            .append('circle')
            .attr('cx', (_, i) => 16 + i * spacing)
            .attr('cy', 14)
            .attr('r', radius)
            .attr('fill', d => d)
            .attr('stroke', 'rgba(0,0,0,0.2)')
            .attr('stroke-width', 1)
            .style('cursor', 'pointer')
            .on('click', (_, color) => {
                note.setColor(color)

                noteSelection
                    .select('.pvt-note-background')
                    .attr('fill', color)
            })
    }

    private renderResizeHandle(
        noteSelection: Selection<SVGGElement, Note, null, undefined>,
        note: Note
    ): void {

        const size = 12

        noteSelection
            .append('rect')
            .classed('pvt-note-resize-handle', true)
            .attr('x', note.width - size)
            .attr('y', note.height - size)
            .attr('width', size)
            .attr('height', size)
            .attr('fill', 'rgba(0,0,0,0.2)')
            .attr('rx', 3)
            .attr('ry', 3)
            .style('cursor', 'nwse-resize')
    }
}