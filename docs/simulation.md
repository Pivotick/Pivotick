# Simulation Options

The Simulation options control the physics and layout behavior of nodes and edges for the graph simulation engine.

Check [D3-force official documentation](https://d3js.org/d3-force/simulation#forceSimulation) to learn more.

| Option              | Type                | Default             | Description                                                                          |
| ------------------- | ------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| `userWorker`        | boolean             | `true`              | Should the initial node placement calculation done by a web worker                   |
| `enabled`           | boolean             | `true`              | Should the simulation be running                                                     |
| `d3Alpha`           | number              | `1.0`               | Initial simulation alpha                                                             |
| `d3AlphaMin`        | number              | `0.001`             | Minimum alpha value before the simulation stops.                                     |
| `d3VelocityDecay`   | number              | `0.4`               | Friction applied to node velocities.                                                 |
| `d3LinkDistance`    | number              | `30`                | Default distance between connected nodes.                                            |
| `freezeNodesOnDrag` | boolean             | `true`              | Whether nodes are frozen once they are release from a drag operation.                |
| `callbacks`         | [SimulationCallbacks](docs/api/html/interfaces/SimulationOptions.SimulationCallbacks.html) | `undefined`         | Hooks for responding to simulation events. |

::: info
Other D3 force parameters like `d3AlphaDecay`, `d3ManyBodyStrength`, `d3CollideRadius` are available and [documented in the API reference](docs/api/html/interfaces/SimulationOptions.SimulationOptions.html).
:::

## Callbacks

- `onInit(sim: Simulation)`: Called when the simulation initializes.
- `onStart(sim: Simulation)`: Called when the simulation starts running.
- `onStop(sim: Simulation)`: Called when the simulation stops.
- `onTick(sim: Simulation)`: Called on each simulation tick.