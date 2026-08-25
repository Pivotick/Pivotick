---
title: "Persist deletes, edits & creates"
category: G
order: 5
aside: false
pageClass: gallery-wide
---

# Persist deletes, edits & creates

When the graph is a *view of persisted records*, no write can be optimistic. Three
before-hooks make every user-initiated write a proposal the consumer decides on, so
the canvas and the database can never disagree:

- **`onBeforeDelete`** — fires for every delete affordance (the sidebar's bulk row, the
  node / edge / note context-menu entries) once the whole target set is resolved,
  including `cascadingEdges`: the relationships that removing a node would destroy.
  Return `false` to veto, or `{ accept: true, nodes, edges }` to keep only what the
  server actually deleted. `ctx.confirm()` is the built-in confirmation modal.
- **`onBeforeNodeCreate`** — fires for **Create ▸ Add node** and the canvas menu's
  **Add Node Here**, with the graph-space `position` and a `promptData()` form. What
  you return is what enters the graph.
- **`onBeforeEdgeEditCommit`** — fires when an edge edit is committed (right-click an
  edge ▸ **Edit Edge**). Refuse it and the edge keeps its data.

All three may be async, and a second gesture is ignored while one is pending.
Programmatic `graph.removeNode()` / `addNode()` are never gated, so your own code
isn't blocked by your own hook.

Try it: select nodes and hit **Delete** in the sidebar (the *published* record comes
back refused), right-click an edge to change its relationship, or use **Create ▸ Add
node**. Set `editors.deletion.enabled: false` to remove the delete affordances
altogether instead of vetoing every click.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded" useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
