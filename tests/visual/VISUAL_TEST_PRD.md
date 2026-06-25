# PRD — Visual regression test coverage

**Status:** In progress (Areas 1–8 done)
**Owner:** _unassigned_
**Last updated:** 2026-06-25

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
| P0 — Harness prerequisites | 7 / 7 |
| 1 — Node & edge styling | 10 / 10 |
| 2 — Themes | 3 / 3 |
| 3 — Layouts | 6 / 6 |
| 4 — Clustering | 3 / 3 |
| 5 — Filtering | 4 / 4 |
| 6 — Multi-selection & tools | 5 / 5 |
| 7 — Hover / tooltip / context menu | 4 / 4 |
| 8 — UI chrome | 5 / 5 |
| 9 — Notes (deepen) | 0 / 6 |
| 10 — Edge creation (extend) | 0 / 3 |
| **Total** | **47 / 56** |

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
- [x] **P0.2 ✅ Fixture `tree`** — 8-node **acyclic** directed graph (`root` → `a/b/c`,
  with `a` → `d/e` and `c` → `f/g`); `MaxReachability` resolves the root to `root`.
  Drives Area 3. Also added a sister fixture **`egoNet`** (a star: a central `ego` linked
  to every other node) for the ego-tree case — the ego layout only positions the root's
  *direct* neighbours, so a star guarantees all nodes get deterministic positions.
- [x] **P0.3 ✅ Fixture `clustered`** — parent `group` with children `[c1, c2, c3]` where
  `c1` is itself a nested cluster `[c1a, c1b]`, plus two external nodes (`ext1`, `ext2`)
  whose edges point into the cluster (yielding visible *synthetic* edges to `group` when
  collapsed). Drives Area 4. Two fixture mechanics worth knowing: (1) the graph's
  normaliser only marks the **first** level of children when handed `Node` instances (the
  form fixtures use), so a `markCluster` helper marks deeper descendants; (2) edges to
  children must be `hide()`d in the fixture (the normaliser only auto-hides them for *raw*
  edge data).
- [x] **P0.4 ✅ Fixture `filterable`** — an 8-node network (3 `router`s in an interconnected
  triangle, 2 `switch`es, 3 `host`s) carrying a categorical `type` and a numeric `ports`
  field. Drives Area 5. **⚠️ `ports` is intentionally a *non-integer* number:** the filter
  form's field discovery (`GraphFilter.getAvailableNodeAttributes`) throws on integer-valued
  data — it routes integers to a `range` bucket it never initialises — and the harness builds
  that form for *every* fixture in light mode (the mainheader renders there; see the Area 5
  done-block), so an integer field would crash every load. A fractional value still matches a
  `{ min, max }` range filter and renders harmlessly in the form.
- [x] **P0.5 ✅ Control verbs — clustering & data:** Clustering done in Area 4 (`expand(path)` /
  `collapse(id)`, deterministically re-pinning children). Data verbs added for Area 5:
  `setFilter` / `setFilters` / `resetFilters` (wrap `graph.queryEngine.*`), `excludeNode`,
  and `hideNode` / `showNode`. **⚠️ `excludeNode` passes the live `Node`, not the id:** the
  library's `queryEngine.excludeNode(string)` resolves the id via `getNode`, which returns a
  method-less `structuredClone`, so the subsequent `node.hide()` throws — a `Node` instance
  takes the working `instanceof` branch instead.
