# Feature — dock tabs: `addDockTab()`, and the second occupant that proves it

**Status:** Implemented — 2026-08-24, branch `worktree-table-mode-prd`. Not merged. **D-2 was reversed on review** (Sami, 2026-08-24) from a flat strip to the nested model — see *Reversed* below, which supersedes the D-2 verdict. Read §11 before merging.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-24
**Area:** `src/ui/elements/Dock/` (the tab strip, activation, the toolbar swap), `src/ui/UIManager.ts` (`addDockTab` / `removeDockTab` / lazy dock build + the `PluginContext` entry), `src/ui/elements/Table/Table.ts` (becomes a tab contributor rather than *the* occupant), `src/interfaces/GraphUI.ts` (`DockTab`), `src/plugins/eventLog/` (new — the second occupant), `src/Graph.ts` (`openTable` and friends now name a tab)
**Related:** [`bottom-dock.md`](bottom-dock.md) — its **§8** sketched this API and its **D-6** deferred it *until a real second occupant exists*; this PRD is that effort, and the sketch is the starting point, not the answer. [`table-mode.md`](table-mode.md) — the table is the incumbent occupant and the thing a regression would land on. [`minimap-plugin.md`](minimap-plugin.md) — proof a UI surface can ship as a plugin on public API; the event log should be able to do the same. `misp/runtime-sidebar-panels.md` — `addPanel()` is the closest precedent in the codebase and this API should rhyme with it.

---

## Implementation (2026-08-24)

> **The event log has since been removed** (see §11.4). Everything below describing
> `eventLog()` — D-6, D-7, §4.4 — is the record of what was built, not of what ships. The
> dock, `addDockTab` and the nested model are unaffected; the log was only ever the
> *demonstration* that a second occupant was possible.

`tsc`, `eslint` and `npm run build` clean; **427 visual tests green (19 new) with no
baseline regenerated** — which was the bar, since the table is the incumbent and every
pixel of its header was already committed to a screenshot.

Commits on top of the table work: `1880149` (the tabs, and the table moving onto them),
`7686cc9` (`UI.dock`), `a106f47` (the event log + specs), `d3603d7` (the demo), `acb0050`
(the D-2 reversal below), `0e60b6a` (the refresh-toolbar fix) and `c1d2cc9` (the gallery
card). **431 tests green, no baseline regenerated.**

### Verdict on the proposals

- **D-1 held.** The strip is `.pvt-dock-tabs` / `.pvt-dock-tab`, styled from the table's
  old tab rules and placed between the chevron and the toolbar — which is exactly where
  the table drew its own. (The reversal below brought `Table.renderTabs` back; its classes
  are `.pvt-dock-views` / `.pvt-dock-view`, per §11.3.)
  Cost was the four selectors in `table-export.spec` the draft predicted, and nothing else.
- **D-2 was reversed** — see *Reversed: the nested model* below. §8's singular sketch was
  right all along. `order` still needed no special-casing: the table's one tab takes the
  default `0`, equal orders keep registration order, and a plugin registers later by
  construction.
- **D-3 held**, and it is the most interesting outcome — and it got *simpler* under the
  reversal, since the gate is now pane-level rather than per-grid. `onActivate` /
  `onDeactivate` are the only signal a pane gets, and the two occupants use them in
  **opposite** directions:
  the table stops rebuilding while hidden and re-derives on return, the log keeps recording
  and stops only painting. That is the strongest evidence the hooks are not table-shaped,
  and it was not something the draft predicted.
- **D-4 held.** `ensureDock()` builds the region on first registration, `setLegend`-style.
  This is load-bearing rather than defensive: `Graph` builds the UIManager at `:111` and
  installs plugins at `:133`, so **every** plugin tab arrives after the gate. Reverting it
  fails two specs.
- **D-5 held, minus the shortcut.** `openTable()` now also activates the table's pane, via
  `Table.dockTabId()` — asking the table which tab is its own rather than matching id
  prefixes in `Graph`. `Shift+T` still means the region. **No `Shift+\`` was added**: the
  strip and the chevron are both one click away, and the draft was right to doubt it.
