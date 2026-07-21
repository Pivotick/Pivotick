# Renderer Abstraction Audit

> **Status**: Complete (2026-07-15). Ground rules agreed, sweep done, findings verified.
> **Deliverable**: audit report only — no code changes. This document is the sole input for a
> separate refactor session/agent, so it must be self-contained: every finding carries
> file:line, rationale, and a concrete proposed fix.

## 1. Ground rules & shared understanding

These decisions were made deliberately and are **premises, not open questions**. The refactor
agent must not relitigate them.

### 1.1 Purpose

Only the SVG renderer is officially supported today; the canvas renderer is a discarded
experiment (it will be redone from scratch if ever pursued). The goal of this audit is to make
the rendering *interface* correct, so that a future canvas or WebGL renderer is feasible:

1. Audit the `GraphRenderer` abstract contract itself (`src/GraphRenderer.ts`, incl.
   `AbstractSelectionBox`) against a hypothetical DOM-less renderer — method-by-method
   verdicts (keep / rename / retype / move-down / remove / add) with proposed signatures.
2. Audit all leakage outside `src/renderers/`: direct SVG/DOM/d3-selection use, casts to
   `GraphSvgRenderer`, and SVG-world concepts embedded in UI, editing, plugins, utils, and
   core classes.

### 1.2 Boundary model (the yardstick)

Three planes decide what counts as a violation:

- **Graph-content plane** — nodes, edges, clusters, labels, highlight/selection visuals,
  shadow edge, lasso/selection box, note→node connector lines. Fully renderer-owned. Any code
  outside `src/renderers/` that touches its DOM, assumes per-element DOM exists, or holds d3
  selections of it is a finding.
- **UI-chrome plane** — sidebar, toolbar, modals, context menus, notifier, tooltips, prompts.
  HTML by design; *not* a finding. But chrome that positions itself relative to graph content
  must do so via renderer coordinate/query APIs (`graphToScreenCoordinates`,
  closest-element queries) — querying SVG elements directly is a finding.
- **Notes plane** — notes are rich sanitized-Markdown HTML, **an HTML overlay by design in
  every renderer** (re-implementing Markdown as canvas drawing is a non-goal, forever). Note
  *content* DOM is exempt; note *positioning* (zoom-space transform) and the note→node
  connector line are renderer-owned.

### 1.3 HTML-in-graph-space policy (capability tiers)

`foreignObject` usage today spans four sites: `renderNode` custom HTML nodes,
`NodeStyle.html`, HTML edge labels, and notes. Policy:

- The **base contract requires graph-space HTML positioning only at O(1) scale: notes.**
  Every renderer must be able to position a scale-independent number of HTML elements
  (dozens) in zoom space. For a non-DOM renderer this is an absolutely-positioned overlay
  container whose CSS transform mirrors the zoom — cheap and required.
- **Per-element HTML content (`renderNode`, `NodeStyle.html`, HTML edge labels) is an
  optional, named capability.** It scales O(n) and would defeat the purpose of a
  performance renderer; canvas/WebGL renderers are not obliged to implement it. SVG
  implements it — `foreignObject` is a legitimate *private mechanism inside the renderer
  boundary*, not a finding per se. The findings are: the capability is unnamed, implemented
  ad-hoc four times, and has no fallback path.
- **Universal fallback**: every node/edge always has a resolved visual spec (§1.4), so a
  renderer without the HTML capability draws the spec instead — nothing is ever undrawable.
- In one sentence: *the base contract requires graph-space HTML only at O(1) scale (notes);
  per-element HTML is an optional capability with a spec-drawing fallback, which SVG
  implements via foreignObject as a private mechanism.*

### 1.4 Visual vocabulary is hoisted (appearance resolution is core)

The target contract separates *appearance resolution* from *drawing*: a renderer-agnostic
layer resolves each node/edge to a visual spec (shape, size, fill, stroke, icon, label,
marker, highlight/dim/selection state); renderers only translate that spec to their medium.
Consequences:

- Default styles move out of `GraphSvgRenderer` into core.
- Visual states that exist only as CSS classes become explicit spec states a non-DOM renderer
  can consume.
- `utils/NodePreview.ts` becomes legitimate by drawing the same resolved spec (SVG is fine for
  UI chrome); it must stop re-deriving appearance independently.

### 1.5 Public API policy: escape-hatch pattern

