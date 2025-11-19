[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / MainHeader

# Interface: MainHeader

Defined in: [interfaces/GraphUI.ts:85](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L85)

Define what should be displayed in the sidebar's main header slot for node or edges.

## Properties

### edgeHeaderMap

> **edgeHeaderMap**: [`HeaderMapEntry`](HeaderMapEntry.md)\<[`Edge`](../../../../classes/Edge.md)\>

Defined in: [interfaces/GraphUI.ts:87](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L87)

***

### nodeHeaderMap

> **nodeHeaderMap**: [`HeaderMapEntry`](HeaderMapEntry.md)\<[`Node`](../../../../classes/Node.md)\>

Defined in: [interfaces/GraphUI.ts:86](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L86)

***

### render?

> `optional` **render**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:94](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L94)

Custom renderer for the main header. This content will override the default sidebar main header.

#### Default

```ts
undefined
```

#### Example

```ts
(element) => `element id: ${element.id}`
```
