---
title: "Custom HTML node"
category: B
order: 3
aside: false
pageClass: gallery-wide
---

# Custom HTML node

When no combination of `shape`, `color`, `icon` and `text` will do, hand the renderer some
markup. `html` is an ordinary style channel, so a card resolves through the **same
precedence chain** as any other — which means a card is something you give to *one kind of
node*, not to the whole graph.

Every node below comes out of one `nodeStyleMap`:

| Node | Declared as | What you get |
|---|---|---|
| the three team cards | `shape: 'none'` + `html` | the card **is** the node — no shape behind it, and its measured box drives the layout and the edges |
| **On call** | `shape: 'circle'` + `html` | the disc is still drawn, and `size` is still the floor — a pill riding on a shape |
| `staging` · `prod` | no `html` | plain hexagons, from the same map |
| **Q3 freeze** | `shape: 'none'`, no `html` | a bare label: nothing drawn but the text, still draggable and selectable |
| **Operations** | the node's own `style.html` | one node overriding its type's card |
| **Engineering** | `render.renderNode` | a global callback that cards *only* this node and returns nothing for the rest |

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options" useInlineStyle="margin: 1em 0; height: 620px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

Four things worth provoking:

- **Click a card.** It highlights like any other node. A card-only node keeps an invisible
  box underneath precisely so the selected and hovered looks have something to land on —
  without one, a custom node had no selected state at all.
- **Drag the cards around.** The collision force is spacing the *real* card boxes, and
  edges stop at each card's border rather than on a circle drawn around it. Nothing about
  the layout had to be tuned for that.
- **Compare `Operations` to `On call`.** Both are `html`. Only one has a shape behind it,
  and that is the whole of what `shape: 'none'` does.
- **Look at `Operations`' markup.** Its root is `width: 100%` — the shape that used to
  collapse onto the placeholder box and clip. Cards are measured inside a shrink-to-fit
  box, so it resolves against its own content and there is nothing you have to do.

::: tip Trusted markup only
Whatever you return is inserted as-is, so these cards are built with `textContent` rather
than by interpolating node data into a markup string. See [Security](/security).
:::

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::

See [Rendering → HTML nodes](/render#html-nodes) for the full contract — when the card is
measured, what a card does *not* switch off, and carding only some nodes.