- **D-6 held.** The event log, `src/plugins/eventLog/`, on public API only — no private
  reach was needed, so the log found no gaps the way the minimap found three. That is a
  result about the *event buses*, not about `addDockTab`.
- **D-7 held.** Off by default, opt-in via `plugins: [eventLog()]`. §11 keeps the tension.
- **D-8 held.** `Dock` is still not exported; `DockTab` / `DockTabHandle` are. A tab gets a
  handle, never the dock, so it cannot resize or fold the region it is sharing.


### Reversed: the nested model (Sami's call, 2026-08-24)

**Each docked element gets its own space; each element owns its own tabs.** The dock's
strip names *panes* — `Table`, `Events` — and `Nodes` / `Edges` went back to being the
table's own switch. This supersedes the D-2 verdict above and lands on exactly what
`bottom-dock.md` §8 sketched: `UI.table` resolves into **a** `DockTab`, singular.

Why the flat version was wrong, and why my argument for it did not hold:

- **It flattens a real hierarchy.** `Nodes` and `Edges` are two views of one pane;
  `Events` is a different pane. Listing all three as siblings asserts they are the same
  kind of thing.
- **It does not scale.** Three panes with two or three views each gives six-to-nine
  sibling tabs in one strip with no way to see which belong together. §6 flagged header
  *width* as the risk and missed that **grouping** is what actually breaks.
- **I over-read D-6.** I justified the flat model by saying nesting "reproduces the visible
  regression D-6 refused". D-6 refused *imposing a cost on the table before a second
  occupant existed to justify it*. It was never a verdict on nesting.
- **The baseline argument was also wrong.** I claimed only the flat model kept the
  screenshots still. Under the `< 2 tabs → no strip` rule the nested model draws **no**
  outer strip while the table is the only pane, so the header is byte-identical either way.
  430 tests pass, no baseline regenerated.

What the reversal cost, and what it did not:

- **The dock side was untouched.** Registry, `addDockTab`, the strip, the toolbar swap,
  `ensureDock`, `UI.dock`, the empty-registry handling — all as built.
- **The table side reverted**: `renderTabs` and `.pvt-table-tabs` are back, and it
  registers one tab, id `table`, label `Table`.
- **One API addition was needed**: `DockTabHandle.refresh()` (+ `UIManager.refreshDockTab`,
  + a `refresh` `DockTabChange`), mirroring `refreshPanel`. A pane with internal views has
  to be able to change body, and it cannot do it behind the dock's back — the dock keeps
  the element `render` returned, so a self-swapped DOM would leave it re-attaching a stale
  node on the next activation. A spec covers exactly that path (*an inner switch survives
  leaving the pane and returning*). Refreshing a **hidden** pane just drops the cached
  body, deferring the rebuild to its next activation.
- Four selectors in `table-export.spec` went back to `.pvt-table-tab`.

**The two levels are drawn differently**, which is the part that makes nesting legible
rather than confusing — two adjacent identical pill groups would have defeated the point:

| | Look | Owner |
|---|---|---|
| `Table │ Events` | full-height, square, underlined when active, closed off by a full-height rule | the dock |
| `Nodes │ Edges` | small rounded pill group, filled when active | the table |

The rule after the pane strip was added after looking at it in the running app: with only
the header's 8px gap between the groups the outer switch ran straight into the inner one.
It comes and goes with the strip, so a single-pane dock is unaffected. Two specs assert the
split numerically (border-bottom vs radius/fill, and full-header height vs not) rather than
leaving it to a screenshot.

### Changed from the draft while building

