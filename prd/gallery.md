# PRD — Pivotick Documentation Gallery

**Status:** Draft for implementation
**Owner:** Sami Mokaddem
**Scope:** Rebuild the VitePress documentation Gallery from scratch as a curated set of live, copy-pasteable demos that (a) teach the most common things a developer needs and (b) act as selling points for adopting Pivotick.

---

## 1. Background & context

Pivotick is a hackable TypeScript graph-visualisation library (D3 force simulations) with a rich, overridable UI layer, an editing subsystem, markdown notes, a query/filter engine, clustering, and multiple layouts. Much of this power is implemented but **undocumented** — for several subsystems the gallery will be their first real showcase.

The docs use **VitePress** (prose + a live `<Pivotick>` Vue component) and **TypeDoc** (generated API reference under `docs/public/api/`). The existing Gallery (`docs/gallery.md` + `docs/examples/gallery/*`) contains 5 implemented examples and ~18 empty stubs.

**Decision:** the existing gallery content (implemented examples + stubs) is **wiped and rebuilt fresh**. Prose doc pages (`configuration.md`, `callbacks.md`, `ui-*.md`, etc.) are **left as-is**; improving them is a later, separate effort and explicitly out of scope here.

---

## 2. Goals & non-goals

### Goals
- A coherent, scannable gallery of **32 live demos** across **12 categories**, each with runnable code shown inline.
- Every demo is **self-contained and copy-pasteable** (a `data` + `options` pair, optionally a callback).
- Cover the four areas the author flagged as primary: **node styling, layouts, event handling, UI overriding**.
- Surface the **differentiating features** (editing, markdown notes with node references, clustering, query engine, runtime layout switching) that competitors lack.
- Each category tells a **progression** (simple → advanced) rather than a flat list.

### Non-goals
- Rewriting/expanding the prose documentation pages (deferred).
- Canvas renderer demos (experimental, not production-ready).
- Promoting the analytics subsystem (DAG/cycle detection) to a first-class feature — it appears only as an optional flourish in L4.
- Ego-tree layout demos (dropped during scoping).
- A standalone group/ungroup authoring demo (dropped; clustering is shown via expand/collapse only).

---

## 3. Positioning & selling points

The gallery is also marketing. These are the selling points and the cards that carry them:

| Selling point | Carried by |
| --- | --- |
| **Hackable rendering** — style with config *or* return arbitrary HTML | B3, B1–B5 |
| **Data-driven styling** — map your data to visuals declaratively | B2, B5, C2 |
| **Batteries-included UI, fully overridable** — sidebar, tooltip, context/selection menus, search, filter out of the box | F1–F4, I1, I4 |
| **Interactive editing** (rare in viz libs) — in-place node edit + drag/click edge creation | G1, G2 |
| **Markdown notes with live node references** (`[[Node]]`) — effectively unique | H2 |
| **Clustering / complexity at scale** — collapse & expand groups | I3, L4 |
| **Multiple layouts + runtime switching** | D1, D2+D4 |
| **Query/filter engine** for large/real datasets | I1 |
| **Colorblind-safe palettes** built in | B5 |
| **Drive it from your app** — full programmatic API + data event bus | E4, J1, J4 |
| **Themeable** via CSS variables | K1 |
| **Scales** to thousands of nodes (web-worker offload in production) | K3 |
| **Believable end-to-end scenarios** | L1–L4 |

---

## 4. Gallery infrastructure & conventions

### 4.1 Per-card file layout
Each demo lives in `docs/examples/gallery/<slug>/`:

- **`content.md`** — frontmatter `title`, a `<script setup>` importing from `./options.js`, the live `<Pivotick>` component, and a `::: code-group` exposing the source via region snippets. Template:
  ```md
  ---
  title: "Card Title"
  ---

  # Card Title

  <script setup>
      import { data, options } from './options.js'
  </script>

  <Pivotick :data="data" :options="options"></Pivotick>

  ::: code-group
  <<< ./options.js#options [Options]
  <<< ./options.js#data [Data]
  :::
  ```
