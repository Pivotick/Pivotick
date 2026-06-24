# PRD — Visual regression test coverage

**Status:** In progress (P1 batch — Areas 1 & 2 done)
**Owner:** _unassigned_
**Last updated:** 2026-06-24

This is a living planning + tracking document for expanding the Playwright visual
regression suite under `tests/visual/`. It is meant to be **picked up incrementally by
any agent** and **edited in place** to track progress — tick the checkboxes, flip the
status emoji, and add notes as you go.

> Read `tests/visual/README.md` first — it explains the harness, the determinism
> strategy, and the baseline workflow. This PRD assumes that context and only adds the
> *what to build* and *in what order*.

---

## How to use this document

Each test and prerequisite has a stable ID (e.g. `T1.3`, `P0.2`) and a status:

| Symbol | Meaning |
| ------ | ------- |
| ☐      | Not started |
| 🔄     | In progress |
| ✅     | Done (spec written, baseline committed, passing) |
| ⏭️     | Skipped / descoped (add a note saying why) |
| ⚠️     | Blocked or flaky (add a note) |

When you finish an item: check its box `- [x]`, change ☐ → ✅, update the **progress
table** below, and bump **Last updated**. Keep the baseline PNG(s) in the same commit as
the spec.

### Progress at a glance

_Update these counts as items complete._

| Area | Done / Total |
| ---- | ------------ |
| P0 — Harness prerequisites | 1 / 7 |
| 1 — Node & edge styling | 10 / 10 |
| 2 — Themes | 3 / 3 |
| 3 — Layouts | 0 / 6 |
| 4 — Clustering | 0 / 4 |
| 5 — Filtering | 0 / 4 |
| 6 — Multi-selection & tools | 0 / 5 |
| 7 — Hover / tooltip / context menu | 0 / 5 |
| 8 — UI chrome | 0 / 5 |
| 9 — Notes (deepen) | 0 / 6 |
| 10 — Edge creation (extend) | 0 / 3 |
| **Total** | **14 / 58** |

---

## Onboarding for the implementing agent

**Goal:** catch *visual* regressions. A test loads a deterministic graph, drives it to a
known state (via the harness control API or real pointer events), and diffs a screenshot
against a committed baseline.

**Where things live:**

```
tests/visual/
├─ harness/
│  ├─ index.html      # page Playwright loads
│  ├─ harness.ts      # builds the graph + exposes window.__pivotick control API  ← add verbs here
│  └─ fixtures.ts     # deterministic graphs (fixed positions, stable domIDs)     ← add fixtures here
├─ specs/             # the test suites                                           ← add specs here
├─ helpers.ts         # gotoHarness / loadFixture / harness() / expectCanvas / locators
├─ __screenshots__/   # committed baseline PNGs, one folder per spec file
├─ README.md          # how the harness works (read first)
└─ VISUAL_TEST_PRD.md # this file
```

**Commands** (Playwright boots the Vite dev server itself):

```bash
npm run test:visual            # run all specs against baselines
npm run test:visual:update     # (re)generate baselines after an intentional change
npm run test:visual:ui         # interactive runner (best for debugging a new test)
npm run test:visual:report     # open the expected/actual/diff HTML gallery
SLOWMO=600 npm run test:visual:headed   # watch a real browser drive it
```

**The workflow for every test below:**

1. If it needs a fixture or control verb that doesn't exist, add it first (see P0).
2. Write the spec in the named file under `specs/`.
3. Generate the baseline: `npm run test:visual:update` (or run just the one file).
4. **Review the baseline** in the report — a wrong-looking baseline locks in a bug.
5. Re-run `npm run test:visual` to confirm it's green and stable (run twice).
6. Commit the spec + baseline PNG(s) together. Tick the box here.

**Non-negotiable determinism rules** (a violation = a flaky test):

- Simulation stays **off** unless the test is specifically about layout, and positions
  come from fixed `x/y` + `fx/fy` in the fixture. Never screenshot an un-settled sim.
- No CSS/SVG **animations** in a baseline (`animateDash`, glow pulses, expand transitions,
  zoom transitions). The config disables animations and zoom animation is off; for state
  that animates in, wait for it to settle or snapshot a non-animated equivalent.
- Pin colours with `UI.theme` (the harness defaults to `'light'`).
- Embed any image asset as a **data-URI** (no network, no external host).
- `await document.fonts.ready` is already handled by `load()`. Keep it that way for any
  text-bearing fixture.
- Baselines are **platform-suffixed** (`*-linux.png`) and must be generated on Linux.
  Don't commit baselines generated on macOS/Windows.