1. **`UI.dock` exists after all** (§7.3, answered by a failing test rather than an
   argument). The draft's conservative plan was `addDockTab`-only, no second config door.
   That is wrong, and the spec caught it within a minute: `dockOptions()` read `open` /
   `collapsed` / `height` out of `UI.table`, so with `table: false` **the region's settings
   were unreachable** — a plugin-only dock could not be asked to open. A log tab could get
   the region built and then had no way to unfold it short of `activateDockTab`. So
   `UI.dock` is now the region's own group, `UI.table`'s copies are still honoured, and
   `UI.dock` wins. This is §7.3's middle option, chosen because a real case demanded it.
2. **`DockTabChange`'s `remove` carries the tab, not just its id** — unlike
   `ExtraPanelChange`. By the time the dock hears about a removal the tab is already out of
   the registry, and the dock still owes a departing tab its `onDeactivate`. The
   alternative was a second map in the dock mirroring the registry.
3. **An empty registry hands the row back** (§7.5, answered as assumed). `pvt-dock-empty`,
   the same treatment as closed. The old gate said the region must not outlive its
   occupant; with a registry that becomes a *state* rather than a construction-time verdict.
4. **The region's label is `'dock'`, not `'table'`.** It reads "Resize the dock" /
   "Collapse the dock" now — the docs already called it that, and with three tabs in it
   naming the region after one of them was simply wrong. Nothing asserted the old strings.
5. **`contentHost()` and `toolbarSlot()` are gone.** They were the single-occupant
   interface and had exactly one caller; `DockTab.render` / `.toolbar` replace them. The
   dock still fills its own toolbar slot, but on the active tab's behalf.
6. **`toolbar` is re-invoked per activation** (§7.6, as proposed), and the picker's open
   state deliberately does *not* survive a switch — consistent with the fold, which already
   dismisses it. Listeners on those per-activation controls go on with plain
   `addEventListener` rather than `listen`: a tracked disposer would outlive the element it
   refers to, adding one entry per tab switch for the life of the table.

### Found on the way in

- **A redrawn strip must not own its listeners.** `renderStrip` runs on every registry
  change, and the table's old `renderTabs` pattern (`this.listen` per button, after
  `innerHTML = ''`) would leak a closure per redraw into the component's disposables. One
  delegated listener on the strip instead.
- **`display: contents` survived the swap** with no measurable change, which is what kept
  the baselines still. Worth restating why it matters: an emptied slot costs nothing, not
  even a flex gap, so a tab with no controls does not shift the header.
- **Detach, never hide.** An inactive tab's body is removed from the DOM rather than
  `display: none`-d, because `TableGrid` measures its scroller as `root.parentElement`.

### Verified against reverted fixes

Per this branch's practice, each new claim was checked against a deliberately broken build:

| Reverted | Fails |
|---|---|
| the catch-up `queueRebuild()` in `activateTab` | *a data change while the table is hidden shows up on return* |
| `ensureDock()` | *brings the dock with it when the table is switched off*, *an empty registry gives the row back* |
| the `pvt-dock-empty` branch in `apply()` | *an empty registry gives the row back* |

## 11. Still open

1. **This was never grilled.** §3's decisions were taken while building. D-2 has since
   been reviewed and reversed (above); `UI.dock` and `DockTabHandle.refresh()` are the
   remaining public-shape additions and have not had a second opinion.
2. **D-7's tension is resolved by the gallery** (§7.2's cheap answer, now written). The
   API's proof is still behind an opt-in, so no default configuration shows a pane strip —
   but the `dock-panes` card (F/8, *Add a dock pane*) exercises it in the docs, with a
   plugin contributing a `Summary` pane that has two views of its own, so the card teaches
   the nested model rather than just the call. Writing it **found a bug**: `refresh()`
   rebuilt the body but not the `toolbar`, so a pane whose controls *are* its view switch
   came back marking the view you had just left. `refresh` now rebuilds both — the same
   thing `refreshPanel` does for a panel's title — and `PluginContext` grew
   `refreshDockTab` for parity with `refreshPanel`. Regression spec: *refresh rebuilds the
   controls, not just the body*, checked against a reverted fix.
