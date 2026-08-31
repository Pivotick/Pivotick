# Feature — rail modes as a plugin extension point

**Status:** **done** — grilled 2026-08-28, implemented 2026-08-31 on `worktree-plugin-rail-modes` (M1 `9b162c4`, M2 `de6aa0e`, M3 `ebe30e2`, gallery card `70df168`). Unmerged. One decision moved during the build: **D4's fallback was taken** — TypeDoc renders `(string & {})` as `string & object`, so `RailMode` is a plain `string`.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-28
**Area:** `src/ui/ModeStore.ts`, `src/ui/elements/ModeRail/`, `src/ui/elements/ToolPanel/`, `src/ui/elements/Flyout/`, `src/ui/UIManager.ts`, `src/interfaces/Plugin.ts`, `src/interfaces/GraphUI.ts`, `src/index.ts` + `src/docIndex.ts`. Touches **public types** (`RailMode` / `PointerMode` / `FlyoutMode`) and **removes a public option** (`UI.modeRail`).
**Type:** plugin API — a registry beside the hardcoded rail, not a rewrite of it.
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
occupy the slot the integrator should be filling themselves. Making the rail extensible
lets the people who know what "enrich" means for *their* data ship it, and lets us delete
a promise we are not keeping.

## 2. What ships

1. **`addRailMode(mode)`** on both `PluginContext` and `UIManager`, returning a disposer —
   the same door shape as `addPanel` and `addDockTab`, plus `removeRailMode`,
   `getRailModes` and `onRailModesChanged` for the rail to subscribe to.
2. **A plugin zone on the rail** — the four built-in buttons, a divider, then the
   registered modes sorted by `order`. The rail rebuilds that zone when the registry
   changes, because plugins install after it has already mounted.
3. **A plugin path through `ToolPanel`** — for a registered pointer mode the panel renders
   from the definition (`tools`, then `render()`), with core owning the header, the
   shortcut badge, arming and collapse.
4. **Flyout-kind modes** — `Flyout` is exported so a plugin subclasses it, and the mode
   definition carries a factory that core mounts into the flyout slot and disposes with
   the mode.
5. **A string-keyed `ModeStore`** — `mode`, `armedTool` and `panelOpen` accept any
   registered id; each registered mode seeds its own defaults.
6. **`UI.modeRail`, `ModeRailOptions` and the SOON stubs deleted**, along with the
   `.pvt-moderail-soon` / `-badge` styling.
7. **Public types**: `RailModeDefinition`, `RailTool`, and the exported `Flyout`.
8. **Docs**: a plugins-page section, a gallery card with a working custom mode, and a demo
   Explore mode behind `?hero` replacing the deleted stubs.

## 3. Decisions taken

Resolved one by one in the 2026-08-28 grilling session. Binding.

