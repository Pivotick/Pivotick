
import type { GraphConnectManager } from '../../../editing/GraphConnectManager'
import type { GraphInteractionContext } from '../../../interfaces/GraphInteractions'
import { Note } from '../../../Note'
import { createHtmlElement, createHtmlTemplate, createShortcutBadge } from '../../../utils/ElementCreation'
import { createButton } from '../../components/Button'
import { addCircle, bidirectional, bulkEdit, edit, editMode, graphEdgeIcon, groupNodes, lassoTool, pathSelection, reverseEdge, selectionInverse, stickyNote, trash, ungroupNodes } from '../../icons'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import './graphToolbar.scss'


export class GraphToolbar extends UIComponent {

    public toolbar?: HTMLDivElement
    private container?: HTMLElement

    private noSelectionContainer?: HTMLDivElement
    private withNodeSelectionContainer?: HTMLDivElement
    private withEdgeSelectionContainer?: HTMLDivElement
    private cursorSelectionContainer?: HTMLDivElement

    private editModeEnabled = false
    private lassoModeEnabled = false

    private enableEditModeButton?: HTMLButtonElement
    private editModeButtonText?: SVGTextElement
    private enableLassoModeButton?: HTMLButtonElement
    private enableAddEdgeModeButton?: HTMLButtonElement

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    protected onMount(container: HTMLElement | undefined) {
        if (!container) return
        this.container = container

        const template = document.createElement('template')
        template.innerHTML = `
  <div class="pvt-graphtoolbar-elements">
  </div>
`
        this.toolbar = template.content.firstElementChild as HTMLDivElement

        const shortcutButton = createShortcutBadge('e', 'pvt-ms-1 pvt-py-1 pvt-px-2')
        this.enableEditModeButton = createButton({
            id: 'pvt-edit-mode-button',
            variant: 'outline-primary',
            text: 'Edit Graph',
            childElement: shortcutButton,
            size: 'sm',
            svgIcon: editMode,
            onClick: () => {
                this.toggleEditMode()
            }
        })
        this.editModeButtonText = this.enableEditModeButton?.querySelector('text') as SVGTextElement

        this.toolbar.appendChild(this.buildNoSelectionContainer())
        this.toolbar.appendChild(this.buildWithNodeSelectionContainer())
        this.toolbar.appendChild(this.buildWithEdgeSelectionContainer())
        this.toolbar.appendChild(this.buildCursorSelectionContainer())

        const buttonContainer = createHtmlElement('span', { 'class': 'edit-mode-button-container' }, [this.enableEditModeButton])
        this.toolbar.appendChild(buttonContainer)

        this.container.appendChild(this.toolbar)
    }

    private toggleEditMode() {
        this.editModeEnabled = !this.editModeEnabled

        this.container?.classList.toggle(
            'edit-mode-active',
            this.editModeEnabled
        )

        this.enableEditModeButton?.classList.toggle(
            'active',
            this.editModeEnabled
        )

        if (!this.editModeEnabled) {
            this.toggleLassoMode(false)

            const connectManager = this.uiManager.graph.editing.connectManager
            if (connectManager.isActive()) {
                connectManager.cancel()
            }
        }

        const textElement =
            this.enableEditModeButton?.querySelector('text')

        if (textElement) {
            textElement.textContent = this.editModeEnabled
                ? 'Editing'
                : 'Edit Graph'
        }

        this.updateToolbarVisibility()
    }

    protected onDestroy() {
        this.toolbar?.remove()
        this.toolbar = undefined
    }

    protected onAfterMount() {
        if (!this.toolbar) return

        this.uiManager.keyManager.register({
            key: 'e', callback: () => {
                this.toggleEditMode()
            }
        })

        this.uiManager.keyManager.register({
            key: 'Escape',
            callback: () => {
                if (this.lassoModeEnabled) {
                    this.toggleLassoMode()
                }

                const connectManager = this.uiManager.graph.editing.connectManager
                if (connectManager.isActive()) {
                    connectManager.exitClickConnectionMode()
                }
            }
        })
    }

