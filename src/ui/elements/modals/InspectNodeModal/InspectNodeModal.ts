import { Node } from '../../../../Node'
import { createHtmlTemplate } from '../../../../utils/ElementCreation'
import { nodeDescriptionGetter, nodeNameGetter, nodePropertiesGetter } from '../../../../utils/GraphGetters'
import { createPropertyList } from '../../Sidebar/PropertyList'
import { createNodePreview } from '../../../../utils/NodePreview'
import { createJsonViewer, type JsonValue } from '../../../components/JsonViewer'
import type { ModalHTMLElement } from '../../../components/Modal'
import { createTabs } from '../../../components/Tabs'
import type { UIManager } from '../../../UIManager'
import './inspectNodeModal.scss'

export function createInspectModal(node: Node, uiManager: UIManager): void {
    const fixedPreviewSize = 42
    const header = createHtmlTemplate(`
        <div class="main-container">
            <div class="icon-container"></div>
            <div class="nodeinfo-container">
                <div class="nodeinfo-name"></div>
                <div class="nodeinfo-subtitle"></div>
            </div>
        </div>
    `) as HTMLDivElement
    // Label and description are graph data: assign them as text, never interpolate as markup.
    const nameEl = header.querySelector('.nodeinfo-name')
    const subtitleEl = header.querySelector('.nodeinfo-subtitle')
    if (nameEl) nameEl.textContent = nodeNameGetter(node, uiManager.getOptions().mainHeader)
    if (subtitleEl) subtitleEl.textContent = nodeDescriptionGetter(node, uiManager.getOptions().mainHeader) ?? ''
    header.querySelector('.icon-container')?.appendChild(createNodePreview(node, { size: fixedPreviewSize, className: 'icon' }))

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
    const properties = nodePropertiesGetter(node, uiManager.getOptions().propertiesPanel)
    container.appendChild(createPropertyList(properties, node, { layout: 'columns' }))
    return container
}

function createNodeJsonTab(node: Node): HTMLDivElement {
    const container = document.createElement('div')
    container.classList.add('inspect-node-json-tab')
    // The snapshot keeps the tab from reflecting later edits, but a circular `data` bag makes
    // it throw — the viewer guards cycles itself, so fall back to the live object.
    let data = node.getData() as JsonValue
    try {
        data = JSON.parse(JSON.stringify(data))
    } catch {
        // keep the live object
    }
    container.appendChild(createJsonViewer(data))

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