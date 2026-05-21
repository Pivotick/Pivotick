import { Node } from '../../../../Node'
import { createHtmlDL, createHtmlTemplate } from '../../../../utils/ElementCreation'
import { nodeDescriptionGetter, nodeNameGetter, nodePropertiesGetter } from '../../../../utils/GraphGetters'
import { createJsonViewer } from '../../../components/JsonViewer'
import type { ModalHTMLElement } from '../../../components/Modal'
import { createTabs } from '../../../components/Tabs'
import type { UIManager } from '../../../UIManager'
import './inspectNodeModal.scss'

export function createInspectModal(node: Node, uiManager: UIManager): void {
    const fixedPreviewSize = 42
    const element = node.getGraphElement()
    let clonedGroup
    if (element && element instanceof SVGGElement) {
        clonedGroup = element.cloneNode(true) as SVGGElement
        const bbox = element.getBBox()
        const scale = fixedPreviewSize / Math.max(bbox.width, bbox.height)
        clonedGroup.setAttribute(
            'transform',
            `translate(${(fixedPreviewSize - bbox.width * scale) / 2 - bbox.x * scale}, ${(fixedPreviewSize - bbox.height * scale) / 2 - bbox.y * scale}) scale(${scale})`
        )
    }
    const header = createHtmlTemplate(`
        <div class="main-container">
            <div class="icon-container">
                <svg class="icon" width="${fixedPreviewSize}" height="${fixedPreviewSize}" viewBox="0 0 ${fixedPreviewSize} ${fixedPreviewSize}" preserveAspectRatio="xMidYMid meet">${clonedGroup?.outerHTML}</svg>
            </div>
            <div class="nodeinfo-container">
                <div class="nodeinfo-name">${nodeNameGetter(node, uiManager.getOptions().mainHeader)}</div>
                <div class="nodeinfo-subtitle">${nodeDescriptionGetter(node, uiManager.getOptions().mainHeader) ?? ''}</div>
            </div>
        </div>
    `) as HTMLDivElement

    const body = createInspectModalBody(node, uiManager)

    const previousInstance = document.querySelector('#inspect-node-modal') as ModalHTMLElement | null
    if (previousInstance) {
        previousInstance.__modalInstance?.destroy()
    }
    
    uiManager.createModal({
        id: 'inspect-node-modal',
        rawHeader: true,
        header: header,
        body: body,
        rawBody: true,
        buttons: null,
        position: 'top',
        size: 'xl',
        noBodyPadding: true,
    })
}

function createNodePropertiesTab(node: Node, uiManager: UIManager): HTMLDivElement {
    const container = createHtmlTemplate('<div class="inspect-node-properties-tab"></div>') as HTMLDivElement
    const dlContainer = createHtmlTemplate('<div class="dl-container"></div>') as HTMLDivElement
    if (dlContainer) {
        const properties = nodePropertiesGetter(node, uiManager.getOptions().propertiesPanel)
        dlContainer.append(createHtmlDL(properties, node))
    }

    container.appendChild(dlContainer)
    return container
}

function createNodeJsonTab(node: Node): HTMLDivElement {
    const container = document.createElement('div')
    container.classList.add('inspect-node-json-tab')
    const jsonViewer = createJsonViewer(JSON.parse(JSON.stringify(node.getData())))
    container.appendChild(jsonViewer)

    return container
}

function createInspectModalBody(node: Node, uiManager: UIManager): HTMLDivElement {
    const body = document.createElement('div')
    body.classList.add('inspect-node-modal-body')

    const tabs = createTabs(
        [
            {
                id: 'properties',
                label: 'Properties',
                content: createNodePropertiesTab(node, uiManager),
            },
            {
                id: 'json',
                label: 'JSON',
                content: createNodeJsonTab(node),
            },
        ],
        'properties',
    )
    body.appendChild(tabs)

    return body
}