| # | Decision | Ruling |
|---|---|---|
| D1 | What a mode may own | **Tools only.** Drag arbitration is out of scope. Note the PRD's first draft was wrong to say a mode *cannot* claim a drag: `LassoOverlay` does exactly that with its own namespaced handlers plus `context.cancel()` guards, and every hook it uses is public. What is missing is **arbitration** — nothing decides who owns `pointerdown` when two claimants exist. A plugin may still do it by hand, unsupported. |
| D2 | The built-ins | **Stay hardcoded.** The registry only appends. Rejected: re-expressing Select/Create/View/Physics as registry entries — it would prove the door is wide enough, but it churns the two most delicate files for no user-visible gain. Accepted cost: the built-ins keep privileges a plugin cannot have, and a gap in the door will not show up in our own use of it. |
| D3 | Panel authoring | A mode declares **`tools`, plus an optional `render()`**. Rows cover the common case; the hatch covers the Explore mode that wants a depth slider. Core keeps the header and the collapse either way. |
| D4 | Public type shape | `RailMode = PointerMode \| FlyoutMode \| (string & {})` — accepts any id while keeping IDE autocomplete for the four built-in names, which D2 makes permanent. Neither form catches a typo in a plugin id; that is impossible. **Fallback:** if TypeDoc renders the idiom badly in the generated reference, drop to plain `string` and document the four names in prose. → **Fallback taken (2026-08-31):** TypeDoc renders it `PointerMode \| FlyoutMode \| string & object`, and `string & object` reads as an impossible type. `RailMode` is a plain `string`, with the four names given in its docstring; `PointerMode` / `FlyoutMode` still name the built-ins. |
| D5 | Rail placement | **Built-ins, divider, then plugin modes by `order`.** The divider appears once one mode is registered — the same treatment the SOON zone had. No `zone` field: with a single plugin zone it collapses into `order`. Plugin modes cannot interleave with, reorder or remove built-ins. |
| D6 | The SOON stubs | **Delete the lot** — `UI.modeRail`, `ModeRailOptions`, the two buttons and their CSS. The option is undocumented (only `UIManager.modeRail`, the component accessor, appears in the docs) and has three consumers: two visual tests and `main.ts:545`. The `?hero` shot registers a **demo Explore mode** instead, which shows off the new door and keeps the `compass` glyph alive. |
| D7 | Flyout modes | **Both kinds ship.** `Flyout` is exported so a plugin subclasses it and inherits `toggleRow` / `sectionLabel` / `wireToggle` / `query`. Consequence: its `protected` members become public API and are covered by semver from here. |
| D8 | Flyout wiring | The definition carries a **factory** (`flyout: ui => new MyFlyout(ui)`); core mounts it into the flyout slot and tears it down with the mode. Rejected: letting the plugin mount it itself — the disposer would then remove the button and leave a dead overlay bound to a mode that no longer exists. `kind: 'flyout'` without a factory is refused. Core **warns** when the subclass's `mode` does not match the definition's `id`; that is the one mismatch a factory cannot prevent. In `viewer` there is no flyout slot, so the factory never runs. |
| D9 | Teardown | Unregistering the **active** mode calls its `onExit`, then falls back to **Select** — which D2 guarantees exists. `onExit` does **not** fire on UI teardown: the plugin's own tracked disposers cover that, and firing hooks mid-teardown is the re-entrancy trap `ui-lifecycle-emitphase-reentrancy` already cost us once. |
| D10 | Shortcuts | Register through `keyManager` and **inherit its shadowing**: last-in wins, warns (`"…is already bound; the new handler shadows it until disposed"`), and pops back on dispose. A plugin may shadow `V`, noisily and reversibly. Rejected: reserving the built-in keys — a special case that exists nowhere else in the library. |
| D11 | Panel default | A plugin mode's panel **opens** on first entry, like Create, so its tools are discoverable. `panelOpen: false` opts out. |
| D12 | Icons | **No export.** `icon` stays a raw SVG string; `icons.ts`'s 82 glyphs stay private rather than being frozen as API. Document instead that the string is **`innerHTML`'d and never sanitised** — unlike the note markdown path, which goes through DOMPurify — so it must be trusted, and that CSS sizes it to 20px on the rail and 18px in the panel. |
| D13 | Tool list | **`RailTool[] \| (() => RailTool[])`.** The array covers a static mode; the function covers one whose tools depend on the selection, and matches what `specsFor()` already does internally. |
| D14 | Tool kinds | Public `RailTool.kind` is **`'default' \| 'toggle' \| 'action'`**. No `'soon'`: we are deleting our own SOON stubs for going stale (D6), and publishing the badge would invite plugins to repeat it. The internal `ToolSpec` keeps `'soon'` for the built-in Path select, so the public type is a strict subset. |
| D15 | Rail slot morph | **Yes, derived from the armed tool.** A plugin mode's button swaps in the armed `RailTool`'s own icon and label, the way Select becomes Lasso. No per-mode hook and no config — the tool already carries both fields. |
| D16 | `tools` + `render()` | **They compose.** Core renders the tool rows, then appends `render()`'s element below them, so a mode gets rows *and* a slider without hand-building rows. |

**Consequences taken as read** (agreed, not separately grilled):

- `addRailMode` lands on **both** `UIManager` and `PluginContext`, like every other door.
- Registration in `viewer` / `static` is a **silent no-op**; a duplicate id **warns and
  skips**. Both match `addDockTab`.
- The rail is **never empty**, so there is no empty state to design.
- The initial mode stays `'select'`. An integrator who wants to boot into their own mode
  calls `modeStore.setMode('explore')` after install — the store is already public.
- Two drive-bys folded in: delete `GraphSvgRenderer.lassoModeActive` (assigned at
  `GraphSvgRenderer.ts:778`, read nowhere), and keep `compass` alive through the demo mode
  rather than deleting it with the stub.

## 4. The shape of the door