- **`options.js`** — exports `data` and `options`, each wrapped in `// #region data` / `// #region options` markers so the `<<<` snippets render. Cards that need runtime behaviour also export a callback (see 4.3).
- **`pic.png`** — thumbnail for the index grid. Captured per theme (light + dark) so the index can show the one matching the reader's selected theme — see 4.4.

### 4.2 The `<Pivotick>` component (`docs/.vitepress/components/Pivotick.vue`)
- Instantiates `new Pivotick(container, data, options)` from `src/index`.
- Props: `data`, `options`, `onMountedCallback(container)`, `onLoadedCallback(graph)`, `useInlineStyle` (default `height: 400px` + border).
- **Forces `simulation.useWorker: false`** — see constraint in 4.4.
- Calls `graph.destroy()` on unmount.

### 4.3 Required component enhancement (infra task)
Cards D2+D4 and J4 run timers (`changeLayout` / `updateData`) started in `onLoadedCallback`. The component currently exposes no unmount hook to the demo, so a timer would keep firing after `destroy()`.

**Add an `onUnmountedCallback` prop** to `Pivotick.vue`, invoked in `onBeforeUnmount` before `destroy()`, so a demo can clear its interval. Demos store the interval id in a closure and clear it there. (Fallback if not added: guard each tick with `container.isConnected`.)

### 4.4 Constraints & risks discovered
- **Web worker disabled in docs** — `Pivotick.vue` hard-sets `useWorker: false`. A genuine *worker* demo isn't possible inline without resolving the worker URL in the VitePress build. **Impact: K3** is scoped as a main-thread "scale" demo; the worker is described in prose. (Optional follow-up: enable the worker for K3 only — feasibility TBD.)
- **Nested cluster simulations in a 400px canvas** — clustering spins up nested subgraph layouts. Must lay out cleanly without jitter in a small iframe. **Impact: I3, L4.** Validate the mechanism in I3 first; build L4 (bigger dataset) only after.
- **Thumbnail generation** — repo already has a Playwright visual-test setup (`npm run test:visual`). Prefer automating `pic.png` capture; **wait explicitly for async render before screenshotting** (notes/markdown/clusters render asynchronously). Manual capture is the fallback.
- **Theme-aware thumbnails** — the docs site has a light/dark toggle (VitePress adds `.dark` to `<html>`, persisted in `localStorage['vitepress-theme-appearance']`; reactive via `useData().isDark`). The graph itself recolors from CSS variables, so a single light `pic.png` looks wrong for dark-theme readers. **Capture one thumbnail per theme** — e.g. `pic-light.png` + `pic-dark.png` — by toggling the `.dark` class (or seeding localStorage) before each screenshot in `scripts/capture-thumbnails.mjs`, and have `GalleryIndex.vue` show the file matching the active theme. Touches the thumbnail glob/selection in `GalleryIndex.vue` and the `hasThumb` check in `gallery-files.js`. **Impact: all cards (re-capture on the theme split).**

### 4.5 Index & navigation
- **`docs/gallery.md`** — rewrite the index grid to the new 12-category structure (thumbnail + title per card, grouped by category heading).
- **`docs/.vitepress/config.ts`** — update the Gallery sidebar `items` to the new category anchors.
- **`docs/.vitepress/gallery-files.js`** — currently an unused auto-discovery helper (commented out). Either wire it up to generate the index from card frontmatter, or delete it. Recommendation: wire it up so adding a card folder auto-registers it.

### 4.6 Definition of done (per card)
1. Live `<Pivotick>` demo renders correctly and is interactive where relevant.
2. `code-group` shows `data` + `options` (+ callback) via region snippets.
3. Thumbnails present for both light and dark themes, shown to match the active theme (see 4.4).
4. Linked from `docs/gallery.md` under the right category.
5. Code is lint-clean (no semicolons, single quotes) and self-contained.

---

## 5. Card catalog

Legend: ★ = selling-point / hero card. "Reuse" = adaptable from existing gallery material.

### A. Basics (1 card)

| ID | Card | Demonstrates | Key API | Data | Notes |
| --- | --- | --- | --- | --- | --- |
| A1 | Hello graph | Absolute minimum to get a graph on screen | `new Pivotick(container, data)` | ~4 nodes, 3 edges | All defaults. Reuse old `basic`. The gallery's front door. |

