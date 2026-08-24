# Feature — hoist the bottom dock out of the table

**Status:** Implemented — 2026-08-21, branch `worktree-table-mode-prd`. Not merged. Scope cut on 2026-08-21 from "generic panel host" to **internal hoist only** — see §2.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-21
**Area:** `src/ui/elements/Dock/` (new, hoisted out of `src/ui/elements/Table/Table.ts`), `src/ui/UIManager.ts` (`UI_ELEMENTS` row + `dock` accessor), `src/ui/elements/Layout.ts` + `src/styles/_layout.scss` + `src/ui/elements/Sidebar/sidebar.scss` (the row was already there; only its names moved), `src/Graph.ts` (`openTable`/`closeTable`/`toggleTable` now reach the dock)
**Type:** UI architecture — separate one feature's container from the feature
**Related:** [`table-mode.md`](table-mode.md) (built the dock as part of the table; this splits them, and its §5.6/§5.9 seams stay intact); `misp/runtime-sidebar-panels.md` (**the pattern this leaves room for** — `UI.extraPanels` + `graph.UIManager.addPanel()` returning a disposer); [`minimap-plugin.md`](minimap-plugin.md) (proof that a UI surface can ship as a plugin on public API — a log or console tab should eventually be able to do the same); [`graph-app-b3-control-layout.md`](graph-app-b3-control-layout.md) (its rejected family **A · "Command Dock"** put tools in a bottom dock; this is not that — no tools move here)

---

## Implementation (2026-08-21)

`tsc`, `eslint` and `npm run build` clean; **404 visual tests green with no baseline
regenerated** — nothing about the rendered dock moved, which was the whole bar to clear.
`Table.ts` went from 586 lines to 354; `Dock.ts` is 369, nearly all of it moved rather
than written.

### The split, as built

```
.pvt-dock-slot            ← Layout, grid-area: dock (was .pvt-table-dock)
└ .pvt-dock               ← Dock: the row, --pvt-dock-height, open/collapsed/userChose
  ├ .pvt-dock-divider     ← Dock: drag-to-resize
  ├ .pvt-dock-header
  │ ├ .pvt-dock-toggle    ← Dock: the chevron
  │ └ .pvt-dock-toolbar   ← Dock renders it, `display: contents`; the table fills it with
  │                         the Nodes/Edges strip, the summary, Select all, CSV/JSON, Columns
  └ .pvt-dock-body        ← Dock: the content host and scroll container; the table's grid
```

`UIManager` registers the two as separate `UI_ELEMENTS` rows — `dock` first, `table`
mounting into `ui.dock?.contentHost()` — rather than having the dock build its occupant.
That is what keeps the region ignorant of what is in it, and it is the line the future
`addDockTab()` would replace.

### Verdict on the decisions

- **D-1 held.** One height, one collapse state, on the dock. A new spec proves it: the
  region keeps its height and its fold through a data change *and* a column change.
- **D-2 held (as reversed).** Nodes / Edges are untouched, and so is every pixel.
- **D-3 held**, via `display: contents` on the toolbar slot — the occupant's controls lay
  out as if they were the header's own children, so an empty slot costs nothing, not even
  a flex gap. Without it the hoist would have needed a wrapper box and a new baseline.
- **D-4, D-5, D-6 held.** No `DockTab`, no second occupant, no public registration API;
  `Dock` is not exported from `index.ts`.

### Departures worth knowing

1. **The region's names moved with it.** `.pvt-table` → `.pvt-dock` (and `-divider`,
   `-header`, `-toggle`, `-body`, `-collapsed`, `-open`), `.pvt-table-dock` →
   `.pvt-dock-slot`, `--pvt-table-height` → `--pvt-dock-height`, `Layout.table` →
   `Layout.dock`. §3 draws the region as `.pvt-dock`, and leaving a log pane to live
   inside `pvt-table-*` scaffolding would have undone the point. Nothing outside `src/`
   and two spec files names them: no doc, no gallery card, no theming API — the custom
   property is only ever *written* by the dock, so no override could have depended on it.
   The table's own classes (`.pvt-table-row`, `-grid`, `-tab`, `-summary`, …) are
   untouched, which is why only `table-dock` and one line of `table-virtualization`
   needed re-pointing. The `table-*` filenames stay as they are.
2. **`UI.table` is read in two halves.** `dockOptions()` in `UIManager` picks `open`,
   `collapsed` and `height` out of it for the region and adds `label: 'table'`, so the
   dock's own controls still read "Resize the table" without the dock knowing what a
   table is. The occupant gets the rest, unchanged. `UI.table`'s shape did not move.
3. **`graph.UIManager.table` no longer carries the region's methods.** `setOpen`,
   `toggleOpen`, `isOpen` and `isCollapsed` are the dock's now, reachable at
   `graph.UIManager.dock`; `getBody()`/`getHeader()` are gone, replaced by the dock's
   `contentHost()`/`toolbarSlot()`. The documented path — `graph.openTable()`,
   `closeTable()`, `toggleTable()` — is unchanged and now delegates to the dock.
