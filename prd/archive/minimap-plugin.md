# Feature — a minimap, and the viewport API that makes it possible as a plugin

**Status:** Done — implemented 2026-08-19 on `worktree-worktree-minimap-plugin`, since merged into develop. Archived.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-19
**Area:** `src/GraphRenderer.ts` + `src/renderers/svg/GraphSvgRenderer.ts` (new viewport API), `src/plugins/minimap/` (new), `src/index.ts` (export), `src/interfaces/Plugin.ts` (stale doc), `docs/plugins.md` (new)
**Type:** Plugin + renderer API
**Related:** [`renderer-abstraction-audit.md`](../renderer-abstraction-audit.md) (WP1–WP8 deferred until a real consumer needs the abstraction — this is that consumer, for one narrow slice); [`filterable-legend.md`](filterable-legend.md) (the canvas-corner inventory, and the cached-render pattern this reuses); [`graph-app-b3-control-layout.md`](../graph-app-b3-control-layout.md) (the chrome it shares corners with)

---

## Implementation (2026-08-19)

`tsc`, `eslint` and `npm run build` clean; `vitepress build docs` clean; `minimap.spec.ts`
7/7, and 50 tests green across the minimap plus `cluster-fit-toggle` (the `fitAndCenter`
canary for D8), `legend`, `ui-chrome` and `mode-rail`.

### Verdict on the foundation

**The plugin API needed no changes at all.** The minimap is a `UIComponent` handed to
`ctx.addElement(el, ctx.layout?.canvas)`, and every capability it uses is public:
`getContentBounds`, `setViewport`, `screenToGraphCoordinates`, `getNodeStyle`,
`getMutableVisibleNodes`, `getEdges`, plus the `dataBatchChanged` / `simulationSlowTick` /
`canvasZoom` events. Only the two new renderer methods were missing, exactly as §3.2/§3.3
predicted. §3.4 held too: `getZoomTransform` was never needed, so d3's `ZoomTransform`
stayed out of the renderer-agnostic surface.

### Changed from the spec while building

- **The canvas renderer was left alone.** §5.1 promised a node-derived `getContentBounds`
  there. It turns out `GraphCanvasRenderer` is a 125-line **`// @ts-nocheck`** stub that
  already implements almost none of `GraphRenderer` (no `fitAndCenter`, no
  `screenToGraphCoordinates`), so adding two half-working methods would have been
  pretending. Both new methods are SVG-only, like the rest of the working surface.
- **CSS colour expressions have to be resolved before a canvas can paint them.** The
  renderer's resolved node colour is normally `var(--pvt-node-color, #007acc)`, and a
  custom property is *substituted* rather than computed, so `getPropertyValue` hands back
  `color-mix(in srgb, var(…) 80%, transparent)` verbatim. Assigning either to `fillStyle`
  is a silent no-op that leaves the previous colour in place — which is why the first
  render drew every dot black. `Minimap.cssColor` parks the expression on a hidden probe
  inside the themed subtree and reads back the computed `color`, cached per rebuild
  (cleared each time, since a theme switch changes the answer). **This is a trap for any
  future canvas-drawn UI in this library.**
- **Click and drag had to be disambiguated.** Preserving the grab offset on *pointerdown*
  meant a click inside the rectangle recentred on the point it was already centred on —
  i.e. did nothing. Now the offset is only applied once the pointer actually moves; a
  press and release without movement is treated as a click and recentres.
- **The viewport is drawn as a shroud, not a fill.** A translucent fill *inside* the
  rectangle washes out the whole minimap in the common fitted-view case (where the
  viewport contains the content), and with `--pvt-theme-primary` being amaranth it read as
  an error state. Everything *outside* the rectangle is dimmed instead, plus a 1px stroke.
- **The `width` option is the outer footprint** (`box-sizing: border-box`), and the pixel
  buffer is sized from the surface's laid-out size rather than the configured number, so
  the border can't distort the aspect ratio.

### Fixed after review (2026-08-19)

**Filtering was not reflected in the minimap.** Hiding nodes goes through the query
engine, which toggles `node.visible` and emits **`filterChange`** — not
`dataBatchChanged`, and not a tick (the simulation is usually idle by then). The minimap
subscribed to neither, so it kept drawing nodes that had left the canvas. It now watches
`queryEngine.on('filterChange')`, which covers the filter panel, the legend's toggles,
programmatic `setFilter` and per-node `excludeNode` alike. `rasterise` was already reading
`getMutableVisibleNodes()`, so this was purely a missing trigger.

