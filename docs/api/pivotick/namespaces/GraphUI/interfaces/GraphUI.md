[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / GraphUI

# Interface: GraphUI

Defined in: [interfaces/GraphUI.ts:11](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L11)

## Properties

### contextMenu

> **contextMenu**: `object`

Defined in: [interfaces/GraphUI.ts:41](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L41)

#### enable?

> `optional` **enable**: `boolean`

#### menuCanvas?

> `optional` **menuCanvas**: `object`

##### menuCanvas.menu?

> `optional` **menu**: [`MenuActionItemOptions`](../type-aliases/MenuActionItemOptions.md)\<`UIElement`\>[]

##### menuCanvas.topbar?

> `optional` **topbar**: [`MenuQuickActionItemOptions`](../type-aliases/MenuQuickActionItemOptions.md)[]

#### menuEdge?

> `optional` **menuEdge**: `object`

##### menuEdge.menu?

> `optional` **menu**: [`MenuActionItemOptions`](../type-aliases/MenuActionItemOptions.md)\<`UIElement`\>[]

##### menuEdge.topbar?

> `optional` **topbar**: [`MenuQuickActionItemOptions`](../type-aliases/MenuQuickActionItemOptions.md)[]

#### menuNode?

> `optional` **menuNode**: `object`

##### menuNode.menu?

> `optional` **menu**: [`MenuActionItemOptions`](../type-aliases/MenuActionItemOptions.md)\<`UIElement`\>[]

##### menuNode.topbar?

> `optional` **topbar**: [`MenuQuickActionItemOptions`](../type-aliases/MenuQuickActionItemOptions.md)[]

***

### extraPanels

> **extraPanels**: [`ExtraPanel`](ExtraPanel.md)[]

Defined in: [interfaces/GraphUI.ts:16](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L16)

***

### mainHeader

> **mainHeader**: [`MainHeader`](MainHeader.md)

Defined in: [interfaces/GraphUI.ts:14](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L14)

***

### mode

> **mode**: [`GraphUIMode`](../type-aliases/GraphUIMode.md)

Defined in: [interfaces/GraphUI.ts:12](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L12)

***

### propertiesPanel

> **propertiesPanel**: [`PropertiesPanel`](PropertiesPanel.md)

Defined in: [interfaces/GraphUI.ts:15](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L15)

***

### selectionMenu

> **selectionMenu**: `object`

Defined in: [interfaces/GraphUI.ts:56](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L56)

#### menuNode?

> `optional` **menuNode**: `object`

##### menuNode.menu?

> `optional` **menu**: [`MenuActionItemOptions`](../type-aliases/MenuActionItemOptions.md)\<`UIElement`\>[]

##### menuNode.topbar?

> `optional` **topbar**: [`MenuQuickActionItemOptions`](../type-aliases/MenuQuickActionItemOptions.md)[]

***

### sidebar

> **sidebar**: [`SidebarOptions`](SidebarOptions.md)

Defined in: [interfaces/GraphUI.ts:13](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L13)

***

### tooltip

> **tooltip**: `object`

Defined in: [interfaces/GraphUI.ts:17](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L17)

#### edgeHeaderMap

> **edgeHeaderMap**: `Partial`\<[`HeaderMapEntry`](HeaderMapEntry.md)\<[`Edge`](../../Edge/classes/Edge.md)\>\>

#### edgePropertiesMap()

> **edgePropertiesMap**: (`edge`) => [`PropertyEntry`](PropertyEntry.md)[]

##### Parameters

###### edge

[`Edge`](../../Edge/classes/Edge.md)

##### Returns

[`PropertyEntry`](PropertyEntry.md)[]

#### enable?

> `optional` **enable**: `boolean`

#### nodeHeaderMap

> **nodeHeaderMap**: `Partial`\<[`HeaderMapEntry`](HeaderMapEntry.md)\<[`Node`](../../Node/classes/Node.md)\>\>

#### nodePropertiesMap()

> **nodePropertiesMap**: (`node`) => [`PropertyEntry`](PropertyEntry.md)[]

##### Parameters

###### node

[`Node`](../../Node/classes/Node.md)

##### Returns

[`PropertyEntry`](PropertyEntry.md)[]

#### render?

> `optional` **render**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Custom renderer for the tooltip. This content will override the default tooltip

##### Default

```ts
undefined
```

##### Example

```ts
(element) => `element id: ${element.id}`
```

#### renderEdgeExtra()?

> `optional` **renderEdgeExtra**: (`edge`) => `string` \| `HTMLElement`

Custom renderer for edge tooltips. This content is added after the default tooltip

##### Parameters

###### edge

[`Edge`](../../Edge/classes/Edge.md)

##### Returns

`string` \| `HTMLElement`

##### Default

```ts
undefined
```

#### renderNodeExtra()?

> `optional` **renderNodeExtra**: (`node`) => `string` \| `HTMLElement`

Custom renderer for node tooltips. This content is added after the default tooltip

##### Parameters

###### node

[`Node`](../../Node/classes/Node.md)

##### Returns

`string` \| `HTMLElement`

##### Default

```ts
undefined
```
