[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / LabelStyle

# Interface: LabelStyle

Defined in: [interfaces/RendererOptions.ts:261](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/RendererOptions.ts#L261)

## Properties

### backgroundColor

> **backgroundColor**: `string`

Defined in: [interfaces/RendererOptions.ts:263](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/RendererOptions.ts#L263)

#### Default

```ts
#ffffff90
```

***

### color

> **color**: `string`

Defined in: [interfaces/RendererOptions.ts:269](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/RendererOptions.ts#L269)

#### Default

```ts
#333
```

***

### fontFamily

> **fontFamily**: `string`

Defined in: [interfaces/RendererOptions.ts:267](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/RendererOptions.ts#L267)

#### Default

```ts
system-ui, sans-serif
```

***

### fontSize

> **fontSize**: `number`

Defined in: [interfaces/RendererOptions.ts:265](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/RendererOptions.ts#L265)

#### Default

```ts
12
```

***

### labelAccessor()?

> `optional` **labelAccessor**: (`edge`) => `string` \| `void` \| `HTMLElement`

Defined in: [interfaces/RendererOptions.ts:271](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/RendererOptions.ts#L271)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`string` \| `void` \| `HTMLElement`

***

### styleCb()?

> `optional` **styleCb**: (`edge`) => `Partial`\<`LabelStyle`\>

Defined in: [interfaces/RendererOptions.ts:270](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/RendererOptions.ts#L270)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`Partial`\<`LabelStyle`\>
