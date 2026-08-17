---
outline: [2, 3]
---

# Callbacks

Pivotick allows you to hook into user interactions and simulation events through the [`callbacks`](/api/html/interfaces/InterractionCallbacks.InterractionCallbacks.html) option.
You can provide functions for various events on the canvas, nodes, and edges.

## Canvas Callbacks

| Callback              | Parameters              | Description                                 |
| --------------------- | ----------------------- | ------------------------------------------- |
| `onCanvasClick`       | `(event: PointerEvent)` | Fired when the canvas is clicked.           |
| `onCanvasContextmenu` | `(event: PointerEvent)` | Fired on canvas right-click.                |
| `onCanvasMousemove`   | `(event: MouseEvent)`   | Fired when the mouse moves over the canvas. |
| `onCanvasZoom`        | `(event: unknown)`      | Fired when the canvas zoom level changes.   |


## Node Callbacks

| Callback            | Parameters                                             | Description                                       |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| `onNodeClick`       | `(event: PointerEvent, node: Node, element: TElement)` | Fired when a node is clicked.                     |
| `onNodeDbclick`     | `(event: PointerEvent, node: Node, element: TElement)` | Fired when a node is double-clicked.              |
| `onNodeContextmenu` | `(event: PointerEvent, node: Node, element: TElement)` | Fired on node right-click.                        |
| `onNodeHoverIn`     | `(event: PointerEvent, node: Node, element: TElement)` | Fired when the mouse enters a node.               |
| `onNodeHoverOut`    | `(event: PointerEvent, node: Node, element: TElement)` | Fired when the mouse leaves a node.               |
| `onNodeSelect`      | `(node: Node, element: TElement)`                      | Fired when a node becomes selected.               |
| `onNodeBlur`        | `(node: Node, element: TElement)`                      | Fired when a node loses focus/selection.          |
| `onNodeDragging`    | `(event: MouseEvent, node: Node)`                      | Fired continuously while a node is being dragged. |
| `onNodeExpansion`   | `(event: PointerEvent, edge: Edge, element: TElement)` | Fired when a node is expanded or collapsed.       |


## Edge Callbacks

| Callback            | Parameters                                             | Description                               |
| ------------------- | ------------------------------------------------------ | ----------------------------------------- |
| `onEdgeClick`       | `(event: PointerEvent, edge: Edge, element: TElement)` | Fired when an edge is clicked.            |
| `onEdgeDbclick`     | `(event: PointerEvent, edge: Edge, element: TElement)` | Fired when an edge is double-clicked.     |
| `onEdgeContextmenu` | `(event: PointerEvent, edge: Edge, element: TElement)` | Fired on edge right-click.                |
| `onEdgeHoverIn`     | `(event: PointerEvent, edge: Edge, element: TElement)` | Fired when the mouse enters an edge.      |
| `onEdgeHoverOut`    | `(event: PointerEvent, edge: Edge, element: TElement)` | Fired when the mouse leaves an edge.      |
| `onEdgeSelect`      | `(edge: Edge, element: TElement)`                      | Fired when an edge becomes selected.      |
| `onEdgeBlur`        | `(edge: Edge, element: TElement)`                      | Fired when an edge loses focus/selection. |


## Write-path lifecycle hooks

Every mutation a user can perform goes through a **before-hook**: the library proposes,
your code decides — asynchronously, and the decision may fail. Absent a hook the
behaviour is unchanged, and **programmatic** mutation (`graph.addNode()`,
`graph.removeNode()`, `graph.removeEdge()`) never invokes them, so your own code driving
the model is not gated by your own hook.

