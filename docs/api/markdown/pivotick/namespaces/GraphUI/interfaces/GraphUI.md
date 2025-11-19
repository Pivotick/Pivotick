[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / GraphUI

# Interface: GraphUI

Defined in: [interfaces/GraphUI.ts:10](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L10)

## Properties

### contextMenu

> **contextMenu**: `object`

Defined in: [interfaces/GraphUI.ts:40](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L40)

#### enabled?

> `optional` **enabled**: `boolean`

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

Defined in: [interfaces/GraphUI.ts:15](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L15)

***

### mainHeader

> **mainHeader**: [`MainHeader`](MainHeader.md)

Defined in: [interfaces/GraphUI.ts:13](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L13)

***

### mode

> **mode**: [`GraphUIMode`](../type-aliases/GraphUIMode.md)

Defined in: [interfaces/GraphUI.ts:11](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L11)

***

### propertiesPanel

> **propertiesPanel**: [`PropertiesPanel`](PropertiesPanel.md)

Defined in: [interfaces/GraphUI.ts:14](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L14)

***

### selectionMenu

> **selectionMenu**: `object`

Defined in: [interfaces/GraphUI.ts:55](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L55)

#### menuNode?

> `optional` **menuNode**: `object`

##### menuNode.menu?

> `optional` **menu**: [`MenuActionItemOptions`](../type-aliases/MenuActionItemOptions.md)\<`UIElement`\>[]

##### menuNode.topbar?

> `optional` **topbar**: [`MenuQuickActionItemOptions`](../type-aliases/MenuQuickActionItemOptions.md)[]

***

### sidebar

> **sidebar**: [`SidebarOptions`](SidebarOptions.md)

Defined in: [interfaces/GraphUI.ts:12](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L12)

***

### tooltip

> **tooltip**: `object`

Defined in: [interfaces/GraphUI.ts:16](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L16)

#### edgeHeaderMap

> **edgeHeaderMap**: `Partial`\<[`HeaderMapEntry`](HeaderMapEntry.md)\<[`Edge`](../../../../classes/Edge.md)\>\>

#### edgePropertiesMap()

> **edgePropertiesMap**: (`edge`) => [`PropertyEntry`](PropertyEntry.md)[]

##### Parameters

###### edge

[`Edge`](../../../../classes/Edge.md)

##### Returns

[`PropertyEntry`](PropertyEntry.md)[]

#### enabled?

> `optional` **enabled**: `boolean`

#### nodeHeaderMap

> **nodeHeaderMap**: `Partial`\<[`HeaderMapEntry`](HeaderMapEntry.md)\<[`Node`](../../../../classes/Node.md)\>\>

#### nodePropertiesMap()

> **nodePropertiesMap**: (`node`) => [`PropertyEntry`](PropertyEntry.md)[]

##### Parameters

###### node

[`Node`](../../../../classes/Node.md)

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

[`Edge`](../../../../classes/Edge.md)

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

[`Node`](../../../../classes/Node.md)

##### Returns

`string` \| `HTMLElement`

##### Default

```ts
undefined
```