```js
import { Pivotick, Flyout } from 'pivotick'

const explore = {
    name: 'explore-mode',
    install(ctx) {
        ctx.addRailMode({
            id: 'explore',
            label: 'Explore',
            icon: compassSvg,          // raw SVG string, innerHTML'd — must be trusted (D12)
            kind: 'pointer',
            shortcut: 'E',
            order: 10,                 // ordering among plugin modes only (D5)
            defaultTool: null,
            // panelOpen defaults to true (D11)
            tools: () => [             // array or function (D13)
                { id: 'expand', label: 'Expand neighbours', icon: plusSvg, kind: 'action',
                  run: () => expandSelected(ctx.graph),
                  enabled: () => !!ctx.graph.renderer.getGraphInteraction().getSelectedNode() },
                { id: 'walk', label: 'Path walk', icon: pathSvg, kind: 'toggle',
                  run: armed => armPathWalk(ctx.graph, armed) },
            ],
            render: () => depthSlider(),   // appended below the rows (D16)
            onEnter: () => {},
            onExit: () => disarmEverything(),   // also called on unregister (D9)
        })
    },
}
```

A flyout mode instead subclasses the exported `Flyout` and hands over a factory:

```js
class EnrichFlyout extends Flyout {
    mode = 'enrich'                    // must match the definition's id (D8)
    template() { return this.headerRow(sparklesSvg, 'Enrich') + this.toggleRow(...) }
    wire() { this.wireToggle('auto', () => toggleAuto(), () => isAuto()) }
}

ctx.addRailMode({
    id: 'enrich', label: 'Enrich', icon: sparklesSvg, kind: 'flyout',
    flyout: ui => new EnrichFlyout(ui),   // core mounts and disposes it
})
```

## 5. Why this is cheap — what already holds

Established by reading the code on 2026-08-28. These are the load-bearing facts; if one
turns out to be wrong the estimate moves.

- **`ModeStore` is purely presentational.** It holds `mode` / `armedTool` / `panelOpen`
  and notifies. The real work is done by `ToolPanel` calling public graph API directly —
  `renderer.toggleLassoMode`, `editing.connectManager`, `noteManager.addNote`. A plugin
  mode's tools can therefore do anything a plugin can already do, with no new privilege.
- **Nothing outside the rail cluster reads mode state.** `grep` for
  `PointerMode|RailMode|FlyoutMode|modeStore|getArmedTool` outside `ModeStore.ts` hits
  only `ModeRail`, `ToolPanel`, `Flyout`, `ViewFlyout`, `PhysicsFlyout` and `docIndex.ts`.
  Nothing in `GraphInteractions`, the renderers or `Graph`.
- **The SCSS is class-driven, not name-driven.** `moderail.scss` styles
  `.pvt-moderail-button` / `-divider` / `.active`; the only per-mode rule in the whole
  cluster is `.pvt-flyout-view .pvt-flyout-card`. A plugin mode inherits the native look
  with no styling work.
- **The rail already self-sizes.** `ModeRail.publishHeight()` (`ModeRail.ts:89`) observes
  its own box with a `ResizeObserver` and publishes `--pvt-moderail-height`, which the
  legend sizes against. Adding or removing modes keeps that correct for free.
- **`Flyout` is already the right contract** — a subclass declares its mode, a
  `template()` and a `wire()`, with `open` bound to the store. D7 just exports it.
- **The precedent exists twice.** `addPanel` and `addDockTab` are registry + disposer +
  subscriber, and `addDockTab` additionally solves the *late arrival* problem
  (`ensureDock`, `UIManager.ts:833`). This is the same problem: plugins install at
  `Graph.ts:140`, after `new UIManager` has already run `build()` and mounted the rail.
  **So the rail must subscribe and rebuild its plugin zone — a requirement, not a nicety.**

## 6. What has to move

D2 shrinks this list sharply: every built-in path stays as it is, and the new code sits
*beside* it.

