[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / CustomNodeShape

# Interface: CustomNodeShape

Defined in: [interfaces/RendererOptions.ts:166](https://github.com/mokaddem/Pivotick/blob/efd37e8952b64b4cfc6926802d22342685cc549b/src/interfaces/RendererOptions.ts#L166)

Represents a node with a custom SVG path.
The `d` property corresponds directly to the `d` attribute of an SVG `<path>` element,
allowing fully custom shapes.

## Example

```ts
{
  d: "M 0 -10 L 10 10 L -10 10 Z"
}
```

## Properties

### d

> **d**: `string`

Defined in: [interfaces/RendererOptions.ts:167](https://github.com/mokaddem/Pivotick/blob/efd37e8952b64b4cfc6926802d22342685cc549b/src/interfaces/RendererOptions.ts#L167)
