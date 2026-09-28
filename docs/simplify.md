---
outline: [2, 3]
---

# Simplify

Many graphs are mostly repetition. Two events share forty IPs, and each IP costs a node, a
label and two edges although what matters is "these two events share forty IPs". A hub has
dozens of leaves that link nowhere else. **Simplify** folds nodes that play the same role into
one **group**, drawn in their place:

```ts
const options = {
    render: {
        nodeTypeAccessor: (node) => node.getData().type,
    },
    UI: {
        simplify: {
            rules: [{ kind: 'neighbours', minSize: 5 }],
        },
    },
}
```

::: tip Groups are a view, not data
`graph.getNodes()`, `getEdges()`, the table, exports and the undo history see the real nodes.
A group is recomputed from them whenever the graph changes, and nothing about it is saved.
:::

See it running on the [Simplify the graph](/examples/gallery/graph-simplification/content)
card.

## Rules

`UI.simplify.rules` is an ordered list. Each rule gives some nodes a key, and nodes sharing a
key become one group, as long as there are at least `minSize` of them.

- Rules run **in order**, and each one sees the groups the rules above it made as ordinary
  nodes. A group can therefore be grouped again by a later rule.
- Rules run **after the node filters**, so a group only holds what passes them: hide three of
  forty IPs and the group reads 37. Edge layers don't change groups; switching one off only
  hides lines.
- A node with a note attached and an expanded cluster are **never grouped**. A closed cluster
  groups like any other node.
- A declared rule is on unless it says `enabled: false`.

Without `UI.simplify`, `full` mode offers the built-in rules switched off in the Simplify rail
mode; the other modes run nothing. `UI.simplify.enabled: false` removes the feature.

### The neighbour rule

```ts
{ kind: 'neighbours', minSize: 5, typeOf: (node) => node.getData().type }
```

It folds nodes of **one type** that link to **exactly the same nodes, the same way round**:
the same nodes pointing at them and the same nodes they point at. The leaves of a hub are the
simplest case. With events A and B sharing three TTPs and each having two of its own, you get
three groups: the shared three between A and B, and two on each side.

- The type is `render.nodeTypeAccessor`, or the rule's own `typeOf`. Nodes with no type group
  among themselves.
- A node linked to nothing is never grouped: a group needs something to hang off.
- A node that gains a link leaves its group for the one that matches its new neighbours. If
  that leaves fewer than `minSize`, the group dissolves.
- A group keeps its identity while it keeps most of its members, so a new node landing with the
  same neighbours joins the existing group without moving it.

### The chain rule

```ts
{ kind: 'chains', minSize: 5, typeOf: (node) => node.getData().type }
```

It folds chains that hang off one node. An event holding thirty files, each with its own hash,
is thirty chains `file > sha256`: the files share no neighbour, since each links its own hash,
so the neighbour rule leaves them alone. The chain rule folds them into one group of files
linked to one group of hashes, and draws the thirty links between them as one line.

- A node's **tail** is a node whose only link comes from it, followed downstream while each
  step links only along the chain. A node linked from two others, a branch or a cycle ends the
  chain there.
- Nodes that **lead chains of the same shape** fold together, when they share the same other
  links and type. Five isolated pairs `domain → ip` give one group of five domains linked to one
  group of five IPs.
- **Each level** of the chains folds too: under the group of their heads, or under a head of
  their own when it has no match.
- Links count **downstream only**: a node whose only link points at another isn't that node's
  tail.
- Placed after the neighbour rule, it folds what that rule left. A group the neighbour rule made
  can be a tail.

### Few links and the core

```ts
{ kind: 'degree', minDegree: 2 }
{ kind: 'kcore', k: 2 }
```

These rules take nodes off the canvas by how well linked they are, and fold them into the
nodes they hang from, so the count stays on the canvas:

- **Few links** (`degree`) folds nodes with fewer than `minDegree` links: at 2, a hub's leaves
  become one group on the hub.
- **Outside the core** (`kcore`) peels off nodes with fewer than `k` links, then does it again
  with what is left, until every node standing has `k` links among the others. At 2 it folds
  whole trees hanging off the graph, not only their leaves.

Folded nodes that touch the same nodes left standing share a group, whatever their types, and
a group may hold a single node: it reads "1 more" on its anchor. Folded nodes linked together
go into the same group, so a path hanging off a hub folds with the hub's leaves. A run of
folded nodes touching nothing left standing is a group of its own, and every node linked to
nothing shares one group. Both settings go from 1 to 10, and links count either way round.

After the neighbour rule, a group is one node to these rules: its links are its lines. A group
hanging alone off its anchor stays as it is.

### Communities

```ts
{ kind: 'communities', level: 4 }
```

For graphs too large for the rules above, Communities folds whole neighbourhoods: nodes more
densely linked to each other than to the rest of the graph become one group, whatever their
types. They are found with the Leiden algorithm, the same for the same graph every time.

- `level` goes from **1, fine**, many small communities, to **7, coarse**, a handful of large
  ones. In the Simplify mode it is a slider, applied when you let go.