Pivotick is a *hackable* library (v1.2.0); reaching into the SVG is a selling point, not an
accident. SVG-specific capabilities are therefore **moved down, never deleted**: they live on
`GraphSvgRenderer`, reachable by explicit narrowing (`instanceof` / typed accessor), and are
documented as renderer-specific. The abstract `GraphRenderer` contract must be fully
implementable by a DOM-less renderer. Breaking (major-version) changes are acceptable;
capability loss is not — except that non-SVG renderers may lack the optional per-element HTML
capability per §1.3.

### 1.6 GraphInteractions is in scope, as intended-shared infrastructure

The model to enforce: *`GraphInteractions` = renderer-agnostic event bus + selection state;
per-renderer `EventHandler` = the adapter translating raw DOM/canvas events into it.* Any
SVG/d3 assumption inside `src/GraphInteractions.ts` is a finding, including its generic type
parameter (`GraphInteractions<unknown>` on the contract) and the question of why the renderer
owns selection state.

### 1.7 The canvas renderer is evidence, not a target

`src/renderers/canvas/` is a discarded experiment. It is read as *evidence* — where it stubs
or contorts to satisfy the contract, that proves the contract is SVG-shaped, and findings cite
it. No parity gap-list, no fixes proposed for it. Sole exception: if the factory's `'canvas'`
path is user-reachably broken (e.g. crashes on selection), that is one finding.

### 1.8 Peripheral surfaces

- **SCSS (`src/styles/`)**: in scope at the *mechanism* level only — e.g. "highlight state
  lives solely in CSS classes on SVG elements, which a non-DOM renderer cannot consume". Not
  rule-by-rule.
- **Visual tests (`tests/visual/`)**: out of scope; they legitimately test the SVG renderer.
- **Docs & gallery (`docs/`)**: out of scope for findings; a doc-debt appendix lists pages the
  contract changes would invalidate.
- **Demo/scratch files** (`src/main.ts`, `src/ail-graph*.ts`, `src/vt-graph.ts`): exempt.

### 1.9 Severity taxonomy & work-package format

- **blocker** — the contract is unimplementable by a DOM-less renderer without this change.
- **major** — code bypasses the contract (direct SVG/d3 access, casts to the SVG renderer).
- **minor** — type-level or cosmetic SVG-ism.

Findings are bundled into work packages sized roughly one PR/session each,
dependency-ordered (contract changes first, callers after), tagged S/M/L for effort.

## 2. Target contract

Two hard pieces of evidence frame everything below:

- The experimental canvas renderer implements **2 of the 26 abstract methods** and compiles
  only because every file is `// @ts-nocheck` (`renderers/canvas/*.ts:1-2`). The contract has
  never been implementable twice.
- The three escape hatches (`getCanvasSelection`, `getZoomBehavior`, `getZoomGroup`) have
  **zero call sites outside `GraphRenderer` itself** (the base class calls `getZoomGroup()`
  in `toggleLayoutProgressVisibility`, `GraphRenderer.ts:94`). Removing them from the base
  contract breaks no internal caller.

### 2.1 New shared types (core)

```ts
// src/interfaces/RendererContract.ts (new)
export interface ViewportTransform { x: number; y: number; scale: number }
export interface ScreenBBox { x: number; y: number; width: number; height: number }
export interface RendererCapabilities {
    /** Per-element HTML content: renderNode / NodeStyle.html / HTML edge labels (§1.3). */
    perElementHtml: boolean
}
```

### 2.2 `GraphRenderer` — method-by-method verdicts

