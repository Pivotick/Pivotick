# Feature — dock tabs: `addDockTab()`, and the second occupant that proves it

**Status:** Draft — pre-grilling. 2026-08-24.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-24
**Area:** `src/ui/elements/Dock/` (the tab strip, activation, the toolbar swap), `src/ui/UIManager.ts` (`addDockTab` / `removeDockTab` / lazy dock build + the `PluginContext` entry), `src/ui/elements/Table/Table.ts` (becomes a tab contributor rather than *the* occupant), `src/interfaces/GraphUI.ts` (`DockTab`), `src/plugins/eventLog/` (new — the second occupant), `src/Graph.ts` (`openTable` and friends now name a tab)
**Related:** [`bottom-dock.md`](bottom-dock.md) — its **§8** sketched this API and its **D-6** deferred it *until a real second occupant exists*; this PRD is that effort, and the sketch is the starting point, not the answer. [`table-mode.md`](table-mode.md) — the table is the incumbent occupant and the thing a regression would land on. [`minimap-plugin.md`](minimap-plugin.md) — proof a UI surface can ship as a plugin on public API; the event log should be able to do the same. `misp/runtime-sidebar-panels.md` — `addPanel()` is the closest precedent in the codebase and this API should rhyme with it.

---

## 0. Instructions

This is a **draft for grilling**, not a plan to execute. Every `D-n` below is a
*proposal* with the argument for it and the cost of it; none is settled. §7 lists what I
could not answer from the code.

---

## 1. What we're trying to achieve

The dock is a region with exactly one occupant and no way to add another. `addDockTab()`
opens it: a second pane can take the same row, the same height, the same fold, rather
than standing up a rival resizable strip that fights the first one for the canvas.

D-6 refused to ship the API on its own, for a reason worth restating because it
constrains this PRD too:

> public API is cheap to add and expensive to have been wrong about, and the tab-strip
> version forced a visible regression on the only occupant there is to make room for one
> that isn't coming yet.

So this effort has **two deliverables that stand or fall together**:

1. `DockTab` + `addDockTab()` + the strip that switches between tabs.
2. **A real second occupant** that ships on that API and nothing more privileged — the
   proof, and per §8 "the reason to write it".

And one bar to clear, inherited from the hoist: **the table must not get worse to make
room.** Last time that meant no baseline moved at all. This time the header genuinely
gains a control, so the bar is narrower — see D-2.

### Explicitly out of scope

- **A console / CLI.** `bottom-dock.md` §8 already parked this: the command language is
  the real problem, not the pane. If the event log needs a filter box, that is a filter
  box, not a language.
- **Per-tab height, detach, maximise, tear-off.** §8 out-of-scope, still out.
- **A right-hand or floating dock.** Same.
- **Row-level actions in the table.** Still deferred (table-mode D-B).
- **Reordering tabs by dragging.** `order` at registration is enough.

## 2. Gap in Pivotick today

All verified against the tree at `5a53b3b`.

### 2.1 The region cannot outlive the table, and the plugin arrives too late

Both `UI_ELEMENTS` rows are gated on the same predicate (`UIManager.ts:250,258`):

```ts
{ key: 'dock',  modes: ['full'], enabled: o => tableWanted(o.table), … }
{ key: 'table', modes: ['full'], enabled: o => tableWanted(o.table), … }
```

That was right when the table was the only occupant — "no table, no region". It is
wrong the moment something else wants the row: `table: false` means no dock at all, so a
log plugin has nowhere to mount.

Worse, the ordering rules it out even with the table on. `Graph`'s constructor builds the
UIManager at `Graph.ts:111` — which runs `setup()` → `build()` → the whole of
`UI_ELEMENTS` — and only installs `options.plugins` at `Graph.ts:133`. **Every plugin
registers after the dock's `enabled` gate has already returned its verdict.** A dock tab
therefore has to be able to bring the region into being, not just fill it.

There is a precedent for exactly this and it is two screens up: `setLegend()`
(`UIManager.ts:565`) builds the legend on first need and `addElement()`s it, catching it
up to whatever phase the UI has reached. `addDockTab()` should work the same way.

### 2.2 The header has one tab strip already, and it is the table's