Verified by removing the subscription and confirming the new test fails — it reads the
minimap's canvas back and counts node-coloured pixels, so it asserts the *drawing* lost
ink rather than merely that a redraw was scheduled.

**The same defect class, found while fixing it:** with the simulation disabled a node drag
produces no ticks either, so a dropped node kept drawing at its old position. Now also
rebuilds on `dragended` — once per drag, never per `pointermove`, which would put the O(N)
pass back into the frame budget.

The general rule this exposes: **the minimap must subscribe to every signal that changes
what is drawn, and those signals are not all on one bus** — data events on the graph,
filter events on the query engine, drag and tick events on the interaction bus.

### Notes for the next person

- Adding N nodes to a live graph costs one full render **each** — `updateData` loops
  `addNode` — so 1600 incremental adds never finish inside a test budget. The large-graph
  test boots a graph of 1600 nodes in one pass instead (`loadManyNodesWithMinimap`).
- The interaction tests must `waitForViewSettled` first: `fitAndCenterWhenSettled` commits
  a transform several frames after `load` resolves, and it will fight a test that starts
  driving the viewport before then.
- Reading a screenshot file twice in one session can serve stale content; copy it to a
  fresh path when re-checking after a change, or a fixed render looks unfixed.

## 0. Instructions

Relentlessly ask me questions whenever you have a doubt on the implementation.

## 1. What we're trying to achieve

Two things, in this order:

1. **Answer whether the plugin API is a real extension point** by building something
   demanding on it — a minimap needs to read the graph, read the viewport, *drive* the
   viewport, and stay cheap on a big graph. Anything it cannot do through public API is
   a gap in the plugin story, not a reason to reach into internals.
2. **Ship the minimap**: a canvas-corner overview of the whole graph with a rectangle
   showing what's on screen, where clicking recentres the view and dragging the
   rectangle pans it.

## 2. What professional tools do

- **Cytoscape (Navigator) / yFiles (Overview)** — a docked thumbnail whose frame covers
  the graph *and* the current viewport, so the viewport rectangle is always visible and
  correctly sized. Click to jump, drag the rectangle to pan.
- **Gephi (Overview)** — content-bounds only; the viewport indicator can leave the
  frame, which is the failure mode we're avoiding.
- **Miro / Figma-likes** — the minimap grows to include wherever you've wandered, and
  draws a density impression rather than every element once the board is large.

The common thread: the minimap is a *navigation* control, not a faithful second render.
Once the graph is big, tools draw an impression (density, no edges, no labels) — nobody
re-renders 50k elements into 200×140 pixels.

## 3. Is the plugin API a solid foundation? (Yes, with three gaps)

### 3.1 What already works

`src/interfaces/Plugin.ts` defines `PivotickPlugin { name, install(ctx) }`, registered
via `GraphOptions.plugins` or `graph.use()`. `UIManager.installPlugin` de-duplicates by
`name` and hands over a `PluginContext`:

| Capability | Why the minimap needs it |
|---|---|
| `layout` (live, never a snapshot) | `layout.canvas` is the mount point |
| `addElement(el, slot)` | mounts a `UIComponent` and catches it up to the current phase |
| `graph` / `ui` | node positions, data events, options |
| `onPhase` / `addKeybinding` | teardown-safe lifecycle hooks |

`UIComponent` then gives `mount → afterMount → graphReady → destroy` plus `track` /
`listen` / `trackInteraction`, so every listener is torn down with the UI. The
`extend-with-a-plugin` gallery card already pins a canvas overlay this way. The
`PivotickPlugin` doc comment's own example is, verbatim, a minimap.

**Verdict: the extension point is real.** No new plugin machinery is needed.

### 3.2 Gap A — no public way to write the viewport

`grep -rn "setZoomTransform|panTo|centerOn|zoomTo|getBounds" src/` returns nothing. The
renderer offers `fitAndCenter(forceScale?)`, `zoomIn()`, `zoomOut()` and
`focusElement(element)` — a fixed menu, none of which is "put this point in the middle".
`fitAndCenter` does the real work internally:

```ts
const transform = d3ZoomIdentity.translate(translateX, translateY).scale(scale)
canvas.call(zoomBehavior.transform, transform)
```

