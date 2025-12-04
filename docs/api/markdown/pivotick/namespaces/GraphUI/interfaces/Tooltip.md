[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / Tooltip

# Interface: Tooltip

Defined in: [interfaces/GraphUI.ts:132](https://github.com/mokaddem/Pivotick/blob/84c67603cf50dc0f96efd867f2d2a3762ebfc09a/src/interfaces/GraphUI.ts#L132)

## Properties

### edgeHeaderMap

> **edgeHeaderMap**: `Partial`\<[`HeaderMapEntry`](HeaderMapEntry.md)\<[`Edge`](../../../../classes/Edge.md)\>\>

Defined in: [interfaces/GraphUI.ts:145](https://github.com/mokaddem/Pivotick/blob/84c67603cf50dc0f96efd867f2d2a3762ebfc09a/src/interfaces/GraphUI.ts#L145)

***

### edgePropertiesMap()

> **edgePropertiesMap**: (`edge`) => [`PropertyEntry`](PropertyEntry.md)[]

Defined in: [interfaces/GraphUI.ts:147](https://github.com/mokaddem/Pivotick/blob/84c67603cf50dc0f96efd867f2d2a3762ebfc09a/src/interfaces/GraphUI.ts#L147)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

[`PropertyEntry`](PropertyEntry.md)[]

***

### enabled?

> `optional` **enabled**: `boolean`

Defined in: [interfaces/GraphUI.ts:133](https://github.com/mokaddem/Pivotick/blob/84c67603cf50dc0f96efd867f2d2a3762ebfc09a/src/interfaces/GraphUI.ts#L133)

***

### nodeHeaderMap

> **nodeHeaderMap**: `Partial`\<[`HeaderMapEntry`](HeaderMapEntry.md)\<[`Node`](../../../../classes/Node.md)\>\>

Defined in: [interfaces/GraphUI.ts:144](https://github.com/mokaddem/Pivotick/blob/84c67603cf50dc0f96efd867f2d2a3762ebfc09a/src/interfaces/GraphUI.ts#L144)

***

### nodePropertiesMap()

> **nodePropertiesMap**: (`node`) => [`PropertyEntry`](PropertyEntry.md)[]

Defined in: [interfaces/GraphUI.ts:146](https://github.com/mokaddem/Pivotick/blob/84c67603cf50dc0f96efd867f2d2a3762ebfc09a/src/interfaces/GraphUI.ts#L146)

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

[`PropertyEntry`](PropertyEntry.md)[]

***

### render?

> `optional` **render**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:154](https://github.com/mokaddem/Pivotick/blob/84c67603cf50dc0f96efd867f2d2a3762ebfc09a/src/interfaces/GraphUI.ts#L154)

Custom renderer for the tooltip. This content will override the default tooltip

#### Default

```ts
undefined
```

#### Example

```ts
(element) => `element id: ${element.id}`
```

***

### renderEdgeExtra()?

> `optional` **renderEdgeExtra**: (`edge`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:143](https://github.com/mokaddem/Pivotick/blob/84c67603cf50dc0f96efd867f2d2a3762ebfc09a/src/interfaces/GraphUI.ts#L143)

Custom renderer for edge tooltips. This content is added after the default tooltip

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`string` \| `HTMLElement`

#### Default

```ts
undefined
```

***

### renderNodeExtra()?

> `optional` **renderNodeExtra**: (`node`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:138](https://github.com/mokaddem/Pivotick/blob/84c67603cf50dc0f96efd867f2d2a3762ebfc09a/src/interfaces/GraphUI.ts#L138)

Custom renderer for node tooltips. This content is added after the default tooltip

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`string` \| `HTMLElement`

#### Default

```ts
undefined
```
