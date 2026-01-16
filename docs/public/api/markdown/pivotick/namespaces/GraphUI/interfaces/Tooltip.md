[**pivotick v0.0.1**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / Tooltip

# Interface: Tooltip

Defined in: [interfaces/GraphUI.ts:137](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L137)

## Properties

### edgeHeaderMap

> **edgeHeaderMap**: `Partial`\<[`HeaderMapEntry`](HeaderMapEntry.md)\<[`Edge`](../../../../classes/Edge.md)\>\>

Defined in: [interfaces/GraphUI.ts:150](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L150)

***

### edgePropertiesMap()

> **edgePropertiesMap**: (`edge`) => [`PropertyEntry`](PropertyEntry.md)[]

Defined in: [interfaces/GraphUI.ts:152](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L152)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

[`PropertyEntry`](PropertyEntry.md)[]

***

### enabled?

> `optional` **enabled**: `boolean`

Defined in: [interfaces/GraphUI.ts:138](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L138)

***

### nodeHeaderMap

> **nodeHeaderMap**: `Partial`\<[`HeaderMapEntry`](HeaderMapEntry.md)\<[`Node`](../../../../classes/Node.md)\>\>

Defined in: [interfaces/GraphUI.ts:149](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L149)

***

### nodePropertiesMap()

> **nodePropertiesMap**: (`node`) => [`PropertyEntry`](PropertyEntry.md)[]

Defined in: [interfaces/GraphUI.ts:151](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L151)

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

[`PropertyEntry`](PropertyEntry.md)[]

***

### render?

> `optional` **render**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:159](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L159)

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

Defined in: [interfaces/GraphUI.ts:148](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L148)

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

Defined in: [interfaces/GraphUI.ts:143](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L143)

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