### B. Node styling (5 cards)
Throughline: *default → data-driven map → automatic palette → icons → full custom HTML.*

| ID | Card | Demonstrates | Key API | Notes |
| --- | --- | --- | --- | --- |
| B1 | Default node style | Base appearance for all nodes; **shape reference baked in** | `render.defaultNodeStyle` (shape/size/color/textColor/strokeWidth); shapes `circle\|square\|triangle\|hexagon` | Show a row of all built-in shapes as the visual. Reuse old `node-style`. |
| B2 | Style by type | Declarative per-type styling | `render.nodeTypeAccessor` + `render.nodeStyleMap` | The most important styling pattern. Reuse old `node-accessor`. |
| B3 | Custom HTML node ★ | Return arbitrary HTML per node | `render.renderNode(node) => HTMLElement\|string` | The "hackable" proof. Reuse old `node-rendering-callback`. |
| B4 | Icons per type ★ | Icons inside nodes | `nodeStyleMap` with `svgIcon: (node)=>…` (verify icon-class/unicode support on `NodeStyle`) | Very common real-world need; demo-friendly. |
| B5 | Color by category ★ | Auto-assign colors, colorblind-safe palettes | `new ColorPaletteMapper('okabe-ito')`; `defaultNodeStyle.color: (node)=>mapper.getColor(node.getData().group)` | Palettes incl. `okabe-ito`, `tol-bright`, `kelly-22`, `d3-category10`. Confirm `color` accepts an accessor. |

### C. Edge styling (3 cards)

| ID | Card | Demonstrates | Key API | Notes |
| --- | --- | --- | --- | --- |
| C1 | Default edge style | Base edge appearance; **marker reference baked in** | `render.defaultEdgeStyle` (strokeColor/strokeWidth/opacity/curveStyle); `markerStart`/`markerEnd` `arrow\|circle\|diamond`; `markerStyleMap` | Show all markers as the visual. |
| C2 | Data-driven edges | Per-edge styling **incl. animated dash** | `dashed`/`strokeWidth`/`markerEnd` as `(edge)=>…`; `animateDash`; `styleCb` | `dashed:true` → flowing animation (built-in `dashmove-edge` keyframe). |
| C4 | Edge labels | Label rendering & styling | `render.renderLabel(edge) => HTMLElement\|string`; `defaultLabelStyle`; `rotateLabel` | |

### D. Layouts (2 cards)

| ID | Card | Demonstrates | Key API | Notes |
| --- | --- | --- | --- | --- |
| D1 | Force layout + tuning | Default physics & how knobs change the look | `layout.type:'force'`; `simulation.d3ManyBodyStrength`/`d3LinkDistance`/`d3GravityStrength` | Doubles as the simulation-tuning showcase (no separate sim category). |
| D2+D4 | Live layout switching ★ | Auto-cycle layouts at runtime | `simulation.changeLayout('tree', {layout:{horizontal/radial,…}})` → `waitForSimulationStop()` → `renderer.fitAndCenter()` | `onLoadedCallback` runs a timer cycling force → vertical → horizontal → radial tree every X s. **Needs `onUnmountedCallback` (4.3) to clear the interval.** Thumbnail captured on the tree state. |

### E. Events & callbacks (2 cards)
Distinction to make explicit: *interaction callbacks (what the user did)* vs *data event bus (what changed)*.

| ID | Card | Demonstrates | Key API | Notes |
| --- | --- | --- | --- | --- |
| E1 | Interaction events + live inspector ★ | React to clicks/hover/select/canvas; see events fire | `callbacks.onNodeClick/HoverIn/HoverOut/Select`; `onCanvas*` | A running event-log panel beside the graph. **Exclude high-frequency `onSimulationTick`** from the log (flood); reference `onSimulationSlowTick` or show a throttled counter. |
| E4 | Data event bus ★ | React to data mutations (app integration / persistence) | `graph.on('nodeAdd'\|'edgeChange'\|'dataBatchChanged'…, handler)`; `graph.off(...)` | Pair with a couple of buttons that mutate data so events visibly fire. |

