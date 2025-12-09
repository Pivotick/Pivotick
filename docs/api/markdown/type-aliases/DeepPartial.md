[**pivotick v0.0.0**](../README.md)

***

[pivotick](../README.md) / DeepPartial

# Type Alias: DeepPartial\<T\>

> **DeepPartial**\<`T`\> = `{ [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] }`

Defined in: [utils/utils.ts:27](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/utils/utils.ts#L27)

## Type Parameters

### T

`T`