4. **One behaviour changed, deliberately.** Folding the dock now dismisses the column
   picker. The chevron always did (its click counted as an outside click); `Shift+T` and
   `collapsed: 'auto'` did not, and left a popover hanging over the canvas with no anchor.
   It is the one caller of `onCollapsedChange`, which is how that half of §4's interface
   ships load-bearing rather than speculative.

### Follow-ups

- `Shift+T` and the `MIN_CANVAS_HEIGHT` / `MIN_DOCK_HEIGHT` floors are the dock's now, and
  correctly so — but the *letter* T and the label both still come from the table. When a
  second occupant lands, the shortcut stays with the region and the label follows whatever
  tab is showing.
- The dock is still gated on `tableWanted(UI.table)`: no table, no region. That is D-6
  working as intended (the region must not outlive its occupant), and it is the predicate
  the next PRD widens.

---

## 1. What we're building

The bottom dock currently belongs to the table: `Table.ts` owns the grid row, the divider,
the collapse state, the height, the tab strip *and* the grid inside it. Split those. A
**`Dock`** owns the region and the table becomes its occupant.

Internal only. No new options, no public registration API, no visible change. The
deliverable is the seam — the day a log pane or a query console wants a home, the
expensive half of the work is already done and what's left is registering it.

## 2. Why — and why only this much

**The dock is already shaped like a host.** It has a tab strip (Nodes / Edges), a
persistent height, a collapse state and a divider. None of that is about tables. The only
reason it lives in `Table.ts` is that the table was the first thing to need a bottom
region.

**A second occupant has nowhere to go.** Today a log pane would either re-implement the
whole dock beside it — two grid rows, two dividers, two collapse states fighting over the
canvas height — or be bolted inside `Table.ts` behind a condition. `Sidebar` already went
through exactly this and came out with `extraPanels` + `addPanel()`; the same refactor is
waiting on the other axis.

**But the public half is one use case early**, which is why the original draft of this PRD
was cut down. A `DockTab` interface plus `addDockTab()` would ship with no caller: the
draft's own D-6 ruled out a core log tab in the same effort, so the API would be designed
against an imagined occupant rather than a real one. Public API is cheap to add and
expensive to have been wrong about. Worse, the tab-strip API forced a *visible* change on
the only occupant there is — demoting Nodes / Edges to a segmented control inside a table
tab — to make room for a tab that isn't coming yet. That trade is backwards. The API
sketch is preserved in §8 so the hoist can be shaped to fit it.

Not a reason: making room for tools. B3 considered and rejected a bottom "Command Dock"
(family A). Modes, tools and physics stay on the rail. This region is for **content you
read**, not controls you drive.

## 3. Shape

```
┌─ .pvt-dock ──────────────────────────────────────────────────┐
│ ▾ │ Nodes │ Edges │   [ ...occupant's toolbar... ]           │  ← dock draws, table fills
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    the table's grid                          │
└──────────────────────────────────────────────────────────────┘
```

Pixel-identical to what ships today. Only the ownership line moves.

**The dock owns**: the grid row and `--pvt-table-height`, the divider and drag-to-resize,
`open` / `collapsed` / `userChose`, the collapse chevron, and a toolbar slot it renders but
does not fill.

**The occupant owns**: its content, its own toolbar contents, its own strip (Nodes /
Edges), and its own view state — the table's sort, columns and row filters stay exactly
where they are.

## 4. Interface

Internal, between two classes in the same package. The table is constructed with the dock
and asks it for its content host and toolbar slot; the dock knows nothing about grids,
CSV or columns.

Roughly:

```ts
class Dock {
    /** The element an occupant renders into. */
    contentHost(): HTMLElement
    /** The header slot an occupant fills with its own controls. */
    toolbarSlot(): HTMLElement
    /** State the occupant reacts to but does not own. */
    isCollapsed(): boolean
    onCollapsedChange(fn: (collapsed: boolean) => void): () => void
}
```

No `GraphUI` change. `UI.table` keeps its exact current meaning and shape, including the
three-state `open`. `graph.UIManager.table` stays as the accessor, and `Shift+T` keeps
toggling what it toggles today.

## 5. What moves, concretely

| Today, in `Table.ts` | Goes to |
|---|---|
| grid row, `--pvt-table-height`, divider, resize drag | `Dock` |
| `open` / `collapsed` / `autoCollapse` / `userChose` | `Dock` |
| collapse chevron | `Dock` |
| tab strip (Nodes / Edges) | stays with the table (§6 D-2) |
| `Select all`, `CSV` / `JSON`, `Columns`, row summary | the table, rendered into the dock's toolbar slot |
| `TableGrid`, `TableColumns`, `TableRowFilters`, `TableExport` | unchanged |

The header row is the whole job. Everything in it except the chevron is the table's, and
it currently reads as the dock's.

## 6. Decisions

- **D-1 · One height and one collapse state, owned by the dock.** Even with one occupant:
  the height is a property of the region, and the canvas must not resize for reasons
  internal to whoever is inside. (VS Code does the same.)
