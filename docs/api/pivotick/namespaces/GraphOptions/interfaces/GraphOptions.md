[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphOptions](../README.md) / GraphOptions

# Interface: GraphOptions

Defined in: [interfaces/GraphOptions.ts:13](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphOptions.ts#L13)

## Remarks

This interface should be used as the entry point when configuring the graph.

## Properties

### callbacks?

> `optional` **callbacks**: [`InterractionCallbacks`](../../InterractionCallbacks/interfaces/InterractionCallbacks.md)\<`unknown`\>

Defined in: [interfaces/GraphOptions.ts:31](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphOptions.ts#L31)

Callbacks to handle various graph events and render hooks.

***

### isDirected?

> `optional` **isDirected**: `boolean`

Defined in: [interfaces/GraphOptions.ts:37](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphOptions.ts#L37)

Enable whether the graph is directed or not

#### Default

```ts
true
```

***

### layout?

> `optional` **layout**: `Partial`\<[`LayoutOptions`](../../LayoutOptions/type-aliases/LayoutOptions.md)\>

Defined in: [interfaces/GraphOptions.ts:26](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphOptions.ts#L26)

Layout-specific configuration (e.g. tree, radial, etc.)

***

### render?

> `optional` **render**: `Partial`\<[`GraphRendererOptions`](../../RendererOptions/interfaces/GraphRendererOptions.md)\>

Defined in: [interfaces/GraphOptions.ts:17](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphOptions.ts#L17)

Options for the rendering engine

***

### simulation?

> `optional` **simulation**: `Partial`\<[`SimulationOptions`](../../SimulationOptions/interfaces/SimulationOptions.md)\>

Defined in: [interfaces/GraphOptions.ts:21](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphOptions.ts#L21)

Options for the simultion engine

***

### UI?

> `optional` **UI**: `Partial`\<[`GraphUI`](../../GraphUI/interfaces/GraphUI.md)\>

Defined in: [interfaces/GraphOptions.ts:42](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphOptions.ts#L42)

Options for the UI
