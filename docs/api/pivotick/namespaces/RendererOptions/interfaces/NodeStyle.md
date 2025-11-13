[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / NodeStyle

# Interface: NodeStyle

Defined in: [interfaces/RendererOptions.ts:158](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L158)

## Properties

### color

> **color**: `string`

Defined in: [interfaces/RendererOptions.ts:168](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L168)

The main color of the node

#### Default

```ts
'var(--pivotick-node-color, #007acc)'
```

***

### fontFamily

> **fontFamily**: `string`

Defined in: [interfaces/RendererOptions.ts:176](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L176)

#### Default

```ts
'var(--pivotick-label-font, system-ui, sans-serif)'
```

***

### iconClass?

> `optional` **iconClass**: `string`

Defined in: [interfaces/RendererOptions.ts:179](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L179)

***

### iconUnicode?

> `optional` **iconUnicode**: `string`

Defined in: [interfaces/RendererOptions.ts:180](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L180)

***

### imagePath?

> `optional` **imagePath**: `string`

Defined in: [interfaces/RendererOptions.ts:182](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L182)

***

### shape

> **shape**: [`NodeShape`](../type-aliases/NodeShape.md)

Defined in: [interfaces/RendererOptions.ts:163](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L163)

The shape of the node, either a standard shape or a custom SVG path

#### Default

```ts
circle
```

***

### size

> **size**: `number`

Defined in: [interfaces/RendererOptions.ts:170](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L170)

#### Default

```ts
10
```

***

### strokeColor

> **strokeColor**: `string`

Defined in: [interfaces/RendererOptions.ts:172](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L172)

#### Default

```ts
'var(--pivotick-node-stroke, #fff)'
```

***

### strokeWidth

> **strokeWidth**: `number`

Defined in: [interfaces/RendererOptions.ts:174](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L174)

#### Default

```ts
2
```

***

### styleCb()?

> `optional` **styleCb**: (`node`) => `Partial`\<`NodeStyle`\>

Defined in: [interfaces/RendererOptions.ts:190](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L190)

Callback to dynamically override style properties based on the node.

#### Parameters

##### node

[`Node`](../../Node/classes/Node.md)

#### Returns

`Partial`\<`NodeStyle`\>

***

### svgIcon?

> `optional` **svgIcon**: `string`

Defined in: [interfaces/RendererOptions.ts:181](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L181)

***

### text?

> `optional` **text**: `string`

Defined in: [interfaces/RendererOptions.ts:186](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L186)

The text to be used inside the node as an `SVGText` element

***

### textColor

> **textColor**: `string`

Defined in: [interfaces/RendererOptions.ts:178](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L178)

#### Default

```ts
'var(--pivotick-node-text-color, #fff)'
```