### F. UI customization (4 cards)
Each is a distinct UI surface with its own API.

| ID | Card | Demonstrates | Key API | Notes |
| --- | --- | --- | --- | --- |
| F1 | Tooltip customization | Header map → extra content → full custom | `UI.tooltip.nodeHeaderMap/edgeHeaderMap/renderNodeExtra/render` | Ramp from easy to full override. |
| F2 | Context-menu entries ★ | Add custom right-click actions | `UI.contextMenu.menuNode/menuEdge/menuCanvas` `{ topbar, menu }`; items `{text, svgIcon, variant, visible, onclick}` | Author-flagged top need. Reuse old `ui-context-menu.js`. |
| F3 | Selection menu + multi-select | Bulk actions on a selection | `UI.selectionMenu.menuNode {topbar, menu}`; shift/alt/ctrl-click selection | Also showcases multi-selection UX. |
| F4 | Sidebar customization ★ | Header, properties, custom panels | `UI.mainHeader`, `UI.propertiesPanel` (`nodePropertiesMap`/`render`), `UI.extraPanels [{title, render}]` | Major batteries-included surface. |

### G. Editing & authoring (2 cards)

| ID | Card | Demonstrates | Key API | Notes |
| --- | --- | --- | --- | --- |
| G1 | In-place node editing | Edit a node via modal, validate commits | `callbacks.onNodeEdit`, `onBeforeNodeEditCommit`, `onNodeEditCancel`; `graph.editing.openNodeSession(node)` | Enable an editable `UI.mode`. Proves authoring, not just viewing. |
| G2 | Create edges (drag + click-click) ★ | Shadow-edge edge creation, both interaction styles | edge-creation flow via toolbar / `graph.editing.connectManager.*` | One of the most compelling live interactions. |

### H. Notes & annotations (2 cards)

| ID | Card | Demonstrates | Key API | Notes |
| --- | --- | --- | --- | --- |
| H1 | Sticky notes | Add free-floating notes; attach to a node | `graph.noteManager.addNote(new Note({x,y,content,color}))`; `attachedElement:{type:'node',id}` | Attachment makes the note track the node on drag. |
| H2 | Markdown notes + node references ★ | Rich markdown + `[[Node]]` links that select/highlight nodes | Note `content` markdown (`marked`+`dompurify`); `nodeReferenceExtension` | The standout "nobody else has this" demo. |

### I. Filtering, search & hierarchy (3 cards)

| ID | Card | Demonstrates | Key API | Notes |
| --- | --- | --- | --- | --- |
| I1 | Filter / query engine ★ | Query-based filtering + programmatic hide/exclude | `graph.queryEngine.setFilter(key,{value,matchMode:'exact'\|'partial'})`, range `{min,max}`; `excludeNode`/`hideNode`/`setVisibleNodes`; built-in filter UI | Use a dataset with categorical + numeric fields. |
| I3 | Clusters & hierarchy ★ | Expand/collapse grouped nodes | data with `children`; `render.enableNodeExpansion`; `node.toggleExpand()` / `graph.toggleExpandNode()` | **Validates the clustering mechanism in-gallery (prereq for L4).** Small, clear dataset. |
| I4 | Search & focus | Built-in search box + programmatic camera | search box (Mainheader / Shift+J); `renderer.focusElement` / `highlightElement` | Holds focus/highlight so J needs no duplicate. |

### J. Programmatic control (2 cards)

| ID | Card | Demonstrates | Key API | Notes |
| --- | --- | --- | --- | --- |
| J1 | Programmatic manipulation | CRUD + selection from buttons | `addNode`/`addEdge`/`removeNode`; `simulation.reheat()`; `selectElement` | Buttons drive the graph. Reuse `api/add-node-edge.js`. |
| J4 | Live / streaming graph ★ | Timed data updates, react & auto-fit | timed `updateData()`; `graph.on('dataBatchChanged')`; `renderer.fitAndCenter()` | Real-world dashboards/monitoring. **Needs `onUnmountedCallback` (4.3).** Absorbs camera-fit story. |

