[**pivotick v0.0.0**](../README.md)

***

[pivotick](../README.md) / Simulation

# Interface: Simulation

Defined in: [Simulation.ts:68](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/Simulation.ts#L68)

## Methods

### changeLayout()

> **changeLayout**(`type`, `simulationOptions`): `Promise`\<`void`\>

Defined in: [Simulation.ts:555](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/Simulation.ts#L555)

Allows to change the layout of the graph

#### Parameters

##### type

[`LayoutType`](../pivotick/namespaces/LayoutOptions/type-aliases/LayoutType.md)

##### simulationOptions

[`DeepPartial`](../type-aliases/DeepPartial.md)\<[`SimulationOptions`](../pivotick/namespaces/SimulationOptions/interfaces/SimulationOptions.md)\> = `{}`

#### Returns

`Promise`\<`void`\>

#### Example

```ts
changeLayout('tree', {
    layout: {
         horizontal: false,
         rootIdAlgorithmFinder: 'FirstZeroInDegree'
    }
})
```

***

### getForceSimulation()

> **getForceSimulation**(): [`SimulationForces`](../pivotick/namespaces/SimulationOptions/interfaces/SimulationForces.md)

Defined in: [Simulation.ts:534](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/Simulation.ts#L534)

#### Returns

[`SimulationForces`](../pivotick/namespaces/SimulationOptions/interfaces/SimulationForces.md)

***

### getSimulation()

> **getSimulation**(): `Simulation`\<[`Node`](../classes/Node.md), `undefined`\>

Defined in: [Simulation.ts:538](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/Simulation.ts#L538)

#### Returns

`Simulation`\<[`Node`](../classes/Node.md), `undefined`\>

***

### isDragging()

> **isDragging**(): `boolean`

Defined in: [Simulation.ts:530](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/Simulation.ts#L530)

#### Returns

`boolean`

***

### pause()

> **pause**(): `void`

Defined in: [Simulation.ts:258](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/Simulation.ts#L258)

Pause the simulation

#### Returns

`void`

***

### reheat()

> **reheat**(`alpha`): `void`

Defined in: [Simulation.ts:464](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/Simulation.ts#L464)

Restart the simulation with a bit of heat

#### Parameters

##### alpha

`number` = `0.7`

#### Returns

`void`

***

### restart()

> **restart**(): `void`

Defined in: [Simulation.ts:265](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/Simulation.ts#L265)

Restart the simulation with rendering on each animation frame.

#### Returns

`void`

***

### start()

> **start**(): `Promise`\<`void`\>

Defined in: [Simulation.ts:273](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/Simulation.ts#L273)

Start the simulation with rendering on each animation frame.

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `void`

Defined in: [Simulation.ts:293](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/Simulation.ts#L293)

Manually stop the simulation and cancel animation frame.

#### Returns

`void`

***

### update()

> **update**(): `void`

Defined in: [Simulation.ts:209](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/Simulation.ts#L209)

#### Returns

`void`

***

### waitForSimulationStop()

> **waitForSimulationStop**(): `Promise`\<`void`\>

Defined in: [Simulation.ts:353](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/Simulation.ts#L353)

Returns a promise that resolves when the simulation stops naturally.
Useful for performing actions (like fitAndCenter) after stabilization.

#### Returns

`Promise`\<`void`\>
