[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / EdgeStyle

# Interface: EdgeStyle

Defined in: [interfaces/RendererOptions.ts:220](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L220)

## Properties

### animateDash?

> `optional` **animateDash**: `boolean`

Defined in: [interfaces/RendererOptions.ts:238](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L238)

Whether the dash should be animated (e.g., animation moving along the path)
@default: true

***

### curveStyle

> **curveStyle**: [`CurveStyle`](../type-aliases/CurveStyle.md)

Defined in: [interfaces/RendererOptions.ts:228](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L228)

#### Default

```ts
bidirectional
```

***

### dashed?

> `optional` **dashed**: `boolean`

Defined in: [interfaces/RendererOptions.ts:233](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L233)

Whether the stroke is dashed

#### Default

```ts
false
```

***

### markerEnd?

> `optional` **markerEnd**: `string` \| (`edge`) => `string`

Defined in: [interfaces/RendererOptions.ts:248](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L248)

Which end marker should the edge use

#### Default

```ts
arrow
```

***

### markerStart?

> `optional` **markerStart**: `string` \| (`edge`) => `string`

Defined in: [interfaces/RendererOptions.ts:253](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L253)

Which start marker should the edge use

#### Default

```ts
undefined
```

***

### opacity

> **opacity**: `number`

Defined in: [interfaces/RendererOptions.ts:226](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L226)

#### Default

```ts
1.0
```

***

### rotateLabel

> **rotateLabel**: `boolean`

Defined in: [interfaces/RendererOptions.ts:243](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L243)

Keeps labels horizontally aligned to the viewport

#### Default

```ts
false
```

***

### strokeColor

> **strokeColor**: `string`

Defined in: [interfaces/RendererOptions.ts:222](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L222)

#### Default

```ts
'var(--pivotick-edge-color, #999)'
```

***

### strokeWidth

> **strokeWidth**: `number`

Defined in: [interfaces/RendererOptions.ts:224](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L224)

#### Default

```ts
2
```

***

### styleCb()?

> `optional` **styleCb**: (`edge`) => `Partial`\<`EdgeStyle`\>

Defined in: [interfaces/RendererOptions.ts:254](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L254)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`Partial`\<`EdgeStyle`\>