- The communities are found **in a worker**, off the page, and only again when the graph's
  shape changes. Meanwhile the card reads *Grouping…* and the previous groups stay. Where no
  worker can start, a Content Security Policy blocking blob workers for instance, the same code
  runs on the page; `useWorker: false` asks for that.
- A community of one node stays a node, and annotated nodes stay out, as for every rule.
- Unlike the other built-in rules, Communities is only in the Simplify mode when declared.

### Pivot landings

```ts
{ kind: 'landings', minSize: 2 }
```

*Ingest in a group*, in the [pivot](./pivots.md) Review pane's footer, lands the selected rows
folded: one group per type, hanging off the node you pivoted on. Forty IPs arrive as
"40 × ip" instead of forty dots.

- A group holds what that ingest **added**. A node that was already on the canvas stays
  where it was.
- A member **stays** whatever it links to later, unlike the neighbour rule. Pull it out, delete
  it, or undo the ingest to take it out. Undo dissolves the group and redo brings it back.
- A type with fewer nodes than `minSize` (2 by default) lands as plain nodes.
- The rule runs first, so the rules after it see each landing as one node. You don't need to
  declare it: the first grouped landing adds it at the top of the Simplify mode, switched on.
  Declare it to put it somewhere else or change its smallest group.
- Which landings are grouped lasts for the session, like open groups.

To group a landing from code, flag the run before ingesting it:

```js
graph.simplify.groupLanding(graph.pivots.candidates('correlations').runId)
await graph.pivots.ingest('correlations')
```

### Custom rules

A rule of your own is a `partition(view)` returning a key per node:

```ts
{
    kind: 'custom',
    id: 'bySensor',
    label: 'By sensor',                      // its name in the Simplify mode
    description: 'Sightings reported by the same sensor.',
    minSize: 2,                              // the default for a custom rule
    partition: (view) => new Map(view.nodes
        .filter((node) => view.typeOf(node) === 'sighting')
        .map((node) => [node.id, node.getData().sensor])),
}
```

`view` is the graph as this rule sees it:

| Member | What it is |
|---|---|
| `nodes` | The nodes this rule may group: what passes the filters, with earlier rules' groups in place of their members. Annotated nodes, pulled-out nodes and expanded clusters are left out. |
| `inNeighbours(node)` / `outNeighbours(node)` | The drawn nodes with a line to, or from, this one. |
| `typeOf(node)` | The type the rule groups by. |
| `groupOf(node)` | The group behind a node, when it is one an earlier rule made. |

A node left out of the map stays itself, and ids that are not in `view.nodes` are ignored. A
rule that throws is switched off, its card in the Simplify mode says so, and the other rules
still run.

## The Simplify mode

The **Simplify** button on the rail opens one card per rule, in run order: a switch, its
setting and what the rule folded. The setting is a − / + stepper for the smallest group, the
fewest links or the core strength, and a slider for the Communities level. Rules declared by
the app carry an *app* tag. The summary at the top reads how many nodes are on the canvas
out of how many pass the filters, and the rail button counts the groups while any rule folds.

## Working with a group

A group is drawn as a node, and it acts for its members wherever that is unambiguous.

- **Open** it with a double-click, **Enter**, the sidebar or the context menu. Its members come
  back as ordinary nodes, inside a wash in the group's colour, and a light pull keeps them
  together. Drag the chip above them to move them all; its **×** folds them back. Its tooltip
  names the rule that made the group. Members come back where they sat; those with no free
  place of their own spread around the group, and live physics gets a gentle push, as for a
  cluster. `simulation.fitViewOnExpandCollapse` fits the view on open and close. A group
  with more members than `UI.simplify.openConfirmAbove` (100) asks first.
- **Select** it to see its members in the sidebar, in a sortable list. *Pull out* keeps one
  member out of the group until it is put back, from its context menu.
- **View in table**, in the sidebar or the context menu, lists the members in the data dock,
  where the column filters narrow them further. The chip over the table lists every node again.
- **Select members**, **Pivot** and **Delete** act on the members. Pivot and Delete go through
  the usual hooks, so `onBeforeDelete` sees the real nodes. Hide, Delete and Pivot on a
  selection that holds groups act on their members too.
- **Selecting a group** lights the nodes it links to, as selecting a node lights its
  neighbours. Editing and connect-to are not offered on a group: it has no data of its own.

Open groups and pulled-out nodes last for the session and are not undo steps. To restore
them, call `graph.simplify.open()` and `pullOut()`.

## Groups made by hand

Select two nodes or more, then **Group** in the sidebar's bulk bar or *Group selected nodes*
in a selected node's context menu. Type a title, or keep the one offered ("3 × ip, 2 × domain"),
and the selection folds into one group under that title.

- **A hand-made group wins.** Its rule, *By hand*, runs before every other, so a picked node
  leaves any rule group. A selected group gives its members, and a node picked into a second
  hand-made group leaves the first. Annotated nodes and open clusters stay out, and the
  prompt says how many.
