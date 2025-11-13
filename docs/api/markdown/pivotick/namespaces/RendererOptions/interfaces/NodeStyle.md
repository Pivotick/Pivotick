[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / NodeStyle

# Interface: NodeStyle

Defined in: [interfaces/RendererOptions.ts:165](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L165)

## Properties

### color

> **color**: `string`

Defined in: [interfaces/RendererOptions.ts:175](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L175)

The main color of the node

#### Default

```ts
'var(--pivotick-node-color, #007acc)'
```

***

### fontFamily

> **fontFamily**: `string`

Defined in: [interfaces/RendererOptions.ts:183](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L183)

#### Default

```ts
'var(--pivotick-label-font, system-ui, sans-serif)'
```

***

### iconClass?

> `optional` **iconClass**: `string`

Defined in: [interfaces/RendererOptions.ts:186](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L186)

***

### iconUnicode?

> `optional` **iconUnicode**: `string`

Defined in: [interfaces/RendererOptions.ts:187](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L187)

***

### imagePath?

> `optional` **imagePath**: `string`

Defined in: [interfaces/RendererOptions.ts:189](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L189)

***

### shape

> **shape**: [`NodeShape`](../type-aliases/NodeShape.md)

Defined in: [interfaces/RendererOptions.ts:170](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L170)

The shape of the node, either a standard shape or a custom SVG path

#### Default

```ts
circle
```

***

### size

> **size**: `number`

Defined in: [interfaces/RendererOptions.ts:177](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L177)

#### Default

```ts
10
```

***

### strokeColor

> **strokeColor**: `string`

Defined in: [interfaces/RendererOptions.ts:179](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L179)

#### Default

```ts
'var(--pivotick-node-stroke, #fff)'
```

***

### strokeWidth

> **strokeWidth**: `number`

Defined in: [interfaces/RendererOptions.ts:181](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L181)

#### Default

```ts
2
```

***

### styleCb()?

> `optional` **styleCb**: (`node`) => `Partial`\<`NodeStyle`\>

Defined in: [interfaces/RendererOptions.ts:197](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L197)

Callback to dynamically override style properties based on the node.

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`Partial`\<`NodeStyle`\>

***

### svgIcon?

> `optional` **svgIcon**: `string`

Defined in: [interfaces/RendererOptions.ts:188](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L188)

***

### text?

> `optional` **text**: `string`

Defined in: [interfaces/RendererOptions.ts:193](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L193)

The text to be used inside the node as an `SVGText` element

***

### textColor

> **textColor**: `string`

Defined in: [interfaces/RendererOptions.ts:185](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L185)

#### Default

```ts
'var(--pivotick-node-text-color, #fff)'
```
