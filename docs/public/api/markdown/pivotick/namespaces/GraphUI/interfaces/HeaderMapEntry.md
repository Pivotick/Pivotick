[**pivotick v0.0.1**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / HeaderMapEntry

# Interface: HeaderMapEntry\<T\>

Defined in: [interfaces/GraphUI.ts:63](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L63)

Mapping functions to extract a node/edge's title and subtitle.

Example for node. Replace with edge for edge mapping.

## Default

```ts
title   = node.getData().label || "Could not resolve title"
subtitle= node.getData().description || "Could not resolve subtitle"
```

## Type Parameters

### T

`T` *extends* [`Node`](../../../../classes/Node.md) \| [`Edge`](../../../../classes/Edge.md)

## Properties

### subtitle

> **subtitle**: `string` \| (`element`) => `string`

Defined in: [interfaces/GraphUI.ts:65](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L65)

***

### title

> **title**: `string` \| (`element`) => `string`

Defined in: [interfaces/GraphUI.ts:64](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L64)