`.pvt-table-tabs` (`table.scss:12`) holds `Nodes | Edges`, rendered by `Table.renderTabs()`
into the dock's toolbar slot — so it is the *first* thing in the header after the chevron.
A dock-level strip would land immediately beside it, and the header would read

```
[⌃]  [ Table | Log ]  [ Nodes | Edges ]  12 of 40 rows  Select all  CSV JSON  Columns
```

Two tab strips, two hops from one pixel to the next, and no way for a reader to tell
which one is the outer. **This is the visible regression D-6 refused**, and any shape that
produces it is a non-answer. D-2 is where that gets resolved.

Worth noting what the table already gets right and the dock should copy: a single tab
renders **no strip** (`Table.renderTabs()` returns early on `offered.length < 2`, and
`.pvt-table-tabs:empty { display: none }`). Nothing points at a switch with one setting.

### 2.3 The toolbar slot is single-occupant by construction

`Dock.toolbarSlot()` hands out one element with `display: contents` — the trick that made
the hoist invisible, since the occupant's controls lay out as the header's own children.
The table fills it once, in `onMount`, and remembers what it put there (`toolbarItems`)
purely so `onDestroy` can take it back out.

With tabs, the header's right-hand group is **per tab**: `Select all`, `CSV`, `JSON`,
`Columns` are the table's and mean nothing over a log. So the slot has to be emptied and
refilled on activation, and `display: contents` has to survive that — an empty slot must
still cost nothing, or every tab switch nudges the header's gaps.

### 2.4 Nothing tells an occupant it stopped being visible

`Dock.onCollapsedChange()` is the only signal, and it is about the *fold*, not about which
tab is on top. The table rebuilds on every graph and filter event
(`Table.onAfterMount()` subscribes to 11 of them) and coalesces to one rebuild per frame.
Left on a hidden tab it keeps doing that — windowing, sorting and re-rendering rows nobody
can see, on data that may be changing fast. An `active` signal is not a nicety here.

The fold has the same problem today, incidentally: folding hides the chrome in CSS and the
table keeps rebuilding behind it. Out of scope to fix, but the same signal would cover it.

### 2.5 Three public entry points name the table and mean the region

- `Graph.openTable()` / `closeTable()` / `toggleTable()` — documented, and they delegate to
  `UIManager.dock.setOpen()` / `toggleOpen()`. They are about the *region*, under the
  incumbent's name.
- `Shift+T` is registered by the **dock** (`Dock.onAfterMount()`), and its comment already
  admits the letter is a leftover: *"The letter is the table's, which is what the region
  held first."*
- `graph.UIManager.table` and `.dock` are both public accessors.

With two occupants "open the table" becomes ambiguous — the region, or the tab? These are
shipped names (`docs/ui-table.md`), so the answer has to be compatible, not clean. D-5.

### 2.6 `addPanel()` is the shape to rhyme with

`UIManager.addPanel()` (`:603`) is the codebase's answer to this exact problem for the
sidebar, and it settles several questions for free:

- plain-object registrations, not `UIComponent` subclasses;
- `id` auto-generated when omitted, duplicates warned and dropped;
- returns a **disposer**, idempotent, and a no-op after `destroy()`;
- `order ?? 0` with a stable insert (`panelInsertIndex`) so equal orders keep registration
  order;
- a `*Handle` passed into the render fn so a panel can refresh or remove *itself* without
  capturing the graph;
- `UI.extraPanels` is seeded through `addPanel()` before `build()` — **declared config is
  sugar for the imperative API, not a second mechanism.**

That last line is exactly what §8 asks for `UI.table`, and it says the resolution should
happen *before* `build()`, which is a useful constraint on D-2.

## 3. Decisions proposed (for grilling)

