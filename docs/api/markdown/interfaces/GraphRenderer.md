[**pivotick v0.0.0**](../README.md)

***

[pivotick](../README.md) / GraphRenderer

# Abstract Interface: GraphRenderer

Defined in: [GraphRenderer.ts:11](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L11)

## Methods

### fitAndCenter()

> `abstract` **fitAndCenter**(): `void`

Defined in: [GraphRenderer.ts:35](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L35)

#### Returns

`void`

***

### focusElement()

> `abstract` **focusElement**(`element`): `void`

Defined in: [GraphRenderer.ts:36](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L36)

#### Parameters

##### element

[`Node`](../classes/Node.md) | [`Edge`](../classes/Edge.md)

#### Returns

`void`

***

### getCanvas()

> **getCanvas**(): `HTMLElement`

Defined in: [GraphRenderer.ts:38](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L38)

#### Returns

`HTMLElement`

***

### getCanvasSelection()

> `abstract` **getCanvasSelection**(): `unknown`

Defined in: [GraphRenderer.ts:31](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L31)

#### Returns

`unknown`

***

### getGraphInteraction()

> `abstract` **getGraphInteraction**(): `GraphInteractions`\<`unknown`\>

Defined in: [GraphRenderer.ts:30](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L30)

#### Returns

`GraphInteractions`\<`unknown`\>

***

### getSelectionBox()

> `abstract` **getSelectionBox**(): `AbstractSelectionBox` \| `null`

Defined in: [GraphRenderer.ts:29](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L29)

#### Returns

`AbstractSelectionBox` \| `null`

***

### getZoomBehavior()

> `abstract` **getZoomBehavior**(): `unknown`

Defined in: [GraphRenderer.ts:28](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L28)

#### Returns

`unknown`

***

### getZoomGroup()

> `abstract` **getZoomGroup**(): `HTMLElement` \| `SVGElement` \| `null`

Defined in: [GraphRenderer.ts:32](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L32)

#### Returns

`HTMLElement` \| `SVGElement` \| `null`

***

### init()

> `abstract` **init**(): `void`

Defined in: [GraphRenderer.ts:25](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L25)

#### Returns

`void`

***

### nextTick()

> `abstract` **nextTick**(): `void`

Defined in: [GraphRenderer.ts:27](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L27)

#### Returns

`void`

***

### setupRendering()

> **setupRendering**(): `void`

Defined in: [GraphRenderer.ts:61](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L61)

#### Returns

`void`

***

### update()

> `abstract` **update**(`dataChanged`): `void`

Defined in: [GraphRenderer.ts:26](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L26)

#### Parameters

##### dataChanged

`boolean`

#### Returns

`void`

***

### updateLayoutProgress()

> **updateLayoutProgress**(`progress`, `elapsedTime`): `void`

Defined in: [GraphRenderer.ts:42](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L42)

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

Defined in: [GraphRenderer.ts:33](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L33)

#### Returns

`void`

***

### zoomOut()

> `abstract` **zoomOut**(): `void`

Defined in: [GraphRenderer.ts:34](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/GraphRenderer.ts#L34)

#### Returns

`void`
