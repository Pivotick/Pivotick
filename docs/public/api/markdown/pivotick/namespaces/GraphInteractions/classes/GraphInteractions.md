[**pivotick v0.0.1**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphInteractions](../README.md) / GraphInteractions

# Class: GraphInteractions\<TElement\>

Defined in: [GraphInteractions.ts:8](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L8)

## Type Parameters

### TElement

`TElement` = `unknown`

## Constructors

### Constructor

> **new GraphInteractions**\<`TElement`\>(`graph`): `GraphInteractions`\<`TElement`\>

Defined in: [GraphInteractions.ts:19](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L19)

#### Parameters

##### graph

[`Pivotick`](../../../../classes/Pivotick.md)

#### Returns

`GraphInteractions`\<`TElement`\>

## Methods

### addNodesToSelection()

> **addNodesToSelection**(`addSelection`): `void`

Defined in: [GraphInteractions.ts:229](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L229)

#### Parameters

##### addSelection

[`NodeSelection`](../../GraphInteractionsI/interfaces/NodeSelection.md)\<`TElement`\>[]

#### Returns

`void`

***

### canvasClick()

> **canvasClick**(`event`): `void`

Defined in: [GraphInteractions.ts:144](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L144)

#### Parameters

##### event

`PointerEvent`

#### Returns

`void`

***

### canvasContextmenu()

> **canvasContextmenu**(`event`): `void`

Defined in: [GraphInteractions.ts:159](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L159)

#### Parameters

##### event

`PointerEvent`

#### Returns

`void`

***

### canvasMousemove()

> **canvasMousemove**(`event`): `void`

Defined in: [GraphInteractions.ts:166](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L166)

#### Parameters

##### event

`MouseEvent`

#### Returns

`void`

***

### canvasZoom()

> **canvasZoom**(`event`): `void`

Defined in: [GraphInteractions.ts:152](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L152)

#### Parameters

##### event

`unknown`

#### Returns

`void`

***

### clearEdgeSelectionList()

> **clearEdgeSelectionList**(): `void`

Defined in: [GraphInteractions.ts:321](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L321)

#### Returns

`void`

***

### clearNodeSelectionList()

> **clearNodeSelectionList**(): `void`

Defined in: [GraphInteractions.ts:310](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L310)

#### Returns

`void`

***

### dragging()

> **dragging**(`event`, `node`): `void`

Defined in: [GraphInteractions.ts:101](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L101)

#### Parameters

##### event

`PointerEvent`

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`void`

***

### edgeClick()

> **edgeClick**(`element`, `event`, `edge`): `void`

Defined in: [GraphInteractions.ts:108](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L108)

#### Parameters

##### element

`TElement`

##### event

`PointerEvent`

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`void`

***

### edgeContextmenu()

> **edgeContextmenu**(`element`, `event`, `edge`): `void`

Defined in: [GraphInteractions.ts:123](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L123)

#### Parameters

##### element

`TElement`

##### event

`PointerEvent`

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`void`

***

### edgeDbclick()

> **edgeDbclick**(`element`, `event`, `edge`): `void`

Defined in: [GraphInteractions.ts:116](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L116)

#### Parameters

##### element

`TElement`

##### event

`PointerEvent`

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`void`

***

### edgeHoverIn()

> **edgeHoverIn**(`element`, `event`, `edge`): `void`

Defined in: [GraphInteractions.ts:130](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L130)

#### Parameters

##### element

`TElement`

##### event

`PointerEvent`

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`void`

***

### edgeHoverOut()

> **edgeHoverOut**(`element`, `event`, `edge`): `void`

Defined in: [GraphInteractions.ts:137](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L137)

#### Parameters

##### element

`TElement`

##### event

`PointerEvent`

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`void`

***

### getGraph()

> **getGraph**(): [`Pivotick`](../../../../classes/Pivotick.md)

Defined in: [GraphInteractions.ts:48](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L48)

#### Returns

[`Pivotick`](../../../../classes/Pivotick.md)

***

### getSelectedEdge()

> **getSelectedEdge**(): [`EdgeSelection`](../../GraphInteractionsI/interfaces/EdgeSelection.md)\<`TElement`\> \| `null`

Defined in: [GraphInteractions.ts:345](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L345)

#### Returns

[`EdgeSelection`](../../GraphInteractionsI/interfaces/EdgeSelection.md)\<`TElement`\> \| `null`

***

### getSelectedEdgeIDs()

> **getSelectedEdgeIDs**(): `string`[] \| `null`

Defined in: [GraphInteractions.ts:357](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L357)

#### Returns

`string`[] \| `null`

***

### getSelectedEdges()

> **getSelectedEdges**(): [`EdgeSelection`](../../GraphInteractionsI/interfaces/EdgeSelection.md)\<`TElement`\>[]

Defined in: [GraphInteractions.ts:361](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L361)

#### Returns

[`EdgeSelection`](../../GraphInteractionsI/interfaces/EdgeSelection.md)\<`TElement`\>[]

***

### getSelectedNode()

> **getSelectedNode**(): [`NodeSelection`](../../GraphInteractionsI/interfaces/NodeSelection.md)\<`TElement`\> \| `null`

Defined in: [GraphInteractions.ts:341](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L341)

#### Returns

[`NodeSelection`](../../GraphInteractionsI/interfaces/NodeSelection.md)\<`TElement`\> \| `null`