| # | Question | Proposal | The cost |
|---|---|---|---|
| **D-1** | Who owns the tab strip's markup? | The **dock**. New `.pvt-dock-tabs` / `.pvt-dock-tab`, styled from `.pvt-table-tab`'s rules so the pixels land where they already are. `Table.renderTabs()` and `.pvt-table-tabs` go. | One spec selector re-points (`table-export.spec:110`). The table stops owning a control it currently draws. |
| **D-2** | Table = one tab, or one tab per table tab? | **One dock tab per table tab.** `tabs: ['nodes','edges']` contributes *two* dock tabs. The strip reads `Nodes │ Edges │ Log`. | §8 wrote "`UI.table` would resolve into **a** `DockTab`" — singular. This departs from the sketch. The table's per-tab state (`grids` map) now sits behind dock activation. |
| **D-3** | Does an inactive tab keep rendering? | **No.** `DockTab` gets `onActivate` / `onDeactivate`; the table stops rebuilding when it is not the visible tab and does one catch-up rebuild when it comes back. | A new lifecycle concept, and a stale-content bug class if the catch-up is missed. |
| **D-4** | Where does the dock come from when the table is off? | `addDockTab()` **builds the region on first need**, exactly as `setLegend()` does. `enabled` becomes "the table is wanted **or** a tab was registered". | The dock can now appear mid-life, which means it can appear *after* `graphReady` and has to be caught up. `addElement()` already does this. |
| **D-5** | What happens to `openTable()` and `Shift+T`? | Both stay and keep meaning **the region**. `Shift+T` shows/folds the dock; `openTable()` additionally *activates a table tab* if one exists, so the documented call still does what its name says. New `Shift+\`` for "cycle dock tabs" — or nothing, pending grilling. | `openTable()` grows a side effect. A second dock shortcut is more keyboard surface for a feature two people will use. |
| **D-6** | What is the second occupant? | An **event log** — the graph's own event bus, timestamped, newest-first, with pause / clear / a type filter. Ships as `eventLog()` in `src/plugins/`, on public API only, the way `minimap()` did. | It is a developer's tool in a consumer-facing library. See §4.4 for why I think that is the point rather than the objection. |
| **D-7** | Is the event log mounted by default anywhere? | **No.** Opt-in via `plugins: [eventLog()]`. Unlike the minimap, nobody wants an event log they did not ask for. | Means the tab strip is invisible in every default configuration — so the API's own proof is off by default. That is a real tension; grill it. |
| **D-8** | Is `Dock` exported from `index.ts`? | **No.** `DockTab` (the type) is public; `Dock` stays internal, and a tab's `render` receives a narrow handle, not the dock. | A tab cannot resize or fold its own region. Probably correct — §8's sketch handed `render` the whole `Dock`, which would have made `Dock` public API by accident. |

## 4. Proposal

### 4.1 The interface

```ts
/** A pane in the bottom dock. Registered up front via `UI.dock.tabs`, or at any
 *  point with `graph.UIManager.addDockTab()`. */
export interface DockTab {
    /** Stable identity: the activation key, and what `removeDockTab` takes. Auto-generated when omitted. */
    id?: string
    /** The strip's label, used verbatim (so it can be translated). */
    label: string
    /** Build the pane's body. Called once, lazily, the first time the tab is activated. */
    render: (tab: DockTabHandle) => HTMLElement
    /** Build the tab's own header controls. Re-invoked on each activation. */
    toolbar?: (tab: DockTabHandle) => HTMLElement | HTMLElement[]
    /** Display order, ascending. @default registration order */
    order?: number
    /** Called when this tab becomes / stops being the visible one. */
    onActivate?: (tab: DockTabHandle) => void
    onDeactivate?: (tab: DockTabHandle) => void
}

/** What a tab gets to drive itself, without capturing the graph or the disposer. */
export interface DockTabHandle {
    readonly id: string
    /** Is this the visible tab? */
    readonly active: boolean
    /** Make this the visible tab (and unfold the dock if it is folded). */
    activate(): void
    /** Unregister the tab and remove its DOM. */
    remove(): void
}
```

and on `UIManager`, mirroring `addPanel` / `removePanel` / `getPanels`:

```ts
addDockTab(tab: DockTab): () => void      // disposer, idempotent, no-op after destroy
removeDockTab(id: string): void
getDockTabs(): ReadonlyArray<RegisteredDockTab>
activateDockTab(id: string): void
```

plus a `PluginContext` entry (`addDockTab`) so a plugin never reaches for `ctx.ui`
directly, as `addPanel` already models.

Declared config, seeded through the imperative path before `build()`:

