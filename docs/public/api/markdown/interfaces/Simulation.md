[**pivotick v0.0.1**](../README.md)

***

[pivotick](../README.md) / Simulation

# Interface: Simulation

Defined in: [Simulation.ts:68](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Simulation.ts#L68)

## Methods

### changeLayout()

> **changeLayout**(`type`, `simulationOptions`): `Promise`\<`void`\>

Defined in: [Simulation.ts:569](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Simulation.ts#L569)

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

Defined in: [Simulation.ts:548](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Simulation.ts#L548)

#### Returns

[`SimulationForces`](../pivotick/namespaces/SimulationOptions/interfaces/SimulationForces.md)

***

### getSimulation()

> **getSimulation**(): `Simulation`\<[`Node`](../classes/Node.md), `undefined`\>

Defined in: [Simulation.ts:552](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Simulation.ts#L552)

#### Returns

`Simulation`\<[`Node`](../classes/Node.md), `undefined`\>

***

### isDragging()

> **isDragging**(): `boolean`

Defined in: [Simulation.ts:544](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Simulation.ts#L544)

#### Returns

`boolean`

***

### pause()

> **pause**(): `void`

Defined in: [Simulation.ts:272](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Simulation.ts#L272)

Pause the simulation

#### Returns

`void`

***

### reheat()

> **reheat**(`alpha`): `void`

Defined in: [Simulation.ts:478](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Simulation.ts#L478)

Restart the simulation with a bit of heat

#### Parameters

##### alpha

`number` = `0.7`

#### Returns

`void`

***

### restart()

> **restart**(): `void`

Defined in: [Simulation.ts:279](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Simulation.ts#L279)

Restart the simulation with rendering on each animation frame.

#### Returns

`void`

***

### start()

> **start**(): `Promise`\<`void`\>

Defined in: [Simulation.ts:287](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Simulation.ts#L287)

Start the simulation with rendering on each animation frame.

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `void`

Defined in: [Simulation.ts:307](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Simulation.ts#L307)

Manually stop the simulation and cancel animation frame.

#### Returns

`void`

***

### update()

> **update**(): `void`

Defined in: [Simulation.ts:223](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Simulation.ts#L223)

#### Returns

`void`

***

### waitForSimulationStop()

> **waitForSimulationStop**(): `Promise`\<`void`\>

Defined in: [Simulation.ts:367](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Simulation.ts#L367)

Returns a promise that resolves when the simulation stops naturally.
Useful for performing actions (like fitAndCenter) after stabilization.

#### Returns

`Promise`\<`void`\>
