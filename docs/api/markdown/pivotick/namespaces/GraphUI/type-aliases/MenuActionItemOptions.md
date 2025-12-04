[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / MenuActionItemOptions

# Type Alias: MenuActionItemOptions\<TThis\>

> **MenuActionItemOptions**\<`TThis`\> = `object`

Defined in: [interfaces/GraphUI.ts:184](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L184)

Options to define an action item in a menu.
Can be used in contextual menus or multi-select menus.

## Type Parameters

### TThis

`TThis` *extends* `UIElement` = `UIElement`

## Properties

### iconClass?

> `optional` **iconClass**: [`IconClass`](IconClass.md)

Defined in: [interfaces/GraphUI.ts:187](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L187)

***

### iconUnicode?

> `optional` **iconUnicode**: [`IconUnicode`](IconUnicode.md)

Defined in: [interfaces/GraphUI.ts:186](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L186)

Unicode character for the icon (optional)

***

### imagePath?

> `optional` **imagePath**: [`ImagePath`](ImagePath.md)

Defined in: [interfaces/GraphUI.ts:189](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L189)

***

### onclick()

> **onclick**: (`this`, `evt`, `element?`) => `void`

Defined in: [interfaces/GraphUI.ts:197](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L197)

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

Defined in: [interfaces/GraphUI.ts:188](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L188)

***

### text

> **text**: `string`

Defined in: [interfaces/GraphUI.ts:191](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L191)

Text of the option.

***

### title?

> `optional` **title**: `string`

Defined in: [interfaces/GraphUI.ts:193](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L193)

Title to be shown when hovering over the option.

***

### variant?

> `optional` **variant**: [`UIVariant`](UIVariant.md)

Defined in: [interfaces/GraphUI.ts:195](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L195)

#### Default

```ts
outline-primary
```

***

### visible?

> `optional` **visible**: `boolean` \| (`element`) => `boolean`

Defined in: [interfaces/GraphUI.ts:196](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/GraphUI.ts#L196)
