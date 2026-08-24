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
| `addDockTab(tab)` / `removeDockTab(id)` | a pane in the bottom dock — the same door the built-in table comes through |
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

### Contributing a dock pane {#dock-tab}

`ctx.addDockTab` puts a pane in the [bottom dock](/ui-table#dock-tabs), beside the data
table. The dock owns the region — its height, its divider, its fold and the strip that
names the panes — and your pane owns what is in it:

```ts
const auditLog: PivotickPlugin = {
    name: 'auditLog',
    install: (ctx) => ctx.addDockTab({
        label: 'Audit',
        render: () => buildPane(ctx.graph),   // once, on first activation
        toolbar: () => [clearButton],         // on every activation
        onActivate: () => resumePainting(),
        onDeactivate: () => stopPainting(),
    }),
}
```

Four things are worth knowing:

- **A tab is a pane, not a view of one.** If your pane has several views of its own, it
  stays a single dock tab and draws its own switch in `toolbar`, calling
  `handle.refresh()` to change body — which re-invokes `render`. That is exactly what the
  data table does for `Nodes` / `Edges`, and why the dock's strip never flattens one
  pane's views out beside another pane. Switching your own DOM behind the dock's back does
  not work: it keeps the element `render` gave it, and would re-attach a stale node on the
  next activation. Draw an inner switch as a segmented control, not as tabs — the outer
  level already looks like tabs.
- **The first pane builds the region.** Plugins install *after* the UI is built, so a tab
  always arrives too late for the dock's own mode gate to have said yes on its behalf.
  Registering one brings the dock into being, which means your plugin works with
  `UI.table: false` and needs nothing turned on but `full` mode.
- **`render` is called once, lazily**, the first time the pane is opened; the element is
  kept and re-attached afterwards, so it holds its own scroll position. `toolbar` is
  rebuilt on every activation, so its controls can read your pane's current state.
- **`onActivate` / `onDeactivate` are the only signal that you are off screen**, and what
  to do with them depends on your pane. Content that is a function of the graph's current
  state can stop working while hidden and re-derive on return — that is what the table
  does. Content that would *miss* something has to keep working and merely stop painting —
  that is what the event log does. Nothing about the hooks prefers either.

A tab is not a `UIComponent`, so nothing drives lifecycle phases into it. When your pane
needs `graphReady`, do what `eventLog()` does: hold a `UIComponent`, `addElement` it, and
call `addDockTab` from its `onMount`.

See the [Add a dock pane](/examples/gallery/dock-panes/content) gallery card for a live,
complete example — a pane with two views of its own, beside the data table.

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
**drag** the rectangle to pan. A very small toggle in the corner it faces folds it away
to just that button, and brings it back.

**`full` mode mounts one for you** — it is part of that mode's chrome, like the header,
the sidebar and the mode rail. Every other mode leaves it to you:

```ts
// full mode: already there, nothing to install
new Pivotick(container, data, { UI: { mode: 'full' } })

// any other mode: ask for it, with `UI.minimap` …
new Pivotick(container, data, { UI: { mode: 'light', minimap: true } })

// … or as the plugin it is
import { Pivotick, minimap } from 'pivotick'
new Pivotick(container, data, { UI: { mode: 'light' }, plugins: [minimap()] })
```

`UI.minimap` takes the same {@link MinimapOptions} the plugin does, so
`{ minimap: { position: 'top-left' } }` configures the one full mode brings along.
`UI.minimap: false` suppresses it. Passing your own `minimap()` in `plugins` also wins —
full mode stands aside rather than mounting a second one — so an existing
`plugins: [minimap({ … })]` keeps working exactly as it did.

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
| `collapsed` | `boolean \| 'auto'` | `false`, or `'auto'` for the one `full` mode mounts | Which state it opens in. The toggle is always there; this is only where it starts. See [Getting out of the way](#minimap-auto) for `'auto'`. |

Nothing else is configurable, because nothing else needs to be: the level of detail and
the redraw cadence adapt to the graph.

### Getting out of the way {#minimap-auto}

A minimap you asked for stays where you put it. The one `full` mode mounts on your behalf
was not asked for, so it opens `collapsed: 'auto'` and takes the canvas into account: it
stays open while the canvas is at least **four minimaps wide and tall**, and folds itself
away to the toggle below that. It keeps following the canvas from then on — folding away
when the sidebar opens over it or the window narrows, coming back when the room does.

The moment anyone folds it away or brings it back — by the toggle, or through
`setCollapsed()` — that stops: an explicit choice sticks, and no later resize overrides
it. Pass an explicit `collapsed: true` / `false` to opt out of `'auto'` from the start.

The toggle's arrow points at the corner the minimap docks in — the direction it folds
away — and flips once it is collapsed. Folded away it draws nothing at all, not even the
rectangle, so it costs nothing while it is out of the way; opening it re-rasterises for
whatever the canvas looks like by then. `setCollapsed(boolean)` and `isCollapsed()` on the
`Minimap` instance drive the same thing from code.

### What it draws, and what it costs

The minimap maps the **content bounds together with the current viewport**, so the
rectangle is always visible and honestly sized — zoom far out and the graph shrinks
inside the frame rather than the rectangle sliding off it.

It keeps the graph in an offscreen bitmap and only re-rasterises it when the picture
actually changed: on a data change, when a filter hides or restores nodes, when a node is
dropped after a drag, on every 10th simulation tick while a layout settles, and on resize.
**Panning and zooming redraw one image and one rectangle**, so navigating costs the same
whether the graph has 20 nodes or 50,000.

Detail degrades with size, on purpose:

| Graph | Drawn as |
|---|---|
| ≤ 1500 nodes | a dot per node in the colour the renderer resolved, plus hairline edges (dropped past 4000 edges) |
| > 1500 nodes | one stamp per node in a single ink, alpha accumulating — dense regions read as a density map, and no per-node style is resolved at all |

It works in `full`, `light` and `viewer` modes, and `full` is the one that mounts it
without being asked. In `static` — which promises no interactions — it is not mounted, and
installing it there warns.

See the [Minimap](/examples/gallery/minimap/content) gallery card for a live one.

## The event log {#event-log}

`eventLog()` puts a pane in the [bottom dock](/ui-table#dock-tabs) listing what the graph
is emitting, newest first: every data change, every filter, every selection, with a
timestamp and a one-line subject.

```js
import { Pivotick, eventLog } from 'pivotick'

new Pivotick(container, data, { UI: { mode: 'full' }, plugins: [eventLog()] })
// …or at any point later:
graph.use(eventLog({ limit: 100, kinds: ['data'] }))
```

It is a development instrument — off by default, because nobody wants an event log they
did not ask for. What it shows is exactly what your own handlers would have seen: it
subscribes to the public buses (`graph.on`, `graph.queryEngine.on`, and the interaction
bus for the selection) and reaches for nothing else.

### Options

| Option | Default | What it does |
|---|---|---|
| `kinds` | all three | Which buses to record: `'data'`, `'filter'`, `'selection'` |
| `limit` | `500` | Entries kept; the oldest fall off. A bulk import emits thousands |
| `paused` | `false` | Start out not recording |
| `label` | `'Events'` | The tab's label |
| `id` / `order` | auto | Identity, and placement in the strip |

The header carries a count, a kind filter, **Pause** — which stops recording without
dropping what is already listed — and **Clear**.

### Why it exists

It is the dock's second occupant, and therefore the proof that
[`addDockTab`](#dock-tab) is enough to build a pane with rather than a hole shaped like
the data table. It shares the region's row, height and fold with the table and asked for
no concessions to get there — it sits beside it as `Table │ Events`.

It also uses the activation hooks the **opposite** way round from the table, which is the
part worth copying. The table stops working when it is off screen and re-derives on
return, because its content is a function of the graph's current state. The log cannot do
that — an event is gone once it has fired — so it keeps recording while hidden and only
stops *painting*, flushing the backlog when it comes back.

It needs `full` mode, since that is the only mode with a dock; installing it elsewhere
warns rather than failing silently.
