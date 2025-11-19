[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / MenuActionItemOptions

# Type Alias: MenuActionItemOptions\<TThis\>

> **MenuActionItemOptions**\<`TThis`\> = `object`

Defined in: [interfaces/GraphUI.ts:178](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L178)

Options to define an action item in a menu.
Can be used in contextual menus or multi-select menus.

## Type Parameters

### TThis

`TThis` *extends* `UIElement` = `UIElement`

## Properties

### iconClass?

> `optional` **iconClass**: [`IconClass`](IconClass.md)

Defined in: [interfaces/GraphUI.ts:181](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L181)

***

### iconUnicode?

> `optional` **iconUnicode**: [`IconUnicode`](IconUnicode.md)

Defined in: [interfaces/GraphUI.ts:180](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L180)

Unicode character for the icon (optional)

***

### imagePath?

> `optional` **imagePath**: [`ImagePath`](ImagePath.md)

Defined in: [interfaces/GraphUI.ts:183](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L183)

***

### onclick()

> **onclick**: (`this`, `evt`, `element?`) => `void`

Defined in: [interfaces/GraphUI.ts:188](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L188)

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

Defined in: [interfaces/GraphUI.ts:182](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L182)

***

### text?

> `optional` **text**: `string`

Defined in: [interfaces/GraphUI.ts:184](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L184)

***

### title

> **title**: `string`

Defined in: [interfaces/GraphUI.ts:185](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L185)

***

### variant

> **variant**: [`UIVariant`](UIVariant.md)

Defined in: [interfaces/GraphUI.ts:186](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L186)

***

### visible

> **visible**: `boolean` \| (`element`) => `boolean`

Defined in: [interfaces/GraphUI.ts:187](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L187)
