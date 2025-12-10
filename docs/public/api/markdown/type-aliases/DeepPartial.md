[**pivotick v0.0.0**](../README.md)

***

[pivotick](../README.md) / DeepPartial

# Type Alias: DeepPartial\<T\>

> **DeepPartial**\<`T`\> = `{ [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] }`

Defined in: [utils/utils.ts:27](https://github.com/mokaddem/Pivotick/blob/efd37e8952b64b4cfc6926802d22342685cc549b/src/utils/utils.ts#L27)

## Type Parameters

### T

`T`