- [x] **P0.6 ✅ Control verbs — interaction triggers:** `hoverNode(id)` (or do it with raw
  pointer events in-spec), `openContextMenu(kind, id?)`, `openInspect(id)`, `toggleEditMode()`,
  `enableLasso()`, `multiSelect(ids)`. Several of these may be better done as real pointer
  gestures in the spec — pick per test and note the choice. Drives Areas 6, 7, 10.
  > **Area 6 added `multiSelect(ids)`, `enableLasso()` and `selectedNodeIds()`.**
  > `multiSelect` drives the library's `selectNodes` directly (the deterministic equivalent
  > of shift-clicking). `enableLasso` calls `renderer.toggleLassoMode(true)` *and* registers
  > `canvasBeforeZoom` + `canvasClick` cancellers — in the real app the toolbar disables
  > panning and the release-deselect while lasso is active, and the harness doesn't mount the
  > toolbar. `selectedNodeIds` reads the committed selection (to verify the box/lasso). The
  > selection box, lasso and group-drag use **real pointer events** in-spec (their visual
  > *is* the gesture).
  > **Area 7 added no verbs:** the tooltip (hover) and the node/canvas/note context menus
  > (right-click) are all driven with **real pointer gestures** in-spec — the gesture *is*
  > the thing under test, and the harness's light mode already mounts the Tooltip and
  > ContextMenu (`buildUIGraphNavigation` wires both whenever their default-on `enabled`
  > flag is set). So `hoverNode` / `openContextMenu` were resolved by choosing the pointer
  > path P0.6 explicitly allows, not by adding verbs.
  > **Area 8 closed this out:** added **`openInspect(id)`** (calls the same `createInspectModal`
  > the `i` shortcut / context-menu "Inspect Properties" item use). `toggleEditMode` was
  > resolved by driving the real `e` shortcut in-spec (the P0.6 pointer/keyboard path), and
  > the search picker by clicking its real button — so no further verbs were owed.
- [x] **P0.7 ✅ Full-mode harness support** — today the harness runs `UI.mode:'light'` with
  the sidebar collapsed, so sidebar/toolbar/controls never render. Allow loading in
  `'full'` mode (either a `load()` override that un-collapses the sidebar, or a second
  loader). Drives Area 8. _Note: full-mode chrome is more pixel-volatile; expect to
  target specific elements (`.pvt-sidebar`, `.pvt-graphtoolbar-elements`) rather than the
  whole page._
  > **Resolved (Area 8): the `load()` override, no second loader.** `load` already deep-merges
  > options, so T8.1 loads full mode with `{ UI: { mode: 'full', sidebar: { collapsed: false } } }`.
  > The 1280×800 viewport sits just under the `hasEnoughSpaceForFullMode` height check, but that
  > only governs the `collapsed:'auto'` branch — an explicit `false` builds the sidebar anyway.
  > Per the P0.7 correction below, only the **sidebar** actually needs full mode: the toolbar,
  > navigation, controls and modal/mainheader containers are built in **light** mode too and are
  > positioned as canvas overlays / a top bar regardless of grid mode, so they look identical in
  > both. So T8.2–T8.5 stay on the default light-mode harness and only T8.1 goes full. Every
  > Area 8 baseline targets a specific element (chrome is volatile), as advised.
  > **Correction (found in Area 5):** light mode *does* build the **mainheader** (and thus
  > its filter / note slide panels) — `setupLightMode` calls `buildMainheader()`, and the
  > harness viewport (1280×800) clears the light-mode space check. So mainheader-hosted
  > chrome is already reachable: T5.4 opens the filter slide panel in the existing light-mode
  > harness with no full-mode work. P0.7 is only still needed for the **sidebar** (collapsed
  > here) and for snapshotting toolbar/controls, which light mode builds but positions as
  > overlay chrome rather than docking.

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

> **Done.** Spec: `specs/layout.spec.ts`. **Determinism decision (the open question):**
> a tree layout's *on-load* positions come from a force relaxation toward the d3-hierarchy
> targets — converged but timing-dependent, so brittle for pixels (and worse under
> parallel-run CPU contention). So:
> - **Force (T3.1):** no exact target exists → keep sim off and `pin()` the fixture's seed
>   positions (deterministic stand-in for a settled force scene; clean contrast to trees).
> - **Tree / egoTree (T3.2–T3.5):** new harness verb **`applyLayout`** re-runs the layout's
>   *exact* d3-hierarchy computation, writes the target positions straight onto the nodes,
>   then pins (`fx/fy`) + re-fits. Baselines are a pure function of (graph, layout options),
>   independent of tick count / machine speed. `applyLayout` is a no-op for `force`.
>
> New verbs in `harness.ts`: `applyLayout()` and `nodePositions()` (reads `node.x/y` for
> T3.6). Baselines reviewed (root placement, ring radii, ego fan) and stable over repeated
> runs (incl. single-worker full-suite). Each pixel baseline is backed by a T3.6 assertion.