| Member (`src/GraphRenderer.ts`) | Verdict | Rationale / new shape |
|---|---|---|
| `init()`, `update(dataChanged)`, `destroy()` | **keep** | Already renderer-agnostic. |
| `nextTick()`, `nextTickFor(nodes)` :32-33 | **keep** | Position-sync from model data. |
| `getOptions()` :31 | **keep** | |
| `getNodeStyle(node)` :30 | **remove** (→ core) | Style resolution is hoisted (§1.4): core `resolveNodeStyle(node)` merges default → `nodeStyleMap` → `node.style` → `styleCb`. Renderers and `NodePreview` consume the same resolved spec. Keep a deprecated delegate for one release. |
| `getZoomBehavior(): unknown` :34 | **move down** | SVG-only concept typed `unknown`. Lives on `GraphSvgRenderer` as `getZoomBehavior(): ZoomBehavior<SVGSVGElement, unknown>` (already the impl at `GraphSvgRenderer.ts:410`). Base replacement: the viewport API below. |
| `getCanvasSelection(): unknown` :42 | **move down** | d3-selection escape hatch. Stays on `GraphSvgRenderer` (typed `Selection<SVGSVGElement, …>`, impl :636). Zero external callers today. |
| `getZoomGroup(): HTMLElement \| SVGElement \| null` :43 | **remove** | Only caller is the base class's own progress-bar logic (:94). Both leave together (see progress bar row). SVG subtype keeps a typed accessor. |
| `screenToGraphCoordinates` / `graphToScreenCoordinates` :35-36 | **keep** | The cornerstone of the chrome-positioning pattern; `EdgeCreationSession` proves it works (§3.4). |
| — | **add** `getViewportTransform(): ViewportTransform` / `setViewportTransform(t, animate?)` | Semantic replacement for `getZoomBehavior`/d3 zoom access. SVG impl already exists as `getZoomTransform()` (`GraphSvgRenderer.ts:414`, subtype-only today). |
| — | **add** `getElementScreenBBox(el: Node \| Edge \| Note): ScreenBBox \| null` | What Tooltip/ShadowLinkManager actually need (they currently read `getGraphElement().getBoundingClientRect()`, §3.5). SVG impl = BCR read; canvas impl = transform math over model geometry. |
| `zoomIn()` / `zoomOut()` :44-45 | **keep** | |
| `fitAndCenter(fitAndCenter?: number)` :46 | **keep** (fix param name) | Abstract declares the scale param as `fitAndCenter?` while the impl calls it `forceScale` — rename to `forceScale?`. |
| `fitAndCenterWhenSettled` :60 | **keep** | |
| `focusElement(element)` :47 | **keep** (fix impl) | SVG impl reads position from the DOM transform matrix (`transform.baseVal`, `GraphSvgRenderer.ts:788-796`) instead of `node.x/y` — must use model data (F15). |
| `highlightElement` / `unHighlightElement` / `clearHighlightedElements` :48-50 | **retype** (state → core) | Highlight state currently exists *only* as a DOM class (F14) — unknowable to a non-DOM renderer. Core gains a highlight store (on `Graph` or `GraphInteractions`); `Graph.highlightElement` mutates the store and triggers `update(false)`; renderers read the store like they read selection. The renderer methods become internal. |
| `getClosestElementToCursor` / `getNodeClosestToCursor` :38-39 | **remove** (→ core) | Both impls are pure math over model data + zoom transform (`GraphSvgRenderer.ts:925-1016`) — nothing SVG in them. Hoist to a core hit-tester built on `screenToGraphCoordinates` + `GraphInteractions.getLastPointerEvent()`. (Incidental: `getClosestElementToCursor` never checks edges despite its return type.) |
| `getSelectionBox(): AbstractSelectionBox \| null` :40 | **replace** | `AbstractSelectionBox` has a single member, `selectionInProgress()`. Replace with `isAreaSelectionInProgress(): boolean` on the renderer (or on `GraphInteractions`); delete `AbstractSelectionBox` (:152-154). |
| `getGraphInteraction(): GraphInteractions<unknown>` :41 | **keep, retype** | Becomes `getGraphInteraction(): GraphInteractions` once `TElement` dies (§2.3). The `@ts-expect-error` on the SVG override (`GraphSvgRenderer.ts:907`) is the type-level proof the current generic doesn't work. Canonical access moves to `graph.interactions` (ownership, §2.3); this stays as an accessor. |
| `toggleLassoMode(enabled)` :37 | **keep** | Implementable in any renderer (polygon overlay + hit test). |
| `showShadowEdge(params)` / `hideShadowEdge()` :51-52 | **keep** | Already the model contract citizen: model objects + positions + semantic `invalid` flag in, drawing renderer-owned. |
| `enterNoteEditMode(note)` :53 | **keep** | Part of the required notes overlay (§1.3). |
| `getCanvas(): HTMLElement` :70 | **keep, rename** `getHostElement()` | Every renderer mounts in an HTML host; the name "canvas" collides with the canvas-renderer concept. |
| `setupRendering()` / `createHtmlProgressBar()` / `updateLayoutProgress()` / `toggleLayoutProgressVisibility()` + fields `progressBar/timerLabel/textLabel/loadingPb` :15-20, 74-148 | **remove from base** (→ UI chrome) | An HTML loading overlay hard-coded into the abstract renderer, which also toggles a `hidden` class on the zoom group (:94-96) — the direct cause of the canvas stub crashing in the base class. Replacement: renderer/simulation report progress via an event (`layoutProgress` on the interaction bus or a Graph event); a `UIManager` element owns the overlay; content hiding becomes `abstract setContentVisible(visible: boolean)`. |
| — | **add** `readonly capabilities: RendererCapabilities` | §1.3. SVG: `{ perElementHtml: true }`. |
| — | **add** notes-overlay obligation (doc-level) | Rendering visible notes as positioned HTML in zoom space is part of `update()`/`nextTick()`'s contract (§1.3), stated in the class TSDoc so renderer #2 can't miss it. |

