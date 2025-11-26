---
outline: [2, 3]
---

<script setup>
    import { data as dataUISidebarRendering, options as optionUISidebarRendering } from './examples/configuration/ui-sidebar-rendering.js'
</script>

# Sidebar Options
The sidebar can be collapsed by default depending on screen size or user preference.

Determines whether the sidebar is collapsed by default.  

- `'auto'` <Badge type="warning" text="default" />: Keeps the sidebar open unless there isn't enough screen space, in which case it collapses automatically.
- `true` Sidebar starts collapsed.
- `false` Sidebar starts expanded.

The sidebar displays contextual information for graph elements. It has three customizable components:
- <span style="color: darkred;">**Main Header**</span> as [`mainHeader`](docs/api/html/interfaces/GraphUI.MainHeader.html)
- <span style="color: darkred;">**Properties Panel**</span> as [`propertiesPanel`](docs/api/html/interfaces/GraphUI.PropertiesPanel.html)
- <span style="color: darkred;">**Extra Panels**</span> as [`extraPanels`](docs/api/html/interfaces/GraphUI.ExtraPanel.html)


<Pivotick
    :data="dataUISidebarRendering"
    :options="optionUISidebarRendering"
    :onMountedCallback="(graphContainer) => {
        graphContainer.querySelector('.pivotick-canvas-container').style.filter = 'blur(0.095rem)'
        graphContainer.querySelector('.pivotick-canvas-container').style.opacity = '0.2'
        graphContainer.querySelector('.pivotick-toolbar-container').style.filter = 'blur(0.095rem)'
        graphContainer.querySelector('.pivotick-toolbar-container').style.opacity = '0.2'
    }"
    :onLoadedCallback="(graph) => {
        graph.selectElement(graph.getNodes()[0])
    }"
    style="
        border: 1px solid var(--vp-c-gray-1);
        box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px;
        position: relative;
        height: 400px;"
></Pivotick>


::: details Click to see the code
<<< @/examples/configuration/ui-sidebar-rendering.js#uioptions
:::

## Main Header <sup>[interface](docs/api/html/interfaces/GraphUI.MainHeader.html)</sup>
Shows a concise summary of the selected node or edge, such as title and subtitle. It helps users quickly identify the current selected element.

The main header panel can be customized through mapping functions. The default mapping for a node is
```ts
{
    title:    node => node.data.label ?? "Could not resolve title"
    subtitle: node => node.data.description ?? ""
}
```

You can change this mapping by overriding the parts you need:

::: code-group

```ts [Mapping for nodes]
const options = {
    UI: {
        mainHeader: {
            nodeHeaderMap: {
                title: node => `Node ${node.id}`,
                subtitle: node => node.data.type ?? "",
            }
        }
    }
}
```

```ts [Mapping for edges]
const options = {
    UI: {
        mainHeader: {
            edgeHeaderMap: {
                title: node => `Node ${node.id}`,
                subtitle: node => node.data.type ?? "",
            }
        }
    }
}
```

```ts [Custom rendering]
const options = {
    UI: {
        mainHeader: {
            render: (element) => {
                const div = document.createElement('div')
                div.textContent = 'Main Header'
                return div 
            }
        }
    }
}
```

:::

::: warning
When `render()` is provided, Pivotick skips all default mapping logic.
:::

## Properties Panel <sup>[interface](docs/api/html/interfaces/GraphUI.PropertiesPanel.html)</sup>
Displays detailed properties of the selected node or edge in the sidebar. Each property has a name and value that can be static or computed dynamically.

The default behavior is to show all key/value pairs from the node or edge's [`getData()`](docs/api/html/classes/Node.html#getdata).

You can customize which properties are displayed and how they are rendered using mapping functions (`nodePropertiesMap` and `edgePropertiesMap`) or a full custom renderer.

::: code-group

```ts [Mapping for node]
const options = {
    UI: {
        propertiesPanel: {
            nodePropertiesMap: (node: Node) => {
                return [
                    {
                        name: 'Node ID',
                        value: node.id,
                    },
                    {
                        name: (node) => `Type of node`,
                        value: (node) => el ? el.type : 'Unknown'
                    },
                    {
                        name: 'Custom HTML',
                        value: document.createElement('div')
                    }
                ]
            }
        }
    }
}
```

```ts [Mapping for edge]
const options = {
    UI: {
        propertiesPanel: {
            edgePropertiesMap: (node: Node) => {
                return [
                    {
                        name: 'Edge ID',
                        value: node.id,
                    },
                    {
                        name: (node) => `Type of edge`,
                        value: (node) => el ? el.type : 'Unknown'
                    },
                    {
                        name: 'Custom HTML',
                        value: document.createElement('div')
                    }
                ]
            }
        }
    }
}
```

```ts [Custom rendering for node]
const options = {
    UI: {
        propertiesPanel: {
            render: (element: Node | Edge | Node[] | Edge[] | null) => {
                const div = document.createElement('div')
                div.textContent = `Element ID: ${element?.id}`
                div.style.fontWeight = 'bold'
                return div
            }
        }
    }
}
```

```ts [(default for node)]
const options = {
    UI: {
        propertiesPanel: {
            nodePropertiesMap: (node: Node) => {
                return Object.entries(node.getData())
                    .filter(([key, value]) => key && value)
                    .map(([key, value]) => ({ name: key, value }))
            }
        }
    }
}
```

:::


## Extra Panels <sup>[interface](docs/api/html/interfaces/GraphUI.ExtraPanel.html)</sup>
Allows adding fully custom panels with dynamic or static content. These panels are ideal for showing additional contextual information, custom controls, or interactive widgets related to the selected element.

Each extra panel has a `title` and a `render()` function, both of which can be static (string/HTMLElement) or dynamic (function returning string/HTMLElement).

::: code-group

```ts [Static content]
const options = {
    UI: {
        extraPanels: [
            {
                title: "Info",
                render: "This is a static extra panel content"
            }
        ]
    }
}
```

```ts [Dynamic content]
const options = {
    UI: {
        extraPanels: [
            {
                title: (node) => `Node #${node?.id}`,
                render: (node) => {
                    const div = document.createElement('div')
                    div.textContent = node?.description ?? 'No description'
                    return div
                }
            }
        ]
    }
}
```
:::
