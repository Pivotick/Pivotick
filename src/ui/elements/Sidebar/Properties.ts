import { createHtmlElement, createHtmlTemplate } from "../../../utils/ElementCreation";
import type { Node } from "../../../Node";
import type { Edge } from "../../../Edge";

interface propertyItem {
    name: string,
    value: string,
}

function nodePropertiesGetter(node: Node): Array<propertyItem> {
    const data = node.getData()
    const properties: Array<propertyItem> = []

    for (const[key, value] of Object.entries(data)) {
        properties.push({
            name: key,
            value: value,
        })
    }
    return properties
}

function edgePropertiesGetter(edge: Edge): Array<propertyItem> {
    const data = edge.getData()
    const properties: Array<propertyItem> = []

    for (const [key, value] of Object.entries(data)) {
        properties.push({
            name: key,
            value: value,
        })
    }
    return properties
}

function injectRowForProperties(dl: HTMLDListElement, properties: Array<propertyItem>): void {
    for (const property of properties) {
        const row = createHtmlElement('dl',
            {
                'class': 'pivotick-property-row',
            },
            [
                createHtmlElement('dt', { class: 'pivotick-property-name' }, [property.name]),
                createHtmlElement('dd', { class: 'pivotick-property-value' }, [property.value]),
            ]
        )
        dl.append(row)
    }
}

export function injectNodeProperties(mainBodyPanel: HTMLDivElement | undefined, node: Node, element: any): void {
    if (!mainBodyPanel) return;

    const template = `<div class="pivotick-properties-container">
    <div class="enter-ready">
        <dl></dl>
    </div>
</div>`
    const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
    const dl = propertiesContainer.querySelector("dl");

    if (dl) {
        const properties = nodePropertiesGetter(node)
        injectRowForProperties(dl, properties)
    }

    mainBodyPanel.innerHTML = propertiesContainer.outerHTML
    requestAnimationFrame(() => {
        mainBodyPanel?.firstElementChild?.firstElementChild?.classList.add('enter-active')
    })
}

export function injectEdgeProperties(mainBodyPanel: HTMLDivElement | undefined, edge: Edge, element: any): void {
    if (!mainBodyPanel) return;

    const template = `<div class="pivotick-properties-container">
    <div class="enter-ready">
        <dl></dl>
    </div>
</div>`
    const propertiesContainer = createHtmlTemplate(template) as HTMLDivElement
    const dl = propertiesContainer.querySelector("dl");

    if (dl) {
        const properties = edgePropertiesGetter(edge)
        injectRowForProperties(dl, properties)
    }

    mainBodyPanel.innerHTML = propertiesContainer.outerHTML
    requestAnimationFrame(() => {
        mainBodyPanel?.firstElementChild?.firstElementChild?.classList.add('enter-active')
    })
}


export function clearProperties(mainBodyPanel: HTMLDivElement | undefined): void {
    if (!mainBodyPanel) return;
    mainBodyPanel.innerHTML = ''
}