### 2.3 `GraphInteractions` — verdicts

- **Kill the `TElement` generic** (`GraphInteractions.ts:9`, `interfaces/GraphInteractions.ts`).
  Selection state becomes identity-based: `NodeSelection`/`EdgeSelection` drop their
  `element` field; `selectNode(node)`, `selectNodes(nodes: Node[])`, etc. The `element`
  parameter in `GraphInteractionEvents` and user-facing `InterractionCallbacks` is retyped to
  a documented opaque handle (`element: unknown /** renderer handle; SVG: SVGGElement */`)
  for one major version — capability preserved via the escape hatch
  `GraphSvgRenderer.getNodeElement(node)` (§2.5). This single change unblocks F9/F21 and
  removes the `@ts-expect-error`.
- **Ownership moves to `Graph`**: the factory currently constructs interactions and hands
  them to the renderer (`GraphRendererFactory.ts:48`), and callers reach them via
  `graph.renderer.getGraphInteraction()`. Selection is application state, not render state —
  `Graph` creates and owns the instance (`graph.interactions`), passes it to the renderer.
  Subgraph code (`GraphInteractions.ts:535,546`) then stops reaching *through* renderers.
- **Semantic zoom events**: `canvasBeforeZoom(event: unknown)` / `canvasZoom(event: unknown)`
  (:412, :431; `interfaces/GraphInteractions.ts:59-60`) pass d3's zoom event as `unknown`.
  Retype payload to `{ transform: ViewportTransform, sourceEvent?: Event }`.
- **Delete the dead DOM probe**: `element as HTMLElement` +
  `classList.contains('pvt-node-expanded')` with an empty body (`GraphInteractions.ts:92-96`).
- The event *vocabulary* itself (node/edge/note/canvas events, selection events, tick events)
  is renderer-agnostic and **keeps** — per-renderer `EventHandler`s remain the adapters.

### 2.4 Options & style vocabulary (`src/interfaces/RendererOptions.ts`)

- **`NodeStyle`**: semantic and portable — keep. `CustomNodeShape.d` (:213-215) and marker
  `pathD` are SVG *path syntax* but portable (canvas draws them via `Path2D`); declare "SVG
  path data" the library's shape language rather than an SVG-ism. `textAnchorPosition`
  (:252) keeps with documented semantic meaning. `html` (:290) moves under the
  `perElementHtml` capability (§1.3).
- **`MarkerStyle`** (:367-378): `pathD` portable; `viewBox`/`refX`/`refY`/`markerWidth`/
  `markerHeight`/`markerUnits`/`orient` are SVG `<marker>` positioning semantics. Verdict:
  keep the fields but **respecify them renderer-neutrally** in TSDoc (a canvas renderer can
  honour them with `Path2D` + an affine transform); no rename needed.
- **`renderNode` / `renderLabel` / `renderCluster`** (:41, :66, :93): capability-gated per
  §1.3, each with the spec-drawing fallback. Docs updated (§5).
- **`RendererType`** (:192): docstring says `'canvas'` is "barely supported"; the factory
  throws for it (`GraphRendererFactory.ts:51`). Tell the truth: `'canvas'` reserved /
  not implemented.
- **Defaults move to core**: `defaultNodeStyle`/`defaultEdgeStyle`/`defaultLabelStyle`/
  `defaultMarkerStyleMap` are defined in `GraphSvgRenderer.ts:74-233` and re-exported to the
  public docs API from there (`docIndex.ts:19`). Move to e.g. `src/style/defaults.ts`;
  the canvas experiment's drifted copies (`GraphCanvasRenderer.ts:14-31` — `opacity: 0.8`
  vs `1.0`, `minZoom: 0.1` vs `0.05`, CSS-var wrappers dropped) are the proof of why.

### 2.5 `GraphSvgRenderer` — the escape hatch surface (§1.5)