but on the abstract `GraphRenderer`, `getZoomBehavior()` and `getCanvasSelection()` are
both typed **`unknown`** (lines 34 and 42). A plugin driving the viewport today must cast
both to d3 types and import `d3-zoom` itself — which makes the plugin SVG-specific and
means the plugin API is only sufficient for read-only decoration.

### 3.3 Gap B — no public content bounds

`fitAndCenter` reads `zoomLayerEl.getBBox()`. That is SVG-only, and the abstract
`getZoomGroup()` returns `HTMLElement | SVGElement | null`, so a plugin cannot portably
ask "how big is the graph". Computing bounds from node `x`/`y` in the plugin is possible
but wrong at the edges: it misses labels, cluster bubbles and notes, all of which
`getBBox()` includes for free.

### 3.4 Gap C — `getZoomTransform` is not abstract (not actually a blocker)

Reading the current transform looks like a third gap: `getZoomTransform()` exists only on
`GraphSvgRenderer`, not on `GraphRenderer`. But it is **not needed** —
`screenToGraphCoordinates` *is* abstract, takes **client** coordinates, and inverts the
transform, so the visible rectangle in graph space is:

```ts
const r = canvasEl.getBoundingClientRect()
const topLeft     = renderer.screenToGraphCoordinates(r.left, r.top)
const bottomRight = renderer.screenToGraphCoordinates(r.right, r.bottom)
```

So no new read API is required, and the minimap stays renderer-agnostic. Worth recording
rather than "fixing": adding `getZoomTransform` to the abstract class would leak d3's
`ZoomTransform` type into the renderer-agnostic surface, which the audit PRD explicitly
warns against.

### 3.5 What the minimap can already get

Node positions (`graph.getMutableNodes()` — `getNodes()` clones every node), resolved
colours (`renderer.getNodeStyle(node).color`), and change signals: `canvasZoom`,
`simulationTick`, `simulationSlowTick` (every 10th tick, `Simulation.ts:514`) and
`dataBatchChanged`. There is **no** canvas-resize event, so the minimap brings its own
`ResizeObserver`.

## 4. Decisions (grilling session, 2026-08-19)

| # | Question | Decision |
|---|---|---|
| D1 | Where does viewport control come from? | **Add a minimal public API first:** `getContentBounds()` and `setViewport({ x, y, scale?, animate? })` on the renderer. The minimap then uses public API only — no d3 casts, no SVG coupling. |
| D2 | What can the user do with it? | **Click to recentre** and **drag the viewport rectangle**. No box-zoom, no wheel-zoom — so no rect-fitting call is needed and the API stays at two methods. |
| D3 | How does drawing degrade with size? | **Two paths.** ≤1500 nodes: anti-aliased dots + hairline edges (edges dropped past 4000 edges). Above: pixel stamps into an `ImageData`, no edges — dense regions saturate into a density map. |
| D4 | What area does it map? | **Content bounds ∪ current viewport**, so the rectangle is always visible and honestly sized. |
| D5 | How does it ship? | `minimap(options?)` **exported from the package root**, plus `Graph.minimap` for the UMD/IIFE builds. |
| D6 | What options? | `position` (default `'bottom-right'`), `width` (default 200), optional `height` (defaults to the canvas aspect ratio). **Nothing else** — no keybinding, no `interactive: false`, no `showEdges`. *Revised after the fact:* a small collapse toggle was asked for and added, with `collapsed` for the state it opens in — collapsing was the one omission that a corner-docked panel is genuinely expected to have. |
| D7 | Which modes? | `full`, `light`, `viewer`. **`static` gets no minimap at all** — `install` no-ops with one warning, since it was requested explicitly. |
| D8 | Refactor `fitAndCenter`? | It keeps its own bounds and scale math; only its **final transform write** becomes a `setViewport` call. Identical output by construction, one writer. |
| D9 | Deliverables | This PRD → implementation → a **minimal** visual spec → gallery card → new `docs/plugins.md`. |

Smaller calls made while building, open to revision:

- Styles live in `src/plugins/minimap/minimap.scss`, imported by the module like every
  other element's stylesheet.
- The minimap brings a `ResizeObserver` on the canvas (§3.5).
- The stale `PluginContext.layout` doc comment (it still lists `graphcontrols` /
  `graphtoolbar`, slots that no longer exist) gets corrected in passing.

## 5. Proposal

### 5.1 The viewport API

Two methods, abstract on `GraphRenderer` and implemented by both renderers.

