# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pivotick is a hackable TypeScript graph visualization library built on D3 force simulations. It renders interactive directed/undirected graphs with force-directed and tree layouts, an editing layer (node editing, drag-and-drop / click-click edge creation), free-floating notes with rich (Markdown) content, query-based filtering, and UI components (sidebar, toolbar, context menus, tooltips, modals). It ships as ES, UMD, and IIFE bundles plus a standalone simulation Web Worker.

## Build & Development Commands

```bash
npm run dev              # Vite dev server (serves src/main.ts demo page)
npm run build            # tsc check, then build ES + browser (UMD/IIFE) + worker bundles
npm run lint             # ESLint check (src/**/*.{ts,tsx})
npm run lint_fix         # ESLint autofix
npm run vitepress:dev    # Documentation dev server
npm run docs:build       # TypeDoc (markdown) + VitePress build
npm run test:visual      # Playwright visual-regression suite (tests/visual/)
```

The only tests are the Playwright visual-regression suite under `tests/visual/` (`npm run test:visual`, `:update` to
refresh snapshots, `:ui`/`:headed`/`:report` for debugging). There is no unit-test framework.

`npm run build` runs four steps in sequence (see `package.json`): `tsc` (type-check only) then three separate Vite library builds, each with its own config:
- `vite.config.es.js` → `dist/pivotick.es.js` (ES module; D3 + lodash.merge left external)
- `vite.config.browser.js` → `dist/pivotick.umd.js` and `dist/pivotick.iife.js` (everything bundled, attaches `Node`/`Edge`/`ColorPaletteMapper` onto the global `Pivotick`)
- `vite.config.worker.js` → `dist/workers/simulation.worker.js` (the simulation Web Worker, built standalone)

All three share `vite.config.base.js`. Note: the entry is declared as `src/index.js` — Vite resolves this to `src/index.ts`. `vite.config.js` is the dev-server config.

## Code Style

