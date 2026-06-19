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
```

There is no test framework configured.

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

`Graph` maintains nodes/edges as `Map`s and emits a typed event bus (`.on(event, handler)`) for: `ready`, `nodeAdd/Remove/Change`, `edgeAdd/Remove/Change`, `noteAdd/Remove/Change`, and `dataBatchChanged`. The `GraphUI.mode` option (`'full' | 'light' | 'viewer' | 'static'`) drives capability defaults — e.g. `'static'` force-disables simulation, zoom, drag, selection box, tooltips, and context menus in the constructor.

### Editing layer (`src/editing/`)

This is the newest major subsystem. `GraphEditingManager` (accessible via `graph.editing`) tracks active edit sessions:
- `NodeEditSession` — in-place node editing (opened via `openNodeSession`, surfaced through the `callbacks.onNodeEdit` hook and the edit-node modal).
- `GraphConnectManager` + `EdgeCreationSession` — hybrid edge creation supporting both drag-and-drop and click-click linking, using a "shadow edge" preview. Related UI lives in `ui/elements/ShadowLinkManager.ts`.

### Notes (`src/Note.ts`, `src/NoteManager.ts`, `src/plugins/noteContentRenderers/`)

Notes are free-floating annotations on the canvas, rendered as HTML. Note content goes through a `NoteContentRenderer` pipeline; the Markdown renderer (`plugins/noteContentRenderers/markdown/`) uses `marked` + `dompurify` and includes a custom `nodeReferenceExtension` for linking note text to graph nodes.

### Renderers (`src/renderers/`)

- `svg/` — primary, production renderer (e.g. `NoteDrawer.ts` renders notes)
- `canvas/` — experimental

`renderers/GraphRendererFactory.ts` selects the renderer; `GraphRenderer.ts` is the abstract interface.

### Simulation & Worker (`src/Simulation.ts`, `src/workers/`, `src/SimulationWorkerWrapper.ts`)

`Simulation` wraps D3 forces. When `simulation.useWorker` is set, work is offloaded to `workers/SimulationWorker.ts` (built separately to `dist/workers/`) via `SimulationWorkerWrapper.ts`.

### Configuration interfaces (`src/interfaces/`)

`GraphOptions` is the root config, composed of nested option groups: `RendererOptions`, `SimulationOptions`, `LayoutOptions`, `GraphUI`, `InterractionCallbacks`, and `GraphQueryEngine` filter types. Note the intentional/legacy spelling **"Interraction"** (two r's) — keep it consistent when touching callbacks.

### Plugins (`src/plugins/`)

- `layout/` — tree/hierarchical layout
- `d3Forces/` — custom D3 force implementations
- `analytics/` — DAG / cycle detection
- `colors/` — `ColorPaletteMapper` + palettes (public export)
- `noteContentRenderers/` — note content rendering (see Notes above)

### UI (`src/ui/`)

- `components/` — reusable primitives (`Button`, `Dropdown`, `Modal`, `Tabs`, `Badge`, `NodePickers`, `JsonViewer`, …); `tom-select` backs select/picker widgets
- `elements/` — feature areas: `Sidebar`, `NoteSidebar`, `GraphToolbar`, `GraphControls`, `GraphFilter`, `GraphNavigation`, `Mainheader`, `ContextMenu`, `Tooltip`, `SlidePanel`, `modals/` (incl. `editNodeModal`, `InspectNodeModal`)

### Utilities (`src/utils/`)

`ElementCreation.ts` (DOM creation + `generateSafeDomId`), `GeometryHelper.ts`, and the `Getters.ts` / `GraphGetters.ts` accessor helpers.

### Styling (`src/styles/`)

SCSS (modern compiler API) with CSS custom properties for theming; split into `components/` and `graph-components/`.

## Demo / scratch files

`src/main.ts` is the dev demo page. `src/ail-graph.ts`, `src/ail-graph2.ts`, `src/vt-graph.ts` are large static datasets used only by the demo — not part of the library.

## Documentation

VitePress docs in `docs/`; API docs auto-generated by TypeDoc (markdown plugin) into the docs tree. Deploys to GitHub Pages via GitHub Actions.
