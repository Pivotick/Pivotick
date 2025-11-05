import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { ExtraPanel } from '../../../GraphOptions'
import { createHtmlTemplate } from '../../../utils/ElementCreation'
import { tryResolveHTMLElement } from '../../../utils/Getters'
import type { UIElement, UIManager } from '../../UIManager'
import type { EdgeSelection, NodeSelection } from '../../../GraphInteractions'

export class ExtraPanelManager implements UIElement {
    private uiManager: UIManager
    
    private panelContainer?: HTMLDivElement
    private panels: ExtraPanel[]
    private allPanels: HTMLDivElement[] = []

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.panels = this.uiManager.getOptions().extraPanels
    }

    public mount(rootContainer: HTMLElement | undefined) {
        if (!rootContainer) return

        this.panelContainer = rootContainer as HTMLDivElement
    }

    public destroy() {
        this.panelContainer?.remove()
        this.panelContainer = undefined
        this.allPanels = []
    }

    public afterMount() {
        this.mountPanels()
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public updateNode(_node: Node): void {
        this.show()
        return
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public updateEdge(_edge: Edge): void {
        this.show()
        return
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public updateNodes(_nodes: NodeSelection<unknown>[]): void {
        this.show()
        return
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public updateEdges(_edge: EdgeSelection<unknown>[]): void {
        this.show()
        return
    }

    public clear(): void {
        this.hide()
        return
    }

    private show() {
        this.allPanels.forEach((panelDiv) => {
            panelDiv!.classList.add('enter-active')
        })
    }

    private hide() {
        this.allPanels.forEach((panelDiv) => {
            panelDiv!.classList.remove('enter-active')
        })
    }

    private mountPanels(): void {
        if (!this.panelContainer) return

        this.panels.forEach((panel) => [
            this.mountPanel(panel)
        ])
    }

    private mountPanel(panel: ExtraPanel): void {
        if (!this.panelContainer) return

        const template = `
            <div class="enter-ready">
                <div class="pivotick-extrapanel-header-panel pivotick-sidebar-header-panel"></div>
                <div class="pivotick-extrapanel-body-panel pivotick-sidebar-body-panel"></div>
            </div>`
        const panelDiv = createHtmlTemplate(template) as HTMLDivElement
        const headerDiv = panelDiv.querySelector('.pivotick-extrapanel-header-panel') as HTMLDivElement
        const bodyDiv = panelDiv.querySelector('.pivotick-extrapanel-body-panel') as HTMLDivElement

        const headerHtml = tryResolveHTMLElement(panel.title, null)
        if (headerHtml) {
            headerDiv.appendChild(headerHtml)
        }

        const bodyHtml = tryResolveHTMLElement(panel.content, null)
        if (bodyHtml) {
            bodyDiv.appendChild(bodyHtml)
        }

        this.allPanels.push(panelDiv)
        this.panelContainer.appendChild(panelDiv)
    }

    graphReady() { }

}