### K. Theming & performance (2 cards)

| ID | Card | Demonstrates | Key API | Notes |
| --- | --- | --- | --- | --- |
| K1 | Theming & styling | CSS variables (easy) + class hooks (advanced) | `--pvt-*` vars (`src/styles/_variables.scss`); `.pvt-node circle`, `.pvt-edge-group path` | Show light/dark + a brand recolor. |
| K3 | Large-graph scale ★ | Renders N-thousand nodes smoothly | large generated dataset; default rendering | ⚠️ Worker disabled in docs (4.4) — frame as scale, describe worker in prose. Optional follow-up: enable worker for this card only. |

### L. Showpieces (4 cards)
Combine features into believable scenarios; richer data, more "wow" than how-to. Each fronts a distinct pillar.

| ID | Card | Pillar | Demonstrates | Notes |
| --- | --- | --- | --- | --- |
| L1 | Social network ★ | Visual styling | icons/shapes/colors per group + edge styling | Flagship / home-page demo. Reuse + polish old `social-network`. |
| L2 | Org chart / file tree | Hierarchy | tree layout + custom nodes in a relatable scenario | |
| L3 | Knowledge base ★ | Notes + filtering | markdown notes + `[[references]]` + filtering together | Shows the unique features in concert. |
| L4 | Clustered infra/dependency map ★ | Clustering at scale | clustering core (collapse/expand service groups) + directed dependency edges (C2 styling) + color-by-tier (B5); **cycle detection optional flourish** | Build **after I3** validates clustering. Keep dataset/framing distinct from I3 (realistic multi-group topology vs. abstract demo). One of the heavier items. |

---

## 6. Implementation plan (phased)

Build infra first, then ascend complexity. Each phase is shippable.

- **Phase 0 — Infra.** Wipe old gallery; rewrite `gallery.md` index + sidebar nav; add `onUnmountedCallback` to `Pivotick.vue` (4.3); decide/auto-wire `gallery-files.js`; set up thumbnail capture (Playwright, async-safe).
- **Phase 1 — Styling foundations** (static, low-risk, high-value): A1, B1–B5, C1, C2, C4. Establishes the visual language.
- **Phase 2 — Layouts & events:** D1, D2+D4 (uses timer infra), E1, E4.
- **Phase 3 — UI customization:** F1–F4.
- **Phase 4 — Editing & notes:** G1, G2, H1, H2.
- **Phase 5 — Filtering, hierarchy & programmatic:** I1, I3 (validate clustering), I4, J1, J4.
- **Phase 6 — Theming & scale:** K1, K3.
- **Phase 7 — Showpieces:** L1, L2, L3, then L4 (depends on I3).

**Dependencies:** D2+D4 & J4 depend on Phase 0 (`onUnmountedCallback`). L4 depends on I3. K3 depends on the worker decision (or ships as scale-only).

---

## 7. Open questions

1. **K3 / worker:** ship as main-thread scale demo only, or invest in enabling the real worker for that one card (worker-URL resolution in VitePress — feasibility unknown)?
> Enable a real worker. Should be straightforward with how the project is built
2. **Thumbnails:** automate via Playwright, or capture manually?
> Automated via playwright, it should be wysiwyg from the picture and the code
3. **`gallery-files.js`:** auto-generate the index from card frontmatter, or hand-maintain `gallery.md`?
> auto-generated
4. **Icon support on `NodeStyle` (B4):** confirm whether icon-class / unicode are supported on node styles or only `svgIcon` (+ menu items).
5. **`NodeStyle.color` accessor (B5):** confirm `color` accepts `(node)=>string` so the palette mapper plugs in cleanly.

---

## 8. Summary

**32 cards / 12 categories:** A(1) · B(5) · C(3) · D(2) · E(2) · F(4) · G(2) · H(2) · I(3) · J(2) · K(2) · L(4).

Dropped during scoping: A2, A3, B6 (folded), C3 (folded into C2), D3 (ego-tree), E2/E3/E5 (folded into E1), F5, G3, H3 (folded), I2 (folded), J2/J3 (folded), K2 (folded into K1), and the original L4 (reborn as the clustered infra map).