- [x] **T3.1 ✅ Force layout** (sim off, seeds pinned) → `layout-force.png`
- [x] **T3.2 ✅ Tree — vertical** (`layout: { type:'tree' }`) → `layout-tree-vertical.png`
- [x] **T3.3 ✅ Tree — horizontal** (`horizontal: true`) → `layout-tree-horizontal.png`
- [x] **T3.4 ✅ Tree — radial** (`radial: true`) → `layout-tree-radial.png`
- [x] **T3.5 ✅ Ego tree** (`type:'egoTree', rootId`, on the `egoNet` star) → `layout-ego-tree.png`
- [x] **T3.6 ✅ Position assertions (non-screenshot)** — `nodePositions()` reads `node.x/y`;
  one assertion test per layout checks relative ordering: vertical (root above, equal-depth
  siblings level, children ordered L→R), horizontal (root left, deeper levels right), radial
  (root at centre, equal-depth ring radii, outer levels larger), ego (neighbours one level
  below the root and sharing a row, root centred in their spread).

---

## Area 4 — Clustering / expand-collapse  ·  `specs/cluster.spec.ts`  ·  Priority P2

Depends on **P0.3** and **P0.5** (`expand`/`collapse`).

> **Done.** Spec: `specs/cluster.spec.ts`.
>
> **Determinism decision (the open question for this area).** Expand/collapse isn't just
> animated — a cluster's *child layout* is produced by a throw-away **subgraph running its
> own force pass** (`cooldownTime` is wall-clock, so the child positions are timing-
> dependent, exactly the brittleness the README flags). Waiting "for the final radius"
> isn't enough; the children themselves won't land in the same place twice. So `expand`:
> 1. expands the node, waits for its subgraph to exist, then **`disable()`s that subgraph's
>    simulation** so nothing drifts;
> 2. re-pins the children onto a fixed **ring** (parent-local coords), mirroring each onto
>    the owner graph's real child so boundary-crossing edges track them;
> 3. **tightens** the cluster-area circle to snugly fit the children — the library's auto
>    radius is oversized for small children, leaving the area mostly empty. For nested
>    clusters this runs **innermost→outermost**, so each parent grows to contain its
>    already-tightened sub-cluster (the nested subgraph renders *inside* the parent's `<g>`,
>    so moving the parent moves its children — no re-sync needed).
>
> The d3 *attribute* transitions (circle radius, glyph/icon re-seat) are JS-driven, so
> Playwright's `animations:'disabled'` doesn't freeze them — `expand` settles them to their
> end-state explicitly (a short `sleep` for the transition + a direct attribute write).
> New verbs: `expand(path)` (single id or nested path) and `collapse(id)`. Baselines
> reviewed (dashed parent circle + synthetic edges; snug area circle with children inside;
> concentric circles for nesting) and stable over repeated runs (single-worker and parallel).

- [x] **T4.1 ✅ Collapsed cluster** — dashed parent circle, synthetic edges visible. → `cluster-collapsed.png`
- [x] **T4.2 ✅ Expanded cluster** — area circle with children rendered inside (`c1` shown as a collapsed sub-cluster). → `cluster-expanded.png`
- [x] **T4.3 ✅ Nested cluster** — cluster within a cluster, both expanded (concentric dashed circles). → `cluster-nested.png`
- ⏭️ **T4.4 — Type-grouped colours** — _descoped._ Type-based styling (`nodeTypeAccessor` +
  `nodeStyleMap`) is a node-styling concern, not clustering; removed from this area.

---

