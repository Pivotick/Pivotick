import { createHtmlDL, createHtmlElement, createHtmlTemplate, createIcon } from '../../../utils/ElementCreation'
import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { UIElement, UIManager } from '../../UIManager'
import './properties.scss'
import { edgePropertiesGetter, nodePropertiesGetter } from '../../../utils/GraphGetters'
import { filterAdd, filterRemove } from '../../icons'
import type { PropertyEntry } from '../../../interfaces/GraphUI'
import type { EdgeSelection, NodeSelection } from '../../../interfaces/GraphInteractions'
import { tryResolveHTMLElement } from '../../../utils/Getters'
import { aggregateProperties, createTableForAggregatedProperties } from '../../../utils/ElementCreationAggregatedProperties'



export class SidebarProperties implements UIElement {
    private uiManager: UIManager

    private panel?: HTMLDivElement
    private header?: HTMLDivElement
    private body?: HTMLDivElement

    private renderCb?: ((element: Node | Edge | Node[] | Edge[] | null) => HTMLElement | string) | HTMLElement | string

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.renderCb = typeof this.uiManager.getOptions().propertiesPanel.render === 'function' ? this.uiManager.getOptions().propertiesPanel.render : undefined
    }

    public mount(rootContainer: HTMLElement | undefined) {
        if (!rootContainer) return

        const template = `
<div class="enter-ready">
    <div class="pvt-properties-header-panel pvt-sidebar-header-panel"></div>
    <div class="pvt-properties-body-panel pvt-sidebar-body-panel"></div>
</div>`
        this.panel = createHtmlTemplate(template) as HTMLDivElement
        this.header = this.panel.querySelector('.pvt-properties-header-panel') as HTMLDivElement
        this.body = this.panel.querySelector('.pvt-properties-body-panel') as HTMLDivElement

        rootContainer.appendChild(this.panel)
    }

    public destroy() {
        this.panel?.remove()
        this.panel = undefined
    }

    public afterMount() {
        this.clearProperties()
    }

    public clearProperties(): void {
        if (!this.body) return

        if (this.renderCb) {
            this.renderCustomContent(null)
            return
        }

        this.body.innerHTML = ''
        this.hidePanel()
    }

    public graphReady(): void { }

    private renderCustomContent(element: Node | Edge | Node[] | Edge[] | null) {
        if (!this.body || !this.renderCb) return

        this.body.innerHTML = ''
        const content = tryResolveHTMLElement(this.renderCb, element)
        if (content) {
            this.body?.appendChild(content)
        }
    }

    private setHeaderBasicNode() {
        this.header!.textContent = 'Basic Node Properties'
    }

    private setHeaderBasicEdge() {
        this.header!.textContent = 'Basic Edge Properties'
    }

    private setHeaderMultiSelectNode() {
        this.header!.textContent = 'Aggregated Node Properties'
    }

    private setHeaderMultiSelectEdge() {
        this.header!.textContent = 'Aggregated Edge Properties'
    }

    private showPanel() {
        this.panel!.classList.add('enter-active')
    }

    private hidePanel() {
        this.panel!.classList.remove('enter-active')
    }

    /* Single selection */
    public updateNodeProperties(node: Node): void {
        if (!this.body) return

        this.setHeaderBasicNode()
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(node)
            return
        }

        const template = `
<div class="pvt-properties-container">
    <div class="dl-container">
    </div>
</div>`
        const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
        const dlContainer = propertiesContainer.querySelector('.dl-container')

        if (dlContainer) {
            const properties = nodePropertiesGetter(node, this.uiManager.getOptions().propertiesPanel)
            dlContainer.append(createHtmlDL(properties, node))
        }

        this.body.innerHTML = ''
        this.body.appendChild(propertiesContainer)
    }

    public updateEdgeProperties(edge: Edge): void {
        if (!this.body) return
        this.setHeaderBasicEdge()
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(edge)
            return
        }

        const template = `
<div class="pvt-properties-container">
    <div class="dl-container">
    </div>
</div>`
        const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
        const dlContainer = propertiesContainer.querySelector('.dl-container')

        if (dlContainer) {
            const properties = edgePropertiesGetter(edge, this.uiManager.getOptions().propertiesPanel)
            dlContainer.append(createHtmlDL(properties, edge))
        }

        this.body.innerHTML = ''
        this.body.appendChild(propertiesContainer)
    }


    /* Multiple selection */
    public updateNodesProperties(nodes: NodeSelection<unknown>[]): void {
        if (!this.body) return
        this.setHeaderMultiSelectNode()
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(nodes.map((nodeS: NodeSelection<unknown>) => nodeS.node))
            return
        }

        const template = `
<div class="pvt-properties-container">
    <div class="">
        <div class="pvt-aggregated-properties"></div>
    </div>
</div>`
        const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
        const div = propertiesContainer.querySelector('div.pvt-aggregated-properties') as HTMLDivElement

        if (div) {
            const allProperties: PropertyEntry[][] = []
            nodes.forEach((selectedNode) => {
                const { node } = selectedNode
                const properties = nodePropertiesGetter(node, this.uiManager.getOptions().propertiesPanel)
                allProperties.push(properties)
            })
            const aggregatedProperties = aggregateProperties(allProperties)
            const aggregatedPropertiesDiv = createTableForAggregatedProperties(aggregatedProperties, nodes.length, this.genActionButtons.bind(this))
            div.appendChild(aggregatedPropertiesDiv)
        }

        this.body.innerHTML = ''
        this.body.appendChild(propertiesContainer)
    }

    public updateEdgesProperties(edges: EdgeSelection<unknown>[]): void {
        if (!this.body) return
        this.setHeaderMultiSelectEdge()
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(edges.map((nodeS: EdgeSelection<unknown>) => nodeS.edge))
            return
        }

        const template = `
<div class="pvt-properties-container">
    <div class="">
        <div class="pvt-aggregated-properties"></div>
    </div>
</div>`
        const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
        const div = propertiesContainer.querySelector('div.pvt-aggregated-properties') as HTMLDivElement

        if (div) {
            const allProperties: PropertyEntry[][] = []
            edges.forEach((selectedEdge) => {
                const { edge } = selectedEdge
                const properties = edgePropertiesGetter(edge, this.uiManager.getOptions().propertiesPanel)
                allProperties.push(properties)
            })
            const aggregatedProperties = aggregateProperties(allProperties)
            const aggregatedPropertiesDiv = createTableForAggregatedProperties(aggregatedProperties, edges.length, this.genActionButtons.bind(this))
            div.appendChild(aggregatedPropertiesDiv)
        }

        this.body.innerHTML = ''
        this.body.appendChild(propertiesContainer)
    }

    private genActionButtons(key: string, value: string): HTMLDivElement {
        const buttonKeep = createHtmlElement('button', {
            title: 'Select Similar',
        }, [createIcon({ svgIcon: filterAdd }) ])
        buttonKeep.addEventListener('click', () => {
            const matchingNodes = this.uiManager.graph.renderer.getGraphInteraction().getSelectedNodes()
                .filter((nodeSelection: NodeSelection<unknown>) => {
                    const node = nodeSelection.node
                    return node.getData()[key] != value
                })
            this.uiManager.graph.renderer.getGraphInteraction().removeNodesFromSelection(matchingNodes)
        })
        
        const buttonExclude = createHtmlElement('button', {
            title: 'Exclude Similar',
        }, [createIcon({ svgIcon: filterRemove }) ])
        buttonExclude.addEventListener('click', () => {
            const matchingNodes = this.uiManager.graph.renderer.getGraphInteraction().getSelectedNodes()
                .filter((nodeSelection: NodeSelection<unknown>) => {
                    const node = nodeSelection.node
                    return node.getData()[key] == value
                })
            this.uiManager.graph.renderer.getGraphInteraction().removeNodesFromSelection(matchingNodes)
        })

        const container = createHtmlElement('div', { class: 'pvt-aggregated-property-actions' }, [
            buttonKeep,
            buttonExclude
        ])
        return container
    }
}
