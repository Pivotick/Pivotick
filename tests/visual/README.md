# Visual regression tests

Screenshot-based tests that drive Pivotick through common user actions and compare
the rendered result against committed baseline images. The goal is to **catch visual
regressions** — if a change alters how the graph, notes, modals, or interactions look,
a test fails and shows you the pixel diff.

> Side benefit (not the focus): the same harness can later generate the screenshots
> for the documentation site.

## Quick start

```bash
npm run test:visual          # run all visual tests against the baselines
npm run test:visual:update   # re-generate baselines (after intentional visual changes)
npm run test:visual:ui       # interactive Playwright UI runner
npm run test:visual:report   # open the HTML report (expected / actual / diff gallery)
```

Playwright boots the Vite dev server automatically (`npm run dev`), so you don't need
to start it yourself.

## Watching the tests run

Two ways to see what a test does in real time (both need a desktop/display):

```bash
npm run test:visual:ui              # interactive runner — best for inspecting
SLOWMO=600 npm run test:visual:headed   # watch a real browser drive the app live
```

- **UI mode** (`:ui`) opens a runner where you pick a test, watch it execute, then
  time-travel through every action with before/after DOM snapshots, console and network.
  It re-runs automatically when you edit a spec (watch mode). This is the best way to
  understand or debug a test.
- **Headed mode** (`:headed`) opens an actual Chromium window and performs the actions
  in front of you. Tests finish in ~1s, so set `SLOWMO=<ms>` to slow each action down
  enough to follow; it runs single-worker so there's only one window to watch.
- After any run, `npm run test:visual:report` opens the HTML report with the
  expected / actual / diff images for every test.

## How it works

```
tests/visual/
├─ harness/
│  ├─ index.html      # the page Playwright loads (served by Vite)
│  ├─ harness.ts      # builds a graph + exposes window.__pivotick control API
│  └─ fixtures.ts     # deterministic graphs (fixed positions, stable domIDs)
├─ specs/             # the test suites
├─ helpers.ts         # navigation / fixture-loading / screenshot helpers
└─ __screenshots__/   # committed baseline PNGs (one folder per spec)
```

Tests don't drive the demo page (`src/main.ts`) — that uses random layouts. Instead they
load a **dedicated harness** with deterministic fixtures, then either:

- call the control API (`window.__pivotick`) for setup and non-visual triggers, or
- dispatch **real pointer events** (mouse move/down/up) for interactions whose
  *intermediate* visual state matters — e.g. the shadow-link preview while connecting,
  or dragging a note.

### Why it's deterministic

Force simulations are non-deterministic by nature, so the harness removes every source
of run-to-run variance:

| Source of variance        | How it's pinned                                              |
| ------------------------- | ------------------------------------------------------------ |
| Force layout / animation  | `simulation.enabled = false`; fixtures seed fixed `x/y`, and `harness.pin()` re-applies them after load (see note below) |
| Node positions            | Hard-coded in `fixtures.ts`                                   |
| Colour scheme             | `theme: 'light'` (otherwise follows OS `prefers-color-scheme`) |
| Zoom/pan transitions      | `render.zoomAnimation = false`                               |
| Viewport size             | Pinned to 1280×800 in `playwright.config.ts`                 |
| Web fonts                 | `await document.fonts.ready` before snapshotting             |
| Browser engine            | Chromium only                                                |
| Sub-pixel anti-aliasing   | `maxDiffPixelRatio: 0.01` tolerance in the screenshot config |

The graph is only screenshotted after the `ready` event fires (layout done, zoom layer
revealed). Most snapshots target the `.pvt-canvas` viewport (grid + SVG + on-canvas
chrome) so they stay focused; UI-specific tests (e.g. the edit modal) target that element.

#### Pinning exact positions (`harness.pin()`)

A fixture's `x/y` are a **deterministic seed**, not a hard layout: the graph's initial
layout pass clears `fx/fy` and settles nodes from those seeds with the force sim (even
with the sim "off"). Well-connected fixtures stay compact; sparse/disconnected scenes get
scattered apart by the charge force. When a test needs the layout it actually designed —
e.g. the side-by-side styling scenes — call `harness(page, 'pin')` right after
`loadFixture`. It re-applies the fixture's declared positions, then redraws and re-fits.
Tests that are happy with the settled layout (most of the originals) simply don't call it.

#### Pinning a computed layout (`harness.applyLayout()`)

For tree / ego-tree layouts the *designed* positions aren't the fixture seeds — they're
whatever the layout algorithm computes. On load those positions come from a **force
relaxation toward the d3-hierarchy targets**: converged, but timing-dependent (and shakier
under parallel-run CPU contention), so brittle as a pixel baseline. `harness(page,
'applyLayout')` re-runs the active layout's *exact* d3-hierarchy computation, writes the
target positions straight onto the nodes, pins them, and re-fits — making tree baselines a
pure function of (graph, layout options). It's a no-op for `force` (which has no exact
target; the layout spec pins the seeds there instead). The `layout` spec also asserts the
computed *ordering* via `harness(page, 'nodePositions')` as a robust complement.

## Coverage

| Spec                    | What it checks                                                       |
| ----------------------- | ------------------------------------------------------------------- |
| `load-render`           | Basic graph, graph with a Markdown note, note linked to a node      |
| `styling`               | Node shapes / size / colour / icons / labels; edge curves / self-loop / markers / dashed / labels; undirected graph |
| `theme`                 | Dark theme — basic graph, markdown note, selected node              |
| `layout`                | Force, tree (vertical / horizontal / radial), ego tree; + position-ordering assertions |
| `selection`             | Node selected, edge selected, selection cleared                     |
| `edge-creation`         | Edge created via the editing layer; click-to-connect shadow preview + commit |
| `notes`                 | Adding a note at runtime; dragging a note by its header             |
| `node-editing`          | The node edit modal                                                 |
| `zoom`                  | A centered 2× zoom and a pan, applied deterministically             |

## Writing a new test

```ts
import { test, gotoHarness, loadFixture, harness, expectCanvas } from '../helpers'

test('does the thing', async ({ page }) => {
    await gotoHarness(page)
    await loadFixture(page, 'basic')        // see fixtures.ts for available fixtures
    await harness(page, 'selectNode', 'a')  // call any window.__pivotick method
    await expectCanvas(page, 'the-thing.png')
})
```

- **Locate elements** with `nodeEl(page, 'a')` → `#node-a`, `noteEl(page, 'id')` → `#note-id`.
  Node/note domIDs equal their id **only** when created through a fixture node or the
  harness `addNote`/`addNode` (fixture *notes* in `data.notes` get a random domID).
- **Add control verbs** by adding a method to the `HarnessApi` class in `harness.ts`.
- **Add fixtures** in `fixtures.ts` (give every node a fixed position and a stable id).

## Updating baselines

When a change *intentionally* alters appearance, the relevant tests will fail. Review the
diff (`npm run test:visual:report`), confirm the new look is correct, then:

```bash
npm run test:visual:update
git add tests/visual/__screenshots__
```

Baselines are platform-suffixed (`*-linux.png`). They must be regenerated on the same OS
the tests run on; CI should run on Linux to match locally-generated Linux baselines (run
in the official Playwright Docker image for byte-stable rendering).

## Not yet covered (future work)

- **Physics / layout assertions.** Screenshotting a settled force layout is brittle; the
  better approach is to assert node positions read from the API. The harness already leaves
  a seam for this (fixed-position fixtures + position accessors).
- **CI workflow.** The config is CI-ready (`reuseExistingServer: false`, retries under
  `CI`), but no GitHub Actions workflow is wired up yet.