## Area 5 — Filtering / query engine  ·  `specs/filter.spec.ts`  ·  Priority P2

Depends on **P0.4** and **P0.5** (`setFilter`/`resetFilters`/`excludeNode`). Filtered-out
nodes are **removed** from render (not dimmed), along with their edges.

> **Done.** Spec: `specs/filter.spec.ts`.
>
> **Determinism.** No new mechanism needed — applying a filter calls `graph.onChange()`,
> which re-renders *synchronously* (`renderer.update(true)` + `nextTick`), so there's nothing
> to wait on and no animation. T5.1–T5.3 pin positions (`harness.pin`, like the other static
> scenes) and **do not re-fit** after filtering — matching the real app, where filtering
> doesn't reframe. The full graph's viewport therefore frames all three canvas baselines, so
> removed nodes simply leave gaps and `filter-applied` / `filter-reset` are directly
> comparable. T5.4 screenshots the slide-panel element, so positions are irrelevant (no pin).
>
> **T5.4 needed no full-mode work** (the PRD guessed P0.7): light mode already builds the
> mainheader and its filter slide panel (see the P0.7 correction). The new `openFilterPanel`
> verb opens it via `mainHeader.filteringSlidepanel.open()`; the form is generated from the
> fixture's node-data fields (`label` / `type` → selects, `ports` → text). New verbs in
> `harness.ts`: `setFilter` / `setFilters` / `resetFilters` / `excludeNode` / `hideNode` /
> `showNode` / `openFilterPanel`. Two library quirks worked around in the fixture/verbs (see
> the ⚠️ notes on P0.4 and P0.5). Baselines reviewed (routers-only triangle; full restore;
> single node removed; generated filter form) and stable over repeated runs (parallel + the
> full single-worker suite).

- [x] **T5.1 ✅ Filter hides nodes** — `setFilter('type', { value:'router', matchMode:'exact' })` removes non-matching nodes + edges (only the router triangle remains). → `filter-applied.png`
- [x] **T5.2 ✅ Filter then reset** — `resetFilters()` restores the full graph. → `filter-reset.png`
- [x] **T5.3 ✅ Manually excluded node** — `excludeNode('h2')`. → `filter-node-excluded.png`
- [x] **T5.4 ✅ Filter panel UI** — `openFilterPanel()` (same panel as the Shift+K shortcut); snapshot the generated form. Reachable in the existing light-mode harness — no P0.7 needed. → `filter-panel.png`

---

## Area 6 — Multi-selection & selection tools  ·  extend `specs/selection.spec.ts`  ·  Priority P2

Real pointer events; depends on **P0.6** for some. Note the zoom-filter quirk: **left-drag
draws the selection box**, middle-button pans.

