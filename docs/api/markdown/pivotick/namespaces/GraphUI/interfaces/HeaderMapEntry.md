[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / HeaderMapEntry

# Interface: HeaderMapEntry\<T\>

Defined in: [interfaces/GraphUI.ts:63](https://github.com/mokaddem/Pivotick/blob/bd0d03b5888228a0656611fab36e6ab7811762a1/src/interfaces/GraphUI.ts#L63)

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

Defined in: [interfaces/GraphUI.ts:65](https://github.com/mokaddem/Pivotick/blob/bd0d03b5888228a0656611fab36e6ab7811762a1/src/interfaces/GraphUI.ts#L65)

***

### title

> **title**: `string` \| (`element`) => `string`

Defined in: [interfaces/GraphUI.ts:64](https://github.com/mokaddem/Pivotick/blob/bd0d03b5888228a0656611fab36e6ab7811762a1/src/interfaces/GraphUI.ts#L64)