Everything removed from the base stays available here, explicitly typed, documented as
SVG-specific, reached by narrowing (`instanceof GraphSvgRenderer` or a typed
`asSvgRenderer()` helper): `getCanvasSelection()`, `getZoomBehavior()`, `getZoomGroup()`,
`getZoomTransform()`, `getNodeSelection()/getEdgeSelection()/getNoteSelection()`
(:895-905), `defs`, and **new** `getNodeElement(node)/getEdgeElement(edge)/getNoteElement(note)`
— the replacement for the model classes' `getGraphElement()` (F19/F20). The factory's
overload that returns `GraphSvgRenderer` for `type: 'svg'` (`GraphRendererFactory.ts:29-33`)
already gives typed access without a cast.

### 2.6 Deferred design note — clusters (no work package)

Expanded clusters are rendered by instantiating a nested `Graph` and appending its SVG
`.zoom-layer` into the parent node's `<g>` (`ClusterDrawer.ts:289-292`), with `<defs>`
radial gradients (:652-682) and `getBBox`-driven radius math (:521-596). The *state*
(`node.expanded`) is model-clean, but the *architecture* assumes one renderer's DOM can be
embedded in another's. A DOM-less renderer needs a different composition model (nested
viewports / render-to-texture). This is a renderer-#2 design problem, not a refactor of the
SVG implementation — recorded here so the contract work doesn't accidentally promise
cluster portability it can't deliver.

## 3. Findings catalog

Severity per §1.9. Every finding names the concrete fix; work-package assignment in §4.

### 3.1 Contract level (`src/GraphRenderer.ts`, factory, options)

| # | Sev | Location | Finding & fix |
|---|---|---|---|
| F1 | blocker | `GraphRenderer.ts:42` | `getCanvasSelection(): unknown` on the abstract contract — a d3/SVG escape hatch every implementer must fake. Fix: move down (§2.5). Zero external callers. |
| F2 | blocker | `GraphRenderer.ts:34` | `getZoomBehavior(): unknown` — same shape, same fix; base gains the viewport API (§2.2). |
| F3 | blocker | `GraphRenderer.ts:43,93-101` | `getZoomGroup(): HTMLElement \| SVGElement` + base class toggling `hidden` on it. A canvas renderer has no zoom-group element; the canvas stub crashes *in the base class* on first progress tick (evidence §2, agent-verified). Fix: remove; `setContentVisible(bool)` abstraction + progress UI move (F4). |
| F4 | major | `GraphRenderer.ts:15-20,74-148` | HTML progress bar (DOM fields, `createHtmlProgressBar`, `updateLayoutProgress`) hard-coded in the abstract base. Fix: progress becomes an event; overlay becomes a `UIManager` element. |
| F5 | major | `GraphSvgRenderer.ts:74-233`, `docIndex.ts:19` | Default node/edge/label/marker styles defined inside the SVG renderer and re-exported as public API from there; canvas experiment kept drifted copies (`GraphCanvasRenderer.ts:14-31`). Fix: hoist to `src/style/defaults.ts` + core style resolver (§1.4); `getNodeStyle` leaves the contract. |
| F6 | minor | `interfaces/RendererOptions.ts:367-378` | `MarkerStyle` uses SVG `<marker>` vocabulary. Portable in practice (`Path2D`); fix is documentation-level respec (§2.4). |
| F7 | major | `interfaces/RendererOptions.ts:41,66,93,290` | `renderNode`/`renderLabel`/`renderCluster`/`NodeStyle.html` presented as universal options; no capability boundary, no fallback. Fix: `capabilities.perElementHtml` + spec-drawing fallback (§1.3). |
| F8 | minor | `interfaces/RendererOptions.ts:189-192` vs `GraphRendererFactory.ts:51` | `RendererType` advertises `'canvas'` ("barely supported") but the factory throws `not implemented yet`. Fix docstring. |
| F16 | minor | `GraphRenderer.ts:40,152-154` | `AbstractSelectionBox` is a one-method abstraction. Replace with `isAreaSelectionInProgress(): boolean`. |
| F17 | minor | `GraphSvgRenderer.ts:925-1016` | `getClosestElementToCursor`/`getNodeClosestToCursor` are pure model math living per-renderer; hoist to core (§2.2). Incidental: edge hit-testing missing despite the signature. |
| F18 | blocker* | `ClusterDrawer.ts:289-292,521-596,652-682` | Cluster rendering embeds nested Graphs' SVG into the parent DOM. *Design-deferred — see §2.6; no work package.* |

### 3.2 Interaction layer

