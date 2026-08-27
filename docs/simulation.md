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

## Automatic layout tuning {#auto-physics}

By default Pivotick tunes the layout for you. Rather than applying one fixed bundle
of force settings to every graph, it derives them from what is actually on screen —
how many nodes there are, how big they are, and how large the canvas is — and
re-derives them whenever that changes. Four small nodes get room to breathe; forty
large ones get packed closer without touching.

This is the **Auto** preset, and it is on unless you say otherwise:

```ts
// Auto: no physics configured, so Pivotick tunes the layout as the graph changes.
new Pivotick(container, data)

// Manual: you set a physics option, so your value is kept and nothing re-tunes.
new Pivotick(container, data, { simulation: { d3LinkDistance: 200 } })

// Explicit, either way.
new Pivotick(container, data, { simulation: { physics: 'manual' } })
new Pivotick(container, data, { simulation: { physics: 'auto', d3LinkDistance: 200 } })
```

The rule is deliberately conservative: setting **any** option that Auto drives
(`d3LinkDistance`, `d3ManyBodyStrength`, `d3CollideRadiusMultiplier`,
`d3VelocityDecay`, `d3GravityStrength`, `d3GravityStrengthConnected`,
`d3AlphaDecay`, `cooldownTime`) turns Auto off for that graph, so an existing
configuration is never quietly taken over. `physics: 'auto'` alongside explicit
options is still legal — the explicit values seed the opening frame and Auto takes
over from there.

Auto only ever moves the same knobs the Physics flyout exposes, and the sliders
follow along as it re-tunes, so its decisions are visible rather than hidden.
Turning any knob yourself — a slider, a `set*` call, or the Tight/Loose presets —
takes it back for good; nothing will re-tune over your choice afterwards.

Two further notes:

- Auto is force-layout only. Under `tree` / `egoTree` it does nothing, because tree
  spacing is the layout's own business.
- Auto never restarts a simulation that is paused (or that the slow-tick watchdog
  switched off). It still works out the knobs; it just doesn't wake anything up.

::: tip
Pinning `physics: 'manual'` is the right call for screenshot tests and thumbnails,
where you want the same picture every time regardless of graph size.
:::

## Options

The Simulation options control the physics and layout behavior of nodes and edges for the graph simulation engine.

Check [D3-force official documentation](https://d3js.org/d3-force/simulation#forceSimulation) to learn more.

| Option              | Type                | Default             | Description                                                                          |
| ------------------- | ------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| `userWorker`        | boolean             | `true`              | Should the initial node placement calculation done by a web worker                   |
| `enabled`           | boolean             | `true`              | Should the simulation be running                                                     |
| `physics`           | `'auto' \| 'manual'` | `'auto'`†          | Who drives the force settings — see [Automatic layout tuning](#auto-physics).        |
| `d3Alpha`           | number              | `1.0`               | Initial simulation alpha                                                             |
| `d3AlphaMin`        | number              | `0.001`             | Minimum alpha value before the simulation stops.                                     |
| `d3VelocityDecay`   | number              | `0.4`               | Friction applied to node velocities.                                                 |
| `d3LinkDistance`    | number              | `30`                | Default distance between connected nodes.                                            |
| `freezeNodesOnDrag` | boolean             | `true`              | Whether nodes are frozen once they are release from a drag operation.                |
| `callbacks`         | [SimulationCallbacks](/api/html/interfaces/SimulationOptions.SimulationCallbacks.html) | `undefined`         | Hooks for responding to simulation events. |

† `'auto'` only for graphs that configure none of the options Auto drives; see
[Automatic layout tuning](#auto-physics).

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