    protected onGraphReady() {
        const interaction = this.uiManager.graph.renderer.getGraphInteraction()

        interaction.on('selectNode', () => {
            this.updateToolbarVisibility()
        })

        interaction.on('unselectNode', () => {
            this.updateToolbarVisibility()
        })

        interaction.on('selectNodes', () => {
            this.updateToolbarVisibility()
        })

        interaction.on('unselectNodes', () => {
            this.updateToolbarVisibility()
        })

        interaction.on('selectEdge', () => {
            this.updateToolbarVisibility()
        })

        interaction.on('unselectEdge', () => {
            this.updateToolbarVisibility()
        })

        interaction.on('selectEdges', () => {
            this.updateToolbarVisibility()
        })

        interaction.on('unselectEdges', () => {
            this.updateToolbarVisibility()
        })

        interaction.on('canvasClick', () => {
            this.updateToolbarVisibility()
        })

        const connectManager = this.uiManager.graph.editing.connectManager

        connectManager.on('start', (connectManager: GraphConnectManager) => {
            if (connectManager.getMode() === 'node-edge') {
                this.refreshAddEdgeButtonState(true)
            }
        })

        connectManager.on('stop', (connectManager: GraphConnectManager) => {
            if (connectManager.getMode() === 'node-edge') {
                this.refreshAddEdgeButtonState(false)
            }
        })
    }

    private updateToolbarVisibility() {
        if (!this.editModeEnabled) {
            this.hideGroup(this.noSelectionContainer)
            this.hideGroup(this.withEdgeSelectionContainer)
            this.hideGroup(this.withNodeSelectionContainer)
            this.hideGroup(this.cursorSelectionContainer)

            return
        }

        this.showGroup(this.cursorSelectionContainer)

        const interaction = this.uiManager.graph.renderer.getGraphInteraction()

        const nodeSelectionCount = (interaction.getSelectedNodeIDs() ?? []).length
        const edgeSelectionCount = (interaction.getSelectedEdgeIDs() ?? []).length
        const hasSelection = nodeSelectionCount > 0 || edgeSelectionCount > 0

        if (hasSelection) {
            if (nodeSelectionCount > 0) {
                this.editModeButtonText!.textContent = `Editing node${nodeSelectionCount > 1 ? 's' : ''}`
                this.showGroup(this.withNodeSelectionContainer)
                this.hideGroup(this.withEdgeSelectionContainer)
            } else {
                this.editModeButtonText!.textContent = `Editing edge${edgeSelectionCount > 1 ? 's' : ''}`
                this.hideGroup(this.withNodeSelectionContainer)
                this.showGroup(this.withEdgeSelectionContainer)
            }
            this.hideGroup(this.noSelectionContainer)
        } else {
            this.editModeButtonText!.textContent = 'Editing'
            this.hideGroup(this.withNodeSelectionContainer)
            this.hideGroup(this.withEdgeSelectionContainer)
            this.showGroup(this.noSelectionContainer)
        }
    }

    private showGroup(element?: HTMLElement) {
        if (!element || element.classList.contains('visible')) return

        const width = element.scrollWidth
        element.style.setProperty('--group-width', `${width}px`)
        element.classList.remove('hiding')
        requestAnimationFrame(() => {
            element.classList.add('visible')
        })
        element.addEventListener('transitionend', (e) => {
            if (
                e.propertyName === 'width' &&
                element.classList.contains('hiding')
            ) {
                element.classList.remove('hiding')
            }
        })
    }

    private hideGroup(element?: HTMLElement) {
        element?.classList.remove('visible')
        element?.classList.add('hiding')
    }

