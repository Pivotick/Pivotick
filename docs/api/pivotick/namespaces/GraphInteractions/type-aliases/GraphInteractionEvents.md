[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphInteractions](../README.md) / GraphInteractionEvents

# Type Alias: GraphInteractionEvents\<TElement\>

> **GraphInteractionEvents**\<`TElement`\> = `object`

Defined in: [interfaces/GraphInteractions.ts:15](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L15)

## Type Parameters

### TElement

`TElement`

## Properties

### canvasClick()

> **canvasClick**: (`event`) => `void`

Defined in: [interfaces/GraphInteractions.ts:33](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L33)

#### Parameters

##### event

`PointerEvent`

#### Returns

`void`

***

### canvasContextmenu()

> **canvasContextmenu**: (`event`) => `void`

Defined in: [interfaces/GraphInteractions.ts:36](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L36)

#### Parameters

##### event

`PointerEvent`

#### Returns

`void`

***

### canvasMousemove()

> **canvasMousemove**: (`event`) => `void`

Defined in: [interfaces/GraphInteractions.ts:35](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L35)

#### Parameters

##### event

`MouseEvent`

#### Returns

`void`

***

### canvasZoom()

> **canvasZoom**: (`event`) => `void`

Defined in: [interfaces/GraphInteractions.ts:34](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L34)

#### Parameters

##### event

`unknown`

#### Returns

`void`

***

### dragging()

> **dragging**: (`event`, `node`) => `void`

Defined in: [interfaces/GraphInteractions.ts:23](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L23)

#### Parameters

##### event

`MouseEvent`

##### node

[`Node`](../../Node/classes/Node.md)

#### Returns

`void`

***

### edgeBlur()

> **edgeBlur**: (`edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:31](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L31)

#### Parameters

##### edge

[`Edge`](../../Edge/classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### edgeClick()

> **edgeClick**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:25](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L25)

#### Parameters

##### event

`PointerEvent`

##### edge

[`Edge`](../../Edge/classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### edgeContextmenu()

> **edgeContextmenu**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:27](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L27)

#### Parameters

##### event

`PointerEvent`

##### edge

[`Edge`](../../Edge/classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### edgeDbclick()

> **edgeDbclick**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:26](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L26)

#### Parameters

##### event

`PointerEvent`

##### edge

[`Edge`](../../Edge/classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### edgeHoverIn()

> **edgeHoverIn**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:28](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L28)

#### Parameters

##### event

`PointerEvent`

##### edge

[`Edge`](../../Edge/classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### edgeHoverOut()

> **edgeHoverOut**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:29](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L29)

#### Parameters

##### event

`PointerEvent`

##### edge

[`Edge`](../../Edge/classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### edgeSelect()

> **edgeSelect**: (`edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:30](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L30)

#### Parameters

##### edge

[`Edge`](../../Edge/classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeBlur()

> **nodeBlur**: (`node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:22](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L22)

#### Parameters

##### node

[`Node`](../../Node/classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeClick()

> **nodeClick**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:16](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L16)

#### Parameters

##### event

`PointerEvent`

##### node

[`Node`](../../Node/classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeContextmenu()

> **nodeContextmenu**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:18](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L18)

#### Parameters

##### event

`PointerEvent`

##### node

[`Node`](../../Node/classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeDbclick()

> **nodeDbclick**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:17](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L17)

#### Parameters

##### event

`PointerEvent`

##### node

[`Node`](../../Node/classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeHoverIn()

> **nodeHoverIn**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:19](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L19)

#### Parameters

##### event

`PointerEvent`

##### node

[`Node`](../../Node/classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeHoverOut()

> **nodeHoverOut**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:20](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L20)

#### Parameters

##### event

`PointerEvent`

##### node

[`Node`](../../Node/classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeSelect()

> **nodeSelect**: (`node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:21](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L21)

#### Parameters

##### node

[`Node`](../../Node/classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### selectEdge()

> **selectEdge**: (`edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:45](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L45)

#### Parameters

##### edge

[`Edge`](../../Edge/classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### selectEdges()

> **selectEdges**: (`edges`) => `void`

Defined in: [interfaces/GraphInteractions.ts:47](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L47)

#### Parameters

##### edges

[`EdgeSelection`](../interfaces/EdgeSelection.md)\<`TElement`\>[]

#### Returns

`void`

***

### selectNode()

> **selectNode**: (`node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:40](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L40)

#### Parameters

##### node

[`Node`](../../Node/classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### selectNodes()

> **selectNodes**: (`nodes`) => `void`

Defined in: [interfaces/GraphInteractions.ts:42](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L42)

#### Parameters

##### nodes

[`NodeSelection`](../interfaces/NodeSelection.md)\<`TElement`\>[]

#### Returns

`void`

***

### simulationSlowTick()

> **simulationSlowTick**: () => `void`

Defined in: [interfaces/GraphInteractions.ts:38](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L38)

#### Returns

`void`

***

### simulationTick()

> **simulationTick**: () => `void`

Defined in: [interfaces/GraphInteractions.ts:37](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L37)

#### Returns

`void`

***

### unselectEdge()

> **unselectEdge**: (`edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:46](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L46)

#### Parameters

##### edge

[`Edge`](../../Edge/classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### unselectEdges()

> **unselectEdges**: (`edges`) => `void`

Defined in: [interfaces/GraphInteractions.ts:48](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L48)

#### Parameters

##### edges

[`EdgeSelection`](../interfaces/EdgeSelection.md)\<`TElement`\>[]

#### Returns

`void`

***

### unselectNode()

> **unselectNode**: (`node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:41](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L41)

#### Parameters

##### node

[`Node`](../../Node/classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### unselectNodes()

> **unselectNodes**: (`nodes`) => `void`

Defined in: [interfaces/GraphInteractions.ts:43](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphInteractions.ts#L43)

#### Parameters

##### nodes

[`NodeSelection`](../interfaces/NodeSelection.md)\<`TElement`\>[]

#### Returns

`void`
