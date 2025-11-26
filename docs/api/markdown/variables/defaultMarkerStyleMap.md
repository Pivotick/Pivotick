[**pivotick v0.0.0**](../README.md)

***

[pivotick](../README.md) / defaultMarkerStyleMap

# Variable: defaultMarkerStyleMap

> `const` **defaultMarkerStyleMap**: [`MarkerStyleMap`](../pivotick/namespaces/RendererOptions/type-aliases/MarkerStyleMap.md)

Defined in: [renderers/svg/GraphSvgRenderer.ts:69](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/renderers/svg/GraphSvgRenderer.ts#L69)

## Default

```ts
{
    arrow: {
        pathD: 'M0,-5L10,0L0,5',
        viewBox: '0 -5 10 10',
        refX: 5,
        refY: 0,
        markerWidth: 6,
        markerHeight: 6,
        markerUnits: 'userSpaceOnUse',
        orient: 'auto',
        fill: 'var(--pivotick-edge-stroke, #999)',
        selected: {
            fill: 'var(--pivotick-edge-selected-stroke, #007acc)',
            markerWidth: 12,
            markerHeight: 12,
            refX: 6,
        }
    },
    circle: {
        pathD: 'M5,5m-3,0a3,3 0 1,0 6,0a3,3 0 1,0 -6,0',
        viewBox: '0 0 10 10',
        refX: 5,
        refY: 5,
        markerWidth: 10,
        markerHeight: 10,
        markerUnits: 'userSpaceOnUse',
        orient: 0,
        fill: 'var(--pivotick-edge-stroke, #999)',
        selected: {
            fill: 'var(--pivotick-edge-selected-stroke, #007acc)',
            markerWidth: 16,
            markerHeight: 16,
        }
    },
    diamond: {
        pathD: 'M0,-4L4,0L0,4L-4,0Z',
        viewBox: '-5 -5 10 10',
        refX: 0,
        refY: 0,
        markerWidth: 8,
        markerHeight: 8,
        markerUnits: 'userSpaceOnUse',
        orient: 0,
        fill: 'var(--pivotick-edge-stroke, #999)',
        selected: {
            fill: 'var(--pivotick-edge-selected-stroke, #007acc)',
            markerWidth: 14,
            markerHeight: 14,
        }
    }
}
```