| Callback                 | Fired when                                                              | Return                                                                       |
| ------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `onBeforeDelete`         | The user asks to delete nodes / edges / notes, before anything is removed | `false` to veto, `true` to delete the request, `{ accept, nodes, edges, notes }` to narrow it |
| `onBeforeNodeCreate`     | The user creates a node (Create ▸ Add node, canvas ▸ Add Node Here)      | `false` to veto, or `{ accept, id, data, style }`                            |
| `onBeforeEdgeCreate`     | A connect gesture resolved a target, before the edge exists              | `false` to veto, or `{ accept, data, style, id, directed }`                   |
| `isValidConnection`      | Live, on every hover while connecting (must be sync + cheap)             | `false` marks the target invalid — the before-create hook is not consulted    |
| `onBeforeNodeEditCommit` | A node edit is committed                                                | `false` refuses the commit, leaving the node's data untouched                  |
| `onBeforeEdgeEditCommit` | An edge edit is committed                                                | `false` refuses the commit, leaving the edge's data untouched                  |

An accepted edit commit announces itself on the data bus — `nodeChange` / `edgeChange`,
with `previousData` and `nextData` — and repaints straight away; a refused one changes
nothing at all.

Their UI counterparts — `onNodeEdit` / `onEdgeEdit` (return the modal body) and
`onNodeEditCancel` / `onEdgeEditCancel` — let you replace the editor rather than gate it.
Short of that, `editors.nodeEditor.fields` / `editors.edgeEditor.fields` declare the
form the default modal builds (a relationship dropdown instead of a free-text field,
say); without them, one text field per data key is inferred. A custom body owns the
draft — mutate `session.draft` as the user types, since there is no form to read on
submit.

### Deleting

`onBeforeDelete` receives the **whole consequence** of the gesture, resolved by the
library: the elements the user named, plus `cascadingEdges` — the edges that removing
those nodes would destroy (`graph.removeNode` cascades). The two never overlap, so each
can be persisted exactly once.

Narrowing is per kind: a supplied array replaces that kind's requested set, an omitted
key leaves it as requested (so `{ accept: true }` matches `true`, and
`{ accept: true, nodes: [] }` deletes no nodes). A veto removes nothing, fires no
`nodeRemove` / `edgeRemove` / `noteRemove`, and leaves the selection intact.

```js
callbacks: {
    onBeforeDelete: async ({ nodes, edges, cascadingEdges, origin, confirm }) => {
        if (!await confirm({
            title: 'Delete from event?',
            body: `${nodes.length} element(s) and ${edges.length + cascadingEdges.length} link(s).`,
        })) return false

        const saved = await deleteServerSide(nodes, [...edges, ...cascadingEdges])
        // Keep exactly what the server actually deleted.
        return { accept: true, nodes: nodes.filter((n) => saved.has(n.id)) }
    },
}
```

`ctx.confirm(options)` opens the library's confirmation modal, resolving `false` on every
cancel path. `ctx.origin` says which affordance asked (`'bulk-action'` or
`'context-menu'`).

### Removing the affordance instead

A veto is the wrong answer when an operation is *never* allowed — for an integration
whose ACL check is known before the graph is built, drop the affordance. Each
`editors.<editor>.enabled` flag (on unless explicitly `false`) removes its buttons and
menu entries:

| Flag                             | Removes                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `editors.deletion.enabled`       | The sidebar bulk **Delete**, and the node / edge / note delete entries |
| `editors.nodeCreator.enabled`    | **Create ▸ Add node** and the canvas menu's **Add Node Here**       |
| `editors.nodeEditor.enabled`     | **Create ▸ Edit node**                                              |
| `editors.edgeEditor.enabled`     | The edge menu's **Edit Edge**                                       |

See the [Persist deletes, edits & creates](/examples/gallery/persist-writes/content)
gallery card for all three hooks against a stand-in backend.

## Simulation Callbacks

| Callback               | Parameters | Description                                                    |
| ---------------------- | ---------- | -------------------------------------------------------------- |
| `onSimulationTick`     | `()`       | Fired every simulation tick.                                   |
| `onSimulationSlowTick` | `()`       | Fired occasionally during simulation (every tenth of simulationTick). |


::: info
The `element` type is `svg` only if the option `render.type == "svg"`.
:::

#### Example

<<< @/examples/configuration/callbacks.js

