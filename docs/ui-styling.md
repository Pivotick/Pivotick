---
outline: [2, 3]
---

# Styling UI

## CSS Classes

### Core UI Wrapper

- `.pivotick` – The main container for the pivotick UI.
  - `.pvt-canvas` – The area where the graph is rendered.
    - `.pvt-graphnavigation` – Navigation controls for the graph.
    - `.pvt-graphcontrols` – Graph-specific control buttons such as changing the layout.
    - `svg` – Inner canvas area (for [Render's type](./render#render-options) `SVG`).
  - `.pvt-sidebar` – Sidebar panel for graph selection details or additional tools.
  - `.pvt-toolbar` – Toolbar for actions related to filering and sorting.

- `.pvt-tooltip` – Tooltip container for nodes or edges.
- `.pvt-contextmenu` – Context menu container for right-click actions.

### Node Classes
- `.pvt-node` – Individual nodes in the graph.

### Edge Classes
- `.pvt-edge-group` – Group container for edges.
  - `path` – The SVG path representing the edge.
  - `.label-container` – Container for the edge label.



::: tip
These are the core classes you can override. To see all available classes, just open your browser's developer tools and inspect the element.
:::


## CSS Variables

Another easy way to style Pivotick is to override the default CSS variables. You can find them all [here](https://github.com/Pivotick/Pivotick/blob/main/src/styles/_variables.scss).

::: details View all variables
<<< @/../src/styles/_variables.scss [styles/_variables.scss]
:::


### Main Variables

::: code-group

<<< @/../src/styles/_variables.scss#core-variables [Theme and Background]
<<< @/../src/styles/_variables.scss#canvas [Canvas]
:::

### Node and Edge Variables

::: code-group

<<< @/../src/styles/_variables.scss#node [Node variables]

<<< @/../src/styles/_variables.scss#edge [Edge variables]

:::

### Example

```html
<style>
  :root {
    --pvt-node-color: #FDDA24;
    --pvt-node-stroke: #000000;
    --pvt-edge-stroke: #EF3340;
  }
</style>
```

<Pivotick
  :data="{
      nodes: [
          { id: 1, data: { label: 'A' } },
          { id: 2, data: { label: 'B' } }
      ],
      edges: [
          { from: 1, to: 2 }
      ]
  }"
  :options="{ UI: { mode: 'static' }}"
  :style="{
    '--pvt-node-color': '#FDDA24',
    '--pvt-node-stroke': '#000000',
    '--pvt-edge-stroke': '#EF3340',
  }"
></Pivotick>


## Theme

