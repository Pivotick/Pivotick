[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / MainHeader

# Interface: MainHeader

Defined in: [interfaces/GraphUI.ts:43](https://github.com/mokaddem/Pivotick/blob/bd0d03b5888228a0656611fab36e6ab7811762a1/src/interfaces/GraphUI.ts#L43)

Define what should be displayed in the sidebar's main header slot for node or edges.

## Properties

### edgeHeaderMap

> **edgeHeaderMap**: [`HeaderMapEntry`](HeaderMapEntry.md)\<[`Edge`](../../../../classes/Edge.md)\>

Defined in: [interfaces/GraphUI.ts:45](https://github.com/mokaddem/Pivotick/blob/bd0d03b5888228a0656611fab36e6ab7811762a1/src/interfaces/GraphUI.ts#L45)

***

### nodeHeaderMap

> **nodeHeaderMap**: [`HeaderMapEntry`](HeaderMapEntry.md)\<[`Node`](../../../../classes/Node.md)\>

Defined in: [interfaces/GraphUI.ts:44](https://github.com/mokaddem/Pivotick/blob/bd0d03b5888228a0656611fab36e6ab7811762a1/src/interfaces/GraphUI.ts#L44)

***

### render?

> `optional` **render**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:52](https://github.com/mokaddem/Pivotick/blob/bd0d03b5888228a0656611fab36e6ab7811762a1/src/interfaces/GraphUI.ts#L52)

Custom renderer for the main header. This content will override the default sidebar main header.

#### Default

```ts
undefined
```

#### Example

```ts
(element) => `element id: ${element.id}`
```