- **D-2 · ~~Nodes / Edges demote to a segmented control.~~ Reversed.** They stay the strip
  they are today. They are two views of one dataset and they belong to the table; the
  incoherence the original decision avoided (`Table | Log | Nodes | Edges` in one strip)
  is a problem to solve when there is a second tab, not before. **No visible change.**
- **D-3 · The dock renders the toolbar slot; the occupant fills it.** The dock never knows
  what `CSV` means. An occupant with nothing to put there gets an empty slot, not a gap in
  the layout.
- **D-4 · The occupant's content is built once and kept.** Already true; stated so the
  future tab case inherits it rather than rediscovering it.
- **D-5 · `full` mode only, as today.** The other modes promise a canvas without this much
  chrome.
- **D-6 · No public registration API, and no second occupant, in this effort.** See §2.
  The next PRD adds `DockTab` + `addDockTab()` *together with* the occupant that proves
  it — most likely a log pane, and preferably as a plugin, the way the minimap shipped.

## 7. Compatibility

There is nothing to be compatible *with*: no option changes shape, so the gallery card and
the ~20 specs passing `table: { open: true }` are untouched by construction. If any of them
need editing, the hoist has overreached — that is the tell to watch for.

## 8. Out of scope

- **`DockTab` / `addDockTab()`.** Deferred to the effort that brings a real second
  occupant — **done 2026-08-24**, see [`dock-tabs.md`](dock-tabs.md). The sketch below
  survived almost intact; the one departure is that `UI.table` resolves into **one tab per
  `TableTab`** rather than the single `Table` tab written here, because the singular
  version reproduces exactly the two-strip regression this PRD's D-6 refused. `render` also
  receives a narrow handle rather than the `Dock` itself, which would have made `Dock`
  public API by accident. The shape as it was aimed at:

  ```ts
  interface DockTab {
      id: string
      label: string
      render: (dock: Dock) => HTMLElement
      toolbar?: () => HTMLElement
      order?: number
  }
  UI: { dock: { tabs: [myLogTab], open: true } }
  const dispose = graph.UIManager.addDockTab(myLogTab)
  ```

  `UI.table` would then resolve into a `DockTab` internally, so it becomes sugar rather
  than a second mechanism. Keep that resolution possible; don't build it.
- **A log or output pane.** The proof the API works, and the reason to write it. **Done**
  — `eventLog()`, on public API only, in `src/plugins/eventLog/`.
- **A console / CLI.** The command language is the real problem, and `GraphQueryEngine`
  filters are the obvious first surface — type an expression, watch the canvas filter.
  Worth doing, separately.
- **Anything on the rail.** See §2.
- **A right-hand or floating dock. Per-tab height, detach, or maximise.**

## 9. Risks

- **`Table.ts` is the dock.** This is a move, not an addition, so it touches everything the
  `table-*` specs assert. Expect the header-row assertions to churn; the grid ones should
  not move at all, and it is a bad sign if they do. With D-2 reversed there is no
  behavioural change to justify a *failing* assertion — only relocated ones.
- **The canvas is permanently shorter**, and this bit twice when the collapsed bar became
  the default (shipped ahead of this PRD, 2026-08-21):
  - The **sidebar's collapse toggle** hangs off its own bottom-right corner, and the
    sidebar spans the dock's row — so the toggle landed on the dock's chevron and the
    chevron swallowed its clicks. Fixed by measuring it from above the dock
    (`bottom: calc(var(--pvt-table-height, 0px) + 7px)`).
  - The **legend versus the mode rail** on a short viewport. Fixed since, and *not* by the
    dock's doing — measurement showed the overlap predates it, with the dock spending a
    ~6px margin that had already gone. The legend now caps its height against
    `--pvt-moderail-height` instead of moving corner. Full write-up in `table-mode.md`
    under *Follow-ups*; the short version is that **full mode has no free corner**, so
    "dock it elsewhere" is not an answer available to anything.

  The lesson for this PRD stands: **nothing in the bottom-left corner is safe to leave
  measured from the layout's bottom.** Anything docked there has to measure from the dock.

## 10. Test plan

The point of this effort is that the suite barely moves, so the plan is mostly about
proving that:

- The whole existing `table-*` suite passes with **no baseline regenerated**. A changed
  screenshot means the hoist changed the look, which it must not.
- `UI.table: { open: true }` / unset / `false` behave exactly as today — asserted
  directly rather than inferred from the other specs passing, since `open`'s three states
  are the part most likely to be dropped in the move.
- The dock's height and collapse state survive a table rebuild (data change, column
  change): the region's state is no longer the table's to lose.
- `Shift+T` and the chevron both still toggle, and the chevron still clears the sidebar's
  collapse toggle (`table-dock` already asserts this — it must keep passing unedited).
- One negative: with the table suppressed (`table: false`), no dock row is rendered at all
  and the canvas gets the full height. The region must not outlive its occupant.
