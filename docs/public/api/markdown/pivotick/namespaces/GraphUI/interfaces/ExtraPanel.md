[**pivotick v0.0.1**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / ExtraPanel

# Interface: ExtraPanel

Defined in: [interfaces/GraphUI.ts:127](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L127)

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

### alwaysVisible?

> `optional` **alwaysVisible**: `boolean`

Defined in: [interfaces/GraphUI.ts:134](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L134)

should the panel be always visible

#### Default

```ts
false
```

***

### render

> **render**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:129](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L129)

***

### title

> **title**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:128](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L128)
