# Node selection: ring instead of fill-recolouring

**Status:** done, on `worktree-selection-ring`. Cleared the 1.6 release gate.

## What changes

A selected node keeps its own `color` and gains a ring, the way a hovered node already does.
Today selection **replaces the shape's fill** with `--pvt-node-selected-color`, which is why a
selected node loses the colour that told you what it was.

## Why now

It is a precondition for a node whose whole body is an HTML card (`shape: 'none'`, see the
custom-HTML-node work). Selection and hover are both drawn by painting the shape element —
`.pvt-node-selected-highlight > .node` and `.pvt-node-highlighted > .node`
(`src/styles/_pivotick.scss:339,369`). A shapeless node has to carry an invisible backing
`rect.node` for either rule to land on, and:

- A **fill** on that rect sits *behind* the card, so on an opaque card only the `drop-shadow`
  bleeds around the edge. A **stroke** is painted centred on the rect's edge, so half of it
  clears the card whatever the card's background is.
- `drop-shadow` silhouettes painted alpha, so a transparent stroke-less rect casts nothing.
  One of fill/stroke has to be doing the work; the ring is the one that survives occlusion.
- The rect's `fill: transparent` then exists purely for hit-testing (`none` is not
  hit-testable), with nothing contending for it.

## The change is smaller than it looks

`glowPulseSelected` animates `stroke-width: 3 → 5 → 3` alongside the drop-shadow
(`src/styles/_animations.scss:1`), and an animated declaration beats a normal one — so
`--pvt-node-selected-stroke-width: 0` never takes effect. What actually hides the selection
stroke is **`--pvt-node-selected-stroke-opacity: 0`** (`_variables.scss:172`). So the core of
this is: stop zeroing that opacity, and drop the `fill` override from
`.pvt-node-selected-highlight > .node`.

Same trap in reverse: dark-mode `--pvt-node-highlighted-stroke-width: 0` (`_variables.scss:448`)
is moot for the same reason, which is why hover shows a ring in both themes. Don't "fix" it.

## How the loose ends were settled

- **Selected vs highlighted.** The colliding state is not canvas hover — `pvt-node-highlighted`
  is the explicit `highlightElement` API (a hovered table row, a note's `[[node]]` link, an
  edge-creation target). Its rule is later in `_pivotick.scss` and so won on source order, which
  would have made highlighting a selected node read as letting go of it. Selection now wins the
  shared rim via `.pvt-node-selected-highlight.pvt-node-highlighted > .node`.
- **Occlusion on a card: the outer half was accepted.** Growing the rect was tried and reverted.
  The backing rect is not only the ring's paint target — the badge rim and the pointer hit area
  are measured off the same box — so padding it pushed every badge 2.5px off its card and
  inflated the hit box. Two existing tests caught it. The outer half is the same half a shaped
  node shows outside its own rim.
- **Corner radius on a card: done**, read off `borderTopLeftRadius` (percentages resolved against
  the card's box, since an SVG `rx` percentage resolves against the viewport instead).
- **`NodePreview`'s strip selector: fixed.** It now strips the state classes from the clone's own
  `<g>` — selection, highlight and the focus-mode dimming — rather than querying for a child
  `circle` that never existed.
- **Baselines.** Only six moved: four in `selection.spec.ts`, `dark-node-selected` and
  `sidebar-node-selected`. Found by running the suite at `threshold: 0` with and without the
  change and diffing the per-snapshot pixel counts, because at the committed tolerances a single
  node is well under the 1% budget and a stale baseline stays green — so `--update-snapshots`
  would not have rewritten them. They were deleted and regenerated.

## What this turned up

**The committed baselines are broadly stale.** At `threshold: 0`, 85 of them differ on untouched
`develop` — most by an identical 50352 pixels, and the regenerated shots show why: they predate
the Physics rail mode (shipped 2026-08-18) and a node-colour change. The 0.2 per-pixel threshold
hides all of it. Not addressed here; worth a deliberate sweep of its own.

## Also stale before the merge

`CHANGELOG.md`'s **Filter Graph** wording — already reworded on `develop` to "nothing the panel's
own form applies ever clobbers it". Nothing left to do.
