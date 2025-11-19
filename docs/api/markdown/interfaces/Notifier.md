[**pivotick v0.0.0**](../README.md)

***

[pivotick](../README.md) / Notifier

# Interface: Notifier

Defined in: [ui/Notifier.ts:30](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/ui/Notifier.ts#L30)

Manages and displays notification messages in the graph UI.

Use this component to show success, warning, error, or info messages
to the user.

## Example

```ts
graph.notifier.warning('This is a warning', 'Content of the message goes here.')
```

## Methods

### error()

> **error**(`title`, `message?`): `void`

Defined in: [ui/Notifier.ts:59](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/ui/Notifier.ts#L59)

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

Defined in: [ui/Notifier.ts:63](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/ui/Notifier.ts#L63)

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

Defined in: [ui/Notifier.ts:46](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/ui/Notifier.ts#L46)

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

Defined in: [ui/Notifier.ts:51](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/ui/Notifier.ts#L51)

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

Defined in: [ui/Notifier.ts:55](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/ui/Notifier.ts#L55)

#### Parameters

##### title

`string`

##### message?

`string`

#### Returns

`void`
