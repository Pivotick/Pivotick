# Pivotick

Pivotick is a TypeScript graph-visualization library built on D3. It renders directed or undirected graphs with interactive controls, force simulation, tree layout support, and optional UI elements such as sidebars, toolbars, context menus, and tooltips.

## Features

- Directed and undirected graph rendering
- Force-based simulation with optional worker support
- Tree/hierarchy layout support
- Rich UI modes (`full`, `light`, `viewer`, `static`)
- SVG renderer (primary) with Canvas renderer scaffolding
- Configurable node/edge styles, labels, and callbacks
- ES module and UMD build outputs

## Installation

```bash
npm install pivotick
```

> This repository is currently configured as a library project and demo/docs workspace.

## Quick start

```ts
import Graph from 'pivotick'

const container = document.getElementById('graph') as HTMLElement

const data = {
  nodes: [
    { id: 1, data: { label: 'A' } },
    { id: 2, data: { label: 'B' } }
  ],
  edges: [
    { from: 1, to: 2 }
  ]
}

const graph = new Graph(container, data, {
  isDirected: true,
  UI: {
    mode: 'full'
  }
})
```

### Browser/UMD usage

After building, use `dist/pivotick.umd.cjs` from your bundle pipeline or adapted browser packaging flow. In UMD-style usage, `Graph` is exported with convenience statics:

- `Graph.Node`
- `Graph.Edge`
- `Graph.ColorPaletteMapper`

For modular usage, use named exports:

```ts
import Graph, { Pivotick, Node, Edge, ColorPaletteMapper } from 'pivotick'
```

## Build the JavaScript library

### Prerequisites

- Node.js 18+
- npm

### Development

```bash
npm install
npm run dev
```

This starts the Vite development server for the demo entry (`src/main.ts`).

### Production build

```bash
npm install
npm run build
```

`npm run build` performs:

1. TypeScript compile/check (`tsc`)
2. Vite library build

Output artifacts are generated in `dist/`:

- `dist/pivotick.js` (ES module)
- `dist/pivotick.umd.cjs` (UMD/CJS-compatible output)

### Linting

```bash
npm run lint
npm run lint_fix
```

## Difference reference

This section highlights the important project “differences” at a glance.

### 1) Build output differences

| Output | File | Best for |
| --- | --- | --- |
| ES module | `dist/pivotick.js` | Modern ESM bundlers (`import`) |
| UMD/CJS bundle | `dist/pivotick.umd.cjs` | Legacy or CommonJS-oriented setups (`require`) |

### 2) UI mode differences

| Mode | Behavior |
| --- | --- |
| `full` | Full UI and interactions enabled |
| `light` | Minimal UI with interactions enabled |
| `viewer` | Pan/zoom/drag navigation without full panels |
| `static` | No interactions (simulation, zoom, drag, selection, tooltip/context menu disabled) |

### 3) Export differences

| Export style | Example | Notes |
| --- | --- | --- |
| Default export | `import Graph from 'pivotick'` | Main graph entry point |
| Named export alias | `import { Pivotick } from 'pivotick'` | Alias to `Graph` |
| Data model exports | `import { Node, Edge } from 'pivotick'` | Programmatic node/edge creation |
| Utility export | `import { ColorPaletteMapper } from 'pivotick'` | Color mapping helper |

### 4) Graph behavior differences

| Option | Effect |
| --- | --- |
| `isDirected: true` | Directed edges/arrow-style semantics |
| `isDirected: false` | Undirected graph semantics |

## Docs and API reference

- Local docs dev server: `npm run vitepress:dev`
- Build docs + API docs: `npm run docs:build`

Generated API docs are emitted under `docs/api/`.

## Project scripts

- `npm run dev` — Vite demo development server
- `npm run build` — TypeScript check + library build
- `npm run lint` — ESLint checks
- `npm run lint_fix` — ESLint autofix
- `npm run vitepress:dev` — local docs server
- `npm run docs:build` — TypeDoc + VitePress build

## Contributing

1. Create a branch
2. Run `npm run build` and `npm run lint`
3. Open a pull request with a concise summary of behavior and API changes
