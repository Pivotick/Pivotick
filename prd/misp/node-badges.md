# Enhancement — a node decoration channel (badges) independent of fill, stroke and icon

**Status:** Grilled 2026-08-25 — decisions settled, implemented on `worktree-node-badges` (branched from `worktree-edge-layers`).
**Owner:** Sami Mokaddem
**Requested:** 2026-08-24
**Area:** `src/interfaces/RendererOptions.ts` (`NodeStyle`), `src/interfaces/InterractionCallbacks.ts`, `src/GraphInteractions.ts`, `src/renderers/svg/NodeDrawer.ts`, `src/Node.ts` (`toSimulationDTO`)
**Type:** Rendering / public options
**Related:** [`multi-facet-legend.md`](multi-facet-legend.md), [`edge-layers.md`](edge-layers.md)

---

## 0. Instructions

Relentlessly ask me questions whenever you have a doubt on the implementation.

## 1. What we're trying to achieve

Let a consumer attach small, countable indicators to a node **without spending an encoding it already uses for something else**.

## 2. What professional tools do

- **KeyLines / ReGraph** call these **glyphs**: badges pinned to a node's rim, carrying a count or icon, explicitly separate from node colour, size and icon.
- **Cytoscape.js** approximates with layered background images and pie slices.

The reason it is a distinct channel everywhere: fill and size are almost always already spent on *type* and *importance*, so any third fact has nowhere to go.

## 3. Gap in Pivotick today

Every `NodeStyle` channel is already committed in a real consumer. In the MISP pivot explorer (`event_pivot_explorer.ctp:355-400`):

| Channel | Already carries |
|---|---|
| `color`, `shape`, `size` (via `nodeStyleMap`) | node kind — event / object / attribute |
| `iconClass` | the misp-iconify glyph for the attribute or object type |
| `imagePath`, `imageFit` | attachment thumbnails (and `strokeColor` again for the frame) |
| `strokeColor`, `strokeWidth` (via `styleCb`) | pending-reference state — the unsaved orange ring |

Nothing is left for "3 notes, disputed". `html` does **not** replace the node — the shape is always drawn and `html` is a `foreignObject.node-content` layered on it — but it sits in an `else if` chain with `iconClass` / `svgIcon` / `imagePath`, so a node cannot have an icon *and* custom markup, and the foreignObject clips to its `size * 2` box so nothing can reach the rim from inside it.

## 4. Proposal

1. **`NodeStyle.badges?: ((node: Node) => NodeBadge[]) | NodeBadge[]`**

   ```ts
   export interface NodeBadge {
       position?: 'ne' | 'nw' | 'se' | 'sw'   // omitted => auto-filled, see §6.2
       color?: string                         // themed default
       text?: string                          // a count, or 1-2 chars
       iconClass?: IconClass
       iconUnicode?: IconUnicode
       svgIcon?: SVGIcon
       title?: string                         // native tooltip, real <title>
       onClick?: (event: PointerEvent, node: Node, badge: NodeBadge) => void
   }
   ```

2. **Rendered in its own `.pvt-node-badges` sibling group**, with its own branch in `NodeDrawer.handleChildrenExpanded` so it follows the node to the NW rim when a cluster expands.
3. **Scales with the node, clamped**, capped by the free corners with an overflow `+n` badge.
4. **Interactive**: a real `<title>`, a per-badge `onClick`, and a global `onBadgeClick` / `badgeClick` pair.

## 5. What the consumer does

```ts
defaultNodeStyle: {
    badges: node => {
        const a = node.getData()?.annotations
        if (!a) return []
        return [
            a.notes    ? { text: String(a.notes), color: '#6fbe80', title: `${a.notes} notes`,
                           onClick: () => openNotes(node) } : null,
            a.disputed ? { iconClass: 'fa fa-exclamation', color: '#b94a48', title: 'Disputed' } : null,
        ].filter(Boolean)
    },
}
```

## 6. Decisions (grilled 2026-08-25)

Sixteen settled before implementation. Three PRD claims were checked against the code and did
not survive; they are corrected in §3 and §4 above and noted below where relevant.

1. **Branch.** `worktree-node-badges` off `worktree-edge-layers`, not `develop` — the MISP stack.
   The `async-children` worktree was removed as not-done; its branch is kept because its
   commit is the only copy of that PRD's grilled decisions (`prd/` is untracked in `develop`).

2. **Placement: per-badge corner with auto-fill.** `position` stays optional. Unpositioned
   badges take free corners clockwise from NE, skipping any claimed by another badge or by the
   expand affordance. An **explicit** `position` is honoured verbatim, even if it overlaps.

3. **Corner reservation.** `.node-icon` sits NE when collapsed and SE when expanded, so it
   sweeps *both* East corners over a node's lifetime. On any node where
   `enableNodeExpansion && hasChildren()`, both are reserved — expanded or not — so badges never
   re-flow on expand. Capacity is **4 on a leaf, 2 on an expandable node**.

4. **Own group, rigid corners.** `.pvt-node-badges`, not `.node-content` — that class is a
   semantic marker `utils/NodePreview.ts` and two specs select on. The PRD's original rationale
   was inverted: `handleChildrenExpanded` *applies* the NW shift to `.node-content`, so a plain
   sibling would have been left stranded at the cluster centre. Badges get their own branch
   there, and keep their corner rather than steering the way a label does.

