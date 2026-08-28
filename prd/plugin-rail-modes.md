# Feature — rail modes as a plugin extension point

**Status:** **draft** — written 2026-08-28, awaiting a grilling session. Nothing implemented.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-28
**Area:** `src/ui/ModeStore.ts`, `src/ui/elements/ModeRail/`, `src/ui/elements/ToolPanel/`, `src/ui/elements/Flyout/`, `src/ui/UIManager.ts`, `src/interfaces/Plugin.ts`, `src/interfaces/GraphUI.ts`, `src/index.ts` + `src/docIndex.ts`. Touches **public types** (`RailMode` / `PointerMode` / `FlyoutMode`).
**Type:** plugin API — turn a hardcoded list into a registry.
**Related:** `graph-app-b3-control-layout.md` (built the rail, and parked Explore/Enrich as "SOON" stubs — D10, §7), `table-mode` + the dock-tab hoist (the registry precedent this copies), `minimap` (the reference plugin, built entirely on public API).

---

## 1. Why

The mode rail was chosen *because* it scales: B3 won its design bake-off on the grounds
that "the rail holds top-level *modes*, each revealing only its own tools, so new
capabilities drop in as new modes without crowding the rail"
(`graph-app-b3-control-layout.md` §2). That promise is currently only true for us.
`ModeRail.onMount` builds four buttons from four literals, and Explore and Enrich exist
only as disabled SOON badges gated behind `UI.modeRail.explore` / `.enrich`.

An integrator who wants an Explore mode (expand neighbours, walk paths, pivot) or an
Enrich mode (call an enrichment API, attach the result) has no way in. They can already
add a sidebar panel, a dock tab, a canvas element, a keybinding and a whole UI component
— everything *except* the surface the redesign made the primary one.

So the SOON badges are the wrong answer twice over: they promise work we have not
scheduled (flagged as ageing badly in `graph-app-b3-control-layout.md` §9.6), and they
occupy the slot the integrator should be filling themselves. Making the rail a registry
lets the people who know what "enrich" means for *their* data ship it, and lets us delete
a promise we are not keeping.

The refactor is small because the groundwork is already done — see §4.

## 2. What ships

1. **`ctx.addRailMode(mode)`** on `PluginContext`, returning a disposer — the same door
   shape as `addPanel` and `addDockTab`.
2. **`UIManager.addRailMode` / `removeRailMode` / `getRailModes`** underneath it, plus
   `onRailModesChanged` for the rail to subscribe to. Registration works in any mode; the
   button is only *drawn* where the rail exists (`full`, `light`).
3. **A registry-driven `ModeRail`** — buttons, order, zones, divider, keyboard shortcuts
   and the active highlight all come from the registry, and it rebuilds when the registry
   changes.
4. **A registry-driven `ToolPanel`** — the tool list, panel title, icon and shortcut badge
   come from the active mode's definition instead of `specsFor()`.
5. **A `ModeStore` keyed by string**, with per-mode defaults seeded at registration.
6. **The four built-ins re-expressed as registry entries** (see Q2) — the honest test that
   the door is wide enough, exactly as the data table is "just" a dock tab.
