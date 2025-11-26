[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [SimulationOptions](../README.md) / SimulationCallbacks

# Interface: SimulationCallbacks

Defined in: [interfaces/SimulationOptions.ts:61](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/SimulationOptions.ts#L61)

## Properties

### onInit()?

> `optional` **onInit**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:65](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/SimulationOptions.ts#L65)

Called when the simulation initializes

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`

***

### onStart()?

> `optional` **onStart**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:69](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/SimulationOptions.ts#L69)

Called when the simulation starts

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`

***

### onStop()?

> `optional` **onStop**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:73](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/SimulationOptions.ts#L73)

Called when the simulation stops

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`

***

### onTick()?

> `optional` **onTick**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:77](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/SimulationOptions.ts#L77)

Called when the simulation ticks

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`
