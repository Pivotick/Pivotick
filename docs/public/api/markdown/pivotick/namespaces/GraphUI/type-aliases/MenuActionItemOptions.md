[**pivotick v0.0.1**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / MenuActionItemOptions

# Type Alias: MenuActionItemOptions\<TThis\>

> **MenuActionItemOptions**\<`TThis`\> = `object`

Defined in: [interfaces/GraphUI.ts:189](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L189)

Options to define an action item in a menu.
Can be used in contextual menus or multi-select menus.

## Type Parameters

### TThis

`TThis` *extends* [`UIElement`](../../../../interfaces/UIElement.md) = [`UIElement`](../../../../interfaces/UIElement.md)

## Properties

### iconClass?

> `optional` **iconClass**: [`IconClass`](IconClass.md)

Defined in: [interfaces/GraphUI.ts:192](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L192)

***

### iconUnicode?

> `optional` **iconUnicode**: [`IconUnicode`](IconUnicode.md)

Defined in: [interfaces/GraphUI.ts:191](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L191)

Unicode character for the icon (optional)

***

### imagePath?

> `optional` **imagePath**: [`ImagePath`](ImagePath.md)

Defined in: [interfaces/GraphUI.ts:194](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L194)

***

### onclick()

> **onclick**: (`this`, `evt`, `element?`) => `void`

Defined in: [interfaces/GraphUI.ts:202](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L202)

#### Parameters

##### this

`TThis`

##### evt

`PointerEvent` | `MouseEvent`

##### element?

[`Node`](../../../../classes/Node.md) | [`Node`](../../../../classes/Node.md)[] | [`Edge`](../../../../classes/Edge.md) | [`Edge`](../../../../classes/Edge.md)[] | `null`

#### Returns

`void`

***

### svgIcon?

> `optional` **svgIcon**: [`SVGIcon`](SVGIcon.md)

Defined in: [interfaces/GraphUI.ts:193](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L193)

***

### text

> **text**: `string`

Defined in: [interfaces/GraphUI.ts:196](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L196)

Text of the option.

***

### title?

> `optional` **title**: `string`

Defined in: [interfaces/GraphUI.ts:198](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L198)

Title to be shown when hovering over the option.

***

### variant?

> `optional` **variant**: [`UIVariant`](UIVariant.md)

Defined in: [interfaces/GraphUI.ts:200](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L200)

#### Default

```ts
outline-primary
```

***

### visible?

> `optional` **visible**: `boolean` \| (`element`) => `boolean`

Defined in: [interfaces/GraphUI.ts:201](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphUI.ts#L201)
