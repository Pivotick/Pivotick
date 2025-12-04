
# Selection Menu {#ui-selectionmenu}
The [selection menu options](docs/api/html/interfaces/GraphUI.SelectionMenu.html) configure the menu shown when elements are selected.

**By default:**
- Selection menu is enabled.
- Any additional custom actions are added after the default actions.

## Usage

- <kbd>`<Shift>`</kbd> + <kbd>`Click`</kbd> — Add to selection  
- <kbd>`<Alt>`</kbd> + <kbd>`Click`</kbd> — Start a new selection  
- <kbd>`<Ctrl>`</kbd> + <kbd>`Click`</kbd> — Remove from selection

Try it out!

<script setup>
    const data = {
        nodes: [
            { "id": "n1", },
            { "id": "n2", },
            { "id": "n3", },
            { "id": "n4", },
            { "id": "n5", },
            { "id": "n6", },
        ],
        edges: [
            { "from": "n3", "to": "n5", },
            { "from": "n1", "to": "n6", },
            { "from": "n3", "to": "n2", },
            { "from": "n1", "to": "n3", },
            { "from": "n3", "to": "n4", },
            { "from": "n4", "to": "n1", },
        ]
    }
</script>


<Pivotick
    :data="data"
    :options="{
        simulation: {
            d3ManyBodyStrength: -500,
        },
        UI: {
            mode: 'light',
            tooltip: {
                enabled: false,
            },
            contextMenu: {
                enabled: false,
            },
        },
        render: {
            zoomAnimation: false
        },
    }"
    :onLoadedCallback="(graph) => {
        graph.renderer.zoomOut()
        graph.renderer.zoomOut()
    }"
></Pivotick>

## Disabling the selection menu
Pretty straightforward by setting the `enabled` property to `false`.

```ts [Disable context menu]
const options = {
    UI: {
        selectionMenu: {
            enabled: false
        }
    }
}
```

## Additional actions

You can configure additional actions to be displayed when multiple nodes are selected.

The interface for action items are defined [here](docs/api/html/types/GraphUI.MenuActionItemOptions.html).

```ts [Additional actions]
const options = {
    UI: {
        selectionMenu: {
            menuNode: {
                topbar: [
                    {
                        text: 'Delete Node',
                        variant: 'danger',
                        onclick: (evt) => console.log('Delete')
                    }
                ],
                menu: [
                    {
                        text: 'Log Nodes',
                        variant: 'primary',
                        onclick: (evt) => console.log('Log')
                    }
                ]
            }
        }
    }
}
```
