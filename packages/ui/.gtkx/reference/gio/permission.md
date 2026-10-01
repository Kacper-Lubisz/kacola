---
description: "A GPermission represents the status of the caller’s permission to perform a certain action."
---

# GPermission

A `GPermission` represents the status of the caller’s permission to
perform a certain action.

You can query if the action is currently allowed and if it is
possible to acquire the permission so that the action will be allowed
in the future.

There is also an API to actually acquire the permission and one to
release it.

As an example, a `GPermission` might represent the ability for the
user to write to a `Gio.Settings` object.  This `GPermission` object
could then be used to decide if it is appropriate to show a “Click here to
unlock” button in a dialog and to provide the mechanism to invoke
when that button is clicked.

```tsx
import { GPermission } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GPermission**

## Props

`ref` receives the `Gio.Permission` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `allowed`

`boolean` · default `false` · read-only, observe with `onNotifyAllowed`

`true` if the caller currently has permission to perform the action that
`permission` represents the permission to perform.

### `canAcquire`

`boolean` · default `false` · read-only, observe with `onNotifyCanAcquire`

`true` if it is generally possible to acquire the permission by calling
`g_permission_acquire()`.

### `canRelease`

`boolean` · default `false` · read-only, observe with `onNotifyCanRelease`

`true` if it is generally possible to release the permission by calling
`g_permission_release()`.

## Methods

Methods are called on the `Gio.Permission` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `acquire`

```ts
acquire(cancellable: Gio.Cancellable | null): boolean
```

Attempts to acquire the permission represented by `permission`.

The precise method by which this happens depends on the permission
and the underlying authentication mechanism.  A simple example is
that a dialog may appear asking the user to enter their password.

You should check with `g_permission_get_can_acquire()` before calling
this function.

If the permission is acquired then `true` is returned.  Otherwise,
`false` is returned and `error` is set appropriately.

This call is blocking, likely for a very long time (in the case that
user interaction is required).  See `g_permission_acquire_async()` for
the non-blocking version.

**Parameters**

- `cancellable`: a `GCancellable`, or `null`

**Returns** `true` if the permission was successfully acquired

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `acquireAsync`

```ts
acquireAsync(cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Attempts to acquire the permission represented by `permission`.

This is the first half of the asynchronous version of
`g_permission_acquire()`.

**Parameters**

- `cancellable`: a `GCancellable`, or `null`

**Returns** `true` if the permission was successfully acquired

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `acquireFinish`

```ts
acquireFinish(result: Gio.AsyncResult): boolean
```

Collects the result of attempting to acquire the permission
represented by `permission`.

This is the second half of the asynchronous version of
`g_permission_acquire()`.

**Parameters**

- `result`: the `GAsyncResult` given to the `GAsyncReadyCallback`

**Returns** `true` if the permission was successfully acquired

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `getAllowed`

```ts
getAllowed(): boolean
```

Gets the value of the 'allowed' property.  This property is `true` if
the caller currently has permission to perform the action that
`permission` represents the permission to perform.

**Returns** the value of the 'allowed' property

_Available since 2.26._

### `getCanAcquire`

```ts
getCanAcquire(): boolean
```

Gets the value of the 'can-acquire' property.  This property is `true`
if it is generally possible to acquire the permission by calling
`g_permission_acquire()`.

**Returns** the value of the 'can-acquire' property

_Available since 2.26._

### `getCanRelease`

```ts
getCanRelease(): boolean
```

Gets the value of the 'can-release' property.  This property is `true`
if it is generally possible to release the permission by calling
`g_permission_release()`.

**Returns** the value of the 'can-release' property

_Available since 2.26._

### `implUpdate`

```ts
implUpdate(allowed: boolean, canAcquire: boolean, canRelease: boolean): void
```

This function is called by the `GPermission` implementation to update
the properties of the permission.  You should never call this
function except from a `GPermission` implementation.

GObject notify signals are generated, as appropriate.

**Parameters**

- `allowed`: the new value for the 'allowed' property
- `canAcquire`: the new value for the 'can-acquire' property
- `canRelease`: the new value for the 'can-release' property

_Available since 2.26._

### `release`

```ts
release(cancellable: Gio.Cancellable | null): boolean
```

Attempts to release the permission represented by `permission`.

The precise method by which this happens depends on the permission
and the underlying authentication mechanism.  In most cases the
permission will be dropped immediately without further action.

You should check with `g_permission_get_can_release()` before calling
this function.

If the permission is released then `true` is returned.  Otherwise,
`false` is returned and `error` is set appropriately.

This call is blocking, likely for a very long time (in the case that
user interaction is required).  See `g_permission_release_async()` for
the non-blocking version.

**Parameters**

- `cancellable`: a `GCancellable`, or `null`

**Returns** `true` if the permission was successfully released

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `releaseAsync`

```ts
releaseAsync(cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Attempts to release the permission represented by `permission`.

This is the first half of the asynchronous version of
`g_permission_release()`.

**Parameters**

- `cancellable`: a `GCancellable`, or `null`

**Returns** `true` if the permission was successfully released

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `releaseFinish`

```ts
releaseFinish(result: Gio.AsyncResult): boolean
```

Collects the result of attempting to release the permission
represented by `permission`.

This is the second half of the asynchronous version of
`g_permission_release()`.

**Parameters**

- `result`: the `GAsyncResult` given to the `GAsyncReadyCallback`

**Returns** `true` if the permission was successfully released

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._
