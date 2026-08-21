# Feature — the bottom dock as a generic panel host

**Status:** Draft — 2026-08-21. Not started.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-21
**Area:** `src/ui/elements/Dock/` (new, hoisted out of `src/ui/elements/Table/Table.ts`), `src/ui/UIManager.ts` (`UI_ELEMENTS` row + `addDockTab`), `src/interfaces/GraphUI.ts` (`DockOptions`, `DockTab`), `src/ui/elements/Layout.ts` + `src/styles/_layout.scss` (unchanged — the row already exists), `docs/ui-dock.md` (new)
**Type:** UI architecture — turn one feature's container into a shared region
**Related:** [`table-mode.md`](table-mode.md) (built the dock as part of the table; this splits them, and its §5.6/§5.9 seams stay intact); `misp/runtime-sidebar-panels.md` (**the pattern to mirror** — `UI.extraPanels` + `graph.UIManager.addPanel()` returning a disposer); [`minimap-plugin.md`](minimap-plugin.md) (proof that a UI surface can ship as a plugin on public API — a log or console tab should be able to do the same); [`graph-app-b3-control-layout.md`](graph-app-b3-control-layout.md) (its rejected family **A · "Command Dock"** put tools in a bottom dock; this is not that — no tools move here)

---

## 1. What we're building

The bottom dock currently belongs to the table: `Table.ts` owns the grid row, the divider,
the collapse state, the height, the tab strip *and* the grid inside it. Split those. A
**`Dock`** owns the region; the table becomes **one tab in it**, registered the same way
sidebar panels already register.

That makes a log, an output pane, or a query console a *contributor* rather than a rewrite
— and, like the minimap, something that can ship as a plugin instead of as core.

## 2. Why

Two arguments, and the second is the load-bearing one.

**The dock is already shaped like a host.** It has a tab strip (Nodes / Edges), a
persistent height, a collapse state and a divider. None of that is about tables. The only
reason it lives in `Table.ts` is that the table was the first thing to need a bottom region.

**A second occupant has nowhere to go.** Today a log pane would either re-implement the
whole dock beside it — two grid rows, two dividers, two collapse states fighting over the
canvas height — or be bolted inside `Table.ts` behind a condition. Both are worse than
having a host. `Sidebar` already went through exactly this and came out with
`extraPanels` + `addPanel()`; this is the same refactor on the other axis.

Not a reason: making room for tools. B3 considered and rejected a bottom "Command Dock"
(family A). Modes, tools and physics stay on the rail. This region is for **content you
read**, not controls you drive.

## 3. Shape

```
┌─ .pvt-dock ──────────────────────────────────────────────────┐
│ ▾ │ Table │ Log │        ← dock: chevron + tab strip         │
│                          [ ...active tab's toolbar... ]      │  ← contributed
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                 active tab's content                         │
└──────────────────────────────────────────────────────────────┘
```

**The dock owns**: the grid row and `--pvt-table-height`, the divider and drag-to-resize,
`open` / `collapsed` / `userChose`, the tab strip, and a toolbar slot it renders but does
not fill.

**A tab owns**: its content, its own toolbar contents, and its own view state (the table's
sort, columns and row filters stay exactly where they are).

## 4. API

Mirrors `ExtraPanel` deliberately — same declare-or-register split, same disposer.

```ts
export interface DockTab {
    /** Stable id, for addressing in `removeDockTab` / `selectDockTab`. */
    id: string,
    /** Tab strip label. */
    label: string,
    /** Built once when the tab is first shown. */
    render: (dock: Dock) => HTMLElement,
    /** Controls for the dock header's toolbar slot, shown only while this tab is active. */
    toolbar?: () => HTMLElement,
    /** Tab order, ascending; ties keep registration order. @default 0 */
    order?: number,
}

// Declared
UI: { dock: { tabs: [myLogTab], open: true } }
// Or at any point in the graph's life
const dispose = graph.UIManager.addDockTab(myLogTab)
```