> **Done.** Spec: `specs/selection.spec.ts` (extends the existing three selection tests).
> Two new harness verbs (see the P0.6 note): `multiSelect(ids)` and `enableLasso()`.
>
> **Split of mechanism (the P0.6 "pick per test" call):** state-only tests set selection
> through the harness — `multiSelect` (T6.1, T6.5) drives the same `selectNodes` path a
> shift-click ends up calling, and the existing `selectNode` verb covers T6.4 — exactly how
> the original single-selection tests work. The *gesture* tests use **real pointer events**,
> because the thing under test is the live interaction overlay, not the resulting state:
> T6.2 Shift+left-drags the rubber-band and snapshots `.pvt-selection-rectangle` **before**
> mouseup; T6.3 enables lasso and traces an open polygon, snapshotting `.pvt-lasso-overlay >
> polyline` **before** pointerup (the loop only closes + selects on release); T6.5 drags a
> selected node with the mouse.
>
> **Source quirks worth knowing:**
> - **The selection box needs a modifier.** `SelectionBox.onMouseDown` only starts on Shift
>   (add) / Alt (start) / Ctrl (remove); a plain left-drag returns (it would pan). Holding
>   Shift both selects "add" mode *and* makes the zoom filter ignore the drag — so a
>   Shift+left-drag cleanly draws the box. (The box lives in screen space, outside the zoom
>   layer, so it's deterministic regardless of pan/zoom.)
> - **The box skips nodes at x=0 or y=0.** `getNodesInRect` early-returns on `!node.x ||
>   !node.y`, so a node sitting on either axis (here `a` and `hub`, both at graph x=0) can
>   never be box-selected. T6.2 therefore frames two off-axis nodes (`b`, `c`) — and asserts
>   ≥2 selected on release so the box provably encloses them.
> - **Lasso fights the pan, and the release click deselects.** `renderer.toggleLassoMode(true)`
>   only toggles the overlay; in the app the *toolbar* both cancels canvas panning (a
>   `canvasBeforeZoom` handler) *and* cancels the `canvasClick` that fires on pointer-up —
>   which otherwise `unselectAll`s the nodes the lasso just selected. The harness has no
>   toolbar, so `enableLasso` registers both cancellers. (The selection box dodges the
>   deselect on its own: `SelectionBox` `preventDefault()`s its mousedown, so no click
>   fires.) T6.3 verifies the release selects the enclosed node and adds a second baseline,
>   `lasso-selected.png`, that actually shows it highlighted.
>
> **Determinism:** all five Area 6 tests `pin()` the fixture's designed positions first.
> The original selection tests ride the *settled* force layout, which drifts a couple of
> percent under heavy parallel-run CPU contention (the README's known caveat) — tolerable at
> their pixel budget, but the group-drag (T6.5) is much more sensitive: dragging a node
> restarts the force pass, so without pinning the *un*selected nodes drift and the dragged
> ones pick up force noise. Pinned, only the dragged selection moves, by an exact, equal
> delta (asserted in T6.5), and every baseline is a pure function of the fixture. Baselines
> reviewed (multi-highlight + focus dim; rubber-band; dashed lasso polygon; single-selection
> dim with class assertions; group drag with position assertions) and stable over repeated
> runs (incl. a 4× `--repeat-each` stress). The bulk-action toolbar flyout that multi-
> selection surfaces ("Pin Nodes") is captured as-is in T6.1/T6.5 — it's deterministic.

- [x] **T6.1 ✅ Multi-select** — `multiSelect(['b','hub'])` (deterministic stand-in for shift+click); both highlighted, the non-adjacent `d`/`e` and their edges dim (`-highlight-shadow`). → `multi-select.png`
- [x] **T6.2 ✅ Selection box** — Shift+left-drag rubber-band over two off-axis nodes; snapshot **mid-drag** (before mouseup) showing `.pvt-selection-rectangle`, then release and assert ≥2 nodes selected. → `selection-box.png`
- [x] **T6.3 ✅ Lasso** — `enableLasso()`, trace a polygon around hub, snapshot mid-drag (`.pvt-lasso-overlay > polyline`, open until pointerup), then release and assert hub got selected (+ a result snapshot). → `lasso.png`, `lasso-selected.png`
- [x] **T6.4 ✅ Focus-mode dimming** — `selectNode('b')`; asserts `a`/`c` (adjacent) stay lit and `d`/`e`/`hub` carry `-highlight-shadow`, plus a snapshot. → `focus-mode-dim.png`
- [x] **T6.5 ✅ Multi-node group drag** — `multiSelect(['a','b'])` then a real drag of `b`; the **whole selection moves together** (`Simulation` drags all subjects when `hasActiveMultiselection()`). Asserts `a` and `b` shift by the same delta and `hub` stays put, plus a snapshot. → `multi-node-drag.png`

---

## Area 7 — Hover, tooltip & context menu  ·  `specs/interactions.spec.ts`  ·  Priority P3

Interaction states. Tooltips are body-attached (`.pvt-tooltip`) with a ~400ms show delay —
wait for it. Context menu is `.pvt-contextmenu`. Needs a UI mode that enables these.

> **Done.** Spec: `specs/interactions.spec.ts`. **No new verb or fixture, and no P0.7
> work needed:** the harness's existing light mode already mounts both the Tooltip and the
> ContextMenu (`UIManager.buildUIGraphNavigation` wires them whenever their `enabled` flag
> is set, which it is by default — `setupLightMode` calls it). All four tests use **real
> pointer gestures** (the P0.6 "pick per test" call — the gesture *is* the thing under
> test): T7.1 hovers a node (a primed pointer move so the tooltip's proximity guard passes,
> then waits out the show delay); T7.3/T7.4/T7.5 right-click the node / an empty canvas
> corner / the note.
>
> **Snapshot target.** The tooltip and context menu are appended to `document.body`,
> *outside* `.pvt-canvas`, so each baseline screenshots that element directly (new
> `expectElement(locator, name)` helper) rather than the canvas. Their content is a pure
> function of the node/edge/note data.
>
> **Determinism (the flake this surfaced).** These body elements are auto-sized and
> positioned at the gesture point, so the screenshot crop's pixel-snapped height depends on
> the *fractional* screen position of the hovered/clicked element. Under the settled force
> layout that position drifts a touch run-to-run (the README's known caveat), which flipped
> the tooltip's captured height by a pixel (112↔113 → a hard dimension-mismatch failure,
> caught under `--repeat-each`). Fix: every test `pin()`s the fixture's designed positions
> first, anchoring the gesture deterministically (the same fix Area 6 used). Baselines
> reviewed (node preview + name + properties; the three menus' quick-actions + items) and
> stable over repeated runs (incl. `--repeat-each 4` and the single-worker full suite).

- [x] **T7.1 ✅ Node tooltip** — hover node `a`, wait out the show delay, snapshot `.pvt-tooltip` (node preview + name + id/label properties). → `tooltip-node.png`
- ⏭️ **T7.2 — Node hover highlight** — _descoped._ There is **no built-in hover effect** on
  graph nodes/neighbours: `nodeHoverIn` only emits the event and opens the tooltip (no
  `:hover` styling, no highlight class on the node `<g>`). Hover's only visual is the
  tooltip, already covered by T7.1 — a separate baseline would be a duplicate of the
  non-hovered canvas.
- [x] **T7.3 ✅ Node context menu** — right-click node `a`; topbar Pin/Focus/Hide + menu Select Neighbors / Hide Children / Connect to… / Inspect Properties. → `contextmenu-node.png`
- [x] **T7.4 ✅ Canvas context menu** — right-click an empty canvas corner; Pin All / Unpin All + Add Note. → `contextmenu-canvas.png`
- [x] **T7.5 ✅ Note context menu** — right-click the note (`withNote`); Hide Note + Remove Note. → `contextmenu-note.png`

---

## Area 8 — UI chrome  ·  `specs/ui-chrome.spec.ts`  ·  Priority P3

Depends on **P0.7** (full mode). Target specific elements, not the whole page — chrome
pixels are more volatile. Each snapshots its own element locator.

> **Done.** Spec: `specs/ui-chrome.spec.ts`. Each test targets a specific element locator.
>
> **Mode (the P0.7 question, resolved — see P0.7 above).** Only the **sidebar** needs full
> mode; it's the one piece built solely in `'full'` mode. T8.1 loads full mode via a plain
> `load()` override (`UI.mode:'full'`, `sidebar.collapsed:false`). The toolbar, navigation,
> controls and modal/mainheader containers are already built by the existing **light** mode
> and positioned as overlays / a top bar independent of grid mode, so T8.2–T8.5 stay on the
> default light-mode harness (they render identically either way).
>
> **Entry mechanism (the P0.6 "pick per test" call).** Edit mode (T8.2) and the search modal
> (T8.5) are driven by their real entry points — the `e` shortcut (after focusing the
> container, which the keybinding gates on; keyboard rather than a click keeps the button
> unfocused, so no focus ring leaks into the baseline) and a click on the real search button.
> The inspect modal (T8.4) uses the new **`openInspect(id)`** verb — the same `createInspectModal`
> the `i` shortcut / context-menu "Inspect Properties" item call (mirroring how T5.4 opens the
> filter panel by verb).
>
> **Determinism.** The one risk was T8.1's **"Neighbor Graph" tab**, which renders a *separate
> internal sub-graph* (`new Graph(...)` with an `egoTree` radial layout) — exactly the
> tree-layout brittleness the README flags. Two things make it safe: (1) the sub-graph sets
> `cooldownTime:0` / `warmupTicks:0`, so its nodes land **directly on the deterministic
> d3-hierarchy radial targets** with no force relaxation to drift (unlike the main-graph trees);
> and (2) it renders **asynchronously** and keeps its container `visibility:hidden` until drawn,
> so the test **waits explicitly** for that flip and for the four node shapes before
> snapshotting — relying on `toHaveScreenshot`'s stability heuristic alone races the async
> render and can lock in the *empty* container. Verified stable over 30+ repeats (single-worker
> and parallel, incl. `--repeat-each 20` under heavy CPU contention). The other baselines are
> modal/overlay/list chrome — pure functions of the node/edge data, layout-independent (the node
> previews are bbox-scaled clones), so no `pin()` is needed anywhere in this area.
>
> **T8.3 is split into two baselines.** The navigation (top-right) and the layout/physics
> controls (top-left) sit in opposite canvas corners with no tight common wrapper, so rather
> than one whole-canvas shot (which the README steers away from for chrome), each is snapshotted
> as its own element: `nav-controls-navigation.png` + `nav-controls-controls.png`. Loaded on the
> acyclic `tree` fixture so the tree-layout buttons render enabled (a cyclic graph disables them);
> the controls' fly-out sub-options are `:hover`-only, so they stay collapsed in the screenshot.

- [x] **T8.1 ✅ Sidebar with a node selected** — overview + properties + neighbours panels populated for node `a` (`.pvt-sidebar`, full mode). → `sidebar-node-selected.png`
- [x] **T8.2 ✅ Toolbar in edit mode** — `e` toggles edit mode; tool groups (Add Node/Edge/Note + selection tools) reveal and the button reads "Editing" (`.pvt-graphtoolbar`). → `toolbar-edit-mode.png`
- [x] **T8.3 ✅ Navigation + controls** — zoom/fit/fullscreen/options (`.pvt-graphnavigation-elements`) + layout/physics buttons (`.pvt-graphcontrols-layout`); two baselines (see above). → `nav-controls-navigation.png`, `nav-controls-controls.png`
- [x] **T8.4 ✅ Inspect-node modal** — `openInspect('a')` (same as the `i` shortcut / context menu); snapshot `#inspect-node-modal` (preview + name + Properties / JSON tabs). → `inspect-modal.png`
- [x] **T8.5 ✅ Search / node-picker modal** — click the search button (Shift+J equivalent), type `router` on `filterable` (matches the 3 routers); snapshot the picker with its results. → `search-modal.png`

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

- **Full-mode strategy (P0.7):** _Resolved (Area 8)._ Neither a parametrised harness nor a
  second page — just a **`load()` override** (`UI.mode:'full'`, `sidebar.collapsed:false`),
  since `load` already deep-merges options and only the sidebar actually needs full mode (the
  rest of the chrome renders in light mode). Documented in `README.md` and the P0.7 block.
- **Layout determinism (Area 3):** _Resolved._ Neither "settle the sim" nor "assert the
  transform" alone — instead **recompute the layout's exact d3-hierarchy positions and pin
  them** (the `applyLayout` verb), so trees are pixel-deterministic without any tick-count
  dependence; force (no exact target) pins the fixture seeds. Position assertions (T3.6)
  back every pixel baseline. See the Area 3 done-block.
- **CI:** README notes no GitHub Actions workflow is wired yet. Out of scope here, but the
  baselines this PRD produces assume a Linux CI runner (Playwright Docker image).
