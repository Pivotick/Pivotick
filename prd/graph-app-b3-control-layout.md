# Feature — the B3 "mode-driven" control layout as Pivotick's default chrome

**Status:** Planned — decisions locked via a design review (2026-07-21); ready to build M1.
**Owner:** Sami Mokaddem
**Requested:** 2026-07-21
**Area:** `src/ui/` (new shell components + registry/scaffold), `src/Simulation.ts` (new physics setter API), `src/interfaces/GraphUI.ts` (mode state + options), `src/styles/` (layout + component SCSS), `src/ui/icons.ts` (new glyphs). Touches the **public UI surface** (breaking).
**Type:** UI / interaction — control-surface redesign.
**Design source:** Claude Design project **"Graph application controls layout"** (`ab310b4e-b570-47af-9cbc-c6a8aba7716b`). Target file **`Graph App - B3.dc.html`**; supporting exploration in `Graph Controls.dc.html` (families A–D), `Graph Controls - Rail Options.dc.html` (B1/B2/B3), and the reusable `PhysicsPanel.dc.html`.
**Related:** `drag-in-node-staging.md` (interactive add-node lands the drag/placement half of M2's add-node tool), `edge-create-veto-hook.md` (already-shipped, feeds Create/add-edge), `renderer-abstraction-audit.md` (grid-in-graph-space belongs to the deferred renderer work), the merged sidebar improvements (type-aware properties, neighbours redesign, faceted multi-select, header auto-fit — all on `develop`).

---

## 1. What we're building

Replace Pivotick's current corner/floating chrome (three absolutely-positioned overlays: `GraphControls` top-left, `GraphNavigation` top-right, `GraphToolbar` top-center) with the **B3 "mode-driven" layout** as the **default** `full`-mode UI. The new surface is:

- a **left mode rail** with two real pointer-modes (**Select**, **Create**) and a **View** button that toggles a settings flyout — plus disabled "SOON" affordances for a future **Enrich** mode;
- **contextual tool panels** that swap with the active mode;
- a **View flyout** consolidating layout, physics (presets + live sliders), and grid/freeze toggles that today are scattered across `GraphControls` and `GraphNavigation`;
- the existing **top bar** (`Mainheader`: Search / Filter / Notes + undo-redo) restyled;
- the existing **selection sidebar** (left) gaining a clear-selection control and a bulk-action row;
- the existing **viewport nav** (`GraphNavigation`) restyled into a right-side rail.

The headline finding of the codebase review: **most of what the mockup shows already exists**, either as working capabilities or as stub buttons. This PRD's M1 is therefore predominantly a *re-organization* of existing controls into a mode-driven shell, plus a small amount of genuinely-new API (physics setters, a mode state machine, a clear-selection control). The genuinely-new *capabilities* the mockup implies (undo/redo, grouping, isolate, path-select, interactive add-node, bulk-edit) are deferred to M2–M4 and ship as visible-but-disabled "SOON" controls in M1.

## 2. Design provenance (how B3 was chosen)

The design explored four control-layout families, then drilled into the winner:

- **A · Command Dock** — tools in one bottom dock; physics as a pop-up tray.
- **B · Unified Rail** — every tool in one sectioned left rail; physics as a flyout. **← chosen.**
- **C · Floating Islands** — refines Pivotick's *current* corner layout; physics as a bottom strip.
- **D · App Bar + Inspector** — full top bar + docked right inspector.

Within B, three rail treatments were compared (`Graph Controls - Rail Options.dc.html`): **B1** (one rail, behavioral zones), **B2** (split author-rail + view-bar), and **B3** (mode-driven rail + contextual bar). **B3 was tagged "most scalable"** — the rail holds top-level *modes*, each revealing only its own tools, so new capabilities drop in as new modes without crowding the rail. `Graph App - B3.dc.html` is the fully-realized B3 screen and is the spec this PRD implements.

Two deliberate departures from the finalized mockup were agreed in review (see §3): **View is not a peer pointer-mode** (it's a settings flyout), and **layout choice is separated from physics presets**.

## 3. Decisions taken (decision log)

These were resolved one-by-one in the 2026-07-21 review. They are the binding constraints for the build.

| # | Decision | Ruling |
|---|---|---|
| D1 | **Scope** | B3 **replaces** the default `full`-mode chrome (not opt-in, not a demo). |
| D2 | **Build strategy** | **New shell components** (`ModeRail`, contextual `ToolPanel`, `ViewFlyout`); reuse the leaf logic; **retire `GraphToolbar` + `GraphControls`** as containers. |
| D3 | **v1 scope** | **Layout shell over existing capabilities.** Six new capabilities deferred (see D12), shown disabled/"SOON" in M1. |
| D4 | **Mode model** | **Two real pointer-modes** (Select, Create) + **View as an always-available settings flyout**. Basic click-select / pan / zoom work in *every* mode. |
| D5 | **View placement + default** | View is a **rail button toggling an overlay flyout** that coexists with the active pointer-mode. **Default mode = Select**; flyout closed on load. |
| D6 | **Layout vs presets** | **Separate concerns.** A Layout control (**Force + Tree** V/H/Radial + root-finders) via `changeLayout()`, distinct from **Tight / Loose / Default** force-param presets. Sliders + presets **grey out under non-Force layouts**. **EgoTree is neighbor-graph-only — never a layout/simulation option.** |
| D7 | **Physics knobs + API** | **Abstract 0–100 knobs** mapped internally → **new public `Simulation` setters** (`setRepulsion` / `setLinkDistance` / `setCollisionRadius` / `setFriction`, each map + `reheat()`). **Change the collide accessor** so the collision knob actually scales layout. Presets call these setters. |
| D8 | **Icons** | **Keep the inline-SVG `icons.ts` set.** Reuse existing glyphs; add the missing ones (cursor, path, wind, arrows-horizontal, circle-dashed, push-pin, eye, magnet slash, etc.) the same way. No icon-font / CDN dependency. |
| D9 | **API compatibility** | **Hard break, no shims.** Remove the old elements, their `UIManager` getters, and their options; changelog entry only. |
| D10 | **Rail extras** | **Enrich** ships as a disabled "SOON" item (DATA zone of the rail). **Workspace switcher is *not* a mode** — moved out of the rail (placement open, see §9). |
| D11 | **Viewport rail** | Fit and center are one action → a single **crosshair** (fit-and-center); zoom in/out; settings gear; keep **fullscreen**. No separate frame-corners fit. |
| D12 | **Roadmap** | Finish the mode surface first, big subsystem last: **M2** = add-node + isolate; **M3** = group/ungroup + bulk-edit; **M4** = path-select + undo/redo. |
| D13 | **Grid mismatch** | **Pragmatic for M1**: unify the visual-grid pitch and snap `gridSize` to one constant (align at 100% zoom), keep the screen-space decorative grid. Defer the graph-space / zoom-tracking grid. |

**Folded-in defaults** (agreed in review, revisit freely):
- **Mode-gating** — `full`: sidebar + top bar + mode rail + panels + View flyout + viewport rail. `light`: same minus the left sidebar. `viewer`: viewport rail + View flyout only (no mode rail; read-only). `static`: bare canvas (unchanged).
- **Sidebar bulk-row** — Pin / Unpin / Hide / **Delete** functional in M1 (delete-selected is cheap over `Graph.removeNode`); Group / Ungroup / Isolate / Bulk-edit disabled "SOON". Plus the clear-selection **X**.
- Keep the right-click **`ContextMenu`** alongside the new chrome.
- **Search** keeps its current picker-modal behavior in M1 (inline top-bar search box is optional/later).
- **Startup defaults** — land in Select mode, View flyout closed, simulation running as today.

## 4. Current-state grounding (reuse / extend / build-new)

Consolidated from four codebase maps. This is why M1 is mostly reorganization.

### 4.1 Already works — reuse as leaf logic
| Capability | Anchor |
|---|---|
| Left selection sidebar: header, type-aware properties (JSON/link/copy), **facet breakdown** (.GROUP/.ID/.LABEL/.GENDER + distribution bars), **Neighbor Graph / Stats / List** tabs, **"+N Group"** collapsed cluster node in the ego-graph | `Sidebar/` (`MainHeader.ts:201-205`, `Properties.ts:144-182`, `ElementCreationAggregatedProperties.ts:68-253`, `Neighbors.ts:59-89, 558-623`) — improvements branch fully merged to `develop` |
| Top bar Search (⇧J, picker), Filter (⇧K → `GraphFilter` slide panel), Notes (⇧N → `NoteSidebar` slide panel) | `Mainheader.ts:36-132`; `KeybindingManager.ts` (per-key stack, focus-gated) |
| Select tools: click / shift / alt / ctrl multi-select, **lasso**, **invert selection** | `GraphInteractions.ts:70-99`; `LassoOverlay.ts`; `GraphToolbar.inverseSelection:523-539` |
| Create tools: **add-edge** (click-click + drag, a real canvas mode), **add-note**, **edit-node** | `GraphConnectManager`/`EdgeCreationSession`; `NoteManager.addNote:14`; `GraphEditingManager.openNodeSession:35` |
| View controls: `changeLayout('force'\|'tree', …)`, physics play/pause (`enable`/`disable`/`pause`/`reheat`), snap-to-grid, highlight-grid, freeze-on-drag | `Simulation.ts:362-509, 605-788`; `GraphNavigation.ts:108-158` |
| Viewport nav: `zoomIn` / `zoomOut` / `fitAndCenter`, fullscreen, options gear | `GraphNavigation.ts:81-105`; `GraphSvgRenderer.ts:470,483,496` |
| Pin / unpin (`node.freeze/unfreeze`), hide (`queryEngine.excludeNode`) | `Node.ts:286-296`; `GraphQueryEngine.ts:98-103` |
| Collapse/expand of **data-defined** clusters | `Node.ts:317-345`; `ClusterDrawer.ts`; `Graph.toggleExpandNode:1039-1050` |

### 4.2 Extend
| Item | What changes |
|---|---|
| Physics sliders (repulsion / link-distance / collision / friction) | **No runtime setters today** — only raw d3 handles. Add public setters + `reheat()`; map 0–100 → real domains; **fix the collide accessor** (`Simulation.ts:232-243`) so the collision knob scales layout instead of only affecting radius-less nodes. |
| Selection-box rubber-band | `SelectionBox.ts` exists but only fires under a modifier (plain drag = pan). Extend so **Select mode owns plain-drag** rubber-band. |
| Selection header | Add the clear-selection **X** → `GraphInteractions.clearNodeSelectionList():678`. |
| Neighbor-graph / facet styling | Restyle to 322px + mockup look; logic unchanged. |
| Viewport nav | Restyle the top-right pill stack into the right rail (D11). |

### 4.3 Build-new
| Item | Notes |
|---|---|
| **Mode state machine** + `ModeRail` + contextual `ToolPanel` + `ViewFlyout` | The spine. No tri-mode exists today (only a binary "Edit Graph" toggle on `e`, `GraphToolbar.ts:71-103`). |
| **Physics presets** (Tight / Loose / Default) | No preset concept exists; each is a named bundle calling the new setters. |
| **Sidebar bulk-action row** | Relocate from `GraphToolbar`; wire Pin/Unpin/Hide/Delete; Group/Ungroup/Isolate/Bulk-edit disabled "SOON". |
| **Deferred capabilities** (M2–M4) | undo/redo (no history engine at all), group/ungroup-to-cluster, isolate, path-select, interactive add-node, bulk-edit — all currently stubs (`GraphToolbar.ts:267-353, 443-452`). |

## 5. Target architecture

### 5.1 How the chrome is built today (and stays)
Chrome is **registry-driven**: `UIManager.UI_ELEMENTS` (`UIManager.ts:141-177`) declares `{ key, modes, enabled?, make, slot }` rows; `build()` (`:270-284`) instantiates each `UIComponent` and mounts it into a DOM slot created by `Layout.onMount` (`Layout.ts:30-62`), positioned by the CSS grid + absolute overlays in `_layout.scss`. **This machinery is reused unchanged** — we edit the catalog, add slots, and add/remove component rows.

### 5.2 New components (D2)
- **`ModeRail`** (new left-edge slot) — renders Select / Create / View + the Enrich "SOON" item; owns nothing but presentation + click → mode-store dispatch.
- **`ToolPanel`** (contextual panel anchored to the rail) — subscribes to the mode store; renders the Select tool-set (Pointer / Lasso / Path-select `SOON` / Invert) or the Create tool-set (Add node `SOON` / Add edge / Add note / Edit). Tools bind to the **existing** leaf logic (§4.1).
- **`ViewFlyout`** (overlay, toggled by the View rail button) — Layout control (Force + Tree variants) + Physics card (`PhysicsPanel`-shaped: presets + 4 sliders + play/pause) + Snap / Highlight-grid / Freeze toggles. All wired to `Simulation` / renderer.
- **Mode store** — a tiny observable on `GraphInteractions` or `UIManager` (`mode: 'select' | 'create'`, `viewFlyoutOpen: boolean`). Emits so the rail, panels, and canvas cursor react. Keybindings register via `keyManager` (per-key stack, auto-disposed through `UIComponent.track`).

### 5.3 Physics setter API (D7)
Add to `Simulation` (public):
```
setRepulsion(v: number)        // 0–100 → d3ManyBodyStrength (negative, radius²/weight-scaled) + reheat
setLinkDistance(v: number)     // 40–260 → d3LinkDistance + re-init link force + reheat
setCollisionRadius(v: number)  // 4–60 → collide radius multiplier (accessor change) + reheat
setFriction(v: number)         // 0–100 → d3VelocityDecay (÷100), instant
applyPhysicsPreset(name)       // 'tight' | 'loose' | 'default' → bundle of the above
```
Preset values from the mockup: **loose** `{70,150,26,28}`, **tight** `{32,70,16,58}`; **default** = loose. (The mockup's third preset "tree" is dropped per D6; Tree is a Layout, not a preset.) Sliders + presets are disabled whenever `layout !== 'force'` (Tree zeroes the force accessors anyway).

### 5.4 Retirement (D9 — breaking)
- Delete `GraphControls` and `GraphToolbar` (classes, `UI_ELEMENTS` rows, `Layout` slots, SCSS).
- Remove `UIManager` getters `graphControls`, `graphToolbar`. `graphNaviation` is kept (renamed to `graphNavigation`; note the existing typo — fix as part of the break) and repointed at the restyled viewport rail.
- Remove the `selectionMenu` option (was hosted by `GraphControls`). The right-click `ContextMenu` remains the extension point for per-node actions; the sidebar bulk-row covers multi-selection actions.
- `navigation` and `extraPanels` options are unchanged.

## 6. Region-by-region spec (M1)

1. **Top bar** (`Mainheader`, restyle) — Search (⇧J), Filter (⇧K), Notes (⇧N) reused as-is; undo/redo stay disabled placeholders (wired in M4). Restyle to the mockup.
2. **Mode rail** (`ModeRail`, new) — Select / Create (exclusive pointer-mode; default Select) + View (independent flyout toggle) + Enrich "SOON" (DATA zone). Keyboard: register mode shortcuts through `keyManager`.
3. **Select panel** — Pointer (default; plain-drag rubber-band via extended `SelectionBox`), Lasso (reuse `LassoOverlay`), Path-select ("SOON", M4), Invert (reuse `inverseSelection`).
4. **Create panel** — Add node ("SOON", M2), Add edge (reuse `GraphConnectManager`), Add note (reuse `NoteManager.addNote`), Edit node (reuse `openNodeSession`).
5. **View flyout** — Layout control (Force + Tree V/H/Radial + root-finders via `changeLayout`; **no EgoTree**); Physics card (Tight/Loose/Default presets + repulsion/link-distance/collision/friction sliders + play/pause); Snap-to-grid, Highlight-grid, Freeze-on-drag toggles (reuse existing `Simulation`/renderer wiring). Sliders/presets greyed under non-Force layouts.
6. **Selection sidebar** (restyle to 322px) — reuse the merged header/properties/facets/neighbor-tabs; **add** the clear-selection **X** and a **bulk-action row** (Pin / Unpin / Hide / Delete functional; Group / Ungroup / Isolate / Bulk-edit disabled "SOON").
7. **Viewport rail** (`GraphNavigation`, restyle) — crosshair (fit-and-center) / zoom in / zoom out / settings gear + fullscreen (D11).

## 7. Milestones

- **M1 — the shell (this effort).** New `ModeRail` + `ToolPanel` + `ViewFlyout`; mode store + keybindings; physics setter API + preset bundles + collide-accessor fix; retire `GraphControls`/`GraphToolbar` (breaking); restyle `Mainheader`, `GraphNavigation`, `Sidebar`; sidebar clear-X + bulk-row (Pin/Unpin/Hide/Delete); grid pitch-constant unify (D13); add missing `icons.ts` glyphs; disabled "SOON" affordances for Enrich, Add-node, Path-select, Group/Ungroup, Isolate, Bulk-edit. **Ships the mockup's look + a fully working core.**
- **M2 — complete the modes.** Interactive **add-node** (placement on canvas; overlaps `drag-in-node-staging.md`); **isolate** (show-only-selection via inverted `queryEngine.excludeNode`).
- **M3 — authoring.** **Group/ungroup** (create a cluster from a selection, reusing the collapse/expand infra + the ego-graph "+N Group" visual); **bulk-edit** (property changes across a selection, generalizing the edit modal).
- **M4 — power features.** **Path-select** (shortest path via `src/plugins/analytics/`); **undo/redo** (a command/history stack over the mutation API — `addNode/addEdge`, `NodeEditSession.commit`, `NoteManager`, `queryEngine`, cluster ops — hooked to the existing disabled buttons and the `dataBatchChanged` event).

## 8. Backward compatibility (breaking — D9)

- **Removed:** `GraphControls`, `GraphToolbar` classes; `UIManager.graphControls` / `graphToolbar` getters; the `selectionMenu` option. `graphNaviation` getter renamed → `graphNavigation`.
- **Behavioral:** the `e` "Edit Graph" toggle is gone (superseded by Create mode); default landing behavior changes (mode rail present, Select active). The collide-accessor change (D7) subtly alters force-layout spacing for graphs relying on the old collision behavior — validate against the visual baselines.
- **Migration:** changelog + a short migration note (old getters → new `modeRail`/`viewFlyout`/`sidebar` accessors; `selectionMenu` → `ContextMenu` options + sidebar bulk-row). Version bump per semver (major, given removed public getters).

## 9. Open questions

1. **Workspace switcher placement** (D10) — a workspace switcher is an *app-level* concept, not a mode. Undecided between a **top-bar pill** and a **bottom-left floating menu**. No placeholder committed until decided.
2. **Graph-space / zoom-tracking grid** (D13) — the correct "snap to grid" needs a graph-space grid that tracks zoom/pan; deferred as a renderer-layer change (belongs with `renderer-abstraction-audit.md`).
3. **Inline top-bar search** — whether to promote the existing `SearchBox` (currently used inside the picker modal) into an inline top-bar field, as the mockup draws it.
4. **`viewer`-mode View flyout** — confirm that exposing layout/physics tuning in read-only `viewer` mode is desired (view settings aren't data mutations, so likely yes).
5. **Fullscreen in the rail** — kept per D11 though the mockup omits it; confirm it belongs in the restyled viewport rail vs. elsewhere.

## 10. Acceptance criteria (M1)

- Launching a `full`-mode graph shows the B3 layout: left sidebar, top bar, left mode rail (Select active), right viewport rail — and **no** old corner overlays.
- Switching Select ⇄ Create swaps the contextual panel and the primary drag/armed tool; **click-select, pan, and zoom keep working in both**; the View button toggles the flyout without leaving the active mode.
- The four physics sliders visibly change the running simulation (including collision), presets snap all four, and both disable under a Tree layout. Play/pause, snap, highlight-grid, and freeze-on-drag all function.
- The sidebar shows the clear-selection X (clears selection) and a bulk-row where Pin/Unpin/Hide/Delete act on the current multi-selection and the four deferred actions render disabled with a "SOON" affordance.
- The viewport rail's crosshair fits-and-centers; zoom ±, settings gear, and fullscreen work.
- All removed public getters/options are gone and documented; the build type-checks with `noUnusedLocals`/`noUnusedParameters`.
- **Tests & docs:** Playwright visual coverage for the new chrome across `full`/`light`/`viewer` modes and for mode-switching + the View flyout (per the visual-test conventions — wait for async render, proximity-guard tooltips); regenerate baselines. Update docs + at least one gallery example driving the mode-driven layout.

## 11. Risks

- **M1 is large** — a full chrome replacement plus a new physics API. Land it behind small, reviewable PRs (mode store → rail/panels → view flyout → sidebar → retirement/restyle) rather than one drop.
- **Collide-accessor change** (D7) can shift existing force layouts — gate on the visual baselines and keep the mapping conservative.
- **Breaking public surface** (D9) — coordinate the changelog/migration note so downstream consumers aren't surprised.
- **Visual-baseline churn** — a wholesale chrome change invalidates most screenshots; budget for a full baseline regen.