7. **Public types**: `RailModeDefinition`, `RailTool` (today's private `ToolSpec`),
   `RailModeHandle`, exported from `index.ts` and `docIndex.ts`.
8. **Docs**: a plugins-page section, and a gallery card with a working custom mode.

## 3. The shape of the door

Sketch, not a ruling — the fields are what §7 is for.

```js
const explore = {
    name: 'explore-mode',
    install(ctx) {
        ctx.addRailMode({
            id: 'explore',
            label: 'Explore',
            icon: compassSvg,
            kind: 'pointer',        // or 'flyout'
            shortcut: 'E',
            zone: 'data',           // rail grouping; a divider separates zones
            order: 10,
            tools: () => [
                { id: 'expand', label: 'Expand neighbours', icon: plusSvg, kind: 'action',
                  run: () => expandSelected(ctx.graph),
                  enabled: () => !!ctx.graph.renderer.getGraphInteraction().getSelectedNode() },
                { id: 'walk', label: 'Path walk', icon: pathSvg, kind: 'toggle',
                  run: (armed) => armPathWalk(ctx.graph, armed) },
            ],
            onEnter: () => {},
            onExit: () => {},       // disarm whatever the mode armed
        })
    },
}

new Pivotick(el, data, { plugins: [explore] })
```

A **flyout** mode declares `kind: 'flyout'` and mounts its own panel into
`ctx.layout.flyout`; the store already opens exactly the panel whose mode is active, so
mutual exclusion is free. See Q6 for whether the definition should carry a `render`
instead.

## 4. Why this is cheap — what already holds

Established by reading the code on 2026-08-28. These are the load-bearing facts; if one
turns out to be wrong the estimate moves.

- **`ModeStore` is purely presentational.** It holds `mode` / `armedTool` / `panelOpen`
  and notifies. It has no coupling to the interaction layer. The real work is done by
  `ToolPanel` calling public graph API directly — `renderer.toggleLassoMode`,
  `editing.connectManager`, `noteManager.addNote`. A plugin mode's tools can therefore do
  anything a plugin can already do, with no new privilege.
- **Nothing outside the rail cluster reads mode state.** `grep` for
  `PointerMode|RailMode|FlyoutMode|modeStore|getArmedTool` outside `ModeStore.ts` hits
  only `ModeRail`, `ToolPanel`, `Flyout`, `ViewFlyout`, `PhysicsFlyout` and `docIndex.ts`.
  Nothing in `GraphInteractions`, the renderers or `Graph`. (The one other `getMode()` in
  the tree is `GraphConnectManager`'s, unrelated.)
- **The SCSS is class-driven, not name-driven.** `moderail.scss` styles
  `.pvt-moderail-button` / `-soon` / `-divider` / `.active`; the only per-mode rule in the
  whole cluster is `.pvt-flyout-view .pvt-flyout-card`. A plugin mode inherits the native
  look with no styling work.
- **The rail already self-sizes.** `ModeRail.publishHeight()` (`ModeRail.ts:89`) observes
  its own box with a `ResizeObserver` and publishes `--pvt-moderail-height`, which the
  legend sizes against. Adding or removing modes keeps that correct for free.
- **`Flyout` is already the right contract** — an abstract base where a subclass declares
  its mode, a `template()` and a `wire()`, with `open` bound to the store. It is simply
  not exported.
- **The precedent exists twice.** `addPanel` and `addDockTab` are registry + disposer +
  subscriber, and `addDockTab` additionally solves the *late arrival* problem
  (`ensureDock`, `UIManager.ts:833`). This is the same problem: plugins install at
  `Graph.ts:140`, after `new UIManager` has already run `build()` and mounted the rail.
  **So the rail must subscribe and rebuild — that is a requirement, not a nicety.**

## 5. What has to move

| File | Hardcoded today | Becomes |
|---|---|---|
| `ModeStore.ts:6-24` | `PointerMode` / `FlyoutMode` string-literal unions; `isPointerMode` is `mode === 'select' \|\| mode === 'create'` | `RailMode = string`; `isPointerMode` a registry lookup |
| `ModeStore.ts:46,53` | `DEFAULT_ARMED` / `DEFAULT_PANEL_OPEN` as `Record<PointerMode, …>` | maps seeded per mode at registration |
| `ModeStore.ts:73` | `lastPointerMode` | unchanged, but needs an answer for "the last pointer-mode was just unregistered" (Q8) |
| `ModeRail.ts:28-55` | four `makeButton` calls in a fixed order, then a DATA zone gated on `UI.modeRail.explore/enrich` | iterate the registry by `zone` then `order`; draw a divider between zones |
| `ModeRail.ts:57-66` | click wiring per literal key; `V` / `C` registered inline | wiring per registry entry; `shortcut` from the definition |
| `ModeRail.ts:138` | `railFace()` — the select→Lasso, create→Edge icon morph | derive from the armed tool's own `icon` + `label`, which deletes the special case rather than generalising it |
| `ToolPanel.ts:144` | `specsFor()` — the two tool lists | the active mode's `tools` |
| `ToolPanel.ts:28,170,241` | `MODE_SHORTCUT`, the panel title + icon, `defaultTool()` | per-mode fields |
| `ToolPanel.ts:120-127` | disarm-on-leave hardcodes lasso + connect-manager cleanup | a per-mode `onExit()` hook |
| `UIManager.ts:246-262` | `modeRail` / `toolPanel` / `viewFlyout` / `physicsFlyout` as fixed `UI_ELEMENTS` entries | rail + tool panel stay; the two flyouts become registry entries (Q2) |
| `interfaces/Plugin.ts` | no rail door | `addRailMode` / `removeRailMode` |

`ToolSpec` (`ToolPanel.ts:17`) is already a decent public shape —
`{ id, label, icon, kind, run, enabled }` — and can be promoted to
`interfaces/GraphUI.ts` close to as-is.

**The one genuinely fiddly bit** is `ToolPanel.onState`'s disarm-on-leave. Its lasso
cleanup carries hard-won ordering (the macrotask deferral at `ToolPanel.ts:299`, so the
trailing canvas click is swallowed by the still-armed guard before the lasso reverts).
Turning that into a documented `onExit` contract is the part most likely to regress, and
the part worth writing a test around first.

## 6. Not in scope

- **Changing what a plain drag does.** Today Select and Create differ *only* in what the
  tool panel arms; there is no mechanism in `GraphInteractions` for a pointer-mode to
  claim the canvas gesture. An Explore mode that wants drag-to-expand needs that
  mechanism, and it is a second, larger piece of work. This PRD ships the rail door only.
  See Q1 — if the answer changes, the estimate doubles.
- **Shipping an Explore or Enrich mode ourselves.** The point is that integrators ship
  theirs. A gallery card demonstrating one is scope; a built-in is not.
- **Reworking the flyout chrome.** `Flyout`'s helpers (`toggleRow`, `sectionLabel`,
  `wireToggle`) are exported as-is or not at all.

## 7. Open decisions — the grilling list

Nothing below is decided.

| # | Question | Lean |
|---|---|---|
| Q1 | Can a plugin mode change what a plain drag does, or only what the tool panel offers? | Only the tool panel, for now — §6 |
| Q2 | Do the four built-ins move onto the registry, or stay hardcoded beside it? | Move them; it is the only real test of the door |
| Q3 | `RailMode` widens from a literal union to `string`. Acceptable break? | Yes — it is a read-only type for consumers |
| Q4 | Do the `UI.modeRail.explore` / `.enrich` SOON stubs survive? | Drop them; they are the thing this replaces |
| Q5 | Is `tools` a static array or a function called per render? | A function — `specsFor()` already re-derives, and Create hides tools when an editor is off |
| Q6 | Does a flyout mode carry a `render` in its definition, or mount its own `UIComponent`? | Mount its own; export the `Flyout` base |
| Q7 | Do we export `icons.ts`? A plugin author must otherwise supply raw SVG strings. | Export a curated set, not the lot |
| Q8 | A mode is unregistered while it is the active mode — what happens? | Fall back to the first registered pointer-mode |
| Q9 | Can a plugin remove or reorder a *built-in* mode? | Reorder yes, remove no |
| Q10 | A plugin claims a shortcut a built-in already owns (`V`). Who wins, and does anyone hear about it? | First registration wins, warn on the second |
| Q11 | Is `zone` a real concept, or just `order` plus an explicit divider flag? | Real, but a free string, not an enum |
| Q12 | Does the store keep `armedTool` / `panelOpen` for flyout modes too, or only pointer-modes? | Only pointer-modes; keep the asymmetry that exists |
| Q13 | Is `kind: 'soon'` part of the public tool API? | Yes — an integrator has the same roadmap problem we do |
| Q14 | What does the rail draw if every mode is unregistered? | Nothing, and no empty chrome box |
| Q15 | Registration in `viewer` mode is accepted but never drawn. Silent, or a warning? | Silent — matches `addDockTab` |

## 8. Work plan

- **M1 — the registry.** `ModeStore` keyed by string; `UIManager` registry + subscribers;
  `ModeRail` and `ToolPanel` driven from it; the four built-ins converted. No public API
  yet. Ends green on the existing visual suite, with the rail pixel-identical.
- **M2 — the door.** `addRailMode` on `PluginContext` and `UIManager`; public types
  exported; `Flyout` exported if Q6 says so; the SOON stubs removed if Q4 says so.
- **M3 — proof + docs.** A gallery card with a real custom mode, a plugins-page section, a
  changelog entry, and visual coverage for a plugin-registered mode.

Roughly one session for M1, half for M2, half for M3 — the same shape and size as the
dock-tabs work.

## 9. Tests and docs

- `tests/visual/specs/mode-rail.spec.ts` uses
  `UI: { modeRail: { explore: true, enrich: true } }` for its `B3` fixture, and
  `harness.ts:255` sets `modeRail: { enrich: true }`. Both need updating if Q4 drops the
  flags — and the harness is the natural place to register a fake plugin mode instead, so
  the suite covers the new door rather than the old stubs.
- The rail is a small target and the suite is colour-blind at threshold 0.2, so a registry
  regression that moves a button by a few pixels will not fail on its own. Assert the
  rail's button ids and order in the DOM, not only by screenshot.
- `docs/ui.md:70` describes the rail and carries the 1.5→1.6 migration warning; it needs
  the new extension point. `docs/plugins.md` gains the section.
