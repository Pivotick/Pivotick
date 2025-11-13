[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / MenuActionItemOptions

# Type Alias: MenuActionItemOptions\<TThis\>

> **MenuActionItemOptions**\<`TThis`\> = `object`

Defined in: [interfaces/GraphUI.ts:164](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L164)

Options to define an action item in a menu.
Can be used in contextual menus or multi-select menus.

## Type Parameters

### TThis

`TThis` *extends* `UIElement` = `UIElement`

## Properties

### iconClass?

> `optional` **iconClass**: [`IconClass`](IconClass.md)

Defined in: [interfaces/GraphUI.ts:167](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L167)

***

### iconUnicode?

> `optional` **iconUnicode**: [`IconUnicode`](IconUnicode.md)

Defined in: [interfaces/GraphUI.ts:166](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L166)

Unicode character for the icon (optional)

***

### imagePath?

> `optional` **imagePath**: [`ImagePath`](ImagePath.md)

Defined in: [interfaces/GraphUI.ts:169](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L169)

***

### onclick()

> **onclick**: (`this`, `evt`, `element?`) => `void`

Defined in: [interfaces/GraphUI.ts:174](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L174)

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

Defined in: [interfaces/GraphUI.ts:168](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L168)

***

### text?

> `optional` **text**: `string`

Defined in: [interfaces/GraphUI.ts:170](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L170)

***

### title

> **title**: `string`

Defined in: [interfaces/GraphUI.ts:171](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L171)

***

### variant

> **variant**: [`UIVariant`](UIVariant.md)

Defined in: [interfaces/GraphUI.ts:172](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L172)

***

### visible

> **visible**: `boolean` \| (`element`) => `boolean`

Defined in: [interfaces/GraphUI.ts:173](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L173)
