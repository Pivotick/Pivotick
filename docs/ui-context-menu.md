# Context Menu {#ui-contextmenu}
The [context menu options](/api/html/interfaces/GraphUI.ContextMenu.html) configure right-click menus for nodes, edges, and the canvas.

**By default:**
- Context menus are enabled.
- Each menu (node, edge, canvas) have separate actions.
- Any additional custom actions are added after the default actions, above the delete.

## Disabling tooltips
Pretty straightforward by setting the `enabled` property to `false`.

```ts [Disable context menu]
const options = {
    UI: {
        contextMenu: {
            enabled: false
        }
    }
}
```

## Additional actions

You can customize the actions that appear when right-clicking a node, an edge, or the canvas.

Each context menu is split into two sections:

- `topbar` for quick actions (compact icons). Accept a [MenuQuickActionItemOptions](/api/html/types/GraphUI.MenuQuickActionItemOptions.html).
- `menu` for full menu actions. Accepts a [MenuActionItemOptions](/api/html/types/GraphUI.MenuActionItemOptions.html).

You can configure these menus for these scopes:
- `menuNode`
- `menuEdge`
- `menuNote`
- `menuSelection`
- `menuCanvas`

## Default actions

| Scope        | Default entries                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `menuNode`   | Pin / Unpin / Focus / Hide (topbar) · Pivot · Pull out of group · Put back in group · View Image · Select Neighbors · Hide Children · Connect to… · Inspect Properties · **Delete Node** |
| `menuEdge`   | **Edit Edge** · **Delete Edge**                                                                                  |
| `menuNote`   | Hide Note (topbar) · Remove Note                                                                                 |
| `menuSelection` | Pin / Unpin / Hide Selected (topbar) · Pivot · Group selected nodes · Pull out of group · Put back in group · Ungroup · Select Neighbors · **Delete Selected** |
| `menuCanvas` | Pin All / Unpin All (topbar) · **Add Node Here** · Add Note · Release pinned nodes (while any node is pinned) |

The node, selection and group menus read in the same order: **Pivot ▸** first, then the
[group](/simplify#working-with-a-group) entries that apply, then the other entries with
yours after them, and the delete last. A group's menu (Pivot · Open group · Select members ·
View members in table · Rename group · Ungroup · Select Neighbors · **Delete members**) is the
library's own and takes no entries of yours. An entry that doesn't apply is left out without
moving the others.

The write-path entries (delete, edit, create) go through their before-hooks — see
[Write-path lifecycle hooks](/callbacks#write-path-lifecycle-hooks) — and each disappears
when its `editors.<editor>.enabled` flag is `false`: **Delete** with `deletion`,
**Edit Edge** with `edgeEditor`, **Add Node Here** with `nodeCreator`, **Connect to…**
with `edgeCreator`. The same goes for entries that are a door into a switchable feature:
**Add Note** and the whole `menuNote` follow [`UI.notes`](/ui#turning-features-off),
**Inspect Properties** follows `UI.inspector`. Your own entries are never gated.
Both "…here" entries place their element where the **menu was opened**, whatever the
zoom or pan.

## Acting on a selection {#selection}

Right-clicking a node that is part of a selection of several nodes opens `menuSelection`,
headed with how many nodes it acts on. Every entry acts on the whole selection, as the
sidebar's bulk actions do, and the entries that only make sense for one node (Inspect,
Connect to…, View Image) are left out. Right-clicking a node outside the selection opens
that node's own menu and leaves the selection as it is, and the canvas keeps its own menu.
Entries of `menuSelection` receive the selected nodes as a `Node[]`, in `visible` as in
`onclick`.

A row of the [data table](/ui-table#selecting) opens the same menu as its element on the
canvas.

**Del** hides the selected nodes. It hides rather than deletes because a hide costs
nothing to undo; **Delete Selected** is in the menu.


::: code-group
<<< @/examples/configuration/ui-context-menu.js#options [Additional actions]

:::


<script setup>
    import { data as data, options as options } from './examples/configuration/ui-context-menu.js'
</script>


<Pivotick
    :data="data"
    :options="options"
></Pivotick>


### Options or action items

The interface for action items are defined [here](/api/html/types/GraphUI.MenuActionItemOptions.html).

| Option        | Type                                                                                            | Default      | Description                                           |
| ------------- | ----------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------- |
| `iconClass`   | `IconClass`                                                                                     | `undefined`  | CSS class used as an icon. Typically used in icon libraries such as fontawesome. Example: `fa-solid fa-edit` |
| `iconUnicode` | `IconUnicode`                                                                                   | `undefined`  | Unicode character used as an icon. Raw unicode to be used in icon libraries such as fontawesome. Example: ``\uf007` |
| `imagePath`   | `ImagePath`                                                                                     | `undefined`  | Path to an image used as an icon.                     |
| `svgIcon`     | `SVGIcon`                                                                                       | `undefined`  | Inline SVG object used as an icon. Example: `<svg>...</svg>` |
| `text`        | `string`                                                                                        | **required**  | The action’s label shown in menus and toolbars.       |
| `title`       | `string`                                                                                        | `undefined` | Optional text label displayed next to the item.       |
| `variant`     | `UIVariant`                                                                                     | `outline-primary` | Visual variant (style) of the menu item.              |
| `visible`     | `boolean \| (element: Node \| Node[] \| Edge \| null) => boolean`                               | `true`       | Controls whether the item is visible. Can be dynamic. |
| `onclick`     | `(evt: PointerEvent \| MouseEvent, element?: Node \| Node[] \| Edge \| Edge[] \| null) => void` | **required** | Triggered when the user activates the menu item.      |

