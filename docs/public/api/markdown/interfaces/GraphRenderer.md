[**pivotick v0.0.1**](../README.md)

***

[pivotick](../README.md) / GraphRenderer

# Abstract Interface: GraphRenderer

Defined in: [GraphRenderer.ts:8](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L8)

## Methods

### fitAndCenter()

> `abstract` **fitAndCenter**(`fitAndCenter?`): `void`

Defined in: [GraphRenderer.ts:33](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L33)

#### Parameters

##### fitAndCenter?

`number`

#### Returns

`void`

***

### focusElement()

> `abstract` **focusElement**(`element`): `void`

Defined in: [GraphRenderer.ts:34](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L34)

#### Parameters

##### element

[`Node`](../classes/Node.md) | [`Edge`](../classes/Edge.md)

#### Returns

`void`

***

### getCanvas()

> **getCanvas**(): `HTMLElement`

Defined in: [GraphRenderer.ts:36](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L36)

#### Returns

`HTMLElement`

***

### getCanvasSelection()

> `abstract` **getCanvasSelection**(): `unknown`

Defined in: [GraphRenderer.ts:29](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L29)

#### Returns

`unknown`

***

### getGraphInteraction()

> `abstract` **getGraphInteraction**(): [`GraphInteractions`](../pivotick/namespaces/GraphInteractions/classes/GraphInteractions.md)\<`unknown`\>

Defined in: [GraphRenderer.ts:28](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L28)

#### Returns

[`GraphInteractions`](../pivotick/namespaces/GraphInteractions/classes/GraphInteractions.md)\<`unknown`\>

***

### getSelectionBox()

> `abstract` **getSelectionBox**(): [`AbstractSelectionBox`](AbstractSelectionBox.md) \| `null`

Defined in: [GraphRenderer.ts:27](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L27)

#### Returns

[`AbstractSelectionBox`](AbstractSelectionBox.md) \| `null`

***

### getZoomBehavior()

> `abstract` **getZoomBehavior**(): `unknown`

Defined in: [GraphRenderer.ts:26](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L26)

#### Returns

`unknown`

***

### getZoomGroup()

> `abstract` **getZoomGroup**(): `HTMLElement` \| `SVGElement` \| `null`

Defined in: [GraphRenderer.ts:30](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L30)

#### Returns

`HTMLElement` \| `SVGElement` \| `null`

***

### init()

> `abstract` **init**(): `void`

Defined in: [GraphRenderer.ts:23](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L23)

#### Returns

`void`

***

### nextTick()

> `abstract` **nextTick**(): `void`

Defined in: [GraphRenderer.ts:25](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L25)

#### Returns

`void`

***

### setupRendering()

> **setupRendering**(): `void`

Defined in: [GraphRenderer.ts:59](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L59)

#### Returns

`void`

***

### update()

> `abstract` **update**(`dataChanged`): `void`

Defined in: [GraphRenderer.ts:24](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L24)

#### Parameters

##### dataChanged

`boolean`

#### Returns

`void`

***

### updateLayoutProgress()

> **updateLayoutProgress**(`progress`, `elapsedTime`): `void`

Defined in: [GraphRenderer.ts:40](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L40)

#### Parameters

##### progress

`number`

##### elapsedTime

`number`

#### Returns

`void`

***

### zoomIn()

> `abstract` **zoomIn**(): `void`

Defined in: [GraphRenderer.ts:31](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L31)

#### Returns

`void`

***

### zoomOut()

> `abstract` **zoomOut**(): `void`

Defined in: [GraphRenderer.ts:32](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphRenderer.ts#L32)

#### Returns

`void`