| # | Sev | Location | Finding & fix |
|---|---|---|---|
| F9 | blocker | `GraphInteractions.ts:9,17-20`, `interfaces/GraphInteractions.ts:6-14,24-75`, `GraphSvgRenderer.ts:907` | `TElement` generic binds selection state and the entire public callback vocabulary to renderer element handles; the SVG override needs `@ts-expect-error` to type-check. Fix: identity-based selection + opaque handle param (§2.3). |
| F10 | minor | `GraphInteractions.ts:92-96` | Dead `element as HTMLElement` + `classList.contains('pvt-node-expanded')` probe with empty body. Delete. |
| F11 | major | `GraphInteractions.ts:412,431`, `interfaces/GraphInteractions.ts:59-60` | `canvasBeforeZoom`/`canvasZoom` pass d3's zoom event as `unknown` to users. Fix: semantic payload (§2.3). |
| F12 | major | `GraphRendererFactory.ts:48`, `GraphInteractions.ts:535,546` | Interactions constructed by the factory, owned by the renderer; selection is app state. Fix: `Graph` owns `graph.interactions` (§2.3). |
| F13 | major | `GraphSvgRenderer.ts:342` | The SVG zoom filter reaches into `graph.editing.connectManager.isActiveAndNotIdle()` — renderer depends on the editing layer. Fix: editing vetoes via the existing `canvasBeforeZoom` cancel mechanism. |

### 3.3 Model layer (graph-content plane rule)

