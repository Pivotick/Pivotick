import type { EdgeStyle, LabelStyle, MarkerStyleMap, NodeStyle } from '../interfaces/RendererOptions'

// Default style values, kept renderer-agnostic (relocated out of GraphSvgRenderer).
// The SVG renderer imports and re-exports them, so the public symbol names are unchanged.

/**
 * @default
{
    arrow: {
        pathD: 'M0,-5L10,0L0,5',
        viewBox: '0 -5 10 10',
        refX: 6,
        refY: 0,
        markerWidth: 12,
        markerHeight: 12,
        markerUnits: 'userSpaceOnUse',
        orient: 'auto',
        fill: 'var(--pvt-edge-stroke, #999)',
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
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
        fill: 'var(--pvt-edge-stroke, #999)',
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
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
        fill: 'var(--pvt-edge-stroke, #999)',
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
            markerWidth: 14,
            markerHeight: 14,
        }
    }
}
 */
export const defaultMarkerStyleMap: MarkerStyleMap = {
    arrow: {
        pathD: 'M0,-5L10,0L0,5',
        viewBox: '0 -5 10 10',
        refX: 6,
        refY: 0,
        markerWidth: 12,
        markerHeight: 12,
        markerUnits: 'userSpaceOnUse',
        orient: 'auto',
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
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
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
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
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
            markerWidth: 14,
            markerHeight: 14,
        }
    },
    bigcircle: {
        pathD: 'M5,5m-3,0a3,3 0 1,0 6,0a3,3 0 1,0 -6,0',
        viewBox: '0 0 10 10',
        refX: 5,
        refY: 5,
        markerWidth: 16,
        markerHeight: 16,
        markerUnits: 'userSpaceOnUse',
        orient: 0,
        selected: {
            fill: 'var(--pvt-edge-selected-stroke, #007acc)',
            markerWidth: 24,
            markerHeight: 24,
        }
    },
}

/**
 * @default
{
    shape: 'circle',
    size: 10,
    strokeWidth: var(--pvt-node-stroke-width, 2),
    color: 'var(--pvt-node-color, #007acc)',
    strokeColor: 'var(--pvt-node-stroke, #fff)',
    fontFamily: 'var(--pvt-label-font, system-ui, sans-serif)',
    textColor: 'var(--pvt-node-text-color, #fff)',
    iconUnicode: undefined,
    iconClass: undefined,
    svgIcon: undefined,
    imagePath: undefined,
    text: undefined,
}
 */
export const defaultNodeStyle: NodeStyle = {
    shape: 'circle',
    size: 10,
    strokeWidth: 'var(--pvt-node-stroke-width, 2)',
    color: 'var(--pvt-node-color, #007acc)',
    strokeColor: 'var(--pvt-node-stroke, #fff)',
    fontFamily: 'var(--pvt-label-font, system-ui, sans-serif)',
    textColor: 'var(--pvt-node-text-color, #fff)',
    textAnchorPosition: 'middle',
    textHorizontalShift: 0,
    textVerticalShift: 0,
    textRotateDegree: 0,
    iconUnicode: undefined,
    iconClass: undefined,
    svgIcon: undefined,
    imagePath: undefined,
    text: undefined,
    html: undefined,
}

/**
 * @default
{
    strokeWidth: 2,
    opacity: 1.0,
    curveStyle: 'bidirectional',
    dashed: false,
    animateDash: true,
    rotateLabel: false,
    markerEnd: 'arrow',
    markerStart: undefined,
    strokeColor: 'var(--pvt-edge-stroke, #999)',
}
 */
export const defaultEdgeStyle: EdgeStyle = {
    strokeWidth: 2,
    opacity: 1.0,
    curveStyle: 'bidirectional',
    dashed: false,
    animateDash: true,
    rotateLabel: false,
    markerEnd: 'arrow',
    markerStart: undefined,
    strokeColor: 'var(--pvt-edge-stroke, #999)',
}

/**
 * @default
{
    fontSize: 12,
    fontFamily: 'var(--pvt-label-font, system-ui, sans-serif)',
    color: 'var(--pvt-edge-label-color, #333)',
    backgroundColor: 'var(--pvt-edge-label-bg, #ffffffa0)',
}
 */
export const defaultLabelStyle: LabelStyle = {
    fontSize: 12,
    fontFamily: 'var(--pvt-label-font, system-ui, sans-serif)',
    color: 'var(--pvt-edge-label-color, #333)',
    backgroundColor: 'var(--pvt-edge-label-bg, #ffffffa0)',
}
