[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [SimulationOptions](../README.md) / SimulationCallbacks

# Interface: SimulationCallbacks

Defined in: [interfaces/SimulationOptions.ts:29](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/SimulationOptions.ts#L29)

## Properties

### onInit()?

> `optional` **onInit**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:33](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/SimulationOptions.ts#L33)

Called when the simulation initializes

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`

***

### onStart()?

> `optional` **onStart**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:37](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/SimulationOptions.ts#L37)

Called when the simulation starts

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`

***

### onStop()?

> `optional` **onStop**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:41](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/SimulationOptions.ts#L41)

Called when the simulation stops

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`

***

### onTick()?

> `optional` **onTick**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:45](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/SimulationOptions.ts#L45)

Called when the simulation ticks

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`
