[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / HeaderMapEntry

# Interface: HeaderMapEntry\<T\>

Defined in: [interfaces/GraphUI.ts:105](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L105)

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

Defined in: [interfaces/GraphUI.ts:107](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L107)

***

### title

> **title**: `string` \| (`element`) => `string`

Defined in: [interfaces/GraphUI.ts:106](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L106)
