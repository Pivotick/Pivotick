
import { createHtmlElement, createHtmlTemplate } from '../../../utils/ElementCreation'
import { createButton } from '../../components/Button'
import { editMode } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './graphToolbar.scss'


export class GraphToolbar implements UIElement {
    private uiManager: UIManager

    public toolbar?: HTMLDivElement
    private container?: HTMLElement
    private enableEditModeButton?: HTMLButtonElement

    private noSelectionContainer?: HTMLDivElement
    private withSelectionContainer?: HTMLDivElement
    private cursorSelectionContainer?: HTMLDivElement
    private canvasToolsContainer?: HTMLDivElement

    private editModeEnabled = false

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

        this.toolbar.appendChild(this.buildNoSelectionContainer())
        this.toolbar.appendChild(this.buildWithSelectionContainer())
        this.toolbar.appendChild(this.buildCursorSelectionContainer())
        this.toolbar.appendChild(this.buildCanvasToolsContainer())

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
            this.hideGroup(this.withSelectionContainer)
            this.hideGroup(this.cursorSelectionContainer)
            this.hideGroup(this.canvasToolsContainer)

            return
        }

        // always visible in edit mode
        this.showGroup(this.cursorSelectionContainer)
        this.showGroup(this.canvasToolsContainer)

        const interaction = this.uiManager.graph.renderer.getGraphInteraction()

        const hasSelection =
            (interaction.getSelectedNodeIDs() ?? []).length > 0 ||
            (interaction.getSelectedEdgeIDs() ?? []).length > 0

        if (hasSelection) {
            this.showGroup(this.withSelectionContainer)
            this.hideGroup(this.noSelectionContainer)
        } else {
            this.hideGroup(this.withSelectionContainer)
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
            // svgIcon: addNode,
            onClick: () => {
                //
            }
        })

        const addStickyNoteButton = createButton({
            variant: 'secondary',
            text: 'Sticky Note',
            size: 'sm',
            // svgIcon: stickyNote,
            onClick: () => {
                //
            }
        })

        this.noSelectionContainer.appendChild(addNodeButton)
        this.noSelectionContainer.appendChild(addStickyNoteButton)

        return this.noSelectionContainer
    }
    
    private buildWithSelectionContainer(): HTMLDivElement {
        this.withSelectionContainer = createHtmlTemplate(`
        <div class="pvt-toolbar-group"></div>
    `) as HTMLDivElement

        const editNodeButton = createButton({
            variant: 'secondary',
            text: 'Edit',
            size: 'sm',
            // svgIcon: edit,
            onClick: () => {
                //
            }
        })

        const bulkEditButton = createButton({
            variant: 'secondary',
            text: 'Bulk Edit',
            size: 'sm',
            // svgIcon: bulkEdit,
            onClick: () => {
                //
            }
        })

        const groupNodesButton = createButton({
            variant: 'secondary',
            text: 'Group',
            size: 'sm',
            // svgIcon: group,
            onClick: () => {
                //
            }
        })

        const ungroupNodesButton = createButton({
            variant: 'secondary',
            text: 'Ungroup',
            size: 'sm',
            // svgIcon: ungroup,
            onClick: () => {
                //
            }
        })

        const editEdgeButton = createButton({
            variant: 'secondary',
            text: 'Edit Edge',
            size: 'sm',
            // svgIcon: edgeEdit,
            onClick: () => {
                //
            }
        })

        const deleteEdgeButton = createButton({
            variant: 'danger',
            text: 'Delete Edge',
            size: 'sm',
            // svgIcon: trash,
            onClick: () => {
                //
            }
        })

        const reverseEdgeButton = createButton({
            variant: 'secondary',
            text: 'Reverse',
            size: 'sm',
            // svgIcon: reverseEdge,
            onClick: () => {
                //
            }
        })

        const bidirectionalEdgeButton = createButton({
            variant: 'secondary',
            text: 'Bidirectional',
            size: 'sm',
            // svgIcon: bidirectional,
            onClick: () => {
                //
            }
        })

        this.withSelectionContainer.appendChild(editNodeButton)
        this.withSelectionContainer.appendChild(bulkEditButton)
        this.withSelectionContainer.appendChild(groupNodesButton)
        this.withSelectionContainer.appendChild(ungroupNodesButton)

        this.withSelectionContainer.appendChild(editEdgeButton)
        this.withSelectionContainer.appendChild(deleteEdgeButton)
        this.withSelectionContainer.appendChild(reverseEdgeButton)
        this.withSelectionContainer.appendChild(bidirectionalEdgeButton)

        return this.withSelectionContainer
    }

    private buildCursorSelectionContainer(): HTMLDivElement {
        this.cursorSelectionContainer = createHtmlTemplate(`
        <div class="pvt-toolbar-group"></div>
    `) as HTMLDivElement

        const lassoSelectionButton = createButton({
            variant: 'secondary',
            text: 'Lasso',
            size: 'sm',
            // svgIcon: lasso,
            onClick: () => {
                //
            }
        })

        const inverseSelectionButton = createButton({
            variant: 'secondary',
            text: 'Invert',
            size: 'sm',
            // svgIcon: inverseSelection,
            onClick: () => {
                //
            }
        })

        const pathSelectionButton = createButton({
            variant: 'secondary',
            text: 'Path Select',
            size: 'sm',
            // svgIcon: pathSelection,
            onClick: () => {
                //
            }
        })

        this.cursorSelectionContainer.appendChild(lassoSelectionButton)
        this.cursorSelectionContainer.appendChild(inverseSelectionButton)
        this.cursorSelectionContainer.appendChild(pathSelectionButton)

        return this.cursorSelectionContainer
    }

    private buildCanvasToolsContainer(): HTMLDivElement {
        this.canvasToolsContainer = createHtmlTemplate(`
        <div class="pvt-toolbar-group"></div>
    `) as HTMLDivElement

        const highlightGridButton = createButton({
            variant: 'secondary',
            text: 'Grid',
            size: 'sm',
            // svgIcon: grid,
            onClick: () => {
                //
            }
        })

        const snapToGridButton = createButton({
            variant: 'secondary',
            text: 'Snap',
            size: 'sm',
            // svgIcon: magnet,
            onClick: () => {
                //
            }
        })

        this.canvasToolsContainer.appendChild(highlightGridButton)
        this.canvasToolsContainer.appendChild(snapToGridButton)

        return this.canvasToolsContainer
    }
}

