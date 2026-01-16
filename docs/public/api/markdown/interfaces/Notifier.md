[**pivotick v0.0.1**](../README.md)

***

[pivotick](../README.md) / Notifier

# Interface: Notifier

Defined in: [ui/Notifier.ts:31](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/ui/Notifier.ts#L31)

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

Defined in: [ui/Notifier.ts:60](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/ui/Notifier.ts#L60)

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

Defined in: [ui/Notifier.ts:64](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/ui/Notifier.ts#L64)

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

Defined in: [ui/Notifier.ts:47](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/ui/Notifier.ts#L47)

Dispatch a notification to the UIManager.

#### Parameters

##### level

[`NotificationLevel`](../type-aliases/NotificationLevel.md)

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

Defined in: [ui/Notifier.ts:52](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/ui/Notifier.ts#L52)

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

Defined in: [ui/Notifier.ts:56](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/ui/Notifier.ts#L56)

#### Parameters

##### title

`string`

##### message?

`string`

#### Returns

`void`
