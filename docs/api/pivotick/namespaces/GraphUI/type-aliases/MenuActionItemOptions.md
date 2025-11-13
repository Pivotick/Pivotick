[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / MenuActionItemOptions

# Type Alias: MenuActionItemOptions\<TThis\>

> **MenuActionItemOptions**\<`TThis`\> = `object`

Defined in: [interfaces/GraphUI.ts:165](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L165)

Options to define an action item in a menu.
Can be used in contextual menus or multi-select menus.

## Type Parameters

### TThis

`TThis` *extends* `UIElement` = `UIElement`

## Properties

### iconClass?

> `optional` **iconClass**: [`IconClass`](../../../../type-aliases/IconClass.md)

Defined in: [interfaces/GraphUI.ts:168](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L168)

***

### iconUnicode?

> `optional` **iconUnicode**: [`IconUnicode`](../../../../type-aliases/IconUnicode.md)

Defined in: [interfaces/GraphUI.ts:167](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L167)

Unicode character for the icon (optional)

***

### imagePath?

> `optional` **imagePath**: [`ImagePath`](../../../../type-aliases/ImagePath.md)

Defined in: [interfaces/GraphUI.ts:170](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L170)

***

### onclick()

> **onclick**: (`this`, `evt`, `element?`) => `void`

Defined in: [interfaces/GraphUI.ts:175](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L175)

#### Parameters

##### this

`TThis`

##### evt

`PointerEvent` | `MouseEvent`

##### element?

[`Node`](../../Node/classes/Node.md) | [`Node`](../../Node/classes/Node.md)[] | [`Edge`](../../Edge/classes/Edge.md) | [`Edge`](../../Edge/classes/Edge.md)[] | `null`

#### Returns

`void`

***

### svgIcon?

> `optional` **svgIcon**: [`SVGIcon`](../../../../type-aliases/SVGIcon.md)

Defined in: [interfaces/GraphUI.ts:169](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L169)

***

### text?

> `optional` **text**: `string`

Defined in: [interfaces/GraphUI.ts:171](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L171)

***

### title

> **title**: `string`

Defined in: [interfaces/GraphUI.ts:172](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L172)

***

### variant

> **variant**: [`UIVariant`](../../../../type-aliases/UIVariant.md)

Defined in: [interfaces/GraphUI.ts:173](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L173)

***

### visible

> **visible**: `boolean` \| (`element`) => `boolean`

Defined in: [interfaces/GraphUI.ts:174](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L174)
