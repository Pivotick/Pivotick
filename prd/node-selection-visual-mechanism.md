# Node selection: ring instead of fill-recolouring

**Status:** decided, not implemented. **Release gate: land before `develop` → `main` for 1.6.**

Accepts a full visual-baseline regeneration.

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

## Loose ends to settle while implementing

- **Selected vs hovered must stay distinguishable** once both are rings. They differ in colour
  today (lobster vs vibrant-blue) and in animation for a node that is both
  (`glowPulseBigSelected`); confirm that still reads.
- **Occlusion on a card.** The backing rect paints under the `foreignObject`, so the inner half
  of the ring is hidden. Either accept the outer half or grow the rect by half the max stroke.
  Do *not* move the rect above the card — a transparent fill on top swallows pointer events
  aimed at interactive card content.
- **Corner radius on a card.** A sharp ring around a `border-radius` card looks wrong and the
  library does not know the author's radius; mirror `getComputedStyle(root).borderRadius` onto
  the rect's `rx`.
- **`NodePreview`'s strip selector is already dead.** `SELECTION_HIGHLIGHT_SELECTOR =
  'circle.pvt-node-selected-highlight'` (`src/utils/NodePreview.ts:18`) matches nothing — the
  class goes on the `<g>` (`NodeDrawer.ts:652`), not a child circle — and it would not match a
  `rect.node` either. Without fixing it, previews of a selected card render with the ring.
- **Baselines.** Every screenshot with a selected node moves. Regenerate deliberately and eyeball
  the diffs: see the note that a 0.2 threshold hides colour-only changes.

## Also stale before the merge

`CHANGELOG.md`'s Unreleased section still says a push "composes with the filter panel … pressing
the panel's own **Filter Graph** never clobbers it". That button was removed in `b9825ac` (the
attribute form applies itself). Reword to "nothing the panel's form applies clobbers it".