```ts
/** A rectangle in graph coordinates. */
export interface GraphBounds {
    x: number
    y: number
    width: number
    height: number
}

/** Where to point the view. `x`/`y` is the graph-space point to centre. */
export interface ViewportTarget {
    x: number
    y: number
    /** Absolute zoom scale. @default the current scale */
    scale?: number
    /** Animate the move. @default false */
    animate?: boolean
}

abstract class GraphRenderer {
    /**
     * The extent of everything drawn, in graph coordinates — `null` when there is
     * nothing to measure (no data, or a detached / zero-size canvas).
     */
    abstract getContentBounds(): GraphBounds | null
    /** Centre the view on a graph-space point, optionally changing the scale. */
    abstract setViewport(target: ViewportTarget): void
}
```

**SVG implementation.** `getContentBounds` returns `zoomGroup.getBBox()` (already the
source of truth for `fitAndCenter`), guarded for the detached / zero-size / empty-bbox
cases that make d3-zoom throw. `setViewport` computes
`translate = canvasSize/2 - scale * point` and writes it exactly as `fitAndCenter` does
today, honouring `options.zoomAnimation` when `animate` is set.

**Canvas implementation.** The experimental renderer has no `getBBox`, so
`getContentBounds` is computed from node positions inflated by each node's radius —
documented as an approximation (it excludes labels).

**`fitAndCenter` (D8)** keeps every line of its bounds and scale math and ends with
`this.setViewport({ x: midX, y: midY, scale, animate: this.options.zoomAnimation })`.

### 5.2 The minimap component

`src/plugins/minimap/Minimap.ts` — a `UIComponent` mounted into `layout.canvas`.

**Two layers, and this is the whole performance story.**

| Layer | Redrawn when | Cost |
|---|---|---|
| **Content bitmap** (offscreen canvas) | data changed, `simulationSlowTick`, settle | O(N) — rare |
| **Visible canvas** = blit + rectangle | pan, zoom, drag, resize | O(1) — one `drawImage` + one `strokeRect` |

The bitmap is rasterised for the **content bounds**. The visible canvas maps
`content ∪ viewport` (D4), so a zoom-out is one *transformed* `drawImage` of the cached
bitmap — never a re-rasterisation. That is what keeps interaction O(1) at any graph size.

**Level of detail (D3).** Measured once per rebuild off `graph.getMutableNodes()`:

```
N ≤ 1500   ctx.arc() per node in its resolved colour
           + hairline edges at low alpha, skipped when E > 4000
N > 1500   one pass writing pixel stamps into an ImageData, no edges
```

**Rules the implementation must respect**, all learned the expensive way elsewhere:

- `getMutableNodes()`, never `getNodes()` (it clones every node).
- `getNodeStyle()` allocates a ~20-field object and resolves strings — call it once per
  node **per rebuild**, cache the colours in a parallel array, never per frame.
- Coalesce every rebuild trigger into a single `requestAnimationFrame`.
- While hidden (`display: none`, zero-size, or off-screen) do nothing at all.
- Draw at `devicePixelRatio` capped to 2.

### 5.3 Interactions (D2)

| Gesture | Effect |
|---|---|
| Click / tap the minimap | `setViewport({ x, y })` — recentre, scale unchanged |
| Drag the viewport rectangle | `setViewport({ x, y })` per `pointermove`, via pointer capture |
| — | No box-zoom, no wheel-zoom |

Minimap pixels → graph coordinates is the inverse of the blit transform. The rectangle
is `pointer-events: none`; the whole minimap surface is the drag target, so a drag
started anywhere behaves as "bring the view here, then follow".

### 5.4 Placement & DOM

Mounted into `.pvt-canvas`, absolutely positioned, **bottom-right by default** — the only
free corner on the current chrome (mode rail + tool panel + flyout top-left; navigation
pill + notifications top-right; legend + sidebar collapse toggle bottom-left; the slide
panel covers the right edge only while open, which is the same trade the legend makes
with the flyout). `z-index: 5`, themed with the existing chrome variables.

```
┌─ canvas ──────────────────────────────────────┐
│ [rail][tool panel]              [zoom][notif] │
│                                               │
│                                               │
│ ┌ Legend ─────┐              ┌──────────────┐ │
│ │ ● Hub    12 │              │  ·· ┌────┐   │ │
│ │ ● Leaf    8 │              │ ·╲╱·│ ·· │   │ │
│ └─────────────┘              │  ·· └────┘   │ │
│  (o) ← collapse              └──────────────┘ │
└───────────────────────────────────────────────┘
```

### 5.5 Shipping & config (D5, D6)

