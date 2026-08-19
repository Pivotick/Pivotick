---
outline: [2, 3]
---

# Plugins

A **plugin** is a self-contained bundle of UI elements, keybindings and lifecycle hooks
that installs itself into a graph without the core needing to know it exists. Register
one declaratively or imperatively:

```ts
import { Pivotick, minimap } from 'pivotick'

// declaratively
const graph = new Pivotick(container, data, { plugins: [minimap()] })

// …or at any point later
graph.use(minimap({ position: 'bottom-left' }))
```

A plugin installed after the graph is live is caught up to the current lifecycle phase,
so there is no "too late" — and everything it registers is torn down with the UI.

## The shape of a plugin

```ts
import type { PivotickPlugin } from 'pivotick'

const myPlugin: PivotickPlugin = {
    name: 'my-plugin',          // used for de-duplication and logging
    install(ctx) { /* … */ },   // called once
}
```

Installing the same `name` twice warns and skips the duplicate, so a plugin can be
listed in `plugins` and re-applied through `graph.use` without doubling up.

### What `install` is handed

`ctx` is a {@link PluginContext}:

| Member | What it's for |
|---|---|
| `graph` | the live `Graph` — nodes, edges, the data event bus, `queryEngine` |
| `ui` | the `UIManager` — options, notifications, the mode store |
| `layout` | the DOM scaffold, read **live** (never a snapshot). `layout.canvas` is where canvas-docked chrome goes |
| `addElement(element, slot?)` | put a `UIComponent` into the lifecycle, mounted into `slot` |
| `addPanel(panel)` / `removePanel(id)` / `refreshPanel(id?)` | sidebar panels — the same door as `UI.extraPanels` |
| `onPhase(phase, cb)` | hook `afterMount` / `graphReady` / `destroy`; returns an unsubscribe |
| `addKeybinding(binding)` | a shortcut that is removed when the UI is torn down |
| `keyManager` | the keybinding registry, for anything more involved |

Which `layout` slots exist depends on the mode: `canvas` and `notification` always,
`graphnavigation` in every mode but `static`, `mainheader` / `modal` / `slidePanel` /
`moderail` / `toolpanel` / `flyout` / `legend` in `full` and `light`, and `sidebar` in
`full` only. Read the slot at the moment you need it rather than caching it.

### Contributing a UI element

Extend `UIComponent` and the lifecycle is driven for you — including teardown of
anything registered through `track` / `listen` / `trackInteraction`:

```ts
import { UIComponent } from 'pivotick'

class Watermark extends UIComponent {
    onMount(slot) {
        this.element = document.createElement('div')
        this.element.textContent = 'draft'
        slot?.appendChild(this.element)
    }

    onGraphReady() {
        // `listen` and `trackInteraction` unsubscribe themselves on destroy
        this.trackInteraction('canvasZoom', () => this.reposition())
    }

    onDestroy() {
        this.element?.remove()
    }
}

const watermark: PivotickPlugin = {
    name: 'watermark',
    install: (ctx) => ctx.addElement(new Watermark(ctx.ui), ctx.layout?.canvas),
}
```

The four phases are `mount(slot)` → `afterMount()` → `graphReady()` → `destroy()`.
`graphReady` fires once the simulation has settled, so it can be **seconds** after
mount on a big graph — anything that should be on screen immediately belongs in
`onMount` / `onAfterMount` (deferred a frame if it needs `graph.renderer`, which is
constructed after the UI).

See the [Extend with a plugin](/examples/gallery/extend-with-a-plugin/content) gallery
card for a live, complete example.

## Driving the viewport

Anything that navigates the graph — a minimap, an overview, a "jump to" control — uses
two renderer methods:

```ts
// The extent of everything drawn, in graph coordinates (null when there's nothing).
const bounds = graph.renderer.getContentBounds()

// Put a graph-space point in the middle of the canvas.
graph.renderer.setViewport({ x: 120, y: -40 })
graph.renderer.setViewport({ x: 0, y: 0, scale: 1.5, animate: true })
```

`setViewport` leaves the scale alone unless you pass one, so it is the primitive for
panning. To read where the view currently *is*, invert the canvas corners rather than
reaching for a zoom transform — this is renderer-agnostic:

```ts
const rect = graph.UIManager.layout.canvas.getBoundingClientRect()
const topLeft = graph.renderer.screenToGraphCoordinates(rect.left, rect.top)
const bottomRight = graph.renderer.screenToGraphCoordinates(rect.right, rect.bottom)
```

`fitAndCenter()` (fit everything), `zoomIn()` / `zoomOut()` and
`focusElement(nodeOrEdge)` remain the shortcuts for the common cases.

## The minimap {#minimap}

A first-party plugin: a cached overview of the whole graph docked in a canvas corner,
with a rectangle showing what is on screen. **Click** it to recentre the view;
**drag** the rectangle to pan.

```ts
import { Pivotick, minimap } from 'pivotick'

new Pivotick(container, data, {
    UI: { mode: 'full' },
    plugins: [minimap()],
})
```

```html
<!-- browser build: it hangs off the global, like Node and Edge -->
<script>new Pivotick(el, data, { plugins: [Pivotick.minimap()] })</script>
```

### Options

| Option | Type | Default | What it does |
|---|---|---|---|
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Which corner it docks in. `'bottom-right'` is the only corner the built-in chrome leaves free in `full` mode. |
| `width` | `number` | `200` | Width in CSS pixels, border included. |
| `height` | `number` | derived | Height in CSS pixels. Omitted, it follows the canvas's aspect ratio (clamped to 70–400px) so the rectangle keeps the shape of the real viewport. |

Nothing else is configurable, because nothing else needs to be: the level of detail and
the redraw cadence adapt to the graph.

### What it draws, and what it costs

The minimap maps the **content bounds together with the current viewport**, so the
rectangle is always visible and honestly sized — zoom far out and the graph shrinks
inside the frame rather than the rectangle sliding off it.

It keeps the graph in an offscreen bitmap and only re-rasterises it when the picture
actually changed: on a data change, on every 10th simulation tick while the layout
settles, and on resize. **Panning and zooming redraw one image and one rectangle**, so
navigating costs the same whether the graph has 20 nodes or 50,000.

Detail degrades with size, on purpose:

| Graph | Drawn as |
|---|---|
| ≤ 1500 nodes | a dot per node in the colour the renderer resolved, plus hairline edges (dropped past 4000 edges) |
| > 1500 nodes | one stamp per node in a single ink, alpha accumulating — dense regions read as a density map, and no per-node style is resolved at all |

It appears in `full`, `light` and `viewer` modes. In `static` — which promises no
interactions — it is not mounted, and installing it there warns.

See the [Minimap](/examples/gallery/minimap/content) gallery card for a live one.