```ts
UI: { dock: { tabs: [myTab], open: true, height: 0.4 } }
```

### 4.2 `UI.table` resolves into dock tabs (D-2)

`UI.table` keeps every option it has. Internally, `UIManager` resolves it into one
`DockTab` per entry in `TableOptions.tabs`, seeded before `build()` the way
`UI.extraPanels` is:

```
UI.table = { tabs: ['nodes', 'edges'] }
  → DockTab { id: 'table-nodes', label: 'Nodes', order: 0,  render: … }
  → DockTab { id: 'table-edges', label: 'Edges', order: 10, render: … }
```

One `Table` instance still owns both, and still keeps a `TableGrid` per tab so each
holds its own sort, columns and row filters — that is unchanged behaviour with a
different switch driving it. `render` for a table tab returns that tab's grid root;
`toolbar` returns the controls the table draws today.

**Why this and not §8's single `Table` tab:** it is the only shape where today's header
*is* the end state. `Nodes │ Edges` is already a two-tab strip in the dock's header; under
D-2 it becomes the dock's own strip in the same place with the same styling, and a log
plugin adds a third sibling. Under the single-tab shape you get §2.2's two strips the
moment anything else registers — the regression D-6 refused, arriving later instead of
now. The departure from the sketch is deliberate and is the first thing to grill.

**Precedence of `Nodes`/`Edges` order:** `order ?? 0` with a stable insert puts the
table's tabs first, since plugins register after `build()` regardless. No special-casing.

### 4.3 The strip, and the toolbar swap

```
.pvt-dock
├ .pvt-dock-divider
├ .pvt-dock-header
│ ├ .pvt-dock-toggle           ← the chevron (unchanged)
│ ├ .pvt-dock-tabs             ← NEW. Hidden while < 2 tabs, and while collapsed.
│ └ .pvt-dock-toolbar          ← `display: contents`. Emptied and refilled per activation.
└ .pvt-dock-body               ← the active tab's element; inactive tabs' elements detached
```

- **< 2 tabs renders no strip**, copying `Table.renderTabs()`'s early return and
  `:empty { display: none }`. So a graph with only `tabs: ['nodes']` looks exactly as it
  does now, and so does one with the table suppressed and a lone log tab.