    private buildNoSelectionContainer(): HTMLDivElement {
        this.noSelectionContainer = createHtmlTemplate(`
        <div class="pvt-toolbar-group"></div>
    `) as HTMLDivElement

        this.enableAddEdgeModeButton = createButton({
            variant: 'secondary',
            text: 'Add Edge',
            size: 'sm',
            svgIcon: graphEdgeIcon(24),
            onClick: () => {
                this.toggleAddEdgeMode()
            }
        })

        const addNodeButton = createButton({
            variant: 'secondary',
            text: 'Add Node',
            size: 'sm',
            svgIcon: addCircle,
            disabled: true,
            onClick: () => {
            }
        })

        const addStickyNoteButton = createButton({
            variant: 'secondary',
            text: 'Add Note',
            size: 'sm',
            svgIcon: stickyNote,
            onClick: (evt: MouseEvent) => {
                const renderer = this.uiManager.graph.renderer
                const bcr = (evt.currentTarget as HTMLButtonElement).getBoundingClientRect()
                const { x, y } = renderer.screenToGraphCoordinates(
                    bcr.x,
                    bcr.y + 50,
                )
                const note: Note = new Note({
                    content: 'This is not a note.',
                    x,
                    y
                })
                this.uiManager.graph.noteManager.addNote(note)
            }
        })

        this.noSelectionContainer.appendChild(addNodeButton)
        this.noSelectionContainer.appendChild(this.enableAddEdgeModeButton)
        this.noSelectionContainer.appendChild(addStickyNoteButton)

        return this.noSelectionContainer
    }

    private buildWithNodeSelectionContainer(): HTMLDivElement {
        this.withNodeSelectionContainer = createHtmlTemplate(`
        <div class="pvt-toolbar-group"></div>
    `) as HTMLDivElement

        const editNodeButton = createButton({
            variant: 'secondary',
            text: 'Edit',
            size: 'sm',
            svgIcon: edit,
            childElement: createShortcutBadge('Shift+E', 'pvt-ms-1 pvt-px-1 pvt-py-0'),
            onClick: () => {
                const nodeSelection = this.uiManager.graph.renderer.getGraphInteraction().getSelectedNode()
                if (nodeSelection) {
                    this.uiManager.graph.editing.openNodeSession(nodeSelection.node)
                }
            }
        })

        const bulkEditButton = createButton({
            variant: 'secondary',
            text: 'Bulk Edit',
            size: 'sm',
            disabled: true,
            svgIcon: bulkEdit,
            onClick: () => {
                //
            }
        })

        const groupNodesButton = createButton({
            variant: 'secondary',
            text: 'Group',
            size: 'sm',
            svgIcon: groupNodes,
            onClick: () => {
                //
            }
        })

        const ungroupNodesButton = createButton({
            variant: 'secondary',
            text: 'Ungroup',
            size: 'sm',
            svgIcon: ungroupNodes,
            onClick: () => {
                //
            }
        })

        this.withNodeSelectionContainer.appendChild(editNodeButton)
        this.withNodeSelectionContainer.appendChild(bulkEditButton)
        this.withNodeSelectionContainer.appendChild(groupNodesButton)
        this.withNodeSelectionContainer.appendChild(ungroupNodesButton)

        return this.withNodeSelectionContainer
    }

    private buildWithEdgeSelectionContainer(): HTMLDivElement {
        this.withEdgeSelectionContainer = createHtmlTemplate(`
        <div class="pvt-toolbar-group"></div>
    `) as HTMLDivElement

        const editEdgeButton = createButton({
            variant: 'secondary',
            text: 'Edit Edge',
            size: 'sm',
            svgIcon: edit,
            onClick: () => {
                //
            }
        })

        const deleteEdgeButton = createButton({
            variant: 'danger',
            text: 'Delete Edge',
            size: 'sm',
            svgIcon: trash,
            onClick: () => {
                //
            }
        })

        const reverseEdgeButton = createButton({
            variant: 'secondary',
            text: 'Reverse',
            size: 'sm',
            svgIcon: reverseEdge,
            onClick: () => {
                //
            }
        })

        const bidirectionalEdgeButton = createButton({
            variant: 'secondary',
            text: 'Bidirectional',
            size: 'sm',
            svgIcon: bidirectional,
            onClick: () => {
                //
            }
        })

        this.withEdgeSelectionContainer.appendChild(editEdgeButton)
        this.withEdgeSelectionContainer.appendChild(deleteEdgeButton)
        this.withEdgeSelectionContainer.appendChild(reverseEdgeButton)
        this.withEdgeSelectionContainer.appendChild(bidirectionalEdgeButton)

        return this.withEdgeSelectionContainer
    }

