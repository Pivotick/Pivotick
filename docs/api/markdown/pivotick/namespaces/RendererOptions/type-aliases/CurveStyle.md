[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / CurveStyle

# Type Alias: CurveStyle

> **CurveStyle** = `"straight"` \| `"curved"` \| `"bidirectional"`

Defined in: [interfaces/RendererOptions.ts:223](https://github.com/mokaddem/Pivotick/blob/84c67603cf50dc0f96efd867f2d2a3762ebfc09a/src/interfaces/RendererOptions.ts#L223)

- 'straight': The edge will go in a straight line from A to B
- 'curved': The edge will always be curved from A to B
- 'bidirectional': The edge will be curved only if there is a birectional relation between A and B. So, from A to B and B to A

## Default

```ts
'bidirectional'
```
