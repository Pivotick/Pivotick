# Phase B prototype — the pivot/enrichment pipeline

Run it with `npm run dev` and open **`/prototype/`**.

This is Phase B of [`../prd/pivot-enrichment-ui-prototype-brief.md`](../prd/pivot-enrichment-ui-prototype-brief.md),
built against the **real library** rather than a mock canvas. The graph, mode rail, tool panel,
dock, table and notification slot are Pivotick's own; what is new is the pivot plugin and a fake
provider. So the page answers a question a mockup could not: *do the real extension points
support D26?* They do — `addRailMode` + `addDockTab` + `getGraphInteraction` were enough, with
one CSS override.

## What is here

| Path | What it is |
|---|---|
| `pivot/types.ts` | the provider contract, mirroring PRD §7 |
| `pivot/manager.ts` | the runtime M1 describes: registry, summarize cache, the gate, staging, ingest, provenance, run-scoped undo/redo |
| `pivot/panel.ts` | Pivot mode's panel — origin, pivots, the five narrowing controls |
| `pivot/triage.ts` | the triage dock tab: header line, row lifecycle, edge-only section, empty/error/ceiling states |
| `pivot/toast.ts` | the actionable notification the library does not have |
| `pivot/plugin.ts` | wires all of the above onto the real extension points |
| `providers.ts` | the fake provider and the call log |

## The six flows from the brief

All six walk. The **provider call log** at the bottom of the page is how the rules are
demonstrated rather than asserted — select nodes with Pivot mode closed and it stays empty.

1. **AIL narrowing** — select `paste-2f9c`, enter Pivot mode (**P**), see `~2,143` refused
   against a cap of 2,000, tick *URLs*, watch it become `~210`, fetch, triage, ingest 12. They
   land around the origin, and the toast offers **Undo** → **Redo**.
2. **MISP auto-ingest** — select `event 5f2a`, run *Objects & attributes*: no pane, the
   container lands with its 12 children, toast with Undo.
3. **Bulk** — lasso or shift-select several nodes; one aggregated summarize, one request.
4. **Origin-less** — clear the origin, type a query into *Search AIL*, run: 30 results land at
   the viewport centre.
5. **Rejection memory** — reject five, hit **Re-run**: the header reads
   `210 fetched · 5 rejected earlier`, and clicking that segment reveals them.
6. **Failure modes** — tick *Fail the next call* for the retry state, or run
   *Everything, everywhere* for the 14,203-over-10,000 ceiling refusal.

The narrowing arithmetic is real: 1,800 + 210 + 95 + 38 = 2,143, and *URLs* alone is 210, so
the gate lifts because the numbers say so rather than because the demo says so.

## What building it against the real library found

Beyond the gaps Phase A already flagged (the toast, `DockTabHandle.setLabel`, the 216px panel,
two missing dark tokens):

- **A registered rail mode's button shows its *armed tool*, not the mode.** `ModeRail.paintFace`
  uses `tool?.label ?? mode.label`, so declaring `defaultTool: 'pick-origin'` made the rail read
  **Pick origin** instead of **Pivot**. Pivot mode must declare no default tool — picking an
  origin is the mode's resting behaviour, exactly as pointing is Select's.
- **A rail mode's `render()` slot is only re-invoked when the panel rebuilds**, which a mode
  change causes and a `summarize` settling does not. The plugin therefore owns a persistent
  host element and re-renders into it. Worth knowing before M3 tries to drive the panel from
  the store.
- **`addNode` / `addEdge` each emit their own `dataBatchChanged`.** Ingesting 12 nodes and 12
  edges fires 24 events. The PRD already asks for "clean `dataBatchChanged` emission" — this is
  the concrete reason.
- **Badge text is capped at three characters.** `2.1k` silently renders as `99+`, so a declared
  potential of 2,100 has to be abbreviated to `2k` by the consumer.
- **`RawNode.expanded` is required**, so every candidate carries `expanded: false` boilerplate.
  M1's plan to make it optional is worth keeping.
- **Marking a triage row must not re-render the pane.** Rebuilding on every checkbox loses
  scroll position mid-triage; the row and footer update in place instead.
- **A pivot with a staged set still needs a run affordance.** Without one, C7's "a re-run
  replaces this pivot's candidate set" is unreachable — hence the **Re-run** button.

## Notes

- `prototype/` is outside `tsconfig.json`'s `include`, so it cannot break `npm run build`.
  Type-check it on its own with `npx tsc --noEmit -p prototype/tsconfig.json`.
- Both themes work; the prototype follows the library's own theming pattern
  (`.pivotick[data-theme='dark']` plus a `prefers-color-scheme` fallback for the unstamped
  case). Getting that wrong paints dark chrome on a light page.
