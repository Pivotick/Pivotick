[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [InterractionCallbacks](../README.md) / InterractionCallbacks

# Interface: InterractionCallbacks\<TElement\>

Defined in: [interfaces/InterractionCallbacks.ts:4](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L4)

## Type Parameters

### TElement

`TElement` = `unknown`

## Properties

### onCanvasClick()?

> `optional` **onCanvasClick**: (`event`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:84](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L84)

Called when the canvas is clicked.

#### Parameters

##### event

`PointerEvent`

#### Returns

`void`

***

### onCanvasContextmenu()?

> `optional` **onCanvasContextmenu**: (`event`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:94](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L94)

Called when the canvas is right clicked.

#### Parameters

##### event

`PointerEvent`

#### Returns

`void`

***

### onCanvasMousemove()?

> `optional` **onCanvasMousemove**: (`event`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:99](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L99)

Called when the mouse move over the canvas.

#### Parameters

##### event

`MouseEvent`

#### Returns

`void`

***

### onCanvasZoom()?

> `optional` **onCanvasZoom**: (`event`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:89](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L89)

Called when the canvas is zoomed.

#### Parameters

##### event

`unknown`

#### Returns

`void`

***

### onEdgeBlur()?

> `optional` **onEdgeBlur**: (`edge`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:70](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L70)

Called when an edge is unselected by the user.

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### onEdgeClick()?

> `optional` **onEdgeClick**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:52](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L52)

Called when an edge is selected by the user.

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

### onEdgeContextmenu()?

> `optional` **onEdgeContextmenu**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:60](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L60)

Called when an edge is right clicked.

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

### onEdgeDbclick()?

> `optional` **onEdgeDbclick**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:56](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L56)

Called when an edge is selected by the user.

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

### onEdgeHoverIn()?

> `optional` **onEdgeHoverIn**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:75](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L75)

Called when a user hovers over an edge.

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

### onEdgeHoverOut()?

> `optional` **onEdgeHoverOut**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:79](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L79)

Called when a user hovers over an edge.

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

### onEdgeSelect()?

> `optional` **onEdgeSelect**: (`edge`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:65](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L65)

Called when an edge is selected by the user.

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

##### element

`TElement`

#### Returns

`void`

***

### onNodeBlur()?

> `optional` **onNodeBlur**: (`node`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:37](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L37)

Called when a node is unselected by the user.

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### onNodeClick()?

> `optional` **onNodeClick**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:8](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L8)

Called when a node is clicked.

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

### onNodeContextmenu()?

> `optional` **onNodeContextmenu**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:18](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L18)

Called when a node is right clicked.

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

### onNodeDbclick()?

> `optional` **onNodeDbclick**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:13](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L13)

Called when a node is double clicked.

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

### onNodeDragging()?

> `optional` **onNodeDragging**: (`event`, `node`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:47](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L47)

Called when a node is dragged.

#### Parameters

##### event

`MouseEvent`

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`void`

***

### onNodeExpansion()?

> `optional` **onNodeExpansion**: (`event`, `edge`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:42](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L42)

Called when a node is expanded (e.g., drilled down or pivoted).

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

### onNodeHoverIn()?

> `optional` **onNodeHoverIn**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:23](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L23)

Called when a user hovers over a node.

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

### onNodeHoverOut()?

> `optional` **onNodeHoverOut**: (`event`, `node`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:27](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L27)

Called when a user hovers out of a node.

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

### onNodeSelect()?

> `optional` **onNodeSelect**: (`node`, `element`) => `void`

Defined in: [interfaces/InterractionCallbacks.ts:32](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L32)

Called when a node is selected by the user.

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

##### element

`TElement`

#### Returns

`void`

***

### onSimulationSlowTick()?

> `optional` **onSimulationSlowTick**: () => `void`

Defined in: [interfaces/InterractionCallbacks.ts:109](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L109)

Called when the every tenth of simulation ticks.

#### Returns

`void`

***

### onSimulationTick()?

> `optional` **onSimulationTick**: () => `void`

Defined in: [interfaces/InterractionCallbacks.ts:104](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/interfaces/InterractionCallbacks.ts#L104)

Called when the simulation ticks.

#### Returns

`void`
