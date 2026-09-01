# Groundwork — what the code actually says

**Status:** Step 0 of [`pivot-enrichment-ui-prototype-brief.md`](pivot-enrichment-ui-prototype-brief.md),
run 2026-09-01 against `62db9da`. Every claim the brief makes about the existing chrome, checked
against `src/` and against the running demo (`npm run dev`, 1600×950, full mode, both themes).
This file records what holds, what does not, and the measurements the artboards need. It decides
nothing.

## 1. Confirmed as written

| Brief says | Code |
|---|---|
| `Notifier` has levels, no action button | `Notifier.notify(level, title, message)`; `UIManager.showNotification` builds a title+body toast — `UIManager.ts:1075` |
| Badges auto-place clockwise from NE | `CORNERS = ['ne', 'se', 'sw', 'nw']` — `BadgeDrawer.ts:12` |
| Four free corners on a plain node, two on a container | A node with children reserves **both** `ne` and `se`, whatever its expanded state, so `nw`/`sw` remain — `BadgeDrawer.ts:167` |
| `text` renders a pill, `99+` past three characters; `title` is a native tooltip; per-badge `onClick` | `NodeBadge` — `RendererOptions.ts:304`. `onClick` also **consumes** the click, so the node is not selected too |
| Narrowing controls are `text`/`select`/`multiselect`/`numberRange`/`boolean` | `FilterFacetType = 'text' \| 'regex' \| 'select' \| 'multiselect' \| 'numberRange' \| 'boolean'` — `GraphQueryEngine.ts:49`. The PRD's `Exclude<…, 'regex'>` is exactly those five |
| `TableGrid` virtualises above 200 rows | `virtualizeAbove = 200` — `TableGrid.ts:98` |
| Mainheader undo/redo are disabled placeholders | Rendered with the `disabled` attribute — `Mainheader.ts:80`; still disabled at runtime |
| A registered-modes zone exists on the rail | `pvt-moderail-zone` — `ModeRail.ts:52`. The demo already registers an **Explore** mode through `ctx.addRailMode` (`main.ts:579`) — the exact pattern §3.2 variant 1 would use |
| `viewer` / `static` modes exist | `GraphUIMode = 'viewer' \| 'full' \| 'light' \| 'static'` — `GraphUI.ts:420` |
| Portaled surfaces opt into the themed scrollbar | `src/styles/_scrollbars.scss` |

`RawNode.expanded` is still **required** (`GraphOptions.ts:73`), so the PRD's M1 "make it optional"
is real pending work, not already true.

## 2. One correction

The selection sidebar is **340px**, not 322px — `--pvt-sidebar-width: 340px` (`_layout.scss:14`),
and `getComputedStyle` returns `340px` on the running demo. Artboards should be drawn at 340.

## 3. Library gaps beyond the toast one the brief already flags

**G1 — the toast is not just missing a button.** It is removed on a hard 4000 ms timer, with no
hover-pause and no dismiss control, and `showNotification` returns `void`
(`UIManager.ts:1096-1106`). So the analyst gets four seconds to read "Ingested 12 nodes, 14 edges"
and decide to undo, and §3.4's "toast flips to *Undone — Redo*" has nothing to mutate. The minimal
extension the prototype specs has to cover **lifetime and a handle**, not only an action slot.

**G2 — a dock tab's label cannot change.** `DockTabHandle` exposes `activate`, `refresh` (body
only) and `remove` — no `setLabel` (`GraphUI.ts:844`). §3.3's "tab = pivot label + count" with a
live count has no API today: either the count lives in the pane header, or the design specs
`handle.setLabel()`.

**G3 — one dock tab draws no tab strip at all** (`GraphUI.ts:870`). A single triage pane is
therefore *strip-less*; the concurrency story only becomes visible at two panes. Phase A needs
both states drawn, not just the multi-pivot one.

**G4 — the context menu is flat.** `MenuActionItemOptions` has no `children`/`submenu`
(`GraphUI.ts:706`), so "Pivot ▸ …" as a nested menu does not exist — it is either one flat
`Pivot…` entry or one entry per pivot. Consolation: `visible` may be a predicate over the clicked
element, which gives `appliesTo` filtering (present, never greyed) for free.

## 4. Measurements for the artboards

Full mode at 1600×950, dock open:

- mainheader 48px · sidebar 340px · dock **332.5px** — 35% of the viewport height.
- The canvas is already ringed: rail + tool panel top-left, navigation top-right, legend
  bottom-left, minimap bottom-right. There is no free corner. This bears on §3.2 variant 2 (an
  anchored popover has little room) and on §3.4 (ingested nodes settling around the origin).
- A sidebar with one node selected is already full: header, `PROPERTIES`, then the *Neighbor
  Graph / Stats / List* tabs take the remaining height. A "Pivots" block (variant 3) lands below
  the fold unless it displaces one of them.
- The node context menu today: a quick-action topbar (pin / focus / hide) over *Select Neighbors ·
  Hide Children · Connect to… · Inspect Properties · Delete Node*.

## 4b. What the Phase B prototype added to this list

Built against the real library ([`../prototype/`](../prototype/README.md)), so these are
observed rather than read:

- **A registered rail mode's button shows its *armed tool*, not the mode.**
  `ModeRail.paintFace` uses `tool?.label ?? mode.label`, so a `defaultTool` renames the rail
  button — Pivot mode must declare none.
- **`RailModeDefinition.render()` is only re-invoked when the panel rebuilds** (a mode change),
  not when data settles. A live panel has to own a persistent host element.
- **`addNode` / `addEdge` each emit their own `dataBatchChanged`** — 24 events for a 12-node,
  12-edge ingest. This is the concrete case behind the PRD's "clean `dataBatchChanged` emission".
- **Badge text is capped at three characters**, so `2.1k` renders as `99+`; a 2,100 potential
  must be abbreviated to `2k` by the consumer.
- **`Graph.nodes` / `Graph.edges` are private**; `getMutableNode(id)` is the door for the
  existence checks dedup needs (`getNode` returns a clone).
- **A per-mode tool-panel width is genuinely needed**, confirmed in use: 216px cannot hold a
  `multiselect` with counts above a `numberRange` pair. The prototype overrides to 300px.

## 5. One arithmetic note on the fake provider

The §6 facet counts sum exactly: 1,800 + 210 + 95 + 38 = **2,143**, and *URLs* alone is **210**.
The walkthrough numbers fall out of the data rather than being asserted, and the gate genuinely
lifts. Keep that invariant when the fake provider is built.
