[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / CustomNodeShape

# Interface: CustomNodeShape

Defined in: [interfaces/RendererOptions.ts:162](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L162)

Represents a node with a custom SVG path.
The `d` property corresponds directly to the `d` attribute of an SVG <path> element,
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

Defined in: [interfaces/RendererOptions.ts:163](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L163)