| File | Change |
|---|---|
| `ModeStore.ts:6-24` | Widen the types per D4. `isPointerMode` can no longer be `mode === 'select' \|\| mode === 'create'` — the store records each registered mode's `kind` at registration, with the four built-ins pre-seeded, and the check becomes a lookup |
| `ModeStore.ts:46,53` | `DEFAULT_ARMED` / `DEFAULT_PANEL_OPEN` stay for the built-ins; a registered mode seeds its own entries from `defaultTool` and `panelOpen` (D11) |
| `ModeStore.ts:73` | `lastPointerMode` unchanged; the D9 fallback is Select, not the last mode |
| `ModeRail.ts:28-55` | Keep the four `makeButton` calls. **Delete** the SOON zone (D6). **Add** a plugin zone: divider + registry-ordered buttons, rebuilt on registry change |
| `ModeRail.ts:57-66` | Keep `V` / `C`. Register each plugin mode's `shortcut` through `keyManager` (D10) |
| `ModeRail.ts:138` | `railFace()` untouched for built-ins; plugin buttons derive their face from the armed `RailTool` (D15) |
| `ToolPanel.ts:144` | `specsFor()` untouched. Add a branch: for a registered mode, read `tools` (array or function, D13) and append `render()` (D16) |
| `ToolPanel.ts:28,170,241` | `MODE_SHORTCUT`, the title/icon and `defaultTool()` keep their built-in values; the registered path reads the definition |
| `ToolPanel.ts:120-127` | **Unchanged.** The lasso / connect-manager disarm-on-leave stays exactly as written. Plugin modes get `onExit` instead |
| `Flyout/Flyout.ts` | Widen `mode` per D4; export the class (D7) |
| `UIManager.ts` | The registry: `addRailMode` / `removeRailMode` / `getRailModes` / `onRailModesChanged`, plus mounting each flyout factory into `layout.flyout` (D8). `UI_ELEMENTS` is untouched |
| `interfaces/GraphUI.ts` | Add `RailModeDefinition` + `RailTool`; **delete** `ModeRailOptions` and `UI.modeRail` (D6) |
| `interfaces/Plugin.ts` | `addRailMode` / `removeRailMode` on `PluginContext` |
| `index.ts` / `docIndex.ts` | Export `Flyout`, `RailModeDefinition`, `RailTool` |

`ToolSpec` (`ToolPanel.ts:17`) is promoted to a public `RailTool` in
`interfaces/GraphUI.ts`, minus `'soon'` (D14).

**The risk the first draft flagged is gone.** It named `ToolPanel.onState`'s
disarm-on-leave — with its macrotask lasso deferral at `ToolPanel.ts:299` — as the part
most likely to regress. D2 means that code is never touched.

## 7. Not in scope

- **Arbitrated drag ownership** (D1). A plugin can wire its own pointer handlers the way
  `LassoOverlay` does, using the public `canvasPointerDown/Up`, `canvasMousemove`,
  `canvasBeforeZoom` and `context.cancel()`. What core will not do in v1 is decide between
  two claimants or suppress pan and the selection box on a mode's behalf. An Explore mode
  wanting drag-to-expand is a second, larger piece of work.
- **Shipping an Explore or Enrich mode ourselves.** The demo mode behind `?hero` and a
  gallery card are scope; a built-in is not.
- **Converting the built-ins** (D2), and **reworking the flyout chrome** beyond exporting
  the base class.

## 8. Work plan

- **M1 — the door.** Registry on `UIManager`; store widened; the rail's plugin zone; the
  tool-panel path for registered pointer modes; `RailModeDefinition` / `RailTool` exported.
  Check how TypeDoc renders the D4 idiom and fall back to `string` if it is ugly. Ends with
  the existing visual suite green and the built-in rail pixel-identical.
- **M2 — flyout modes.** Export `Flyout`, widen its `mode`, mount and dispose factories,
  warn on id mismatch.
- **M3 — retire the stubs and prove it.** Delete `UI.modeRail` + `ModeRailOptions` + the
  SOON buttons and CSS; the `?hero` demo Explore mode; a gallery card; the plugins-page
  section; a changelog entry; visual coverage for a registered mode.

Roughly one session for M1, half for M2, half for M3 — the same shape and size as the
dock-tabs work.

## 9. Tests and docs

- `tests/visual/specs/mode-rail.spec.ts` uses
  `UI: { modeRail: { explore: true, enrich: true } }` for its `B3` fixture (and
  `{ explore: false, enrich: false }` at line 145), and `harness.ts:255` sets
  `modeRail: { enrich: true }`. All three go with D6 — and the harness is the natural place
  to register a fake plugin mode instead, so the suite covers the new door rather than the
  old stubs.
- The rail is a small target and the suite is **colour-blind at threshold 0.2** and blind
  to ~16px chrome moves. A registry regression that reorders or drops a button will not
  fail on a screenshot alone: assert the rail's button ids and their order in the DOM.
- Worth a test before the code: unregistering the active mode must call `onExit` and land
  on Select (D9), and a `kind: 'flyout'` mode's disposer must take its panel with it (D8).
- `docs/ui.md:70` describes the rail and carries the 1.5→1.6 migration warning; it needs
  the new extension point and a note that `UI.modeRail` is gone. `docs/plugins.md` gains
  the section, including the D12 warning that `icon` is injected as raw HTML.
