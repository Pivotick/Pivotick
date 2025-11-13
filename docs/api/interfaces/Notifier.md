[**pivotick v0.0.0**](../README.md)

***

[pivotick](../README.md) / Notifier

# Interface: Notifier

Defined in: [ui/Notifier.ts:19](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/ui/Notifier.ts#L19)

## Properties

### graph

> **graph**: [`Pivotick`](Pivotick.md)

Defined in: [ui/Notifier.ts:20](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/ui/Notifier.ts#L20)

## Methods

### error()

> **error**(`title`, `message?`): `void`

Defined in: [ui/Notifier.ts:48](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/ui/Notifier.ts#L48)

#### Parameters

##### title

`string`

##### message?

`string`

#### Returns

`void`

***

### info()

> **info**(`title`, `message?`): `void`

Defined in: [ui/Notifier.ts:52](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/ui/Notifier.ts#L52)

#### Parameters

##### title

`string`

##### message?

`string`

#### Returns

`void`

***

### notify()

> **notify**(`level`, `title`, `message?`): `void`

Defined in: [ui/Notifier.ts:35](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/ui/Notifier.ts#L35)

Dispatch a notification to the UIManager.

#### Parameters

##### level

`NotificationLevel`

The severity level of the notification.

##### title

`string`

The title to display in the notification.

##### message?

`string`

Optional detailed message for the notification.

#### Returns

`void`

***

### success()

> **success**(`title`, `message?`): `void`

Defined in: [ui/Notifier.ts:40](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/ui/Notifier.ts#L40)

#### Parameters

##### title

`string`

##### message?

`string`

#### Returns

`void`

***

### warning()

> **warning**(`title`, `message?`): `void`

Defined in: [ui/Notifier.ts:44](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/ui/Notifier.ts#L44)

#### Parameters

##### title

`string`

##### message?

`string`

#### Returns

`void`