```ts
export interface MinimapOptions {
    /** @default 'bottom-right' */
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    /** Width in CSS pixels. @default 200 */
    width?: number
    /** Height in CSS pixels. @default derived from the canvas's aspect ratio */
    height?: number
}

export function minimap(options?: MinimapOptions): PivotickPlugin
```

Exported from `src/index.ts` and attached as `Graph.minimap` alongside `Node` / `Edge` /
`ColorPaletteMapper` / `UIComponent`, so the browser builds can reach it.

## 6. What the consumer does

```ts
import { Pivotick, minimap } from 'pivotick'

new Pivotick(container, data, {
    UI: { mode: 'full' },
    plugins: [minimap()],
})
```

```ts
// placement + size, and installed after the fact
graph.use(minimap({ position: 'bottom-left', width: 260 }))
```

```html
<!-- browser build -->
<script>new Pivotick(el, data, { plugins: [Pivotick.minimap()] })</script>
```

## 7. Open questions / risks

1. **`getBBox()` on a big graph.** It forces layout of the whole zoom layer. It is
   already called on every `fitAndCenter`, and the minimap calls it once per *rebuild*
   (not per frame), but on a 50k-node SVG this may be the dominant cost. If it shows up,
   the fallback is the canvas renderer's node-derived bounds for both renderers.
2. **Content bounds while the simulation runs.** Bounds grow and shrink as nodes settle,
   so the minimap's scale drifts for the first seconds. Rebuilding on `slowTick` damps
   it; if it still reads as jitter, quantise the bounds (round outwards to a grid).
3. **Notes are not drawn** (D3 lists nodes and edges only), so a note-only region of the
   canvas is invisible in the minimap even though `getContentBounds` includes it.
4. **`static` mode** gets no minimap; a consumer who installs the plugin for every mode
   sees one warning per static graph. If that turns out noisy, downgrade to `debug`.
5. **The canvas renderer** is experimental, so its `getContentBounds` is approximate and
   its `setViewport` is only as good as its zoom support.

## 8. Acceptance criteria

1. `plugins: [minimap()]` on a `full`-mode graph renders a bottom-right minimap showing
   every node, with a rectangle matching the visible region.
2. The rectangle's graph-space geometry equals the region derived from
   `screenToGraphCoordinates` on the canvas corners — asserted numerically, within a
   pixel of tolerance, not by screenshot.
3. Clicking the minimap recentres the main view on that point; the scale is unchanged.
4. Dragging the rectangle pans the main view continuously and ends where released.
5. Zooming or panning the main view moves the rectangle **without** re-rasterising the
   content bitmap (assert the rebuild counter doesn't advance).
6. Past the LOD threshold the density path is used, no edges are drawn, and a
   several-thousand-node graph still renders inside one frame budget.
7. `getContentBounds()` returns the graph's extent and `null` for an empty graph;
   `setViewport({ x, y })` leaves the scale untouched while `{ x, y, scale }` applies it.
8. `fitAndCenter()` produces the same transform it did before D8's change.
9. No minimap in `static` mode, one warning; present in `full`, `light` and `viewer`.
10. `minimap({ position, width, height })` honours all three; the default height follows
    the canvas's aspect ratio.
11. Destroying the graph removes the minimap, its listeners, its `ResizeObserver` and its
    pending frame (no leaks, no errors).
12. `tsc`, `eslint` and `npm run build` clean; `vitepress build docs` clean; the new
    (minimal) spec green with no unrelated baseline churn.
13. Docs: `docs/plugins.md` covering the plugin API and `minimap(options)`, a nav entry,
    and a gallery card with its `pic.png`.

## 9. Work plan

| Step | Scope |
|---|---|
| 1 | `GraphBounds` / `ViewportTarget` + the two abstract methods; SVG and canvas implementations; `fitAndCenter` delegates its write (D8) |
| 2 | `src/plugins/minimap/`: the `Minimap` component (two layers, cached bitmap, LOD) |
| 3 | Interactions: click-to-recentre, drag the rectangle (pointer capture) |
| 4 | `minimap()` factory + `src/index.ts` export + `Graph.minimap`; `minimap.scss` |
| 5 | `ResizeObserver`, visibility short-circuit, teardown |
| 6 | Minimal visual spec + harness support |
| 7 | `docs/plugins.md` + nav entry + gallery card (with `pic.png`) |
| 8 | Fix the stale `PluginContext.layout` doc comment |
