[**pivotick v0.0.1**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / MainHeader

# Interface: MainHeader

Defined in: [interfaces/GraphUI.ts:43](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L43)

Define what should be displayed in the sidebar's main header slot for node or edges.

## Properties

### edgeHeaderMap

> **edgeHeaderMap**: [`HeaderMapEntry`](HeaderMapEntry.md)\<[`Edge`](../../../../classes/Edge.md)\>

Defined in: [interfaces/GraphUI.ts:45](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L45)

***

### nodeHeaderMap

> **nodeHeaderMap**: [`HeaderMapEntry`](HeaderMapEntry.md)\<[`Node`](../../../../classes/Node.md)\>

Defined in: [interfaces/GraphUI.ts:44](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L44)

***

### render?

> `optional` **render**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:52](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L52)

Custom renderer for the main header. This content will override the default sidebar main header.

#### Default

```ts
undefined
```

#### Example

```ts
(element) => `element id: ${element.id}`
```
