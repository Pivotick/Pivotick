[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [SimulationOptions](../README.md) / SimulationCallbacks

# Interface: SimulationCallbacks

Defined in: [interfaces/SimulationOptions.ts:59](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/SimulationOptions.ts#L59)

## Properties

### onInit()?

> `optional` **onInit**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:63](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/SimulationOptions.ts#L63)

Called when the simulation initializes

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`

***

### onStart()?

> `optional` **onStart**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:67](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/SimulationOptions.ts#L67)

Called when the simulation starts

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`

***

### onStop()?

> `optional` **onStop**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:71](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/SimulationOptions.ts#L71)

Called when the simulation stops

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`

***

### onTick()?

> `optional` **onTick**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:75](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/SimulationOptions.ts#L75)

Called when the simulation ticks

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`
