---
description: "An abstract interface representing a password used in TLS."
---

# GTlsPassword

An abstract interface representing a password used in TLS. Often used in
user interaction such as unlocking a key storage token.

_Available since 2.30._

```tsx
import { GTlsPassword } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GTlsPassword**

## Props

`ref` receives the `Gio.TlsPassword` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `description`

`string` · default `null`

Description of what the password is for.

_Available since 2.30._

### `flags`

`Gio.TlsPasswordFlags` · default `G_TLS_PASSWORD_NONE`

Flags about the password.

_Available since 2.30._

### `warning`

`string` · default `null`

Warning about the password.

_Available since 2.30._

## Methods

Methods are called on the `Gio.TlsPassword` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getDescription`

```ts
getDescription(): string
```

Get a description string about what the password will be used for.

**Returns** The description of the password.

_Available since 2.30._

### `getFlags`

```ts
getFlags(): Gio.TlsPasswordFlags
```

Get flags about the password.

**Returns** The flags about the password.

_Available since 2.30._

### `getValue`

```ts
getValue(): Uint8Array
```

Get the password value. If `length` is not `null` then it will be
filled in with the length of the password value. (Note that the
password value is not nul-terminated, so you can only pass `null`
for `length` in contexts where you know the password will have a
certain fixed length.)

**Returns** The password value (owned by the password object).

_Available since 2.30._

### `getWarning`

```ts
getWarning(): string
```

Get a user readable translated warning. Usually this warning is a
representation of the password flags returned from
`g_tls_password_get_flags()`.

**Returns** The warning.

_Available since 2.30._

### `setDescription`

```ts
setDescription(description: string): void
```

Set a description string about what the password will be used for.

**Parameters**

- `description`: The description of the password

_Available since 2.30._

### `setFlags`

```ts
setFlags(flags: Gio.TlsPasswordFlags): void
```

Set flags about the password.

**Parameters**

- `flags`: The flags about the password

_Available since 2.30._

### `setValue`

```ts
setValue(value: Uint8Array | number[]): void
```

Set the value for this password. The `value` will be copied by the password
object.

Specify the `length`, for a non-nul-terminated password. Pass -1 as
`length` if using a nul-terminated password, and `length` will be
calculated automatically. (Note that the terminating nul is not
considered part of the password in this case.)

**Parameters**

- `value`: the new password value

_Available since 2.30._

### `setValueFull`

```ts
setValueFull(value: Uint8Array | number[], destroy: GLib.DestroyNotify | null): void
```

Provide the value for this password.

The `value` will be owned by the password object, and later freed using
the `destroy` function callback.

Specify the `length`, for a non-nul-terminated password. Pass -1 as
`length` if using a nul-terminated password, and `length` will be
calculated automatically. (Note that the terminating nul is not
considered part of the password in this case.)

**Parameters**

- `value`: the value for the password
- `destroy`: a function to use to free the password.

_Available since 2.30._

### `setWarning`

```ts
setWarning(warning: string): void
```

Set a user readable translated warning. Usually this warning is a
representation of the password flags returned from
`g_tls_password_get_flags()`.

**Parameters**

- `warning`: The user readable warning

_Available since 2.30._