    private buildCursorSelectionContainer(): HTMLDivElement {
        this.cursorSelectionContainer = createHtmlTemplate(`
        <div class="pvt-toolbar-group"></div>
    `) as HTMLDivElement

        this.enableLassoModeButton = createButton({
            variant: 'secondary',
            text: 'Lasso',
            tooltip: 'Select nodes using a lasso tool',
            size: 'sm',
            svgIcon: lassoTool,
            onClick: () => {
                this.toggleLassoMode()
            }
        })

        const inverseSelectionButton = createButton({
            variant: 'secondary',
            text: 'Invert',
            tooltip: 'Inverse the selection of selected nodes',
            size: 'sm',
            svgIcon: selectionInverse,
            onClick: () => {
                this.inverseSelection()
            }
        })

        const pathSelectionButton = createButton({
            variant: 'secondary',
            text: 'Path Select',
            tooltip: 'Select all nodes traversed by the shortest path between 2 selected nodes',
            size: 'sm',
            svgIcon: pathSelection,
            disabled: true,
            onClick: () => {
            }
        })

        this.cursorSelectionContainer.appendChild(this.enableLassoModeButton)
        this.cursorSelectionContainer.appendChild(inverseSelectionButton)
        this.cursorSelectionContainer.appendChild(pathSelectionButton)

        return this.cursorSelectionContainer
    }

    public toggleLassoMode(enabled?: boolean) {
        if (!this.enableLassoModeButton) return
        const canvas: HTMLDivElement | undefined = this.uiManager.layout?.canvas
        if (!canvas) return

        if (enabled !== undefined) {
            this.lassoModeEnabled = enabled
        } else {
            this.lassoModeEnabled = !this.lassoModeEnabled
        }

        // active state
        this.enableLassoModeButton.classList.toggle('pivotick-button-secondary', !this.lassoModeEnabled)
        this.enableLassoModeButton.classList.toggle('pivotick-button-primary', this.lassoModeEnabled)

        // update canvas cursor
        canvas.classList.toggle('canvas--lasso-mode', this.lassoModeEnabled)

        // disable panning while lasso mode is active
        this.uiManager.graph.renderer.toggleLassoMode(this.lassoModeEnabled)
        if (this.lassoModeEnabled) {
            this.uiManager.graph.renderer.getGraphInteraction().on('canvasBeforeZoom', this.canvasBeforeZoomCb)
            this.uiManager.graph.renderer.getGraphInteraction().on('canvasClick', this.canvasClickCb)
        } else {
            this.uiManager.graph.renderer.getGraphInteraction().off('canvasBeforeZoom', this.canvasBeforeZoomCb)
            this.uiManager.graph.renderer.getGraphInteraction().off('canvasClick', this.canvasClickCb)
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private canvasBeforeZoomCb = (event: any, context: GraphInteractionContext) => {
        if (event.type === 'wheel') return true
        if (event.button === 1) return true

        context.cancel()
    }

    private canvasClickCb = (event: PointerEvent, context: GraphInteractionContext) => {
        context.cancel()
    }

    public toggleAddEdgeMode() {

        const manager = this.uiManager.graph.editing.connectManager

        if (manager.isActive()) {
            manager.exitClickConnectionMode()
        } else {
            manager.startNodeClickConnection()
        }
    }

    private refreshAddEdgeButtonState(active: boolean): void {

        this.enableAddEdgeModeButton?.classList.toggle('pivotick-button-secondary', !active)
        this.enableAddEdgeModeButton?.classList.toggle('pivotick-button-primary', active)

        if (!active) {
            this.enableAddEdgeModeButton?.blur()
        }
    }

    private inverseSelection() {
        const interaction = this.uiManager.graph.renderer.getGraphInteraction()

        const selectedNodeIDs = new Set(
            interaction.getSelectedNodeIDs()
        )

        const invertedSelection = this.uiManager.graph
            .getMutableNodes()
            .filter(node => !selectedNodeIDs.has(node.id))
            .map(node => ({
                node,
                element: node.getGraphElement() as SVGGElement
            }))

        interaction.selectNodes(invertedSelection)
    }
}

