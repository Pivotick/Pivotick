import { createHtmlElement, createHtmlTemplate, createIcon } from '../../../utils/ElementCreation'
import { createPropertyList } from './PropertyList'
import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import './properties.scss'
import { collectPropertyEntries, edgePropertiesGetter, nodePropertiesGetter } from '../../../utils/GraphGetters'
import { filterAdd, filterRemove } from '../../icons'
import type { PropertiesPanel, PropertyEntry } from '../../../interfaces/GraphUI'
import type { EdgeSelection, NodeSelection } from '../../../interfaces/GraphInteractions'
import { isThenable } from '../../../utils/Getters'
import { AsyncRenderScope } from '../../../utils/AsyncRender'
import type { RenderContext } from '../../../interfaces/AsyncContent'
import { aggregateProperties, createTableForAggregatedProperties } from '../../../utils/ElementCreationAggregatedProperties'



export class SidebarProperties extends UIComponent {

    private panel?: HTMLDivElement
    private header?: HTMLDivElement
    private body?: HTMLDivElement

    private renderCb?: PropertiesPanel['render']

    // Placeholder / staleness for an async `render` or properties map; superseded
    // on every selection change.
    private readonly renderScope: AsyncRenderScope

    constructor(uiManager: UIManager) {
        super(uiManager)
        this.renderCb = typeof this.uiManager.getOptions().propertiesPanel.render === 'function' ? this.uiManager.getOptions().propertiesPanel.render : undefined
        this.renderScope = new AsyncRenderScope('properties', () => this.uiManager.getOptions().asyncContent)
        this.track(() => this.renderScope.supersede())
    }

