[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / ExtraPanel

# Interface: ExtraPanel

Defined in: [interfaces/GraphUI.ts:169](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L169)

Additional panel in the graph UI's sidebar.
Currently only displayed when an element is selected

Both `title` and `render` can be:
- A string or `HTMLElement` for static content, or
- A function returning a string or `HTMLElement` for dynamic content based on the current selected node or edge.

## Example

```ts
{
    render: (node: Node): HTMLElement => {
        const div = document.createElement('div')
        div.textContent = node?.description ?? 'Empty node description'
        return div
    },
    title: "My extra panel",
}
```

## Properties

### render

> **render**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:171](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L171)

***

### title

> **title**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:170](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L170)