| # | Sev | Location | Finding & fix |
|---|---|---|---|
| F19 | blocker | `Node.ts:189-191`, `Edge.ts:156-158` | `getGraphElement(): SVGGElement \| null` via global `document.getElementById` — the model queries the DOM and returns SVG types. Fix: delete from models; `GraphSvgRenderer.getNodeElement/getEdgeElement` (§2.5). `domID` stays (it's just an id). |
| F20 | blocker | `Note.ts:34,82-91` | `Note` *stores* an `SVGGElement` on the model (plus lazy `getElementById`). Also a `structuredClone`/worker-postMessage hazard (cf. archived DataClone bug). Fix: same as F19; SVG renderer keeps its own note→element map. |
| F21 | major | `Graph.ts:1110-1112`, `ui/UIManager.ts:312`, `editing/NodeEditSession.ts:82,111`, `ui/elements/ContextMenu/ContextMenu.ts:86`, `ui/elements/Sidebar/Neighbors.ts:550`, `ui/elements/GraphToolbar/GraphToolbar.ts:532` | Seven call sites pass `getGraphElement()` into `selectNode/selectNodes` — forced by the F9 contract. All collapse to `selectNode(node)` once F9 lands. |
| F22 | major | `Simulation.ts:632-633` (consumer: `renderers/svg/EventHandler.ts:33`) | Core `Simulation` constructs `d3Drag<SVGGElement, Node>` — physics layer builds an SVG-typed DOM behavior. Fix: drag-behavior construction moves into the SVG `EventHandler`; `Simulation` exposes semantic hooks (`startNodeDrag(node)`, `dragNodeTo(node, x, y)`, `endNodeDrag(node)`). |
| F15 | major | `GraphSvgRenderer.ts:788-796` | `focusElement` derives the target position from the SVG `transform.baseVal` matrix instead of `node.x/y` (model positions are authoritative — every other path trusts them). Fix: use model coordinates; also makes `focusElement(note)` honest. |

### 3.4 Visual state (mechanism level, §1.8)

Verified positive: **no code outside `src/renderers/` ever toggles a graph-content CSS
class** — visual-state writes already respect the plane boundary. Selection,
focus-dim, filtered (`visible`), pinned (`frozen`), synthetic edges, expanded state and note
connectors are all derivable from model/interactions data. The gaps:

| # | Sev | Location | Finding & fix |
|---|---|---|---|
| F14 | blocker | `GraphSvgRenderer.ts:812-835`, `Graph.ts:1128-1147` | Programmatic highlight (`Graph.highlightElement`) exists **only as a DOM class** — no backing store, so no other renderer can ever know it. Fix: core highlight set + renderer consumption (§2.2). Incidental: `.pvt-edge-highlighted` has an empty SCSS rule (`_pivotick.scss:291-292`) — edge highlight is visually a no-op even in SVG. |
| F29 | major | `src/styles/_pivotick.scss:273-281,283-305,432-454,503-510`, `_animations.scss` | Several visual behaviors exist **only in CSS**: focus-dim (grayscale+opacity), glow pulses, marching-ants dashes, all `:hover` feedback, and theming via `--pvt-*` custom properties. Not a bug in SVG — but renderer #2 gets none for free. Fix (doc-level now): enumerate these as named spec states/animations in the hoisted style layer (§1.4), and define the CSS-variable resolution path for non-DOM renderers (`getComputedStyle` on the host — the SVG renderer already does this trick at `ClusterDrawer.ts:658` and `EdgeDrawer.ts:145`). |
| F30 | minor | `renderers/svg/NodeDrawer.ts:531-573` | Focus-dim adjacency (selected + neighbors vs the rest) is computed inside the SVG NodeDrawer from model data. Hoist the computation to core as derived state so renderer #2 doesn't re-derive the rule. |

### 3.5 UI chrome & utils

| # | Sev | Location | Finding & fix |
|---|---|---|---|
| F23 | major | `utils/NodePreview.ts:15-181` | Node previews are built by **cloning the live rendered SVG group** (`cloneNode(true)`, `getBBox`, `ownerSVGElement`) with hard-coded renderer selectors (`image.node-content`, `circle.pvt-node-selected-highlight`, `text.pvt-node-label`) and xlink href reads. Affects every consumer: `Tooltip.ts:232,272`, `EditNodeModal.ts:24`, `InspectNodeModal.ts:22`, `Mainheader/SearchBox.ts:158`, `Sidebar/MainHeader.ts:92` (which also does `instanceof SVGGElement`). Fix: consume the core resolved style spec (§1.4) — draw the preview from `{shape, size, color, icon, imageHref}`; SVG output for the preview itself is fine (UI chrome). Depends on F5. |
| F27 | major | `ui/elements/Tooltip/Tooltip.ts:402,555,571` | Tooltip anchors and pinned-tooltip connectors positioned via `getGraphElement().getBoundingClientRect()`. Fix: `getElementScreenBBox()` (§2.2). The connector overlay itself (`Tooltip.ts:86-92`, `ShadowLinkManager.ts`) is chrome-owned screen-space SVG — an acceptable mechanism; only the anchor read leaks. |
| F24 | major | `plugins/layout/MicroForce.ts:125-132,147-208,234-254` | A "plugin" that imports `d3-drag`/`d3-selection`, takes `Selection<SVGGElement, …>` params, sets `transform` attributes, and imports the SVG renderer's `EdgeDrawer`. Only importers are `renderers/svg/NodeDrawer.ts:10` and `renderers/svg/ClusterDrawer.ts:4` — it's SVG-renderer code stranded in `plugins/`. Fix: split — pure force math stays in `plugins/`; the selection-driven runner + drag wiring moves into `renderers/svg/`. |
| F25 | minor | `utils/GeometryHelper.ts:264,292,366` | Three functions take `SVGPathElement` and parse its `d` attribute; callers are SVG-renderer-only (`EdgeDrawer.ts:226-236`). Fix: retype to accept the `d` string (the parsers for it already exist in the same file) or relocate to `renderers/svg/`. |
| F26 | minor | `utils/ElementCreation.ts:11-34` | `createSvgElement` — generic SVG factory in shared utils. Sole non-renderer caller is the tooltip connector overlay (acceptable chrome use). Keep; note it exists so the refactor agent doesn't mistake it for a leak to purge. |
| F28 | minor | `ui/elements/GraphToolbar/GraphToolbar.ts:27,58,94` | `SVGTextElement` typing for the toolbar button's own icon — chrome-internal SVG, not graph content. No fix required; listed to mark it deliberately out of scope. |

### 3.6 Incidental (non-abstraction) defects noticed during the sweep

Not renderer findings; recorded so they aren't lost:
- `GraphInteractions.ts:259` — `edgeHoverOut` guards on `callbacks.onNodeHoverOut` but calls
  `onEdgeHoverOut`: the edge hover-out callback never fires unless the *node* one is set.
- `_pivotick.scss:291-292` — `.pvt-edge-highlighted` rule is empty (see F14).
- `GraphRenderer.ts:46` — abstract `fitAndCenter(fitAndCenter?: number)` parameter misnamed.
- `renderers/canvas/EdgeDrawer.ts:115,155-176` — dangling `this.graphSvgRenderer` references
  (copy-paste leftovers; dead code, would throw if reached).

## 4. Work packages

Dependency-ordered; each ≈ one PR/session. Severities addressed are listed per package.

| WP | Effort | Contents | Depends on |
|---|---|---|---|
| **WP1 — Contract surgery** | M | F1, F2, F3, F4, F8, F16 + rename `getCanvas()`/`fitAndCenter` param. Move escape hatches down to `GraphSvgRenderer` (§2.5); add `ViewportTransform` API + `setContentVisible`; extract progress overlay to a `UIManager` element; delete `AbstractSelectionBox`. Pure mechanical moves — no behavior change, big surface. | — |
| **WP2 — Identity-based interactions** | M | F9, F10, F11, F12, F13, F21. Kill `TElement`; selection by model identity; opaque-handle deprecation for `InterractionCallbacks`; semantic zoom payload; `Graph` owns `graph.interactions`; editing vetoes zoom via `canvasBeforeZoom`. Public-API breaking (callbacks) — the major-version driver. | WP1 (touches same files, land after) |
| **WP3 — Style & visual-state hoist** | L | F5, F6 (doc), F14, F29 (doc/spec), F30. `src/style/defaults.ts` + core `resolveNodeStyle`/`resolveEdgeStyle`; `docIndex` re-exports move; core highlight store; focus-dim derivation in core; named spec states + CSS-var resolution documented. The biggest package; the enabler for WP5/WP6. | WP1 |
| **WP4 — De-DOM the models** | M | F15, F19, F20, F22. Remove `getGraphElement` from `Node`/`Edge`/`Note` (renderer-side element registry instead); `focusElement` from model coords; drag-behavior construction into SVG `EventHandler`. | WP2 (selection no longer needs elements) |
| **WP5 — Geometry APIs** | S | F17, F27. Core hit-tester (closest element/node); `getElementScreenBBox`; Tooltip/ShadowLink anchors converted. | WP1, WP4 |
| **WP6 — NodePreview on the spec** | M | F23, F28. Rebuild previews from the resolved style spec; drop live-SVG cloning, `getBBox`, hard-coded selectors; all five consumer sites. | WP3 |
| **WP7 — Plugins & utils cleanup** | S | F24, F25, F26. MicroForce split; GeometryHelper retyping; `createSvgElement` annotation. | none (any time) |
| **WP8 — Capability tiering** | S | F7. `RendererCapabilities` + `perElementHtml` gating for `renderNode`/`html`/`renderLabel`/`renderCluster`, spec-drawing fallback wired; docs updated (§5). | WP3 (needs the fallback) |

F18 (clusters) intentionally has no package — see §2.6. The incidental defects (§3.6) are
one-line fixes that can ride along with whichever package touches their file.

## 5. Doc-debt appendix

Verified: **no hand-written doc or gallery example uses the escape hatches**
(`getCanvasSelection`/`getZoomGroup`/`getZoomBehavior`, `d3.select` on graph content,
`getGraphInteraction()`, renderer casts). All `graph.renderer.*` usage in docs is the stable
surface (`fitAndCenter`, `zoomIn/zoomOut`) that survives WP1 unchanged. Actual debt:

**Capability tiering (WP8) touches:**
- `docs/render.md` — L16 `renderNode` option row; L35 prose; L40-45 foreignObject sizing
  warning (becomes SVG-internal detail); L9-11 "styles apply only when `render.type` is
  `svg`" framing (stale after WP3).
- `docs/configuration.md` — L84-99 mirrors of the above.
- `docs/examples/configuration/render-callback.js` — `renderNode` tab example.
- `docs/examples/gallery/custom-html-node/` — entire example is the capability; must present
  it as SVG-capability + note the fallback.
- `docs/examples/gallery/org-chart/` — `defaultNodeStyle.html` card nodes.
- `docs/examples/gallery/node-icon-sources/options.js` — L22 one of five icon mechanisms uses
  `html:`; other four unaffected.
- `docs/examples/gallery/edge-labels/content.md` — L12-13 prose calling `renderLabel` "the
  same escape hatch as `renderNode`".

**Style-hoist (WP3) touches:** deep-links into TypeDoc pages for `defaultNodeStyleValue` /
`NodeStyle` from `render.md` (L18-21, L86) and `configuration.md` will 404 if the exported
symbol names or homes change — keep the export names stable in `docIndex.ts` or update the
links. TypeDoc API pages themselves regenerate; no manual edits.

Not affected (checked): `renderNodeExtra` in `docs/ui-tooltip.md` is a tooltip callback,
unrelated to `renderNode`; the ~9 gallery `options.js` files calling
`fitAndCenter`/`zoomIn`/`zoomOut` keep working.
