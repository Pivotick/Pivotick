[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphOptions](../README.md) / GraphOptions

# Interface: GraphOptions

Defined in: [interfaces/GraphOptions.ts:15](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphOptions.ts#L15)

## Remarks

This interface should be used as the entry point when configuring the graph.

## Properties

### callbacks?

> `optional` **callbacks**: [`InterractionCallbacks`](../../InterractionCallbacks/interfaces/InterractionCallbacks.md)\<`unknown`\>

Defined in: [interfaces/GraphOptions.ts:33](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphOptions.ts#L33)

Callbacks to handle various graph events and render hooks.

***

### isDirected?

> `optional` **isDirected**: `boolean`

Defined in: [interfaces/GraphOptions.ts:39](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphOptions.ts#L39)

Enable whether the graph is directed or not

#### Default

```ts
true
```

***

### layout?

> `optional` **layout**: `Partial`\<[`LayoutOptions`](../../LayoutOptions/type-aliases/LayoutOptions.md)\>

Defined in: [interfaces/GraphOptions.ts:28](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphOptions.ts#L28)

Layout-specific configuration (e.g. tree, radial, etc.)

***

### render?

> `optional` **render**: `Partial`\<[`GraphRendererOptions`](../../RendererOptions/interfaces/GraphRendererOptions.md)\>

Defined in: [interfaces/GraphOptions.ts:19](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphOptions.ts#L19)

Options for the rendering engine

***

### simulation?

> `optional` **simulation**: `Partial`\<[`SimulationOptions`](../../SimulationOptions/interfaces/SimulationOptions.md)\>

Defined in: [interfaces/GraphOptions.ts:23](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphOptions.ts#L23)

Options for the simultion engine

***

### UI?

> `optional` **UI**: `Partial`\<[`GraphUI`](../../GraphUI/interfaces/GraphUI.md)\>

Defined in: [interfaces/GraphOptions.ts:44](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphOptions.ts#L44)

Options for the UI
