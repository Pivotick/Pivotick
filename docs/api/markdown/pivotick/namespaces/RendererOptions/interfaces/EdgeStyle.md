[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / EdgeStyle

# Interface: EdgeStyle

Defined in: [interfaces/RendererOptions.ts:217](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L217)

## Properties

### animateDash?

> `optional` **animateDash**: `boolean`

Defined in: [interfaces/RendererOptions.ts:235](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L235)

Whether the dash should be animated (e.g., animation moving along the path)
@default: true

***

### curveStyle

> **curveStyle**: [`CurveStyle`](../type-aliases/CurveStyle.md)

Defined in: [interfaces/RendererOptions.ts:225](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L225)

#### Default

```ts
bidirectional
```

***

### dashed?

> `optional` **dashed**: `boolean`

Defined in: [interfaces/RendererOptions.ts:230](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L230)

Whether the stroke is dashed

#### Default

```ts
false
```

***

### markerEnd?

> `optional` **markerEnd**: `string` \| (`edge`) => `string`

Defined in: [interfaces/RendererOptions.ts:245](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L245)

Which end marker should the edge use

#### Default

```ts
arrow
```

***

### markerStart?

> `optional` **markerStart**: `string` \| (`edge`) => `string`

Defined in: [interfaces/RendererOptions.ts:250](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L250)

Which start marker should the edge use

#### Default

```ts
undefined
```

***

### opacity

> **opacity**: `number`

Defined in: [interfaces/RendererOptions.ts:223](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L223)

#### Default

```ts
1.0
```

***

### rotateLabel

> **rotateLabel**: `boolean`

Defined in: [interfaces/RendererOptions.ts:240](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L240)

Keeps labels horizontally aligned to the viewport

#### Default

```ts
false
```

***

### strokeColor

> **strokeColor**: `string`

Defined in: [interfaces/RendererOptions.ts:219](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L219)

#### Default

```ts
'var(--pivotick-edge-color, #999)'
```

***

### strokeWidth

> **strokeWidth**: `number`

Defined in: [interfaces/RendererOptions.ts:221](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L221)

#### Default

```ts
2
```

***

### styleCb()?

> `optional` **styleCb**: (`edge`) => `Partial`\<`EdgeStyle`\>

Defined in: [interfaces/RendererOptions.ts:251](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L251)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`Partial`\<`EdgeStyle`\>
