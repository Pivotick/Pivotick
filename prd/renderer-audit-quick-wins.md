# Renderer Audit — Quick Wins (unbundled)

> **Status**: Proposed (2026-07-16). The actionable, non-speculative subset carved out of the
> [Renderer Abstraction Audit](./renderer-abstraction-audit.md), which remains the source of
> record for the full contract analysis and the deferred work.
> **Deliverable**: ship §2 now; §3 records what stays deferred and the gate for starting it.
>
> **Landed 2026-07-20** on `worktree-pivotick-improvements` (§2 complete): N1, N2, N3, N4, N5, N6, N8, N9 all done.
> Notes: N4 rode along in the N1–N3 bugs commit. N8 — the SVG runner `simulateChildrenInsideParent` turned out to be
> dead (no importers), so it was deleted rather than relocated; the pure `forceConstrainParent` moved to
> `plugins/d3Forces/ForceConstrainParent.ts`. N9 — values relocated to `src/styles/defaults.ts` (existing dir, to avoid a
> confusing `src/style` vs `src/styles` sibling); GraphSvgRenderer/docIndex/NodeDrawer import from there, export names unchanged.
> §3 (abstraction machinery) remains deferred per its gate.

## 1. Why this document exists

The [renderer abstraction audit](./renderer-abstraction-audit.md) is accurate and well-scoped, but
it bundles three very different kinds of work into one eight-package plan (WP1–WP8):

1. **Genuine defects** — user-visible today, unrelated to renderer portability.
2. **Cheap hygiene** — misplaced code, a lying docstring, a dead probe — worth fixing regardless of
   whether a second renderer is ever built.
3. **Speculative abstraction machinery** — a viewport API, capability tiers, identity-based
   selection, de-DOM'd models, a core style resolver + highlight store — whose only beneficiary is a
   DOM-less renderer that **does not exist and is not committed**.

