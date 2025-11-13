[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / EdgeStyle

# Interface: EdgeStyle

Defined in: [interfaces/RendererOptions.ts:210](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L210)

## Properties

### animateDash?

> `optional` **animateDash**: `boolean`

Defined in: [interfaces/RendererOptions.ts:228](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L228)

Whether the dash should be animated (e.g., animation moving along the path)
@default: true

***

### curveStyle

> **curveStyle**: [`CurveStyle`](../type-aliases/CurveStyle.md)

Defined in: [interfaces/RendererOptions.ts:218](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L218)

#### Default

```ts
bidirectional
```

***

### dashed?

> `optional` **dashed**: `boolean`

Defined in: [interfaces/RendererOptions.ts:223](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L223)

Whether the stroke is dashed

#### Default

```ts
false
```

***

### markerEnd?

> `optional` **markerEnd**: `string` \| (`edge`) => `string`

Defined in: [interfaces/RendererOptions.ts:238](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L238)

Which end marker should the edge use

#### Default

```ts
arrow
```

***

### markerStart?

> `optional` **markerStart**: `string` \| (`edge`) => `string`

Defined in: [interfaces/RendererOptions.ts:243](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L243)

Which start marker should the edge use

#### Default

```ts
undefined
```

***

### opacity

> **opacity**: `number`

Defined in: [interfaces/RendererOptions.ts:216](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L216)

#### Default

```ts
1.0
```

***

### rotateLabel

> **rotateLabel**: `boolean`

Defined in: [interfaces/RendererOptions.ts:233](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L233)

Keeps labels horizontally aligned to the viewport

#### Default

```ts
false
```

***

### strokeColor

> **strokeColor**: `string`

Defined in: [interfaces/RendererOptions.ts:212](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L212)

#### Default

```ts
'var(--pivotick-edge-color, #999)'
```

***

### strokeWidth

> **strokeWidth**: `number`

Defined in: [interfaces/RendererOptions.ts:214](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L214)

#### Default

```ts
2
```

***

### styleCb()?

> `optional` **styleCb**: (`edge`) => `Partial`\<`EdgeStyle`\>

Defined in: [interfaces/RendererOptions.ts:244](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L244)

#### Parameters

##### edge

[`Edge`](../../Edge/classes/Edge.md)

#### Returns

`Partial`\<`EdgeStyle`\>
