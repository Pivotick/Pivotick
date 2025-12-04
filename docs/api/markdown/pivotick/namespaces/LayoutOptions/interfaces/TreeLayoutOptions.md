[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [LayoutOptions](../README.md) / TreeLayoutOptions

# Interface: TreeLayoutOptions

Defined in: [interfaces/LayoutOptions.ts:19](https://github.com/mokaddem/Pivotick/blob/3aa20c1688c1c8b84622ae4b90902629f36acbd7/src/interfaces/LayoutOptions.ts#L19)

## Extends

- [`BaseLayoutOptions`](BaseLayoutOptions.md)

## Properties

### flipEdgeDirection

> **flipEdgeDirection**: `boolean`

Defined in: [interfaces/LayoutOptions.ts:56](https://github.com/mokaddem/Pivotick/blob/3aa20c1688c1c8b84622ae4b90902629f36acbd7/src/interfaces/LayoutOptions.ts#L56)

If the direction of the edges should be flipped. This can lead to other visualization

#### Default

```ts
false
```

***

### horizontal?

> `optional` **horizontal**: `boolean`

Defined in: [interfaces/LayoutOptions.ts:41](https://github.com/mokaddem/Pivotick/blob/3aa20c1688c1c8b84622ae4b90902629f36acbd7/src/interfaces/LayoutOptions.ts#L41)

Should the nodes be placed horizontally rather than vertically

#### Default

```ts
false
```

***

### radial?

> `optional` **radial**: `boolean`

Defined in: [interfaces/LayoutOptions.ts:36](https://github.com/mokaddem/Pivotick/blob/3aa20c1688c1c8b84622ae4b90902629f36acbd7/src/interfaces/LayoutOptions.ts#L36)

Should the nodes be placed radially instead of vertically

#### Default

```ts
false
```

***

### radialGap

> **radialGap**: `number`

Defined in: [interfaces/LayoutOptions.ts:51](https://github.com/mokaddem/Pivotick/blob/3aa20c1688c1c8b84622ae4b90902629f36acbd7/src/interfaces/LayoutOptions.ts#L51)

The grap between each layers used in the radial mode

#### Default

```ts
750
```

***

### rootId?

> `optional` **rootId**: `string`

Defined in: [interfaces/LayoutOptions.ts:26](https://github.com/mokaddem/Pivotick/blob/3aa20c1688c1c8b84622ae4b90902629f36acbd7/src/interfaces/LayoutOptions.ts#L26)

Specify the ID of the node to be used as the root of the tree.
Keep undefined to let `rooIdAlgorithmFinder` to select it.

#### Default

```ts
undefined
```

***

### rootIdAlgorithmFinder

> **rootIdAlgorithmFinder**: [`TreeLayoutAlgorithm`](../../../../type-aliases/TreeLayoutAlgorithm.md)

Defined in: [interfaces/LayoutOptions.ts:46](https://github.com/mokaddem/Pivotick/blob/3aa20c1688c1c8b84622ae4b90902629f36acbd7/src/interfaces/LayoutOptions.ts#L46)

The algorithm to use to find the root of the tree

#### Default

```ts
'MaxReachability'
```

***

### strength?

> `optional` **strength**: `number`

Defined in: [interfaces/LayoutOptions.ts:31](https://github.com/mokaddem/Pivotick/blob/3aa20c1688c1c8b84622ae4b90902629f36acbd7/src/interfaces/LayoutOptions.ts#L31)

The strength of the force keeping the nodes placed to form a tree in place

#### Default

```ts
0.1
```

***

### type

> **type**: `"tree"`

Defined in: [interfaces/LayoutOptions.ts:20](https://github.com/mokaddem/Pivotick/blob/3aa20c1688c1c8b84622ae4b90902629f36acbd7/src/interfaces/LayoutOptions.ts#L20)

#### Default

```ts
'force'
```

#### Overrides

[`BaseLayoutOptions`](BaseLayoutOptions.md).[`type`](BaseLayoutOptions.md#type)