Executing (3) now means shipping a (nominally) breaking change and a large mechanical refactor
against an **unvalidatable** success criterion (there is no second renderer to test the contract
against), with **no unit-test safety net** (`CLAUDE.md`: "There is no test framework configured" —
only the Playwright visual suite exists) — and it still would **not** meet the audit's own goal,
because its largest architectural blocker (clusters embed a nested `Graph`'s SVG —
[F18](./renderer-abstraction-audit.md)) is deferred with no work package. Compare the audit's §1.5
(the goal: "fully implementable by a DOM-less renderer") against §2.6 / F18 (why it isn't).

Categories (1) and (2) are low-risk, non-breaking, and valuable on their own. This PRD extracts
them so they can ship now.

**Decision**: land §2 now, in any order. Defer the abstraction machinery (§3) until a second
renderer is actually committed — and when it is, **spike the hardest unknown first** (non-DOM
cluster composition, or a minimal non-DOM node/edge renderer) and let *that* drive the contract,
using the audit as the checklist of known SVG-isms rather than a pre-committed refactor plan.

## 2. Address now

All items are non-breaking and independently landable. The `[Fn]` / `[§x]` tags link back to the
audit finding. Effort: S ≈ minutes–hour, M ≈ half-day.

### 2.1 Real bugs (user-visible)

| # | Location | Bug → Fix | Effort |
|---|---|---|---|
| **N1** | `GraphInteractions.ts:259` ([§3.6](./renderer-abstraction-audit.md)) | `edgeHoverOut` guards on `typeof callbacks.onNodeHoverOut === 'function'` but calls `onEdgeHoverOut` — so the **edge hover-out callback never fires unless the *node* one is also set**. Fix: guard on `onEdgeHoverOut`, mirroring `edgeHoverIn` at :252. *(Verified against source.)* | S |
| **N2** | `styles/_pivotick.scss:291-292` ([F14 incidental](./renderer-abstraction-audit.md)) | `.pvt-edge-highlighted > *` is an **empty rule** → `graph.highlightElement(edge)` is a **visual no-op even in SVG**. Fix: give edge-highlight a real style, mirroring the populated node rule at :283-289. **Scope**: SVG visual fix only — the core highlight *store* (F14 proper) stays deferred (§3). | S |
| **N3** | `renderers/svg/GraphSvgRenderer.ts:788-796` ([F15](./renderer-abstraction-audit.md)) | `focusElement` derives the target position from the SVG `transform.baseVal` matrix instead of `node.x/y`. Model positions are authoritative everywhere else; this can focus a stale/wrong spot and is undefined for notes. Fix: use model coordinates (also makes `focusElement(note)` honest). | S |

### 2.2 Cheap hygiene (non-breaking)

| # | Location | Cleanup | Effort |
|---|---|---|---|
| **N4** | `GraphInteractions.ts:92-96` ([F10](./renderer-abstraction-audit.md)) | Dead `element as HTMLElement` + `classList.contains('pvt-node-expanded')` probe with an empty body. Delete. | S |
| **N5** | `interfaces/RendererOptions.ts:189-192` vs `GraphRendererFactory.ts:51` ([F8](./renderer-abstraction-audit.md)) | `RendererType` docstring calls `'canvas'` "barely supported"; the factory throws `not implemented yet`. Fix the docstring to tell the truth (reserved / not implemented). | S |
| **N6** | `GraphRenderer.ts:46` ([§3.6](./renderer-abstraction-audit.md)) | Abstract `fitAndCenter(fitAndCenter?: number)` param is misnamed (the impl uses `forceScale`). Rename to `forceScale?`. Param-name only — **not** breaking (callers pass positionally). Note: the `getCanvas()` → `getHostElement()` rename from the same audit row stays with WP1 (§3). | S |

> Not included: the canvas `EdgeDrawer.ts:115,155-176` dangling `this.graphSvgRenderer` dead code
> ([§3.6](./renderer-abstraction-audit.md)). Considered and dropped — it lives under `@ts-nocheck`
> in a discarded experiment; touching it has ~zero value. Recorded here only so it isn't
> "rediscovered" as new.

### 2.3 Misplaced code (standalone-correct, larger)

Bigger than the above (S–M) and each worth its own PR, but still correct **today** regardless of
renderer #2 — they fix code that is in the wrong home now, with no public-API change.

- **N8 — MicroForce is SVG-renderer code stranded in `plugins/`** ([F24](./renderer-abstraction-audit.md)).
  `plugins/layout/MicroForce.ts` imports `d3-drag`/`d3-selection`, takes `Selection<SVGGElement, …>`
  params, sets `transform` attributes, and imports the SVG `EdgeDrawer`; its only importers are
  `renderers/svg/NodeDrawer.ts` and `renderers/svg/ClusterDrawer.ts`. Fix: split — pure force math
  stays in `plugins/`; the selection-driven runner + drag wiring moves into `renderers/svg/`.
  Effort: M.
- **N9 — Default style *values* live inside the SVG renderer and are re-exported as public API**
  ([F5](./renderer-abstraction-audit.md), value-relocation slice only).
  `defaultNodeStyle` / `defaultEdgeStyle` / `defaultLabelStyle` / `defaultMarkerStyleMap` are defined
  in `GraphSvgRenderer.ts:74-233` and re-exported from `docIndex.ts:19`; the canvas experiment kept
  **drifted** copies (`opacity 0.8` vs `1.0`, `minZoom 0.1` vs `0.05`) — proof the duplication
  already bit. Fix: move the constant *definitions* to `src/style/defaults.ts` and import them back.
  **Keep the exported symbol names identical** (audit §5: TypeDoc deep-links from `render.md` /
  `configuration.md` 404 otherwise). **Scope**: value relocation only — the core style *resolver*
  and `getNodeStyle` leaving the contract (the rest of F5) stay deferred (§3). Effort: S–M.

## 3. Deferred — gate: a committed second renderer

Do **not** start these until a second renderer is actually greenlit. They encode guesses about a
consumer that doesn't exist, carry the (nominal) breaking change, and can't be verified without the
very thing that motivates them. Full detail lives in the audit; listed here so the deferral is a
recorded decision, not an omission:

- **Contract surgery** — viewport API, `setContentVisible`, progress overlay → `UIManager`, drop
  `AbstractSelectionBox`, move escape hatches down, `getCanvas()` → `getHostElement()`
  ([WP1](./renderer-abstraction-audit.md) / F1–F4, F16).
- **Identity-based interactions** — kill the `TElement` generic, `Graph`-owned `interactions`,
  semantic zoom payload, editing→zoom veto ([WP2](./renderer-abstraction-audit.md) / F9, F11–F13, F21).
  *Calibration*: WP2's user-facing break is smaller than the audit implies —
  `GraphOptions.callbacks?: InterractionCallbacks` already resolves `element` to `unknown` today, so
  users already cast it. The real changes are internal plus the `NodeSelection`/`EdgeSelection` field
  drop; the "major-version driver" framing is overstated.
- **Style / visual-state hoist beyond N9** — core `resolveNodeStyle`/`resolveEdgeStyle`, highlight
  store, focus-dim derivation, spec'd CSS states ([WP3](./renderer-abstraction-audit.md) / F14, F29, F30).
- **De-DOM the models** — remove `getGraphElement` from `Node`/`Edge`/`Note`; drag construction into
  the SVG `EventHandler` ([WP4](./renderer-abstraction-audit.md) / F19, F20, F22).
- **Geometry APIs** — core hit-tester, `getElementScreenBBox`, Tooltip/ShadowLink anchors
  ([WP5](./renderer-abstraction-audit.md) / F17, F27).
- **NodePreview on the spec** ([WP6](./renderer-abstraction-audit.md) / F23) — depends on the style resolver.
- **Capability tiering** — `RendererCapabilities.perElementHtml` + spec-drawing fallback
  ([WP8](./renderer-abstraction-audit.md) / F7).
- **Clusters** — the real blocker; needs a composition model, not a refactor of the SVG impl
  ([§2.6](./renderer-abstraction-audit.md) / F18). This is the highest-information spike target when
  renderer #2 is greenlit.

## 4. Verification

No unit-test framework exists, so each item states how it is checked. Baseline for every item:
`npm run build` (tsc + bundles) and `npm run lint` stay green.

| # | Check |
|---|---|
| **N1** | Dev server; register only `onEdgeHoverOut` (no `onNodeHoverOut`), hover an edge, confirm it fires. Optionally add an interaction test asserting the callback runs. |
| **N2** | Call `graph.highlightElement(edge)`; confirm the edge is now visibly highlighted (was invisible before). Visual-suite screenshot. |
| **N3** | Move/settle a node, then `focusElement(node)`; confirm it centers on the node's model position, not its pre-move spot. Repeat for a note. |
| **N4–N6** | Type-check + lint + build; no runtime behavior to observe. |
| **N8** | Build + lint + **visual suite** — MicroForce drives micro/cluster layout, so screenshot parity before/after the move is the real check. |
| **N9** | Build; confirm resolved styles are byte-identical (values relocated, unchanged); confirm `docIndex.ts` export names unchanged so TypeDoc links hold; visual suite for default appearance. |
