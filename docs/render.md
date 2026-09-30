---
outline: [2, 3]
---

# Render Options

Pivotick allows you to customize how nodes, edges, and labels are rendered through the `render` option.

::: warning
All styles defined here apply only when `render.type` is set to `svg`.
:::

| Option             | Type                                                                   | Default                                                                  | Description                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `type`             | `'svg' \| 'canvas'`                                                    | `'svg'`                                                                  | The rendering method. `'svg'` uses SVG elements, `'canvas'` uses the HTML canvas (experimental - not fully implemented).                 |
| `renderNode`       | `(node: Node) => HTMLElement \| string \| void`                        | `undefined`                                                              | Custom renderer for nodes.                                                                                                               |
| `renderLabel`      | `(edge: Edge) => HTMLElement \| string \| void`                        | `undefined`                                                              | Custom renderer for edge labels.                                                                                                         |
| `defaultNodeStyle` | [NodeStyle](/api/html/interfaces/RendererOptions.NodeStyle.html)   | [defaultNodeStyle](/api/html/variables/defaultNodeStyleValue.html)   | Default styling applied to all nodes.                                                                                                    |
| `defaultEdgeStyle` | [EdgeStyle](/api/html/interfaces/RendererOptions.EdgeStyle.html)   | [defaultEdgeStyle](/api/html/variables/defaultEdgeStyleValue.html)   | Default styling applied to all edges.                                                                                                    |
| `defaultLabelStyle` | [LabelStyle](/api/html/interfaces/RendererOptions.LabelStyle.html) | [defaultLabelStyle](/api/html/variables/defaultLabelStyleValue.html) | Default styling applied to all edge labels.                                                                                              |
| `markerStyleMap`   | `Record<string, MarkerStyle>`                                          | [defaultMarkerStyle](/api/html/variables/defaultMarkerStyleMap.html) | Custom styles for edge markers (`'arrow'`, `'diamond'`, etc.). See [`MarkerStyle`](/api/html/interfaces/RendererOptions.MarkerStyle.html) |
| `nodeTypeAccessor` | `(node: Node) => string \| undefined`                                  | `undefined`                                                              | Function to access the type of a node, used with `nodeStyleMap`.                                                                         |
| `nodeStyleMap`     | `Record<string, NodeStyle>`                                            | `{}`                                                                     | Maps node types (from `nodeTypeAccessor`) to styles.                                                                                     |
| `edgeTypeAccessor` | `(edge: Edge) => string \| undefined`                                  | `undefined`                                                              | The *kind* of an edge, used with `edgeStyleMap` and as a [layer](/edge-layers) key.                                                       |
| `edgeStyleMap`     | `Record<string, Partial<EdgeStyle>>`                                   | `undefined`                                                              | Maps edge kinds (from `edgeTypeAccessor`) to styles. See [Edge layers](/edge-layers).                                                    |
| `minZoom`          | `number`                                                               | `0.1`                                                                    | Minimum zoom level.                                                                                                                      |
| `maxZoom`          | `number`                                                               | `10`                                                                     | Maximum zoom level.                                                                                                                      |
| `minFitScale`      | `number`                                                               | `undefined`                                                              | The lowest zoom a fit goes to. A graph too big to fit at it opens at this zoom, centred on `fitAnchor`, and the minimap shows the rest.   |
| `fitAnchor`        | `string`                                                               | `undefined`                                                              | Id of the node a fit held at `minFitScale` centres on. The view stops at the graph's edges, so an anchor on one side stays near that side. |
| `zoomEnabled`      | `boolean`                                                              | `true`                                                                   | Enable zoom. `false` also takes the viewport rail's zoom buttons, keeping fit-and-center.                                                 |
| `selectionBox`     | [SelectionBox](/api/html/interfaces/RendererOptions.SelectionBox.html)  | `undefined`                                                              | Region selection: `enabled: false` drops the drag marquee **and** the Select ▸ Lasso tool.                                               |
| `enableNodeExpansion` | `boolean`                                                           | `true`                                                                   | Expanding a cluster: `false` takes the chevron, the `Enter` shortcut and the dashed collapsed outline with it.                            |

## Type of rendering

::: tip
Pivotick gives you flexible control over rendering, from simple defaults to fully custom rendering.
Here's a quick rundown:

- **`renderNode`** and **`renderLabel`** let you fully customize how nodes and labels are drawn (you can return HTML or text).
- **`defaultNodeStyle.html`** (per node or per type) is the same escape hatch inside the styling chain — see [HTML nodes](#html-nodes).
- **`nodeTypeAccessor`** + **`nodeStyleMap`** allow dynamic styling based on each element's type.
- **`defaultNodeStyle`**, **`defaultEdgeStyle`**, and **`defaultLabelStyle`** define the base appearance for all elements.
- **`edgeTypeAccessor`** + **`edgeStyleMap`** are the edge counterparts, and they double as
  the key a relation layer is switched off by — see [Edge layers](/edge-layers).
:::

::: tip Your card is measured, whatever shape it is
Pivotick measures what you return to size its `<foreignObject>` and to feed the force
layout's collision radius. The card is measured inside a shrink-to-fit box of the
library's own, so you do **not** have to make your root self-sizing: `width: 100%` on it
resolves against its own content rather than against the placeholder.
:::

The next three rendering examples are using the following data:

```ts
const data = {
    nodes: [
        { id: 1, data: { label: 'A', type: 'hub' } },
        { id: 2, data: { label: 'B', type: 'spoke' } }
    ],
    edges: [{ from: 1, to: 2 }]
}
```

::: code-group

<<< @/examples/configuration/render-default.js [Default rendering]

<<< @/examples/configuration/render-map-accessor.js#options [Map-Accessor rendering]

<<< @/examples/configuration/render-callback.js [Custom callback rendering]

:::


## Example for Map-Accessor rendering

<script setup>
    import { data as dataR, options as optionsR } from './examples/configuration/render-map-accessor.js'
</script>


<Pivotick
    :data="dataR"
    :options="optionsR"
></Pivotick>


## HTML nodes {#html-nodes}

When no combination of `shape`, `color`, `icon` and `text` will do, hand the renderer some
markup. There are two ways in, and the difference is only *where they are declared*:

| | Declared on | Reaches |
|---|---|---|
| `NodeStyle.html` | `defaultNodeStyle`, `nodeStyleMap[type]`, a node's own style, a `styleCb` return | one type, or one node |
| `render.renderNode` | the renderer options | every node, ahead of the styling chain |

`html` is the one to reach for first: it is an ordinary style channel, so it resolves
through the same precedence chain as `color` or `shape`, and a card can be given to one
kind of node while the rest keep their shapes.

```ts
const options = {
    render: {
        nodeTypeAccessor: (node) => node.getData()?.kind,
        nodeStyleMap: {
            // A card, and nothing else: `shape: 'none'` is what makes it the whole node.
            service: {
                shape: 'none',
                html: (node) => {
                    const card = document.createElement('div')
                    card.className = 'my-service-card'
                    card.textContent = node.getData()?.name
                    return card
                },
            },
            // Same graph, ordinary shapes.
            host: { shape: 'circle', size: 18, color: '#0891b2' },
        },
    },
}
```

### `shape: 'none'`

Without it, the shape is **still drawn behind your card**, and `size` is the smallest the
node is allowed to be — which is what you want for a card sitting on a coloured disc, and
not what you want for a card that is the node. `shape: 'none'` draws no shape, and hands
the node's collision radius and edge anchors to the card instead.

It is a shape value like any other, so it composes: a label-only node is
`shape: 'none'` with a `text` and no card, and an icon-only node is `shape: 'none'` with
an `iconClass`. A shapeless node with no content at all is invisible — but still there,
still draggable, and still selectable over `2 × size`.

::: tip What a card does *not* switch off
`text` is a separate channel, so a card and a node label are drawn together. If your card
carries its own title, set `text: ''` — an inherited value cannot be cleared with
`undefined`, which falls through to whatever the style map said.
:::

### Sizing

Your card is measured and the node grows to it, so it is never clipped, the collision
force spaces the real cards, and edges land on the card's border rather than on a circle
around it. You do not have to do anything to make that work — returning a `width: 100%`
root is fine, because the measurement happens inside a shrink-to-fit box.

Two consequences worth knowing:

- The measurement is **asynchronous** (a card cannot be measured before it is on screen),
  so a node's radius is its styled `size` for the first frame or two and then becomes the
  card's. The layout is nudged once when that lands.
- A card is measured **once, at render**. If its content later changes size on its own,
  re-render the node to re-measure it.

### Carding only some nodes

Both callbacks may return **nothing** for a node, which hands that node back to the
styling chain — shape, style-map entry, icons and label as usual. So a single global
`renderNode` can card the nodes that deserve one:

```ts
renderNode: (node) => node.getData()?.featured ? buildCard(node) : undefined
```

::: warning Trusted markup only
Whatever you return is inserted as-is. Build it with `textContent`, or escape it — do not
interpolate node data into a markup string. See the [security guide](/security).
:::

## Full node labels

A node label longer than the room it has is shortened with a middle ellipsis
(`Supe…abel`). Set `textTruncate: false` to draw it in full instead — as a default,
per node type, or per node:

```ts
const options = {
    render: {
        defaultNodeStyle: { textTruncate: false },
    },
}
```

Between the two, `textMaxWidth` caps the label at a width you choose, in graph units
(CSS pixels at zoom 1), instead of the room the node gives it. A label that fits is drawn
in full, and a longer one is shortened with a middle ellipsis to that width:

```ts
const options = {
    render: {
        defaultNodeStyle: { textTruncate: true, textMaxWidth: 160 },
    },
}
```

The cap scales with the zoom like the rest of the node, and it can be a function of the
node. It is ignored when `textTruncate` is `false`.

A full or capped label usually spills past the node's shape, so it is drawn on the same
themed pill as a floated label to stay readable over the canvas. Pair it with
`textVerticalShift: 1` (or `textHorizontalShift`) to move the whole label clear
of the node. Edge labels are never truncated.

`text` is a label on a node, not a substitute for one. A node that *is* its text should be
drawn as the node, through [`html`](#html-nodes), `renderNode` or a
[tier](#node-tiers) — those are the node's drawing, and the zoom keeps them whatever
[`minLabelFontSize`](#label-zoom) does to labels.

## Node badges

By the time a graph is useful, `color`, `shape`, `size` and `iconClass` are usually
all carrying something. `badges` is a channel of its own — small indicators pinned
to the node's rim, spending none of the others:

```ts
const options = {
    render: {
        defaultNodeStyle: {
            badges: (node) => {
                const { notes, disputed } = node.getData()
                return [
                    notes && { text: String(notes), color: '#2563eb', title: `${notes} notes` },
                    disputed && { iconClass: 'fa fa-exclamation', color: '#b94a48', title: 'Disputed' },
                ].filter(Boolean)
            },
        },
    },
}
```

Give a badge `text` (a count, or a character or two), an `iconClass`,
`iconUnicode` or `svgIcon`, and a `title` for its native tooltip. `text` wins if
you supply both. Longer text grows the badge into a pill, and past three
characters it renders `99+`.

### Where they go

Omit `position` and badges fill the free corners clockwise from `'ne'`. Name one
(`'ne' | 'nw' | 'se' | 'sw'`) and it is honoured verbatim, overlaps included.

**Four fit on a plain node, two on one with children.** The expand/collapse
control sits north-east when a node is collapsed and south-east when it is
expanded, so on any expandable node *both* East corners are reserved — otherwise
every badge would change corner the moment a cluster opened. Badges beyond what
fits fold into a `+n` whose tooltip names them.

Badges scale with the node between a floor and a ceiling, so they stay legible on
a tiny node without swelling on a large one, and they sit on the shape's real
rim — the corner of a square or a framed picture, the 45° point of a circle.

### Clicks

A badge is hit-testable but transparent by default: with no handler its click
falls through and selects the node underneath, so a badge is never a dead spot.

```ts
{ text: '3', onClick: (event, node, badge) => openNotes(node) }
```

Give a badge an `onClick` — or declare `callbacks.onBadgeClick` for behaviour they
all share — and it takes the pointer cursor and consumes its click, leaving the
node unselected. Both fire, the badge's own first. Pressing a badge still drags
the node either way, and a `badgeClick` listener on the interaction bus can
`cancel()` both.

### Scope

Badges describe **only the node they sit on**. A collapsed cluster does not
aggregate its children's — walk `node.children` in your own `badges` function if
that is what you want, since only you know whether a fact sums, wins, or neither.

## Detail that follows the zoom {#node-tiers}

A drawing that reads well close up is unreadable on an overview, and a dot that fits an
overview cannot say what it is. `tiers` lets one node carry several drawings and picks
between them from how large the node currently renders.

```ts
const options = {
    render: {
        defaultNodeStyle: {
            tiers: [
                // Small: a coloured dot.
                { width: 32, height: 32, style: { shape: 'circle', size: 16 } },
                // Once there is room for it: a labelled chip.
                { width: 140, height: 44, style: { shape: 'none', html: buildChip } },
            ],
        },
    },
}
```

Tiers are ordered smallest first and the richest one that fits wins. When none does, the
node draws at its base style, so the style you already have is the floor: a graph that
declares no `tiers` is unaffected in every respect.

### What a tier inherits {#tier-clearing}

A tier merges over the base style, so a channel it does not name is inherited. The drawing
is the exception: `iconUnicode`, `iconClass`, `svgIcon`, `imagePath` and `html` are one slot,
so a tier that names any of them replaces the base's drawing (and its `imageFit`) outright.
A glyph at rest with a card tier needs nothing more than the card:

```ts
const options = {
    render: {
        defaultNodeStyle: {
            svgIcon: buildGlyph,
            tiers: [
                { width: 140, height: 44, style: { shape: 'none', html: buildChip } },
            ],
        },
    },
}
```

A tier that names no drawing, only `size`, `color` or `text` say, keeps the base's glyph.

To take away a channel the tier does not otherwise replace, set it to `null`, which means
the tier draws that one **not at all**. `strokeColor: null` drops the base's outline, for
instance. `undefined` cannot stand in: it means "I am not naming this channel", which is
exactly how the base's value survives.

This is the only layer where `null` works that way. Everywhere else in the style chain `null`
still falls through to the layer below, because a `styleCb` handing back a null straight out
of node data is an ordinary shape and has always meant "use the default".

To make a node shapeless, use `shape: 'none'` rather than clearing `shape`.

### What picks a tier

The **rendered size**: the node's footprint in CSS pixels, which is `footprint × zoom`. A
tier engages once that reaches its `minRenderedSize`, which defaults to the tier's own
`width`, so `{ width: 140 }` reads as "engage once there is room to draw 140 pixels of
node".

The zoom scale on its own would not do. It multiplies coordinates the layout invented, so
the same scale means a different apparent size on a different graph, and a threshold tuned
on one dataset would be wrong on the next.

A tier that has engaged holds until the rendered size falls to 85% of its threshold. Every
node shares a threshold, so without that band a canvas parked on one would flicker as a
whole.

### The footprint stays put

The box a node reserves in the layout does not change when its drawing does. It is
`layoutSize`, and it defaults to half the widest declared tier, so declaring tiers gives
the graph the right spacing without a second number. Nothing moves when a tier swaps: the
drawing changes inside a box that was already the right size, and the forces never see the
difference.

`width` and `height` are declared rather than measured, for the same reason. The layout has
to know the footprint before the first tick, and a measured card only reports its size once
it has been drawn.

Set `layoutSize` yourself to space the graph tighter or wider than the widest tier. Note
that a tier is drawn at its design size only when its width equals the footprint; a
narrower one engages proportionally earlier and is drawn proportionally smaller. Give it an
explicit `minRenderedSize` if that matters.

### The focus drawing

`focusTier` is the drawing a node uses while it is hovered, or selected on its own,
whatever the zoom. This is where a node says everything about itself, so reading one never
means zooming to it.

```ts
const options = {
    render: {
        defaultNodeStyle: {
            tiers: [/* … */],
            focusTier: { shape: 'none', html: buildDetailCard },
        },
    },
}
```

It merges over the node's **base** style rather than over the active tier, so a chip tier's
`shape` or `html` cannot leak into it. It holds a constant size on screen: the drawing is
counter-scaled against the zoom, so a 280×150 card is 280×150 CSS pixels however far out
the graph is. And it never touches the node's geometry, so edges keep landing on the tier
underneath and hovering moves nothing.

Only a node selected **on its own** is promoted. A fifty-node box selection would be a wall
of overlapping cards.

`render.focusTierTrigger` says when it fires: `'both'` (the default), `'hover'`,
`'selection'`, or `'off'`. Reach for `'off'` when you are embedding a style preset someone
else ships and want its focus drawing suppressed without editing it.

#### When a tier already shows it

Sometimes the focus drawing is the same as one of the zoom tiers: a glyph at rest that
hovers into a chip, with the chip also drawn once the graph is zoomed in far enough. There,
hovering would paint a second, smaller chip over the one already on screen.
`focusTierYieldsAt` names the index into `tiers` from which the focus drawing stops firing:

```ts
defaultNodeStyle: {
    tiers: [{ width: 140, height: 44, style: { shape: 'none', html: chipFor } }],
    focusTier: { shape: 'none', html: chipFor },
    focusTierYieldsAt: 0,
}
```

While the node is drawn at that tier or a richer one, hover and a lone selection leave it as
it is. It follows the active tier, not the zoom level, so it uses the same thresholds as the
swap. Zooming in with the card open fades it out as the tier fades in, and zooming back out
brings it back without moving the pointer. Leave it unset on a node whose focus drawing says
more than any tier, and a node with no `tiers` ignores it.

::: tip Tooltips still fire
A focus card does not replace the tooltip. The two are independent, and a tooltip may
carry something the card does not.
:::

### The swap itself {#tier-transition}

A node cross-fades from one drawing to the next rather than cutting to it. The outgoing
drawing is held on a layer of its own and the two fade past each other, so a node is never
absent mid-swap, only briefly softer where they overlap.

`render.detailTransition` is how long that takes, in milliseconds. It defaults to `160` and
covers every drawing the zoom decides: a tier crossing, the focus drawing, and a label
crossing [`minLabelFontSize`](#label-zoom). Set it to `0` to replace the drawing in a single
frame:

```ts
const options = {
    render: {
        detailTransition: 0,
        defaultNodeStyle: { tiers: [/* … */] },
    },
}
```

Every node on screen crosses at the same moment, so a crossing starts as many fades as
there are nodes changing. Measured on 210 nodes each holding a 140×44 card, the fade runs
at 60fps for its whole length; what it costs is about 26ms on the single frame the crossing
already spends, and that figure does not grow with the duration. Turn it off on a graph
where that frame matters more than the transition.

`prefers-reduced-motion` turns it off on its own, whatever the option says.

## Labels at a readable size {#label-zoom}

A label rides the graph and scales with it, so the further out the view is the smaller it is
painted. A graph opens at whatever scale the fit picks, and that scale falls as the graph
grows: past a few hundred nodes the opening frame is text nobody can read, drawn over the
graph it is naming.

`render.minLabelFontSize` is the rendered size, in CSS pixels, below which a label is not
drawn. It defaults to `9`.

```ts
const options = {
    render: {
        minLabelFontSize: 9,
    },
}
```

The test is `fontSize × zoom`, in rendered pixels rather than the zoom scale: a scale
multiplies coordinates the layout invented, so the same value means a different apparent size
on the next dataset.

It is one number for the whole canvas, edge labels and node labels alike. The difference
between them is already in the font size: an edge label is drawn at
`defaultLabelStyle.fontSize` (12 by default), while a node's is derived from the node,
`max(12, size × 0.45)`, so a large node keeps its label to a lower zoom than a small one.

`0` turns the gate off and draws every label at every zoom.

::: tip What counts as a label
The text the library places: an edge's `label`, a node's `text`, and whatever
`render.renderLabel` returns. A node's `html`, `renderNode` or tier card is its *drawing*,
and [`tiers`](#node-tiers) is what chooses between drawings.
:::

A label that is showing holds until its rendered size falls to 85% of the threshold, so a
view parked on the line settles instead of flickering. Every label drawn at one size answers
together, whichever element it belongs to.

An edge selected **on its own** shows its label whatever the zoom, counter-scaled so it is
readable rather than the two pixels it was hidden at. An edge has no tooltip and no panel, so
its label is the only thing that answers "what is this". A node needs none of that: it
already answers through its tooltip, the sidebar, and its `focusTier` drawing.

A hidden label is not merely invisible, it is not in the graph — which is where the cost goes.
A label is repositioned on every simulation tick, and on a large graph that pass alone costs
more than a frame. What remains after the gate is the stroke, which is cheap.

::: warning What it does not do
Above the threshold, labels can still overlap each other. An edge label is typically wider
than the edge it names, and that ratio does not change with the zoom. This option is about
legibility, not decluttering.
:::

## API

Pivotick exposes a renderer controller that lets you interact directly with the rendering engine.
All methods are [available online](/api/html/interfaces/GraphRenderer.html)

### Fit and Zoom

::: code-group
```ts [Fit and center]
graph.renderer.fitAndCenter()
```

```ts [Zomm in / out]
graph.renderer.zoomIn()
graph.renderer.zoomOut()
```
:::

