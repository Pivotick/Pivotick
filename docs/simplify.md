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

The **Simplify** button on the rail opens one card per rule, in run order: a switch, the
smallest group (a − / + stepper) and what the rule folded. Rules declared by the app carry an
*app* tag. The summary at the top reads how many nodes are on the canvas out of how many pass
the filters, and the rail button counts the groups while any rule folds.

## Working with a group

A group is drawn as a node, and it acts for its members wherever that is unambiguous.

- **Open** it with a double-click, **Enter**, the sidebar or the context menu. Its members come
  back as ordinary nodes, inside a wash in the group's colour, and a light pull keeps them
  together. The chip above them folds them back. A group with more members than
  `UI.simplify.openConfirmAbove` (100) asks first.
- **Select** it to see its members in the sidebar, in a sortable list. *Pull out* keeps one
  member out of the group until it is put back, from its context menu.
- **Select members**, **Pivot** and **Delete** act on the members. Pivot and Delete go through
  the usual hooks, so `onBeforeDelete` sees the real nodes. Hide, Delete and Pivot on a
  selection that holds groups act on their members too.
- **Selecting a group** lights the nodes it links to, as selecting a node lights its
  neighbours. Editing and connect-to are not offered on a group: it has no data of its own.

Open groups and pulled-out nodes last for the session and are not undo steps. To restore
them, call `graph.simplify.open()` and `pullOut()`.

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
    groupOutline: (group) => `Fold ${group.members.length} back`,
}
```

Each receives a `GroupInfo`:

| Field | What it is |
|---|---|
| `id` | Stable while the group keeps most of its members. |
| `rule` | `'neighbours'`, `'chains'`, or a custom rule's `id`. |
| `members` | The real nodes it stands for. |
| `typeCounts` | How many members of each type; `''` is no type. |
| `anchors` | The drawn nodes it links to, groups included. |
| `open` | Whether its members are back on the canvas. |

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
| `setRuleEnabled(id, on)` / `setRuleMinSize(id, n)` | What the Simplify mode's switch and stepper do. |
| `getGroups()` / `groupOf(node)` | Every group, and the group a node is in. |
| `open(group)` / `close(group)` | Put a group's members on the canvas, or fold them back. |
| `pullOut(node)` / `putBack(node)` / `isPulledOut(node)` | Keep a node out of any group, or let it back. |
| `summary()` | How many nodes are drawn, pass the filters, and are folded. |
| `onChange(listener)` | Called after the grouping changes; returns its unsubscribe. |