- **It keeps its members** whatever they link to. One that is deleted or filtered out is not
  drawn; a group left with one member is not drawn at all, and comes back with its members.
- **Rename** and **Ungroup** it from its sidebar panel or its context menu. An empty title
  labels it by its types again. The bulk bar's **Ungroup** removes every hand-made group the
  selection holds or sits in.
- **Group, Rename and Ungroup are undo steps**, unlike opening or pulling out.
- It is view state: not exported, and gone on reload. To keep it, save `getManualGroups()`
  and hand it back to `setManualGroups()`.

```js
const id = graph.simplify.groupNodes(['ip-1', 'ip-2', 'dom-7'], 'Suspicious infra')
graph.simplify.renameGroup(id, 'Cleared infra')
graph.simplify.ungroup(id)
```

## Searching

Search looks through every node, the folded ones included.

- A match inside a group says so in its result row: *in 12 × ip*.
- Picking it opens the group and selects the node, as *Select members* would. A group with
  more members than `openConfirmAbove` stays closed and is selected instead.
- **Show all on the canvas**, the last row of the results or **Shift+Enter**, closes the
  search and lights every match; everything else fades. A group holding matches is lit too,
  and an arc in the theme colour over its ring shows their share. Its tooltip counts them:
  *2 of 12 match "198.51"*. **Esc**, a click on empty canvas or the next search ends it.

Hovering a legend entry marks groups the same way: a group holding nodes of that entry is lit,
with their share on its ring, so a group mixing types does not read as all of one.

An app with a search of its own can mark its matches the same way with
`graph.simplify.setMatches(nodes, query)`, and clear them with `setMatches([])`.

## The look

A group is a ring around a disc in its type's colour, with the count on the disc once there is
room for it and a label below. It grows with its count, up to a limit. A group mixing types
gets a neutral disc and a ring split by type.

The label is `12 × ip` by default. `typeLabel` names your types:

```ts
UI: {
    simplify: {
        typeLabel: (type, count) => `${count} ${count === 1 ? type : `${type}s`}`,
    },
}
```

`render.groupStyle(group)` returns a `NodeStyle` layered over the default, so `tiers`, `html`,
`shape` and badges work on a group as on a node. `render.groupOutline(group)` sets what the
chip over an open group says:

```ts
render: {
    groupStyle: (group) => group.rule === 'bySensor' ? { color: '#6b7280' } : undefined,
    groupOutline: (group) => `${group.members.length} from ${group.rule}`,
}
```

Each receives a `GroupInfo`:

| Field | What it is |
|---|---|
| `id` | Stable while the group keeps most of its members. |
| `rule` | `'neighbours'`, `'chains'`, `'degree'`, `'kcore'`, `'communities'`, or a custom rule's `id`. |
| `members` | The real nodes it stands for. |
| `typeCounts` | How many members of each type; `''` is no type. |
| `anchors` | The drawn nodes it links to, groups included. |
| `open` | Whether its members are back on the canvas. |
| `level` | The Communities level it was found at. |

The tooltip of a group names its rule, lists what it links to and, for a mixed group, its
members by type. `tooltip.renderGroupExtra(group, ctx)` adds your own lines, as
`renderNodeExtra` does for a node. A group skips `tooltip.render` and `renderNodeExtra`, which
are written for a node's data.

## In the table

The data dock lists the real nodes. A folded node reads `grouped` in the *Visibility* column,
and a *Group* column names its group while there are any. An edge whose line is drawn to a
group reads `grouped` too.

## At runtime

`graph.simplify` holds the rules and the groups:

| Method | What it does |
|---|---|
| `setRules(rules)` / `getRules()` | Replace the rules; read each one's state and what it folded. |
| `setRuleEnabled(id, on)` / `setRuleSetting(id, n)` | What the Simplify mode's switch and stepper do. `setRuleMinSize(id, n)` sets only a smallest group. |
| `getGroups()` / `groupOf(node)` | Every group, and the group a node is in. |
| `open(group)` / `close(group)` | Put a group's members on the canvas, or fold them back. |
| `pullOut(node)` / `putBack(node)` / `isPulledOut(node)` | Keep a node out of any group, or let it back. |
| `groupNodes(nodes, title?)` / `renameGroup(group, title)` / `ungroup(groups)` / `isManual(group)` | Make, retitle or remove [groups by hand](#groups-made-by-hand); each is an undo step. |
| `getManualGroups()` / `setManualGroups(list)` | Save the hand-made groups, and restore them. |
| `groupLanding(runId)` / `ungroupLanding(runId)` / `isLandingGrouped(runId)` | Fold what a pivot run adds into [landing groups](#pivot-landings), or draw it loose again. |
| `summary()` | How many nodes are drawn, pass the filters, and are folded. |
| `setMatches(nodes, query)` / `matchesIn(group)` | Mark a search's matches on the groups holding them; read how many a group holds. |
| `onChange(listener)` | Called after the grouping changes; returns its unsubscribe. |
