# Simulation Options

In Pivotick, the physics simulation is partially managed for performance and stability. It includes:

- **Pre-computation**: the layout is simulated before the graph is rendered, stopping once it is nearly stable.
- **Timed execution**: the simulation automatically halts if it runs too long.
- **Start/stop control**: the engine prevents the simulation from running unnecessarily in the background.

Because of this controlled behavior, adding nodes after the simulation has finished will not automatically re-run the physics.
If you modify the graph dynamically, you'll need to manually "re-heat" the layout to trigger a new simulation pass.

```ts
const graph = new Pivotick(container, data)
// Add nodes
graph.simulation.reheat(0.7) // [!code focus]
```

## Options

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
| `callbacks`         | [SimulationCallbacks](/api/html/interfaces/SimulationOptions.SimulationCallbacks.html) | `undefined`         | Hooks for responding to simulation events. |

::: info
Other D3 force parameters like `d3AlphaDecay`, `d3ManyBodyStrength`, `d3CollideRadius` are available and [documented in the API reference](/api/html/interfaces/SimulationOptions.SimulationOptions.html).
:::

## Callbacks

- `onInit(sim: Simulation)`: Called when the simulation initializes.
- `onStart(sim: Simulation)`: Called when the simulation starts running.
- `onStop(sim: Simulation)`: Called when the simulation stops.
- `onTick(sim: Simulation)`: Called on each simulation tick.


## API

Pivotick exposes a simulation controller that lets you interact directly with the physics engine.
All methods are [available online](/api/html/interfaces/Simulation.html)

### Stop / Start
```ts
pause(): void;
reheat(alpha?: number): void;
restart(): void;
start(): Promise<void>;
stop(): void;
```

### Changing layout
::: code-group

```ts [changeLayout method]
changeLayout(
    type: LayoutType,
    simulationOptions?: DeepPartial<SimulationOptions.SimulationOptions>,
): Promise<void>;
```

```ts [Change layour to a tree]
graph.simulation.changeLayout('tree', {
    layout: {
         horizontal: false,
         rootIdAlgorithmFinder: 'FirstZeroInDegree'
    }
})
```

:::


### Stabilization callback

::: code-group

```ts [waitForSimulationStop method]
waitForSimulationStop(): Promise<void>;

```

```ts [Change layour to a tree]
graph.simulation.reheat(0.7)
// Wait until the simulation stops
await graph.simulation.waitForSimulationStop()
graph.renderer.fitAndCenter()
```

:::