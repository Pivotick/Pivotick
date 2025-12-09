[**pivotick v0.0.0**](../README.md)

***

[pivotick](../README.md) / DeepPartial

# Type Alias: DeepPartial\<T\>

> **DeepPartial**\<`T`\> = `{ [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] }`

Defined in: [utils/utils.ts:27](https://github.com/mokaddem/Pivotick/blob/89f1790aaeb5f0539811e3c09a6577d9f9258d15/src/utils/utils.ts#L27)

## Type Parameters

### T

`T`
