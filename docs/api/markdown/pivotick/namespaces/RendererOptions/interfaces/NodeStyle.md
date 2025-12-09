[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / NodeStyle

# Interface: NodeStyle

Defined in: [interfaces/RendererOptions.ts:172](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L172)

## Properties

### color

> **color**: `string`

Defined in: [interfaces/RendererOptions.ts:182](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L182)

The main color of the node

#### Default

```ts
'var(--pvt-node-color, #007acc)'
```

***

### fontFamily

> **fontFamily**: `string`

Defined in: [interfaces/RendererOptions.ts:190](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L190)

#### Default

```ts
'var(--pvt-label-font, system-ui, sans-serif)'
```

***

### iconClass?

> `optional` **iconClass**: `string`

Defined in: [interfaces/RendererOptions.ts:193](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L193)

***

### iconUnicode?

> `optional` **iconUnicode**: `string`

Defined in: [interfaces/RendererOptions.ts:194](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L194)

***

### imagePath?

> `optional` **imagePath**: `string`

Defined in: [interfaces/RendererOptions.ts:196](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L196)

***

### shape

> **shape**: [`NodeShape`](../type-aliases/NodeShape.md)

Defined in: [interfaces/RendererOptions.ts:177](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L177)

The shape of the node, either a standard shape or a custom SVG path

#### Default

```ts
circle
```

***

### size

> **size**: `number`

Defined in: [interfaces/RendererOptions.ts:184](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L184)

#### Default

```ts
10
```

***

### strokeColor

> **strokeColor**: `string`

Defined in: [interfaces/RendererOptions.ts:186](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L186)

#### Default

```ts
'var(--pvt-node-stroke, #fff)'
```

***

### strokeWidth

> **strokeWidth**: `number`

Defined in: [interfaces/RendererOptions.ts:188](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L188)

#### Default

```ts
2
```

***

### styleCb()?

> `optional` **styleCb**: (`node`) => `Partial`\<`NodeStyle`\>

Defined in: [interfaces/RendererOptions.ts:204](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L204)

Callback to dynamically override style properties based on the node.

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`Partial`\<`NodeStyle`\>

***

### svgIcon?

> `optional` **svgIcon**: `string`

Defined in: [interfaces/RendererOptions.ts:195](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L195)

***

### text?

> `optional` **text**: `string`

Defined in: [interfaces/RendererOptions.ts:200](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L200)

The text to be used inside the node as an `SVGText` element

***

### textColor

> **textColor**: `string`

Defined in: [interfaces/RendererOptions.ts:192](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/RendererOptions.ts#L192)

#### Default

```ts
'var(--pvt-node-text-color, #fff)'
```
