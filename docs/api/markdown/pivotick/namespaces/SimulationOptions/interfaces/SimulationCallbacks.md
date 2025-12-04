[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [SimulationOptions](../README.md) / SimulationCallbacks

# Interface: SimulationCallbacks

Defined in: [interfaces/SimulationOptions.ts:61](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/SimulationOptions.ts#L61)

## Properties

### onInit()?

> `optional` **onInit**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:65](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/SimulationOptions.ts#L65)

Called when the simulation initializes

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`

***

### onStart()?

> `optional` **onStart**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:69](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/SimulationOptions.ts#L69)

Called when the simulation starts

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`

***

### onStop()?

> `optional` **onStop**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:73](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/SimulationOptions.ts#L73)

Called when the simulation stops

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`

***

### onTick()?

> `optional` **onTick**: (`simulation`) => `void`

Defined in: [interfaces/SimulationOptions.ts:77](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/interfaces/SimulationOptions.ts#L77)

Called when the simulation ticks

#### Parameters

##### simulation

[`Simulation`](../../../../interfaces/Simulation.md)

#### Returns

`void`
