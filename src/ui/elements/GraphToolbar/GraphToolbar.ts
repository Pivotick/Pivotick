
import { createHtmlElement, createHtmlTemplate } from '../../../utils/ElementCreation'
import { createButton } from '../../components/Button'
import { addCircle, bidirectional, bulkEdit, edit, editMode, groupNodes, lassoTool, pathSelection, reverseEdge, selectionInverse, stickyNote, trash, ungroupNodes } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './graphToolbar.scss'


export class GraphToolbar implements UIElement {
    private uiManager: UIManager

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

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return
        this.container = container

        const template = document.createElement('template')
        template.innerHTML = `
  <div class="pvt-graphtoolbar-elements">
  </div>
`
        this.toolbar = template.content.firstElementChild as HTMLDivElement

        const shortcutButton = createHtmlTemplate('<span class="pvt-keyboard-shortcut pvt-ms-1">e</span>')
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

        const textElement =
            this.enableEditModeButton?.querySelector('text')

        if (textElement) {
            textElement.textContent = this.editModeEnabled
                ? 'Editing'
                : 'Edit Graph'
        }

        this.updateToolbarVisibility()
    }

    destroy() {
        this.toolbar?.remove()
        this.toolbar = undefined
    }

    afterMount() {
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
            }
        })
    }

    graphReady() {
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
        element?.classList.add('visible')
    }

    private hideGroup(element?: HTMLElement) {
        element?.classList.remove('visible')
    }

    private buildNoSelectionContainer(): HTMLDivElement {
        this.noSelectionContainer = createHtmlTemplate(`
        <div class="pvt-toolbar-group"></div>
    `) as HTMLDivElement

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
            text: 'Sticky Note',
            size: 'sm',
            svgIcon: stickyNote,
            disabled: true,
            onClick: () => {
            }
        })

        this.noSelectionContainer.appendChild(addNodeButton)
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
            onClick: () => {
                //
            }
        })

        const bulkEditButton = createButton({
            variant: 'secondary',
            text: 'Bulk Edit',
            size: 'sm',
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

    public toggleLassoMode() {
        if (!this.enableLassoModeButton) return
        const canvas: HTMLDivElement | undefined = this.uiManager.layout?.canvas
        if (!canvas) return

        this.lassoModeEnabled = !this.lassoModeEnabled


        // active state
        this.enableLassoModeButton.classList.toggle('pivotick-button-secondary', !this.lassoModeEnabled)
        this.enableLassoModeButton.classList.toggle('pivotick-button-primary', this.lassoModeEnabled)

        // update canvas cursor
        canvas.classList.toggle('canvas--lasso-mode', this.lassoModeEnabled)

        // disable panning while lasso mode is active
        this.uiManager.graph.renderer.toggleLassoMode(this.lassoModeEnabled)
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