**Naming conventions:**

- Spec files: `kebab-area.spec.ts` (e.g. `styling.spec.ts`).
- Baseline names: `kebab-state.png` (e.g. `node-shapes.png`); Playwright appends
  `-linux`. Keep names matching the test IDs loosely so they're greppable.
- New fixtures: lower-camel name in `fixtures.ts`, every node gets a fixed position and a
  stable id-equals-domID.

**Key API facts (verified against source — re-verify field names when you touch them):**

- Node style: `shape` (`'circle' | 'square' | 'triangle' | 'hexagon'` or `{ d: '<path>' }`),
  `size`, `color`, `strokeColor`, `strokeWidth`, label `text`/`textColor`/`textVerticalShift`/
  `textHorizontalShift`/`textRotateDegree`, icons `iconUnicode`/`iconClass`/`svgIcon`/`imagePath`.
  Type-based styling via renderer options `nodeTypeAccessor` + `nodeStyleMap`.
- Edge style: `curveStyle`, `markerEnd`, `markerStart`, `dashed`, `animateDash` (avoid),
  `rotateLabel`. Direction comes from `isDirected` (graph) or per-edge `directed`.
- Layout: `layout.type` is `'force' | 'tree' | 'egoTree'`; tree opts `radial`, `horizontal`,
  `rootId`, `strength`, `rootIdAlgorithmFinder`, `flipEdgeDirection`. `egoTree` **requires** `rootId`.
- Theme: `UI.theme` (string class, e.g. `'light'` / `'dark'`).
- Graph public API: `graph.queryEngine` (`setFilter`/`setFilters`/`resetFilters`/`excludeNode`),
  `graph.noteManager`, `graph.editing`, `graph.toggleExpandNode(node)` / `toggleExpandNodes(nodes)`,
  `graph.hideNode`/`showNode`, `graph.focusElement`, `graph.highlightElement`, `graph.getMutableNode(id)`.
- `Note` API: `setPosition`, `setSize`, `setAttachedElement({ type, id })`.

All of these are reached from the harness, which imports `src/` directly — so a new verb
is usually a 3-line method on the `Harness` class plus an entry on the `HarnessApi`
interface in `harness/harness.ts`.

---

## P0 — Harness prerequisites

Most tests below need one of these first. Build them on demand (a test's row lists which
it depends on), or knock them all out up front.

