[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / LabelStyle

# Interface: LabelStyle

Defined in: [interfaces/RendererOptions.ts:257](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L257)

## Properties

### backgroundColor

> **backgroundColor**: `string`

Defined in: [interfaces/RendererOptions.ts:259](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L259)

#### Default

```ts
#ffffff90
```

***

### color

> **color**: `string`

Defined in: [interfaces/RendererOptions.ts:265](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L265)

#### Default

```ts
#333
```

***

### fontFamily

> **fontFamily**: `string`

Defined in: [interfaces/RendererOptions.ts:263](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L263)

#### Default

```ts
system-ui, sans-serif
```

***

### fontSize

> **fontSize**: `number`

Defined in: [interfaces/RendererOptions.ts:261](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L261)

#### Default

```ts
12
```

***

### labelAccessor()?

> `optional` **labelAccessor**: (`edge`) => `string` \| `void` \| `HTMLElement`

Defined in: [interfaces/RendererOptions.ts:267](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L267)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`string` \| `void` \| `HTMLElement`

***

### styleCb()?

> `optional` **styleCb**: (`edge`) => `Partial`\<`LabelStyle`\>

Defined in: [interfaces/RendererOptions.ts:266](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/RendererOptions.ts#L266)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`Partial`\<`LabelStyle`\>