- **No semicolons**, **single quotes** (ESLint enforced via `eslint.config.js`)
- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters`

## Architecture

### Entry Point & Exports

`src/index.ts` exports `Graph` (as `Pivotick`), `Node`, `Edge`, and `ColorPaletteMapper`. There is no default export. For browser (UMD/IIFE) builds, `Node`, `Edge`, and `ColorPaletteMapper` are attached as properties on `Graph` so they're reachable from the global.

### Graph orchestration

`Graph` (`src/Graph.ts`) is the main entry point: `new Graph(container, data?, options?)`. It owns and wires together the major subsystems, each exposed as a public field:

- `renderer` — created via `renderers/GraphRendererFactory.ts`
- `simulation` (`Simulation.ts`) — D3 force wrapper, optionally offloaded to the Web Worker
- `UIManager` (`ui/UIManager.ts`) — coordinates all UI elements
- `noteManager` (`NoteManager.ts`) — registry/lifecycle for `Note`s
- `queryEngine` (`GraphQueryEngine.ts`) — filtering / node hiding
- `editing` (`editing/GraphEditingManager.ts`) — interactive editing sessions
- `notifier` (`ui/Notifier.ts`) — user notifications

`Graph` maintains nodes/edges as `Map`s and emits a typed **data** event bus (`.on(event, handler)`) for: `ready`, `nodeAdd/Remove/Change`, `edgeAdd/Remove/Change`, `noteAdd/Remove/Change`, and `dataBatchChanged`. The `GraphUI.mode` option (`'full' | 'light' | 'viewer' | 'static'`) drives capability defaults — e.g. `'static'` force-disables simulation, zoom, drag, selection box, tooltips, and context menus in the constructor.

There are **two distinct event systems**: this high-level data event bus (`graph.on(...)`), and the lower-level pointer/selection **interaction** event system in `GraphInteractions` (see next section).

### Interaction & event layer (`src/GraphInteractions.ts`)

`GraphInteractions` is the low-level interaction layer that translates DOM/pointer events into a typed interaction-event bus (`GraphInteractionEvents`, defined in `interfaces/GraphInteractions.ts`): node/edge/note `click`/`dbclick`/`hoverIn`/`hoverOut`/`pointerDown`/`pointerUp`/`contextmenu`, drag events (incl. `noteDragging`), canvas events (`canvasClick`, `canvasMousemove`, `canvasZoom`, `canvasBeforeZoom`, …), `simulationTick`/`simulationSlowTick`, and selection events (`selectNode(s)`/`selectEdge(s)` plus their `unselect`/`blur` counterparts). It owns selection state (selected node/edge plus multi-selection arrays) and registers keyboard shortcuts via `UIManager.keyManager`. It is owned by the renderer rather than `Graph` directly — reach it via `graph.renderer.getGraphInteraction()`. The user-facing `InterractionCallbacks` (note the two-r spelling) are dispatched from here.

### Editing layer (`src/editing/`)

This is the newest major subsystem. `GraphEditingManager` (accessible via `graph.editing`) tracks active edit sessions:
- `NodeEditSession` — in-place node editing (opened via `openNodeSession`, surfaced through the `callbacks.onNodeEdit` hook and the edit-node modal).
- `GraphConnectManager` + `EdgeCreationSession` — hybrid edge creation supporting both drag-and-drop and click-click linking, using a "shadow edge" preview. Related UI lives in `ui/elements/ShadowLinkManager.ts`.

### Notes (`src/Note.ts`, `src/NoteManager.ts`, `src/plugins/noteContentRenderers/`)

Notes are free-floating annotations on the canvas, rendered as HTML. Note content goes through a `NoteContentRenderer` pipeline; the Markdown renderer (`plugins/noteContentRenderers/markdown/`) uses `marked` + `dompurify` and includes a custom `nodeReferenceExtension` for linking note text to graph nodes.

### Renderers (`src/renderers/`)

- `svg/` — primary, production renderer. Split into per-concern drawers: `GraphSvgRenderer.ts` (orchestrator + default node/edge/label/marker styles), `NodeDrawer.ts`, `EdgeDrawer.ts`, `NoteDrawer.ts`, `ClusterDrawer.ts`, `EventHandler.ts`, plus selection visuals (`SelectionBox.ts`, `LassoOverlay.ts`).
- `canvas/` — experimental (`GraphCanvasRenderer.ts`, `NodeDrawer.ts`, `EdgeDrawer.ts`, `EventHandler.ts`).

`renderers/GraphRendererFactory.ts` selects the renderer; `GraphRenderer.ts` is the abstract interface (and owns the `getGraphInteraction()` accessor returning the `GraphInteractions` instance).

### Simulation & Worker (`src/Simulation.ts`, `src/workers/`, `src/SimulationWorkerWrapper.ts`)

`Simulation` wraps D3 forces. When `simulation.useWorker` is set, work is offloaded to `workers/SimulationWorker.ts` (built separately to `dist/workers/`) via `SimulationWorkerWrapper.ts`.

### Configuration interfaces (`src/interfaces/`)

`GraphOptions` is the root config, composed of nested option groups: `RendererOptions`, `SimulationOptions`, `LayoutOptions`, `GraphUI` (incl. the `Keybinding` type), `InterractionCallbacks`, and `GraphQueryEngine` filter types. `GraphInteractions.ts` here holds the interaction-layer types (`GraphInteractionEvents`, `GraphInteractionContext`, node/edge selection types) consumed by `src/GraphInteractions.ts`. Note the intentional/legacy spelling **"Interraction"** (two r's) on the callbacks interface — keep it consistent when touching callbacks.

### Plugins (`src/plugins/`)

- `layout/` — tree/hierarchical layout (`Tree.ts`, `EgoTree.ts`) plus `MicroForce.ts`
- `d3Forces/` — custom D3 force implementations (`ForceCenter.ts`, `ForceGravity.ts`, `ForceClusterRadial.ts`)
- `analytics/` — DAG / cycle detection (`DAGAlgorithms.ts`, `cycle.ts`)
- `colors/` — `ColorPaletteMapper` + palettes (public export)
- `noteContentRenderers/` — note content rendering (see Notes above)

### UI (`src/ui/`)

- Top level: `UIManager.ts` (coordinates all UI elements; `UIElement` interface; exposes `keyManager`), `KeybindingManager.ts` (keyboard-shortcut registry, gated on container focus / editable targets), `Notifier.ts` (user notifications), `icons.ts` (icon set)
- `components/` — reusable primitives (`Button`, `Dropdown`, `Modal`, `Tabs`, `Badge`, `InlineBar`, `NodePickers`, `JsonViewer`, …); `tom-select` backs select/picker widgets
- `elements/` — feature areas: `Layout` (root DOM scaffold), `Sidebar` (incl. `BulkActions`), `NoteSidebar`, `ModeRail` / `ToolPanel` / `ViewFlyout` (the mode-driven "B3" chrome — Select/Create rail, contextual tool panel, and layout/physics/grid flyout), `GraphFilter`, `GraphNavigation`, `Mainheader`, `ContextMenu`, `Tooltip`, `SlidePanel`, `ShadowLinkManager` (edge-creation preview, see Editing layer), `modals/` (incl. `editNodeModal`, `InspectNodeModal`)

### Utilities (`src/utils/`)

`ElementCreation.ts` (DOM creation + `generateSafeDomId`; see also `ElementCreationAggregatedProperties.ts`), `FormFactory.ts` (form-building helper), `CoordinateTransform.ts` and `GeometryHelper.ts` (screen/graph coordinate + geometry math), `NoteReferenceStyle.ts`, `PivotickPicker.ts`, `workerUrl.ts` (worker URL resolution), `utils.ts` (incl. `deepMerge` and the `DeepPartial` type), and the `Getters.ts` / `GraphGetters.ts` accessor helpers.

### Styling (`src/styles/`)

SCSS (modern compiler API) with CSS custom properties for theming; split into `components/` and `graph-components/`.

## Demo / scratch files

`src/main.ts` is the dev demo page. `src/ail-graph.ts`, `src/ail-graph2.ts`, `src/vt-graph.ts` are large static datasets used only by the demo — not part of the library.

## Documentation

VitePress docs in `docs/`; API docs auto-generated by TypeDoc (markdown plugin) into the docs tree. TypeDoc's entry point is `src/docIndex.ts` (config in `typedoc.json`) — a dedicated module that re-exports the public classes and type groups for documentation, kept separate from the runtime entry `src/index.ts`. Deploys to GitHub Pages via GitHub Actions.
