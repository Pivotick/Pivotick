# Context Menu {#ui-contextmenu}
The [context menu options](docs/api/html/interfaces/GraphUI.ContextMenu.html) configure right-click menus for nodes, edges, and the canvas.

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

- `topbar` for quick actions (compact icons). Accept a [MenuQuickActionItemOptions](docs/api/html/types/GraphUI.MenuQuickActionItemOptions.html).
- `menu` for full menu actions. Accepts a [MenuActionItemOptions](docs/api/html/types/GraphUI.MenuActionItemOptions.html).

You can configure these menus for these scopes:
- `menuNode`
- `menuEdge`
- `menuCanvas`


::: code-group
<<< @/examples/configuration/ui-context-menu.js#options [Additional actions]

:::

### Options or action items

The interface for action items are defined [here](docs/api/html/types/GraphUI.MenuActionItemOptions.html).

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


<script setup>
    import { data as data, options as options } from './examples/configuration/ui-context-menu.js'
</script>


<Pivotick
    :data="data"
    :options="options"
></Pivotick>
