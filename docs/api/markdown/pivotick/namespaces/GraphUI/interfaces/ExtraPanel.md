[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / ExtraPanel

# Interface: ExtraPanel

Defined in: [interfaces/GraphUI.ts:127](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L127)

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

Defined in: [interfaces/GraphUI.ts:129](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L129)

***

### title

> **title**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:128](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L128)
