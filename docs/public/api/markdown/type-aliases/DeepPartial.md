[**pivotick v0.0.1**](../README.md)

***

[pivotick](../README.md) / DeepPartial

# Type Alias: DeepPartial\<T\>

> **DeepPartial**\<`T`\> = `{ [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] }`

Defined in: [utils/utils.ts:27](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/utils/utils.ts#L27)

## Type Parameters

### T

`T`