5. **Anchor to `getCircleRadius()` in a rAF**, as `addExpandCollapseIcons` already does, **plus
   a re-anchor at the three late-radius sites**: the `imageFit: 'frame'` image probe, the custom
   shape measure, and the `renderNode` measure loop. Without it a badge on a framed square image
   sits ~30% too far in, over the picture. The same helper fixes the **pre-existing** detachment
   of the expand `+` icon on framed images.

6. **Shape-aware rim geometry.** The existing `(r + padding) / √2` is the 45° point on the
   *circumscribed* circle, correct only for circles: on a 20×20 square it lands 36% inside the
   corner, and on a 60×40 frame it falls outside the shape vertically. Badges use the bbox corner
   for rect-ish shapes and the 45° rim point for round ones. **The expand icon is aligned to the
   same geometry** — its size stays at 8.

7. **Badges render on `render.renderNode` nodes too**, anchored to the measured foreignObject
   box. The expand affordance already renders there, and a custom-node consumer has spent the
   whole node. Consequence: `getNodeStyle()` starts being called on that path, so a consumer's
   `styleCb` now runs for custom nodes.

8. **Replace, not concatenate.** `badges` resolves with `??` like every other channel — narrowest
   wins outright. `badges: []` is distinguishable from `undefined` and is the supported way to say
   "this node wears none". Per-badge fields are plain values, not resolvers; the outer function
   already receives the node.

9. **Overflow is `+n` in the last free corner**, silent — no warning, matching `NodeDrawer`'s own
   precedent for dropped `imagePath` values ("this runs per node per render, so a log would
   flood"). Its `title` lists the hidden badges. It takes a neutral themed fill and is inert.

10. **Badges are hit-testable.** §4.4's "not interactive" and "`title` surfaces as a native
    tooltip" were mutually exclusive — `pointer-events: none` kills native tooltips. Node
    handlers are bound on the `g.pvt-node` group with `mouseenter`/`mouseleave` (which do not
    re-fire for descendants) plus bubbling `click`/`pointerdown`, so hit-testable badges break
    neither node click, drag, hover, nor the graph tooltip.

11. **Click, built now — not reserved.** Per-badge `onClick`, plus a global
    `InterractionCallbacks.onBadgeClick(event, node, badge, element)` and a bus `badgeClick`,
    dispatched from one `GraphInteractions.badgeClick()` in the established shape: emit with a
    cancellable `GraphInteractionContext`, stop if cancelled, then the per-badge handler, then the
    global one. No suppression protocol between the two. `cursor: pointer` and `stopPropagation`
    apply only when a handler is declared, so an inert badge is never a dead zone.

12. **Badges describe their own node only.** No aggregation on collapse. A consumer wanting a
    collapsed parent to sum its children walks the public `node.children` field in three lines.
    Generic aggregation has no defensible policy (counts sum, flags don't; colours conflict;
    grandchildren?) and would need a new invalidation path — repaint a parent when any hidden
    descendant changes.

13. **No legend integration, no minimap.** `LegendSectionView` already accepts declared `entries`
    carrying their own `predicate` with no section `key`, so a consumer can key *and filter* on
    badges today with zero library change. A derived section is impossible anyway: badges are
    anonymous, with no id to group by. The minimap paints bare `context.arc` / `fillRect` with no
    style resolution at all — it stays deliberately shape-only.

14. **Named `NodeBadge`**, key stays `badges`. `ui/components/Badge.ts` already exports
    `createBadge(options: BadgeOptions)`, a DOM chip whose fields (`iconClass`, `svgIcon`,
    `imagePath`, `text`) nearly match. Matches the existing `NodeStyle` / `NodeShape` / `NodeData`
    prefix convention.

15. **Size and content.** Radius `clamp(6, 0.45 × nodeRadius, 14)` — the expand `+` is fixed at 8
    and sits inside that band. `text` wins over an icon when both are given. Text beyond 2
    characters grows the badge into a pill, capped at 3, then `99+`. Default colour is a themed
    variable.

16. **Node styles stop carrying functions into `postMessage`.** `Node.toSimulationDTO()` ships
    `style` verbatim, so any per-node style holding a function plus `simulation.useWorker` throws
    `DataCloneError` — reachable today via `styleCb`, `html` or a function-valued `color`. No force
    reads `node.style`. Functions are stripped from the DTO, **in its own commit**, since the bug
    predates badges.

## 7. Acceptance criteria

- `badges` accepts an array or a per-node function; `undefined` renders no group at all and costs nothing.
- Badges sit on the node's rim at the requested corner for every shape, scale within the clamp, and stay attached through drag, zoom, cluster expand/collapse, the NW-rim shift and the framed-image probe.
- Node click, drag, hover and the expand affordance behave identically with and without badges; an inert badge passes its click through to the node.
- A badge declaring `onClick` fires it, then the global `onBadgeClick`, and does not select the node; a bus listener may `cancel()` both.
- Exceeding the free corners collapses to `+n`, whose `title` names what is hidden.
- `title` surfaces as a native tooltip and does not suppress the graph tooltip for the node.
- A graph declaring no badges renders byte-identically to today, except for square and image nodes, whose expand `+` moves to the corrected geometry (§6.6) — those baselines are re-shot deliberately.
- Tests: placement, attachment, resolution, overflow and interaction — numeric harness readers rather than screenshots, since the suite's 0.2 pixel threshold hides colour-only change.
- Docs: a `## Node badges` section in `docs/render.md` and a `node-badges` gallery card. `docs/public/api` is left to CI.
