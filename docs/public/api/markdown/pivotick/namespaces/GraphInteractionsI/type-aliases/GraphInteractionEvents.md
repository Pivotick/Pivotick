[**pivotick v0.0.1**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphInteractionsI](../README.md) / GraphInteractionEvents

# Type Alias: GraphInteractionEvents\<TElement\>

> **GraphInteractionEvents**\<`TElement`\> = `object`

Defined in: [interfaces/GraphInteractions.ts:18](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L18)

## Type Parameters

### TElement

`TElement`

## Properties

### canvasClick()

> **canvasClick**: (`event`) => `void`

Defined in: [interfaces/GraphInteractions.ts:36](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L36)

#### Parameters

##### event

`PointerEvent`

#### Returns

`void`

***

### canvasContextmenu()

> **canvasContextmenu**: (`event`) => `void`

Defined in: [interfaces/GraphInteractions.ts:39](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L39)

#### Parameters

##### event

`PointerEvent`

#### Returns

`void`

***

### canvasMousemove()

> **canvasMousemove**: (`event`) => `void`

Defined in: [interfaces/GraphInteractions.ts:38](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L38)

#### Parameters

##### event

`MouseEvent`

#### Returns

`void`

***

### canvasZoom()

> **canvasZoom**: (`event`) => `void`

Defined in: [interfaces/GraphInteractions.ts:37](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L37)

#### Parameters

##### event

`unknown`

#### Returns

`void`

***

### dragging()

> **dragging**: (`event`, `node`) => `void`

Defined in: [interfaces/GraphInteractions.ts:26](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L26)

#### Parameters

##### event

`MouseEvent`

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`void`

***

### edgeBlur()

> **edgeBlur**: (`edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:34](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L34)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### edgeClick()

> **edgeClick**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:28](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L28)

#### Parameters

##### event

`PointerEvent`

##### edge

[`Edge`](../../../../classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### edgeContextmenu()

> **edgeContextmenu**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:30](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L30)

#### Parameters

##### event

`PointerEvent`

##### edge

[`Edge`](../../../../classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### edgeDbclick()

> **edgeDbclick**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:29](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L29)

#### Parameters

##### event

`PointerEvent`

##### edge

[`Edge`](../../../../classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### edgeHoverIn()

> **edgeHoverIn**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:31](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L31)

#### Parameters

##### event

`PointerEvent`

##### edge

[`Edge`](../../../../classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### edgeHoverOut()

> **edgeHoverOut**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:32](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L32)

#### Parameters

##### event

`PointerEvent`

##### edge

[`Edge`](../../../../classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### edgeSelect()

> **edgeSelect**: (`edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:33](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L33)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeBlur()

> **nodeBlur**: (`node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:25](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L25)

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeClick()

> **nodeClick**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:19](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L19)

#### Parameters

##### event

`PointerEvent`

##### node

[`Node`](../../../../classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeContextmenu()

> **nodeContextmenu**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:21](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L21)

#### Parameters

##### event

`PointerEvent`

##### node

[`Node`](../../../../classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeDbclick()

> **nodeDbclick**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:20](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L20)

#### Parameters

##### event

`PointerEvent`

##### node

[`Node`](../../../../classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeHoverIn()

> **nodeHoverIn**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:22](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L22)

#### Parameters

##### event

`PointerEvent`

##### node

[`Node`](../../../../classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeHoverOut()

> **nodeHoverOut**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:23](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L23)

#### Parameters

##### event

`PointerEvent`

##### node

[`Node`](../../../../classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### nodeSelect()

> **nodeSelect**: (`node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:24](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L24)

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### selectEdge()

> **selectEdge**: (`edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:48](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L48)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### selectEdges()

> **selectEdges**: (`edges`) => `void`

Defined in: [interfaces/GraphInteractions.ts:50](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L50)

#### Parameters

##### edges

[`EdgeSelection`](../interfaces/EdgeSelection.md)\<`TElement`\>[]

#### Returns

`void`

***

### selectNode()

> **selectNode**: (`node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:43](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L43)

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### selectNodes()

> **selectNodes**: (`nodes`) => `void`

Defined in: [interfaces/GraphInteractions.ts:45](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L45)

#### Parameters

##### nodes

[`NodeSelection`](../interfaces/NodeSelection.md)\<`TElement`\>[]

#### Returns

`void`

***

### simulationSlowTick()

> **simulationSlowTick**: () => `void`

Defined in: [interfaces/GraphInteractions.ts:41](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L41)

#### Returns

`void`

***

### simulationTick()

> **simulationTick**: () => `void`

Defined in: [interfaces/GraphInteractions.ts:40](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L40)

#### Returns

`void`

***

### unselectEdge()

> **unselectEdge**: (`edge`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:49](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L49)

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### unselectEdges()

> **unselectEdges**: (`edges`) => `void`

Defined in: [interfaces/GraphInteractions.ts:51](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L51)

#### Parameters

##### edges

[`EdgeSelection`](../interfaces/EdgeSelection.md)\<`TElement`\>[]

#### Returns

`void`

***

### unselectNode()

> **unselectNode**: (`node`, `element`) => `void`

Defined in: [interfaces/GraphInteractions.ts:44](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L44)

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### unselectNodes()

> **unselectNodes**: (`nodes`) => `void`

Defined in: [interfaces/GraphInteractions.ts:46](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/interfaces/GraphInteractions.ts#L46)

#### Parameters

##### nodes

[`NodeSelection`](../interfaces/NodeSelection.md)\<`TElement`\>[]

#### Returns

`void`
