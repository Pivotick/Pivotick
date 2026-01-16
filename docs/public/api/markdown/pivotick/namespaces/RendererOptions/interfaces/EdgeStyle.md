[**pivotick v0.0.1**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / EdgeStyle

# Interface: EdgeStyle

Defined in: [interfaces/RendererOptions.ts:224](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/RendererOptions.ts#L224)

## Properties

### animateDash?

> `optional` **animateDash**: `boolean`

Defined in: [interfaces/RendererOptions.ts:242](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/RendererOptions.ts#L242)

Whether the dash should be animated (e.g., animation moving along the path)
@default: true

***

### curveStyle

> **curveStyle**: [`CurveStyle`](../type-aliases/CurveStyle.md)

Defined in: [interfaces/RendererOptions.ts:232](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/RendererOptions.ts#L232)

#### Default

```ts
bidirectional
```

***

### dashed?

> `optional` **dashed**: `boolean` \| (`edge`) => `boolean`

Defined in: [interfaces/RendererOptions.ts:237](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/RendererOptions.ts#L237)

Whether the stroke is dashed

#### Default

```ts
false
```

***

### markerEnd?

> `optional` **markerEnd**: `string` \| (`edge`) => `string`

Defined in: [interfaces/RendererOptions.ts:252](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/RendererOptions.ts#L252)

Which end marker should the edge use

#### Default

```ts
arrow
```

***

### markerStart?

> `optional` **markerStart**: `string` \| (`edge`) => `string`

Defined in: [interfaces/RendererOptions.ts:257](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/RendererOptions.ts#L257)

Which start marker should the edge use

#### Default

```ts
undefined
```

***

### opacity

> **opacity**: `number`

Defined in: [interfaces/RendererOptions.ts:230](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/RendererOptions.ts#L230)

#### Default

```ts
1.0
```

***

### rotateLabel

> **rotateLabel**: `boolean`

Defined in: [interfaces/RendererOptions.ts:247](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/RendererOptions.ts#L247)

Keeps labels horizontally aligned to the viewport

#### Default

```ts
false
```

***

### strokeColor

> **strokeColor**: `string`

Defined in: [interfaces/RendererOptions.ts:226](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/RendererOptions.ts#L226)

#### Default

```ts
'var(--pvt-edge-stroke, #999)'
```

***

### strokeWidth

> **strokeWidth**: `number`

Defined in: [interfaces/RendererOptions.ts:228](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/RendererOptions.ts#L228)

#### Default

```ts
2
```

***

### styleCb()?

> `optional` **styleCb**: (`edge`) => `Partial`\<`EdgeStyle`\>

Defined in: [interfaces/RendererOptions.ts:258](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/RendererOptions.ts#L258)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`Partial`\<`EdgeStyle`\>