***

### getSelectedNodeIDs()

> **getSelectedNodeIDs**(): `string`[] \| `null`

Defined in: [GraphInteractions.ts:349](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L349)

#### Returns

`string`[] \| `null`

***

### getSelectedNodes()

> **getSelectedNodes**(): [`NodeSelection`](../../GraphInteractionsI/interfaces/NodeSelection.md)\<`TElement`\>[]

Defined in: [GraphInteractions.ts:353](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L353)

#### Returns

[`NodeSelection`](../../GraphInteractionsI/interfaces/NodeSelection.md)\<`TElement`\>[]

***

### hasActiveMultiselection()

> **hasActiveMultiselection**(): `boolean`

Defined in: [GraphInteractions.ts:332](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L332)

#### Returns

`boolean`

***

### nodeClick()

> **nodeClick**(`element`, `event`, `node`): `void`

Defined in: [GraphInteractions.ts:61](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L61)

#### Parameters

##### element

`TElement`

##### event

`PointerEvent`

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`void`

***

### nodeContextmenu()

> **nodeContextmenu**(`element`, `event`, `node`): `void`

Defined in: [GraphInteractions.ts:80](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L80)

#### Parameters

##### element

`TElement`

##### event

`PointerEvent`

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`void`

***

### nodeDbclick()

> **nodeDbclick**(`element`, `event`, `node`): `void`

Defined in: [GraphInteractions.ts:73](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L73)

#### Parameters

##### element

`TElement`

##### event

`PointerEvent`

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`void`

***

### nodeHoverIn()

> **nodeHoverIn**(`element`, `event`, `node`): `void`

Defined in: [GraphInteractions.ts:87](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L87)

#### Parameters

##### element

`TElement`

##### event

`PointerEvent`

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`void`

***

### nodeHoverOut()

> **nodeHoverOut**(`element`, `event`, `node`): `void`

Defined in: [GraphInteractions.ts:94](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L94)

#### Parameters

##### element

`TElement`

##### event

`PointerEvent`

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`void`

***

### off()

> **off**\<`K`\>(`event`, `handler`): `void`

Defined in: [GraphInteractions.ts:41](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L41)

#### Type Parameters

##### K

`K` *extends* keyof [`GraphInteractionEvents`](../../GraphInteractionsI/type-aliases/GraphInteractionEvents.md)\<`TElement`\>

#### Parameters

##### event

`K`

##### handler

[`GraphInteractionEvents`](../../GraphInteractionsI/type-aliases/GraphInteractionEvents.md)\<`TElement`\>\[`K`\]

#### Returns

`void`

***

### on()

> **on**\<`K`\>(`event`, `handler`): `void`

Defined in: [GraphInteractions.ts:34](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L34)

#### Type Parameters

##### K

`K` *extends* keyof [`GraphInteractionEvents`](../../GraphInteractionsI/type-aliases/GraphInteractionEvents.md)\<`TElement`\>

#### Parameters

##### event

`K`

##### handler

[`GraphInteractionEvents`](../../GraphInteractionsI/type-aliases/GraphInteractionEvents.md)\<`TElement`\>\[`K`\]

#### Returns

`void`

***

### refreshRendering()

> **refreshRendering**(): `void`

Defined in: [GraphInteractions.ts:336](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L336)

#### Returns

`void`

***

### removeNodesFromSelection()

> **removeNodesFromSelection**(`removeSelection`): `void`

Defined in: [GraphInteractions.ts:241](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L241)

#### Parameters

##### removeSelection

[`NodeSelection`](../../GraphInteractionsI/interfaces/NodeSelection.md)\<`TElement`\>[]

#### Returns

`void`

***

### selectEdge()

> **selectEdge**(`element`, `edge`): `void`

Defined in: [GraphInteractions.ts:256](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L256)

#### Parameters

##### element

`TElement`

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`void`

***

### selectEdges()

> **selectEdges**(`selection`): `void`

Defined in: [GraphInteractions.ts:270](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L270)

#### Parameters

##### selection

\[[`Edge`](../../../../classes/Edge.md), `TElement`\][]

#### Returns

`void`

***

### selectNode()

> **selectNode**(`element`, `node`): `void`

Defined in: [GraphInteractions.ts:187](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L187)

#### Parameters

##### element

`TElement`

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`void`

***

### selectNodes()

> **selectNodes**(`selection`): `void`

Defined in: [GraphInteractions.ts:216](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L216)

#### Parameters

##### selection

[`NodeSelection`](../../GraphInteractionsI/interfaces/NodeSelection.md)\<`TElement`\>[]

#### Returns

`void`

***

### simulationSlowTick()

> **simulationSlowTick**(): `void`

Defined in: [GraphInteractions.ts:180](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L180)

#### Returns

`void`

***

### simulationTick()

> **simulationTick**(): `void`

Defined in: [GraphInteractions.ts:173](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L173)

#### Returns

`void`

***

### unselectAll()

> **unselectAll**(): `void`

Defined in: [GraphInteractions.ts:302](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L302)

#### Returns

`void`

***

### unselectEdge()

> **unselectEdge**(): `void`

Defined in: [GraphInteractions.ts:288](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L288)

#### Returns

`void`

***

### unselectNode()

> **unselectNode**(): `void`

Defined in: [GraphInteractions.ts:202](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/GraphInteractions.ts#L202)

#### Returns

`void`
