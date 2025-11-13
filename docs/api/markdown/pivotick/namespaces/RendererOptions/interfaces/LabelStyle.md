[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / LabelStyle

# Interface: LabelStyle

Defined in: [interfaces/RendererOptions.ts:254](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L254)

## Properties

### backgroundColor

> **backgroundColor**: `string`

Defined in: [interfaces/RendererOptions.ts:256](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L256)

#### Default

```ts
#ffffff90
```

***

### color

> **color**: `string`

Defined in: [interfaces/RendererOptions.ts:262](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L262)

#### Default

```ts
#333
```

***

### fontFamily

> **fontFamily**: `string`

Defined in: [interfaces/RendererOptions.ts:260](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L260)

#### Default

```ts
system-ui, sans-serif
```

***

### fontSize

> **fontSize**: `number`

Defined in: [interfaces/RendererOptions.ts:258](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L258)

#### Default

```ts
12
```

***

### labelAccessor()?

> `optional` **labelAccessor**: (`edge`) => `string` \| `void` \| `HTMLElement`

Defined in: [interfaces/RendererOptions.ts:264](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L264)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`string` \| `void` \| `HTMLElement`

***

### styleCb()?

> `optional` **styleCb**: (`edge`) => `Partial`\<`LabelStyle`\>

Defined in: [interfaces/RendererOptions.ts:263](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/RendererOptions.ts#L263)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`Partial`\<`LabelStyle`\>