- [x] **P0.1 ✅ Styling fixtures** — _Implemented as a family of focused, side-by-side
  fixtures_ (`nodeShapes`, `nodeStyles`, `nodeIcons`, `nodeLabels`, `edgeCurves`,
  `selfLoop`, `edgeMarkers`, `edgeDashed`, `edgeLabels`) rather than one monolithic
  `styled` graph: each T1.x baseline must isolate a single concern, and ten distinct
  baselines need ten distinct scenes (cropping one big graph would be brittle). Together
  they exercise all of shape/size/colour/icon/label variety + `curveStyle`/`markerEnd`/
  `dashed` + a reciprocal pair + a self-loop. Added `mkStyledNode`/`mkEdge`/`starPath`
  helpers in `fixtures.ts`.
  > **⚠️ Harness fix this surfaced:** the initial layout pass clears `fx/fy` and settles
  > nodes from their seed positions with the force sim (the README's "fixed positions
  > pin the layout" wasn't actually holding). Well-connected fixtures stay compact;
  > disconnected scenes scatter. Added an **opt-in `pin()` harness verb** that re-applies
  > the fixture's declared positions after `ready` (redraw + re-fit). Styling specs load
  > pinned; existing specs/baselines are untouched. **Future fixed-position areas (P0.2
  > tree, P0.3 cluster, Area 3 layouts) should `pin()` too.**
- [ ] **P0.2 ☐ Fixture `tree`** — 7–10 node **acyclic** directed graph with an obvious
  root. Drives Area 3 (layouts). Tree-layout buttons disable on cyclic graphs, so this
  must be a DAG.
- [ ] **P0.3 ☐ Fixture `clustered`** — a parent node with `children` (and one nested
  child-of-child for the nested case) plus a couple of external nodes with edges into the
  cluster. Drives Area 4.
- [ ] **P0.4 ☐ Fixture `filterable`** — ~8 nodes carrying filterable data fields
  (a categorical `type` and a numeric field) so query filters have something to match.
  Drives Area 5.
- [ ] **P0.5 ☐ Control verbs — clustering & data:** `expand(id)` / `collapse(id)` (wrap
  `graph.toggleExpandNode`), `setFilter(key, config)` / `resetFilters()` / `excludeNode(id)`
  (wrap `graph.queryEngine.*`), `hideNode(id)` / `showNode(id)`. Drives Areas 4 & 5.
- [ ] **P0.6 ☐ Control verbs — interaction triggers:** `hoverNode(id)` (or do it with raw
  pointer events in-spec), `openContextMenu(kind, id?)`, `openInspect(id)`, `toggleEditMode()`,
  `enableLasso()`, `multiSelect(ids)`. Several of these may be better done as real pointer
  gestures in the spec — pick per test and note the choice. Drives Areas 6, 7, 10.
- [ ] **P0.7 ☐ Full-mode harness support** — today the harness runs `UI.mode:'light'` with
  the sidebar collapsed, so sidebar/toolbar/controls never render. Allow loading in
  `'full'` mode (either a `load()` override that un-collapses the sidebar, or a second
  loader). Drives Area 8. _Note: full-mode chrome is more pixel-volatile; expect to
  target specific elements (`.pvt-sidebar`, `.pvt-graphtoolbar-elements`) rather than the
  whole page._

> **Note on themes/layouts/direction:** these need **no new verb** — the existing
> `load(name, overrides)` already deep-merges options, so `UI.theme`, `layout.*`, and
> `isDirected` are set via overrides.

---

## Area 1 — Node & edge styling  ·  `specs/styling.spec.ts`  ·  Priority P1

Pure render, no interaction → the most stable, highest-coverage-per-effort tests. All
depend on **P0.1**.

> **Done.** Spec: `specs/styling.spec.ts`. Every test loads its fixture **pinned**
> (`harness.pin`, see P0.1) so the side-by-side scenes render exactly as laid out.
> Baselines reviewed and stable over repeated runs.

- [x] **T1.1 ✅ Node shapes** — circle / square / triangle / hexagon / custom SVG path (star), side by side. → `node-shapes.png`
- [x] **T1.2 ✅ Node size & colour variation** — distinct sizes, fills, stroke colour/width. → `node-size-color.png`
- [x] **T1.3 ✅ Node icons** — one node each for `iconUnicode` (♥), `iconClass` (★), `svgIcon` (▶), `imagePath` (✓ as data-URI). `iconClass` resolves its glyph from the consumer's icon-library CSS (`--fa` custom property); Pivotick ships no icon font, so the spec injects a tiny self-contained stand-in stylesheet. → `node-icons.png`
- [x] **T1.4 ✅ Node labels** — long-label truncation (ellipsis), `textVerticalShift`/`textHorizontalShift` (+ background box), a rotated label. Note: node labels render from the `text` style, not `data.label`. → `node-labels.png`
- [x] **T1.5 ✅ Edge curve styles** — straight vs curved vs bidirectional (reciprocal edges curve apart). → `edge-curves.png`
- [x] **T1.6 ✅ Self-loop edge** — `from === to` arc + label offset. → `edge-self-loop.png`
- [x] **T1.7 ✅ Edge end-markers** — arrow / circle / diamond / bigcircle. → `edge-markers.png`
- [x] **T1.8 ✅ Dashed edge** — `dashed: true`, `animateDash: false` (explicitly off so the dash is a static, deterministic frame). → `edge-dashed.png`
- [x] **T1.9 ✅ Edge labels** — label with background box; rotated-to-edge label (`rotateLabel`). → `edge-labels.png`
- [x] **T1.10 ✅ Undirected graph** — `load('basic', { isDirected: false })`; no arrowheads. → `undirected-graph.png`

---

## Area 2 — Themes  ·  `specs/theme.spec.ts`  ·  Priority P1

Cheap, high value: today everything is pinned to light. Uses `load(..., { UI: { theme: 'dark' } })`.

> **Done.** Spec: `specs/theme.spec.ts`. No new verb/fixture needed — `UIManager` sets
> `data-theme="dark"` on the `.pivotick` container, and the existing `load(name, overrides)`
> deep-merges `{ UI: { theme: 'dark' } }`. T2.1/T2.3 reuse the `basic` fixture and T2.2 the
> `withNote` fixture (no `pin()`, matching the light `load-render`/`selection` baselines —
> the well-connected `basic` graph settles deterministically). Baselines reviewed (dark
> canvas/grid/chrome; selection glow + focus-dim over dark) and stable over repeated runs.

- [x] **T2.1 ✅ Dark theme — basic graph** → `dark-basic-graph.png`
- [x] **T2.2 ✅ Dark theme — note** (markdown note in dark) → `dark-note.png`
- [x] **T2.3 ✅ Dark theme — selected node** (theme × selection colours) → `dark-node-selected.png`

---

## Area 3 — Layouts  ·  `specs/layout.spec.ts`  ·  Priority P2

Depends on **P0.2**. Layout output is the area the README flags as brittle for pixels —
**pair each screenshot with a position assertion** (T3.6) and/or run the sim to settle.
Decide per-layout whether to keep sim off (assert the computed transform) or settle it.

- [ ] **T3.1 ☐ Force layout** → `layout-force.png`
- [ ] **T3.2 ☐ Tree — vertical** (`layout: { type:'tree' }`) → `layout-tree-vertical.png`
- [ ] **T3.3 ☐ Tree — horizontal** (`horizontal: true`) → `layout-tree-horizontal.png`
- [ ] **T3.4 ☐ Tree — radial** (`radial: true`) → `layout-tree-radial.png`
- [ ] **T3.5 ☐ Ego tree** (`type:'egoTree', rootId`) → `layout-ego-tree.png`
- [ ] **T3.6 ☐ Position assertions (non-screenshot)** — read `node.x/y` from the API and
  assert relative ordering (root above/left of children, radial ring radii) for each
  layout. Robust complement to the pixel diffs. _Add an API accessor if needed._

---

## Area 4 — Clustering / expand-collapse  ·  `specs/cluster.spec.ts`  ·  Priority P2

Depends on **P0.3** and **P0.5** (`expand`/`collapse`). Watch for expand/collapse
*animations* — wait for the cluster area to reach final radius before snapshotting.

- [ ] **T4.1 ☐ Collapsed cluster** — dashed parent circle, synthetic edges visible. → `cluster-collapsed.png`
- [ ] **T4.2 ☐ Expanded cluster** — hull/area circle with children rendered inside. → `cluster-expanded.png`
- [ ] **T4.3 ☐ Nested cluster** — cluster within a cluster, both expanded. → `cluster-nested.png`
- [ ] **T4.4 ☐ Type-grouped colours** — `nodeTypeAccessor` + `nodeStyleMap` colour nodes by type. → `cluster-type-colors.png`

---

## Area 5 — Filtering / query engine  ·  `specs/filter.spec.ts`  ·  Priority P2

Depends on **P0.4** and **P0.5** (`setFilter`/`resetFilters`/`excludeNode`). Filtered-out
nodes are **removed** from render (not dimmed), along with their edges.

- [ ] **T5.1 ☐ Filter hides nodes** — `setFilter('type', { value, matchMode })` removes non-matching nodes + edges. → `filter-applied.png`
- [ ] **T5.2 ☐ Filter then reset** — `resetFilters()` restores the full graph. → `filter-reset.png`
- [ ] **T5.3 ☐ Manually excluded node** — `excludeNode(id)`. → `filter-node-excluded.png`
- [ ] **T5.4 ☐ Filter panel UI** — open slide panel (Shift+K) and snapshot the generated form. _Needs full/light UI with mainheader; depends on P0.7-ish._ → `filter-panel.png`

---

## Area 6 — Multi-selection & selection tools  ·  extend `specs/selection.spec.ts`  ·  Priority P2

Real pointer events; depends on **P0.6** for some. Note the zoom-filter quirk: **left-drag
draws the selection box**, middle-button pans.

- [ ] **T6.1 ☐ Multi-select** — shift+click two nodes; both highlighted, neighbours dimmed (`-highlight-shadow`). → `multi-select.png`
- [ ] **T6.2 ☐ Selection box** — left-drag rubber-band; snapshot **mid-drag** (before mouseup) showing `.pvt-selection-rectangle`. → `selection-box.png`
- [ ] **T6.3 ☐ Lasso** — enable lasso mode, draw polygon, snapshot mid-drag (`.pvt-lasso-overlay > polyline`). → `lasso.png`
- [ ] **T6.4 ☐ Focus-mode dimming** — selecting a node dims non-adjacent nodes/edges; assert the focus visual explicitly. → `focus-mode-dim.png`
- [ ] **T6.5 ☐ Multi-node group drag** — select 2+ nodes (shift/ctrl+click, or a rubber-band/lasso selection), then drag any one selected node; the **whole selection moves together** (`Simulation` drags all subjects when `hasActiveMultiselection()`). Snapshot after the drag; optionally assert each selected node's `x/y` shifted by the same delta. → `multi-node-drag.png`

---

## Area 7 — Hover, tooltip & context menu  ·  `specs/interactions.spec.ts`  ·  Priority P3

Interaction states. Tooltips are body-attached (`.pvt-tooltip`) with a ~400ms show delay —
wait for it. Context menu is `.pvt-contextmenu`. Needs a UI mode that enables these.

- [ ] **T7.1 ☐ Node tooltip** — hover a node, wait, snapshot `.pvt-tooltip`. → `tooltip-node.png`
- [ ] **T7.2 ☐ Node hover highlight** — built-in hover effect on the node/neighbours (if any). → `hover-node.png`
- [ ] **T7.3 ☐ Node context menu** — right-click node, snapshot `.pvt-contextmenu`. → `contextmenu-node.png`
- [ ] **T7.4 ☐ Canvas context menu** — right-click empty canvas. → `contextmenu-canvas.png`
- [ ] **T7.5 ☐ Note context menu** — right-click a note. → `contextmenu-note.png`

---

## Area 8 — UI chrome  ·  `specs/ui-chrome.spec.ts`  ·  Priority P3

Depends on **P0.7** (full mode). Target specific elements, not the whole page — chrome
pixels are more volatile. Each snapshots its own element locator.

- [ ] **T8.1 ☐ Sidebar with a node selected** — properties + neighbours panels populated (`.pvt-sidebar`). → `sidebar-node-selected.png`
- [ ] **T8.2 ☐ Toolbar in edit mode** — press `e`, snapshot toolbar groups (`.pvt-graphtoolbar-elements`). → `toolbar-edit-mode.png`
- [ ] **T8.3 ☐ Navigation + controls** — zoom/fit/fullscreen buttons + layout/physics controls. → `nav-controls.png`
- [ ] **T8.4 ☐ Inspect-node modal** — open via `I` / context menu; snapshot `#inspect-node-modal` (Properties + JSON tabs). → `inspect-modal.png`
- [ ] **T8.5 ☐ Search / node-picker modal** — Shift+J; snapshot the picker. → `search-modal.png`

---

## Area 9 — Notes (deepen)  ·  extend `specs/notes.spec.ts`  ·  Priority P1 (markdown) / P3 (rest)

T9.1–T9.2 are pure-render P1 (catch `marked`/`dompurify`/extension regressions). Add note
content via the existing `addNote` verb + `fit`.

- [ ] **T9.1 ☐ Rich markdown** — one note with heading, list, **bold**/*italic*, `code`, blockquote, table, link. **(P1)** → `note-markdown-rich.png`
- [ ] **T9.2 ☐ Node reference** — `[[NodeName]]` renders the custom reference span (distinct from a plain linked note). **(P1)** → `note-node-reference.png`
- [ ] **T9.3 ☐ Note colour variants** — the 5-colour palette. → `note-colors.png`
- [ ] **T9.4 ☐ Note resize** — drag the corner handle (or `setSize`); snapshot resized. → `note-resized.png`
- [ ] **T9.5 ☐ Note attached to an edge** — `attachedElement: { type:'edge', id }` connector (only node-attach is tested today). → `note-attached-edge.png`
- [ ] **T9.6 ☐ Empty note** — `content: ''`; header + handle, no body. → `note-empty.png`

---

## Area 10 — Edge creation (extend)  ·  extend `specs/edge-creation.spec.ts`  ·  Priority P3

Real pointer gestures from a node. The `pair` fixture already exists.

- [ ] **T10.1 ☐ Drag-to-connect** — pointer-down on A, drag past the 4px threshold toward B, snapshot the shadow edge **mid-drag** (`.pvt-shadow-edge`). → `drag-connect-preview.png`
- [ ] **T10.2 ☐ Valid vs invalid drop target** — shadow edge snaps to a node centre within 30px vs tracking the bare cursor; two snapshots. → `drag-target-valid.png`, `drag-target-empty.png`
- [ ] **T10.3 ☐ Cancel via Escape** — start a connection, press Escape; shadow edge gone, canvas classes cleared. → `connect-cancelled.png`

---

## Out of scope (explicitly not testing)

- Animated states as baselines: `animateDash`, selection glow pulses, cluster
  expand/zoom transitions — covered only in their settled end-state.
- Settled force-layout pixels without a position-assertion backstop (too brittle).
- Cross-browser/cross-OS baselines — Chromium + Linux only by design.

## Open questions / decisions for the implementer

- **Full-mode strategy (P0.7):** one parametrised harness vs a second harness page? Pick
  one and document it in `README.md`.
- **Layout determinism (Area 3):** settle the sim with a fixed tick count, or keep sim off
  and assert the computed layout transform? Decide per layout; note the choice in the spec.
- **CI:** README notes no GitHub Actions workflow is wired yet. Out of scope here, but the
  baselines this PRD produces assume a Linux CI runner (Playwright Docker image).
