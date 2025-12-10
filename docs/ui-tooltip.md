
# Tooltips {#ui-tooltip}
The [tooltip menu options](/api/html/interfaces/GraphUI.Tooltip.html) configure default and custom tooltips for nodes and edges.

**By default:**
- Tooltips are enabled.
- Node and edge titles/subtitles come from their respective header maps.
- Properties come from the node/edge property maps.

## Disabling tooltips
Pretty straightforward by setting the `enabled` property to `false`.

```ts [Disable tooltips]
const options = {
    UI: {
        tooltip: { // [!code focus:3]
            enabled: false
        }
    }
}
```

## Header mapping
Similar to the mapping done in the sidebar's [main header](/ui-sidebar#main-header-interface), you can provide mapping for the tooltip's header for both nodes and edges.

::: code-group

```ts [Mapping for node and edge]
const options = {
    UI: {
        tooltip: {  // [!code focus:10]
            nodeHeaderMap: {
                title: node => `Node ${node.id}`,
                subtitle: node => node.data.description ?? ''
            },
            edgeHeaderMap: {
                title: edge => `Edge ${edge.from} → ${edge.to}`,
                subtitle: edge => edge.data.label ?? ''
            }
        }
    }
}
```
:::


## Extra content

Similar to the sidebar's [extra content](/ui-sidebar#extra-panels-interface), you can define additional content to be appened at the end of the tooltip.

::: code-group

```ts [Extra content]
const options = {
    UI: {
        tooltip: { // [!code focus:8]
            renderNodeExtra: (node) => {
                const div = document.createElement('div')
                div.textContent = `Type: ${node.data.type ?? 'Unknown'}`
                return div
            },
            renderEdgeExtra: (edge) => `Weight: ${edge.data.weight ?? '0'}`
        }
    }
}
```
:::


## Custom rendering
Finally, you can completly override a tooltip's content using the `render` function.

::: code-group

```ts [Custom tooltip]
const options = {
    UI: {
        tooltip: {
            render: (element) => {
                const div = document.createElement('div')
                div.textContent = `Element ID: ${element.id}`
                div.style.fontWeight = 'bold'
                return div
            }
        }
    }
}
```
:::
