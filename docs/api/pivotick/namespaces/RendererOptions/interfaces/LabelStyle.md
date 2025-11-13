[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / LabelStyle

# Interface: LabelStyle

Defined in: [interfaces/RendererOptions.ts:247](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L247)

## Properties

### backgroundColor

> **backgroundColor**: `string`

Defined in: [interfaces/RendererOptions.ts:249](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L249)

#### Default

```ts
#ffffff90
```

***

### color

> **color**: `string`

Defined in: [interfaces/RendererOptions.ts:255](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L255)

#### Default

```ts
#333
```

***

### fontFamily

> **fontFamily**: `string`

Defined in: [interfaces/RendererOptions.ts:253](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L253)

#### Default

```ts
system-ui, sans-serif
```

***

### fontSize

> **fontSize**: `number`

Defined in: [interfaces/RendererOptions.ts:251](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L251)

#### Default

```ts
12
```

***

### labelAccessor()?

> `optional` **labelAccessor**: (`edge`) => `string` \| `void` \| `HTMLElement`

Defined in: [interfaces/RendererOptions.ts:257](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L257)

#### Parameters

##### edge

[`Edge`](../../Edge/classes/Edge.md)

#### Returns

`string` \| `void` \| `HTMLElement`

***

### styleCb()?

> `optional` **styleCb**: (`edge`) => `Partial`\<`LabelStyle`\>

Defined in: [interfaces/RendererOptions.ts:256](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L256)

#### Parameters

##### edge

[`Edge`](../../Edge/classes/Edge.md)

#### Returns

`Partial`\<`LabelStyle`\>
