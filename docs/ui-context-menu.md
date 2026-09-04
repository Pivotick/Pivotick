# Context Menu {#ui-contextmenu}
The [context menu options](/api/html/interfaces/GraphUI.ContextMenu.html) configure right-click menus for nodes, edges, and the canvas.

**By default:**
- Context menus are enabled.
- Each menu (node, edge, canvas) have separate actions.
- Any additional custom actions are added after the default actions.

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
- `menuCanvas`

## Default actions

| Scope        | Default entries                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `menuNode`   | Pin / Unpin / Focus / Hide (topbar) · View Image · Select Neighbors · Hide Children · Connect to… · Inspect Properties · **Delete Node** |
| `menuEdge`   | **Edit Edge** · **Delete Edge**                                                                                  |
| `menuNote`   | Hide Note (topbar) · Remove Note                                                                                 |
| `menuCanvas` | Pin All / Unpin All (topbar) · **Add Node Here** · Add Note                                                       |

The write-path entries (delete, edit, create) go through their before-hooks — see
[Write-path lifecycle hooks](/callbacks#write-path-lifecycle-hooks) — and each disappears
when its `editors.<editor>.enabled` flag is `false`: **Delete** with `deletion`,
**Edit Edge** with `edgeEditor`, **Add Node Here** with `nodeCreator`, **Connect to…**
with `edgeCreator`. The same goes for entries that are a door into a switchable feature:
**Add Note** and the whole `menuNote` follow [`UI.notes`](/ui#turning-features-off),
**Inspect Properties** follows `UI.inspector`. Your own entries are never gated.
Both "…here" entries place their element where the **menu was opened**, whatever the
zoom or pan.


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
| `visible`     | `boolean \| (element: Node \| Edge \| null) => boolean`                                         | `true`       | Controls whether the item is visible. Can be dynamic. |
| `onclick`     | `(evt: PointerEvent \| MouseEvent, element?: Node \| Node[] \| Edge \| Edge[] \| null) => void` | **required** | Triggered when the user activates the menu item.      |