3. **Both switch levels are now themeable, and the accent bug is fixed.** Writing the
   gallery card left a pane's inner switch with no class to reach for, so the card
   restated the table's pill look inline. `.pvt-dock-views` / `.pvt-dock-view` are now
   public (documented on `DockTab.toolbar`, in `ui-table.md` and in `plugins.md`), the
   table renders through them, and the card uses them instead of inline style. Doing it
   surfaced a real bug: **`--pvt-primary-color` was never defined anywhere in the
   library**, so the active tab's underline, the divider's drag accent and the selected
   row all fell through to a hard-coded `#007acc`, ignoring the theme. The two chrome
   accents now use `--pvt-theme-primary` like the rest of the B3 chrome, and the selected
   row uses `--pvt-selection-color` — the same colour the canvas marks a selected node
   with, which is what its own comment always claimed. `dock-panes/pic.png` regenerated
   for the new accent; no baseline moved.

   That finding was then swept for across the whole library, since a `var()` fallback
   hides the typo that made it necessary. Eight more references pointed at names that were
   never declared: `--pvt-label-font` (`defaults.ts` ×4, so node and edge labels ignored
   `--pvt-font-family`), `--pvt-color-info` / `--pvt-color-success`, `--pvt-modal-text`
   (the declared name is `pvt-modal-text-color`), `--pvt-danger` (`pvt-theme-danger`),
   `--pvt-text-color` ×2 (only `-0`…`-6` exist) and `--pvt-sidebar-collapse-border-color`
   (never declared, so that control had **no border at all** — now declared as
   `--pvt-border-color`). All fixed; the info/success pair went with the event log.

   **Worth knowing for next time:** none of this failed a single test, and two baselines
   were silently stale afterwards. `playwright.config.ts` sets `threshold: 0.2` — per-pixel
   colour sensitivity — so a uniform shift like `#000` → `#333` counts every pixel as
   *unchanged* no matter how many of them move, and `maxDiffPixelRatio` never comes into
   play. Colour-only regressions are invisible to this suite. `inspect-modal-linux.png`
   and `drag-invalid-target-linux.png` were regenerated by hand after measuring the
   computed colours to find out which shots were actually affected. (`--update-snapshots`
   will not do it — it only rewrites shots that *fail* — and `=all` rewrites every file on
   encoding noise, which is not a usable signal.)
4. **The event log is gone — it was a demo, and the repo is not where demos live**
   (Sami's call, 2026-08-24). `src/plugins/eventLog/` is deleted, along with its exports,
   its `Graph.eventLog` global, the demo wiring in `main.ts` and its docs section. This
   undoes D-6/D-7 as *shipped code* while leaving their reasoning on the record: the log
   proved `addDockTab` was enough to build a pane with, and having proved it, it was a
   development instrument sitting in a consumer-facing library.

   The API coverage it carried did **not** go with it. Two claims were only ever tested
   through the log, and both moved into the harness as a test-only fake pane
   (`loadWithPluginPane`): that a tab registered from a **plugin's** `install` still
   brings the dock with it when the table is off — the D-4 claim, and the reason
   `ensureDock()` is load-bearing rather than defensive, which `addTestDockTab` cannot
   reach because it calls `UIManager` directly — and the D-3 contrast, a pane that keeps
   working while hidden and paints its backlog on return, the opposite direction from the
   table. What went for good is the log's own UI (Pause, Clear, the kind filter, the
   outside-`full`-mode warning); that was testing the demo, not the dock.
5. **The header's width is untested past three tabs.** Nothing in the CSS wraps or
   scrolls, and at 1024px the bar already carries a chevron, three tabs, a count and four
   controls. Measure before a fourth pane exists, not after.
6. **Folding still does not stop an occupant working.** The `active` gate covers hidden
   tabs; a *folded* dock keeps rebuilding the visible one, as it always has. The same
   signal would cover it, and §2.4 flagged it as out of scope.
7. **`docs/ui-table.md` now documents a region under the table's page.** With a second
   occupant shipped, the dock probably deserves `docs/ui-dock.md` of its own; the content
   is written, only misfiled.

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
