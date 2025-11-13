[**pivotick v0.0.0**](../README.md)

***

[pivotick](../README.md) / Simulation

# Interface: Simulation

Defined in: [Simulation.ts:74](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L74)

## Methods

### applyScalledSimulationOptions()

> **applyScalledSimulationOptions**(): `void`

Defined in: [Simulation.ts:252](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L252)

#### Returns

`void`

***

### changeLayout()

> **changeLayout**(`type`, `simulationOptions`): `Promise`\<`void`\>

Defined in: [Simulation.ts:482](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L482)

#### Parameters

##### type

[`LayoutType`](../pivotick/namespaces/LayoutOptions/type-aliases/LayoutType.md)

##### simulationOptions

`DeepPartial`\<[`SimulationOptions`](../pivotick/namespaces/SimulationOptions/interfaces/SimulationOptions.md)\> = `{}`

#### Returns

`Promise`\<`void`\>

***

### getForceSimulation()

> **getForceSimulation**(): `simulationForces`

Defined in: [Simulation.ts:478](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L478)

#### Returns

`simulationForces`

***

### isDragging()

> **isDragging**(): `boolean`

Defined in: [Simulation.ts:474](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L474)

#### Returns

`boolean`

***

### pause()

> **pause**(): `void`

Defined in: [Simulation.ts:260](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L260)

Pause the simulation

#### Returns

`void`

***

### reheat()

> **reheat**(): `void`

Defined in: [Simulation.ts:408](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L408)

#### Returns

`void`

***

### restart()

> **restart**(): `void`

Defined in: [Simulation.ts:267](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L267)

Restart the simulation with rendering on each animation frame.

#### Returns

`void`

***

### scaleSimulationOptions()

> **scaleSimulationOptions**(): `void`

Defined in: [Simulation.ts:236](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L236)

#### Returns

`void`

***

### start()

> **start**(): `Promise`\<`void`\>

Defined in: [Simulation.ts:275](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L275)

Start the simulation with rendering on each animation frame.

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `void`

Defined in: [Simulation.ts:289](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L289)

Manually stop the simulation and cancel animation frame.

#### Returns

`void`

***

### update()

> **update**(): `void`

Defined in: [Simulation.ts:214](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L214)

#### Returns

`void`

***

### waitForSimulationStop()

> **waitForSimulationStop**(): `Promise`\<`void`\>

Defined in: [Simulation.ts:349](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Simulation.ts#L349)

Returns a promise that resolves when the simulation stops naturally.
Useful for performing actions (like fitAndCenter) after stabilization.

#### Returns

`Promise`\<`void`\>
