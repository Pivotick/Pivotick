[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / HeaderMapEntry

# Interface: HeaderMapEntry\<T\>

Defined in: [interfaces/GraphUI.ts:99](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L99)

Mapping functions to extract a node/edge's title and subtitle.

Example for node. Replace with edge for edge mapping.

## Default

```ts
title   = node.getData().label || "Could not resolve title"
subtitle= node.getData().description || "Could not resolve subtitle"
```

## Type Parameters

### T

`T` *extends* [`Node`](../../Node/classes/Node.md) \| [`Edge`](../../Edge/classes/Edge.md)

## Properties

### subtitle

> **subtitle**: `string` \| (`element`) => `string`

Defined in: [interfaces/GraphUI.ts:101](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L101)

***

### title

> **title**: `string` \| (`element`) => `string`

Defined in: [interfaces/GraphUI.ts:100](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L100)
