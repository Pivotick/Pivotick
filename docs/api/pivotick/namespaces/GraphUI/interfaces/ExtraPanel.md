[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / ExtraPanel

# Interface: ExtraPanel

Defined in: [interfaces/GraphUI.ts:156](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L156)

Additional panel in the graph UI's sidebar.
Currently only displayed when an element is selected

Both `title` and `content` can be:
- A string or `HTMLElement` for static content, or
- A function returning a string or `HTMLElement` for dynamic content based on the current selected node or edge.

## Example

```ts
{
    content: (node: Node): HTMLElement => {
        const div = document.createElement('div')
        div.textContent = node?.description ?? 'Empty node description'
        return div
    },
    title: "My extra panel",
}
```

## Properties

### content

> **content**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:158](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L158)

***

### title

> **title**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:157](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L157)