- The **body** holds one tab's element at a time. Detached, not hidden: `TableGrid`
  windows its rows against `root.parentElement` (per the hoist's notes), so a grid parked
  in a hidden wrapper would measure the wrong scroller. Detach and re-append.
- The **toolbar** is emptied and refilled from `tab.toolbar()` on activation. `display:
  contents` means an empty slot still costs nothing — the property that made the hoist
  invisible has to keep holding through the swap, and a test should say so.

### 4.4 The second occupant: an event log (D-6, D-7)

`eventLog()`, in `src/plugins/eventLog/`, on public API only:

```js
import { Pivotick, eventLog } from 'pivotick'
new Pivotick(container, data, { plugins: [eventLog()] })
```

It subscribes to what is already public and typed — the data bus (`graph.on`: `nodeAdd`,
`nodeRemove`, `nodeChange`, `edgeAdd/Remove/Change`, `noteAdd/Remove/Change`,
`dataBatchChanged`), the query engine's `filterAdd/Remove/Change/Reset`, and the
interaction bus's selection events — and lists them newest-first with a timestamp, the
event name and a one-line subject. Toolbar: **Pause**, **Clear**, and a type filter.

Why an event log rather than something a consumer's end user wants:

- It is the **honest** test of the API. It needs a body, its own toolbar, its own
  re-render schedule (nothing to do with the selection), and it must stop working when
  hidden — every seam D-3 and §4.3 introduce, exercised by a real consumer instead of a
  fixture.
- It is buildable **entirely on public API**, which is the minimap's bar. If it needs one
  private reach, that is a gap in the public surface and the log is how we find out — the
  same way the minimap surfaced three viewport gaps.
- Pivotick has no way at all to watch its own event bus today. Every one of the debugging
  notes in `table-mode.md` — `hideNode()` notifying nobody, `dataBatchChanged` firing
  twice, the multi-event coalescing — was found by reading code. This is the instrument.

D-7 (off by default) is the uncomfortable half: it means no default configuration shows
the tab strip, so the feature's proof is behind an opt-in. The alternatives are worse
(an event log nobody asked for, in a consumer's product) but the tension is real —
see §7.

### 4.5 Lifecycle

- `addDockTab` before `build()` (from `UI.dock.tabs` or `UI.table`) → the dock is in
  `UI_ELEMENTS` and picks the tabs up when it mounts.
- `addDockTab` after `build()` (a plugin, or any later call) → if the dock exists, the
  strip re-renders and nothing else moves; if it does not, `addDockTab` builds it and
  `addElement()`s it, which catches it up to whatever phase the UI has reached (D-4).
- The disposer removes the tab, its DOM, and — if it was the visible one — activates the
  next. Removing the **last** tab leaves an empty dock; it should give the row back, on
  the same argument as the original gate ("the region must not outlive its occupant").
- After `UIManager.destroy()`, `addDockTab` warns and returns a no-op disposer, and a
  disposer held across destroy is silent. Both are `addPanel`'s existing behaviour.
- `DockTab` is a plain object, so nothing recurses `UIComponent` phases into it. A tab
  that needs `graphReady` should be a plugin holding a `UIComponent` and calling
  `addDockTab` from it — which is what `eventLog()` will do, and therefore a real check
  that the plain-object shape is sufficient.

## 5. What the integrator does

```js
// The declared route
new Pivotick(el, data, {
    UI: {
        mode: 'full',
        dock: { open: true, height: 0.4, tabs: [{
            label: 'Notes',
            render: () => myNotesPane(),
            toolbar: () => myNotesControls(),
        }] },
    },
})

// The imperative route, at any point in the graph's life
const dispose = graph.UIManager.addDockTab({ id: 'audit', label: 'Audit', render: … })
dispose()

// The plugin route — what eventLog() does internally
export function eventLog(options = {}) {
    return { name: 'eventLog', install(ctx) { ctx.addDockTab({ … }) } }
}
```

## 6. Risks

- **The table is the incumbent and every `table-*` spec lands on it.** D-2 moves the tab
  strip's ownership and D-3 changes when it rebuilds. `table-export.spec:110` names
  `.pvt-table-tab[data-tab="edges"]` and will need re-pointing; if anything in
  `table-grid` / `table-selection` / `table-virtualization` needs an edit, that is the
  tell that D-2 or D-3 went further than advertised.
- **D-3 is where the bugs will be.** "Stop rebuilding while hidden" plus "catch up on
  return" is a cache-invalidation problem in a trench coat. The failure is silent and
  looks like stale rows. It needs a spec that changes the data *while the tab is hidden*
  and asserts what comes back — and per the branch's practice, checked against a
  deliberately reverted fix.
- **A lazily-built dock can arrive after `graphReady`.** `addElement` handles the catch-up,
  but the dock also writes `--pvt-dock-height` on `.pvt-layout` and starts a
  `ResizeObserver`. Appearing mid-life shortens the canvas under a settled simulation, and
  `Simulation.measureContainer` is exactly the thing `table-mode.md` §3.4 flagged. Assert
  the inputs, not the outcome — `physics-container.spec`'s lesson.
- **`display: contents` through a swap.** If refilling the slot changes the header's gaps
  even by a pixel, every table baseline moves and the hoist's invariant is spent. Cheap to
  test, easy to miss.
- **Two shortcuts for one region.** D-5's `Shift+\`` may not earn itself. The dock already
  has a chevron and a strip; a keyboard cycle for a two-tab strip is the kind of surface
  that is easier to add than remove.
- **The header is finite.** At 1024px with the sidebar open the dock header already
  carries a chevron, two tabs, a summary, `Select all`, two exports and `Columns`. A third
  tab is fine; a fourth plus a plugin's toolbar may not be. Nothing in the current CSS
  wraps or scrolls. Worth measuring before, not after.

## 7. Open questions

1. **D-6's occupant is my choice, not yours.** An event log is what §8 named ("a log or
   output pane") and what the library visibly lacks, but it is a developer's tool. If the
   proof should be something a consumer's user wants instead, the candidate list is short
   and the shape of `DockTab` barely changes — but D-7 changes completely.
2. **D-7: is a default-off occupant enough proof?** If not, the options are a
   `full`-mode default (rejected above), or shipping the log as a **gallery card** and
   accepting that the docs are where the API gets exercised. The gallery route is
   cheap and might be the honest answer.
3. **Does `UI.dock` become a public option group at all?** D-2 has `UI.table` resolving
   into tabs, so `UI.dock.tabs` is a second door into the same room. The dock's
   `open`/`height`/`collapsed` are currently read *out of* `UI.table` (`dockOptions()`),
   which is already odd and gets odder with two occupants. Options: promote them to
   `UI.dock` and deprecate the `UI.table` copies; keep both with a documented precedence;
   or leave `UI.table` as the only door and make `addDockTab` the only way to add a tab.
4. **Should the table's `Nodes`/`Edges` keep their `data-tab` attributes?** Re-pointing
   one spec is trivial; keeping `data-tab="edges"` on a `.pvt-dock-tab` is a hair of
   backwards compatibility for a class nobody outside `src/` and one spec references.
5. **What does the dock do with zero tabs but `open: true`?** Give the row back (my
   assumption), or hold an empty region so `Shift+T` still has something to toggle?
6. **Is `toolbar` re-invoked or cached?** I proposed re-invoked per activation, which is
   simpler and lets a tab reflect its own state in its controls — but it re-creates the
   table's seven controls on every switch, and the column picker's open/closed state has
   to survive it (or deliberately not, as the fold already deliberately dismisses it).

## 8. Acceptance criteria

- `addDockTab()` registers, orders, activates and disposes; duplicate ids warn and drop;
  the disposer is idempotent and a no-op after `destroy()`. Same table of behaviours as
  `addPanel`, asserted directly.
- With the table's two tabs and nothing else, **no table baseline moves.** The strip is
  the dock's now, in the same place, at the same size.
- With `table: false` and `plugins: [eventLog()]`, the dock exists, holds one tab, renders
  **no strip**, and the canvas gets the rest of the row.
- With both, the strip reads `Nodes │ Edges │ Events`; switching swaps body *and* toolbar;
  the table's sort/columns/filters survive a detour through the log tab (the guarantee
  `table-export.spec`'s "each tab keeps its own sort" already asserts, extended across an
  unrelated occupant).
- A data change **while the table's tab is hidden** shows up correctly on return — the
  D-3 spec, verified against a reverted fix.
- The dock's height and fold are unchanged by tab switching (D-1 of the hoist, still true).
- `Graph.openTable()` / `closeTable()` / `toggleTable()` and `Shift+T` behave as documented
  today, with the table present.
- `eventLog()` uses no private API. Any reach that isn't public is a finding, and either
  the log changes or the surface does.
- `tsc`, `eslint`, `npm run build` clean; the full visual suite green.

## 9. Work plan

1. `DockTab` / `DockTabHandle` in `interfaces/GraphUI.ts`; the registry, `addDockTab` /
   `removeDockTab` / `getDockTabs` / `activateDockTab` on `UIManager`, modelled on the
   panel registry line for line; the `PluginContext` entry.
2. The dock: `.pvt-dock-tabs`, activation, body detach/re-append, the toolbar swap,
   `< 2 tabs → no strip`. No occupant changes yet — a throwaway second tab proves the
   strip, then goes.
3. Lazy build (D-4): `enabled` widens, `addDockTab` builds-on-need via `addElement`.
4. `UI.table` → dock tabs (D-2): the table becomes a contributor, `renderTabs` and
   `.pvt-table-tabs` go, `table-export.spec` re-points. **This is the step that must not
   move a baseline** — check before going further.
5. `onActivate` / `onDeactivate` (D-3), and the table's rebuild gate + catch-up.
6. `eventLog()` as a plugin. Every private reach it needs is a finding, not a workaround.
7. Specs: the registry table, the no-strip cases, the cross-occupant state survival, the
   hidden-tab data change, the header geometry.
8. Docs: `docs/ui-dock.md` (or a section in `ui-table.md`), the plugin's own page, and a
   gallery card if §7.2 lands that way.
