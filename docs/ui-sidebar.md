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
- <span style="color: darkred;">**Main Header**</span> as [`mainHeader`](/api/html/interfaces/GraphUI.MainHeader.html)
- <span style="color: darkred;">**Properties Panel**</span> as [`propertiesPanel`](/api/html/interfaces/GraphUI.PropertiesPanel.html)
- <span style="color: darkred;">**Extra Panels**</span> as [`extraPanels`](/api/html/interfaces/GraphUI.ExtraPanel.html)


<Pivotick
    :data="dataUISidebarRendering"
    :options="optionUISidebarRendering"
    :onMountedCallback="(graphContainer) => {
        const selectors = ['.pvt-canvas', '.pvt-mainheader', '.pvt-moderail', '.pvt-toolpanel', '.pvt-graphnavigation']
        selectors.forEach((selector) => {
            const el = graphContainer.querySelector(selector)
            if (!el) return
            el.style.filter = 'blur(0.095rem)'
            el.style.opacity = '0.2'
            el.style.pointerEvents = 'none'
        })
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

## Main Header <sup>[interface](/api/html/interfaces/GraphUI.MainHeader.html)</sup>
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

## Properties Panel <sup>[interface](/api/html/interfaces/GraphUI.PropertiesPanel.html)</sup>
Displays detailed properties of the selected node or edge in the sidebar. Each property has a name and value that can be static or computed dynamically.

The default behavior is to show all key/value pairs from the node or edge's [`getData()`](/api/html/classes/Node.html#getdata).

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


## Extra Panels <sup>[interface](/api/html/interfaces/GraphUI.ExtraPanel.html)</sup>
Allows adding fully custom panels with dynamic or static content. These panels are ideal for showing additional contextual information, custom controls, or interactive widgets related to the selected element.

Each extra panel has an optional `title` and a `render()`, both of which can be static (string/HTMLElement) or a function of the current selection. A returned `string` renders as **text**; return an `HTMLElement` to render your own markup.

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
// The selection is a Node, an Edge, an array of either, or null — this example
// only cares about a single element:
const single = (element) => (element && !Array.isArray(element)) ? element : null

const options = {
    UI: {
        extraPanels: [
            {
                // Both are called with the live selection, on every selection change.
                title: (element) => single(element) ? `Node #${single(element).id}` : 'Nothing selected',
                render: (element) => {
                    const div = document.createElement('div')
                    div.textContent = single(element)?.getData().description ?? 'No description'
                    return div
                }
            }
        ]
    }
}
```
:::

### The selection a panel is rendered with

`title` and `render` are re-invoked on **every selection change**, with what is currently selected:

| Selection | Argument |
| --- | --- |
| One node / one edge | the [`Node`](/api/html/classes/Node.html) or [`Edge`](/api/html/classes/Edge.html) |
| Several nodes / edges | a `Node[]` / `Edge[]` |
| Nothing selected | `null` |

A panel is only *shown* while something is selected, unless it sets `alwaysVisible: true` — but a reactive panel is re-rendered either way, so it never holds content describing a stale selection.

Set `reactive: false` for a panel that doesn't describe the selection and is expensive to build: it then renders once, and only an explicit `refreshPanel()` rebuilds it.

### Registering panels at runtime

`UI.extraPanels` is the declarative form of the same registry. Anything you can declare there you can also register — and remove — at any point in the graph's life, through the [`UIManager`](/api/html/classes/UIManager.html):

```ts
const graph = new Pivotick(container, data, options)

// Register a panel that depends on the graph itself. Returns a disposer.
const dispose = graph.UIManager.addPanel({
    id: 'unlinked-items',
    title: 'Unlinked items',
    alwaysVisible: true,
    order: -1,                              // sorts above the option-declared panels
    render: (selection) => tray.render(selection),
})

// Your own data changed (a save landed) rather than the selection —
// ask for a re-render instead of hand-patching the panel's DOM.
graph.UIManager.refreshPanel('unlinked-items')

// Gone for good (equivalent to calling `dispose()`):
graph.UIManager.removePanel('unlinked-items')
```

| Method | |
| --- | --- |
| `addPanel(panel)` | Register a panel; returns a disposer. `id` is auto-generated when omitted. Works before and after the graph is ready, and from a plugin's `install` (as `ctx.addPanel`). |
| `removePanel(id)` | Remove the panel and its DOM. |
| `refreshPanel(id?)` | Re-render one panel, or all of them. Refreshes `reactive: false` panels too. |
| `getPanels()` | The registered panels, in display order. |

Panels sort by `order` (ascending, default `0`) and keep registration order within the same value, so `UI.extraPanels` reads top-to-bottom and runtime panels append after them.

A panel's own `title` / `render` receives a second argument — a handle on itself — so it can drive its own updates without reaching for the graph:

```ts
render: (selection, panel) => {
    const button = document.createElement('button')
    button.textContent = 'Reload'
    button.onclick = () => panel.refresh()   // …or panel.remove()
    return button
}
```

::: tip Sidebar-only
Panels are shown by the sidebar, which exists in `full` mode. Registration succeeds in any mode — the panel simply has nowhere to render until a sidebar does.
:::