    protected onMount(rootContainer: HTMLElement | undefined) {
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

    protected onDestroy() {
        this.panel?.remove()
        this.panel = undefined
    }

    protected onAfterMount() {
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

    protected onGraphReady(): void { }

    private renderCustomContent(element: Node | Edge | Node[] | Edge[] | null) {
        if (!this.body || !this.renderCb) return

        this.renderScope.supersede()
        this.body.innerHTML = ''
        const content = this.renderScope.content(this.renderCb, element)
        if (content) {
            this.body?.appendChild(content)
        }
    }

    /**
     * Replace the panel body with the outcome of a render pass.
     *
     * Everything the panel draws goes through here so the staleness guard is in
     * one place: whatever the last pass was still fetching is abandoned before
     * its slot leaves the DOM.
     */
    private renderBody<T>(
        produce: (ctx: RenderContext) => T | Promise<T>,
        build: (value: T) => HTMLElement | undefined,
    ): void {
        if (!this.body) return

        this.renderScope.supersede()
        const content = this.renderScope.resolve(produce, build)
        this.body.innerHTML = ''
        if (content) this.body.appendChild(content)
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

        this.renderBody(
            (ctx) => nodePropertiesGetter(node, this.uiManager.getOptions().propertiesPanel, ctx),
            (properties) => createHtmlElement('div', { class: 'pvt-properties-container' }, [
                createPropertyList(properties, node),
            ]) as HTMLDivElement,
        )
    }

    public updateEdgeProperties(edge: Edge): void {
        if (!this.body) return
        this.setHeaderBasicEdge()
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(edge)
            return
        }

        this.renderBody(
            (ctx) => edgePropertiesGetter(edge, this.uiManager.getOptions().propertiesPanel, ctx),
            (properties) => createHtmlElement('div', { class: 'pvt-properties-container' }, [
                createPropertyList(properties, edge),
            ]) as HTMLDivElement,
        )
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

        this.renderBody(
            (ctx) => collectPropertyEntries(
                nodes.map((selected) => selected.node),
                (node) => nodePropertiesGetter(node, this.uiManager.getOptions().propertiesPanel, ctx),
            ),
            (allProperties) => this.buildAggregatedTable(allProperties, nodes.length, this.applyNodeFacetFilter.bind(this)),
        )
    }

    /**
     * The aggregated table for a multi-selection. `onFacetFilter` is node-only:
     * edge selection filtering runs on nodes, so an edge table's bars and chips
     * stay non-clickable.
     */
    private buildAggregatedTable(
        allProperties: PropertyEntry[][],
        count: number,
        onFacetFilter?: (key: string, value: string, mode: 'keep' | 'exclude') => void,
    ): HTMLDivElement {
        const template = `
<div class="pvt-properties-container">
    <div class="">
        <div class="pvt-aggregated-properties"></div>
    </div>
</div>`
        const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
        const div = propertiesContainer.querySelector('div.pvt-aggregated-properties') as HTMLDivElement

        if (div) {
            div.appendChild(createTableForAggregatedProperties(
                aggregateProperties(allProperties),
                count,
                this.genActionButtons.bind(this),
                onFacetFilter,
            ))
        }
        return propertiesContainer
    }

    public updateEdgesProperties(edges: EdgeSelection<unknown>[]): void {
        if (!this.body) return
        this.setHeaderMultiSelectEdge()
        this.showPanel()

        if (this.renderCb) {
            this.renderCustomContent(edges.map((nodeS: EdgeSelection<unknown>) => nodeS.edge))
            return
        }

        this.renderBody(
            (ctx) => collectPropertyEntries(
                edges.map((selected) => selected.edge),
                (edge) => edgePropertiesGetter(edge, this.uiManager.getOptions().propertiesPanel, ctx),
            ),
            (allProperties) => this.buildAggregatedTable(allProperties, edges.length),
        )
    }

    /**
     * Narrows the current node selection by a single facet value: `keep` drops
     * every node that does not carry the value, `exclude` drops those that do.
     * Shared by the row icons and by clicking a distribution bar / value chip.
     *
     * The value is read through `nodePropertiesGetter` — the same source the
     * facet was built from — rather than raw `getData()`, so getter-derived
     * fields (e.g. `id`, which lives on `node.id`) match instead of missing.
     *
     * A declared map may be async, in which case the narrowing waits for it.
     * A synchronous map still narrows in the same tick as the click.
     */
    private applyNodeFacetFilter(key: string, value: string, mode: 'keep' | 'exclude'): void {
        const propertiesPanel = this.uiManager.getOptions().propertiesPanel
        const interaction = this.uiManager.graph.renderer.getGraphInteraction()
        const selected = interaction.getSelectedNodes()

        const narrow = (allProperties: PropertyEntry[][]): void => {
            const toRemove = selected.filter((_nodeSelection: NodeSelection<unknown>, index: number) => {
                const nodeValue = allProperties[index].find((prop) => prop.name === key)?.value
                // Strict: the facet is type-sensitive, so 80 and '80' are distinct rows.
                return mode === 'keep' ? nodeValue !== value : nodeValue === value
            })
            interaction.removeNodesFromSelection(toRemove)
        }

        const collected = collectPropertyEntries(
            selected.map((nodeSelection) => nodeSelection.node),
            (node) => nodePropertiesGetter(node, propertiesPanel),
        )
        if (isThenable(collected)) {
            void collected.then(narrow)
        } else {
            narrow(collected)
        }
    }

    private genActionButtons(key: string, value: string): HTMLDivElement {
        const buttonKeep = createHtmlElement('button', {
            title: 'Keep only nodes with this value',
            class: 'pvt-facet-action-select',
        }, [createIcon({ svgIcon: filterAdd }) ])
        buttonKeep.addEventListener('click', () => this.applyNodeFacetFilter(key, value, 'keep'))

        const buttonExclude = createHtmlElement('button', {
            title: 'Exclude nodes with this value',
            class: 'pvt-facet-action-exclude',
        }, [createIcon({ svgIcon: filterRemove }) ])
        buttonExclude.addEventListener('click', () => this.applyNodeFacetFilter(key, value, 'exclude'))

        const container = createHtmlElement('div', { class: 'pvt-aggregated-property-actions' }, [
            buttonKeep,
            buttonExclude
        ])
        return container
    }
}