`UI.table` keeps working and is resolved into a `DockTab` internally — see §7.

## 5. What moves, concretely

| Today, in `Table.ts` | Goes to |
|---|---|
| grid row, `--pvt-table-height`, divider, resize drag | `Dock` |
| `open` / `collapsed` / `autoCollapse` / `userChose` | `Dock` |
| tab strip (Nodes / Edges) | `Dock`'s strip — but see D-2 |
| collapse chevron | `Dock` |
| `Select all`, `CSV` / `JSON`, `Columns`, row summary | the table tab's `toolbar()` |
| `TableGrid`, `TableColumns`, `TableRowFilters`, `TableExport` | unchanged |

The header row is the whole job. Everything in it except the chevron and the strip is the
table's, and it currently reads as the dock's.

## 6. Decisions

- **D-1 · One height and one collapse state for the dock, not per tab.** Switching tabs
  must not resize the canvas. (VS Code does the same; a per-tab height reads as a bug.)
- **D-2 · Nodes / Edges demote to a segmented control inside the table tab.** They are two
  views of one dataset, not two panels — `Table | Log | Nodes | Edges` in one strip is
  incoherent. This is a visible change to what `table-mode` shipped.
- **D-3 · The dock renders the toolbar slot; tabs fill it.** The dock never knows what
  `CSV` means. A tab with no `toolbar()` gets an empty slot, not a gap in the layout.
- **D-4 · A tab's content is built once, lazily, on first activation, and kept.** A log
  must not lose its scrollback because you looked at the table. The table's own rebuild
  triggers (§5.7 of `table-mode`) stay the table's business.
- **D-5 · `full` mode only, as today.** The other modes promise a canvas without this much
  chrome.
- **D-6 · No core log or console tab in this effort.** Ship the host and move the table
  onto it. A log tab is the *proof* the API works and can land right after; a console needs
  a command language and is its own PRD (§8).

## 7. Compatibility

`UI.table` must keep working — the gallery card and ~20 specs pass `table: { open: true }`.
Resolve it internally into a `DockTab` plus the dock's own `open` / `height` / `collapsed`,
so `UI.table` becomes sugar rather than a second mechanism. `UI.dock.tabs` and `UI.table`
are additive; `table: false` removes the table tab, and a dock with no tabs does not render.

`graph.UIManager.table` stays as an accessor. `Shift+T` toggles the dock, not the table.

## 8. Out of scope

- **A console / CLI.** The command language is the real problem, and `GraphQueryEngine`
  filters are the obvious first surface — type an expression, watch the canvas filter.
  Worth doing, separately.
- **Anything on the rail.** See §2.
- **A right-hand or floating dock.** One region, at the bottom.
- **Per-tab height, detach, or maximise.**

## 9. Risks

- **The canvas gets permanently shorter.** Once the dock defaults to its collapsed bar
  (shipped ahead of this PRD, 2026-08-21) the bottom-left chrome and the left rail converge
  sooner. `table-mode`'s outcome already records that the legend concedes the rail on a
  short viewport, and the gallery card docks its legend `top-left` for that reason.
  **Re-check the legend and minimap `collapsed: 'auto'` thresholds against the shorter
  default**, rather than assuming the 34px is free.
- **`Table.ts` is the dock.** This is a move, not an addition, so it touches everything the
  `table-*` specs assert. Expect the header-row assertions to churn; the grid ones should
  not move at all, and it is a bad sign if they do.

## 10. Test plan

- Two tabs register, the strip shows both in `order`, and switching does **not** change the
  dock height (D-1).
- Nodes / Edges live inside the table tab, and each keeps its own sort (the existing
  `table-export` assertion, relocated).
- A tab's content survives switching away and back — build it once, assert identity or a
  mutation that would be lost (D-4).
- `addDockTab()`'s disposer removes the tab and its strip entry; the last one leaving
  renders no dock.
- `UI.table: { open: true }` still opens an expanded table — the compatibility path (§7),
  asserted directly rather than inferred from the other specs passing.
