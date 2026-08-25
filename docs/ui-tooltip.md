
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

## Fetching tooltip content {#async-content}

`render`, `renderNodeExtra`, `renderEdgeExtra`, `nodePropertiesMap` and
`edgePropertiesMap` may all be `async`. The tooltip shows a placeholder while
the promise is pending, swaps the content in when it resolves, and repositions
itself so the grown tooltip stays on screen.

```ts
const options = {
    UI: {
        tooltip: {
            renderNodeExtra: async (node, { signal }) => { // [!code focus:5]
                const res = await fetch(`/enrich/${node.getData().uuid}`, { signal })
                return renderChips(await res.json())
            },
        },
    },
}
```

The tooltip is the surface where this matters most, because it is a **single
reused container** opened behind a 400 ms delay: a fetch started for one node
would otherwise land in a tooltip already describing another. It cannot here —
hovering a second node aborts the first render's `signal` and drops its result,
even if it resolves last. See [asynchronous content](./ui#async-content) for the
full contract and for `UI.asyncContent`, which customises the placeholder.

::: tip Pinning a pending tooltip
Pinning while content is still loading is fine: the copy fills itself in when
the fetch resolves, as long as it hasn't been superseded by another hover first.
:::
