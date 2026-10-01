---
description: "Abstract base class for D-Bus interfaces on the service side."
---

# GDBusInterfaceSkeleton

Abstract base class for D-Bus interfaces on the service side.

_Available since 2.30._

```tsx
import { GDBusInterfaceSkeleton } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GDBusInterfaceSkeleton**

Implements `GDBusInterface`.

## Props

`ref` receives the `Gio.DBusInterfaceSkeleton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `gFlags`

`Gio.DBusInterfaceSkeletonFlags` · default `G_DBUS_INTERFACE_SKELETON_FLAGS_NONE`

Flags from the `GDBusInterfaceSkeletonFlags` enumeration.

_Available since 2.30._

## Signals

### `onGAuthorizeMethod`

```ts
(invocation: Gio.DBusMethodInvocation, self: Gio.DBusInterfaceSkeleton) => boolean | undefined
```

Emitted when a method is invoked by a remote caller and used to
determine if the method call is authorized.

Note that this signal is emitted in a thread dedicated to
handling the method call so handlers are allowed to perform
blocking IO. This means that it is appropriate to call e.g.
[`polkit_authority_check_authorization_sync()`](http://hal.freedesktop.org/docs/polkit/PolkitAuthority.html#polkit-authority-check-authorization-sync)
with the
[POLKIT_CHECK_AUTHORIZATION_FLAGS_ALLOW_USER_INTERACTION](http://hal.freedesktop.org/docs/polkit/PolkitAuthority.html#POLKIT-CHECK-AUTHORIZATION-FLAGS-ALLOW-USER-INTERACTION:CAPS)
flag set.

If `false` is returned then no further handlers are run and the
signal handler must take a reference to `invocation` and finish
handling the call (e.g. return an error via
`g_dbus_method_invocation_return_error()`).

Otherwise, if `true` is returned, signal emission continues. If no
handlers return `false`, then the method is dispatched. If
`interface` has an enclosing `GDBusObjectSkeleton`, then the
`GDBusObjectSkeleton.authorize-method` signal handlers run before
the handlers for this signal.

The default class handler just returns `true`.

Please note that the common case is optimized: if no signals
handlers are connected and the default class handler isn't
overridden (for both `interface` and the enclosing
`GDBusObjectSkeleton`, if any) and `GDBusInterfaceSkeleton.gFlags` does
not have the
`G_DBUS_INTERFACE_SKELETON_FLAGS_HANDLE_METHOD_INVOCATIONS_IN_THREAD`
flags set, no dedicated thread is ever used and the call will be
handled in the same thread as the object that `interface` belongs
to was exported in.

**Parameters**

- `invocation`: A `GDBusMethodInvocation`.
- `self`: The instance the signal was emitted on.

**Returns** `true` if the call is authorized, `false` otherwise.

_Available since 2.30._

## Methods

Methods are called on the `Gio.DBusInterfaceSkeleton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `dBusInterfaceSkeletonGetInfo`

```ts
dBusInterfaceSkeletonGetInfo(): Gio.DBusInterfaceInfo
```

Gets D-Bus introspection information for the D-Bus interface
implemented by `interface_`.

**Returns** A `GDBusInterfaceInfo` (never `null`). Do not free.

_Available since 2.30._

### `export`

```ts
export(connection: Gio.DBusConnection, objectPath: string): boolean
```

Exports `interface_` at `object_path` on `connection`.

This can be called multiple times to export the same `interface_`
onto multiple connections however the `object_path` provided must be
the same for all connections.

Use `g_dbus_interface_skeleton_unexport()` to unexport the object.

**Parameters**

- `connection`: A `GDBusConnection` to export `interface_` on.
- `objectPath`: The path to export the interface at.

**Returns** `true` if the interface was exported on `connection`, otherwise `false` with
`error` set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `flush`

```ts
flush(): void
```

If `interface_` has outstanding changes, request for these changes to be
emitted immediately.

For example, an exported D-Bus interface may queue up property
changes and emit the
`org.freedesktop.DBus.Properties.PropertiesChanged`
signal later (e.g. in an idle handler). This technique is useful
for collapsing multiple property changes into one.

_Available since 2.30._

### `getConnection`

```ts
getConnection(): Gio.DBusConnection | null
```

Gets the first connection that `interface_` is exported on, if any.

**Returns** A `GDBusConnection` or `null` if `interface_` is
not exported anywhere. Do not free, the object belongs to `interface_`.

_Available since 2.30._

### `getConnections`

```ts
getConnections(): Gio.DBusConnection[]
```

Gets a list of the connections that `interface_` is exported on.

**Returns** A list of
  all the connections that `interface_` is exported on. The returned
  list should be freed with `g_list_free()` after each element has
  been freed with `g_object_unref()`.

_Available since 2.32._

### `getFlags`

```ts
getFlags(): Gio.DBusInterfaceSkeletonFlags
```

Gets the `GDBusInterfaceSkeletonFlags` that describes what the behavior
of `interface_`

**Returns** One or more flags from the `GDBusInterfaceSkeletonFlags` enumeration.

_Available since 2.30._

### `getObjectPath`

```ts
getObjectPath(): string | null
```

Gets the object path that `interface_` is exported on, if any.

**Returns** A string owned by `interface_` or `null` if `interface_` is not exported
anywhere. Do not free, the string belongs to `interface_`.

_Available since 2.30._

### `getProperties`

```ts
getProperties(): GLib.Variant
```

Gets all D-Bus properties for `interface_`.

**Returns** A `GVariant` of type
['a{sv}'](../glib/gvariant-text-format.html#dictionaries-and-dictionary-entries).
Free with `g_variant_unref()`.

_Available since 2.30._

### `getVtable`

```ts
getVtable(): Gio.DBusInterfaceVTable
```

Gets the interface vtable for the D-Bus interface implemented by
`interface_`. The returned function pointers should expect `interface_`
itself to be passed as `user_data`.

**Returns** the vtable of the D-Bus interface implemented by the skeleton

_Available since 2.30._

### `hasConnection`

```ts
hasConnection(connection: Gio.DBusConnection): boolean
```

Checks if `interface_` is exported on `connection`.

**Parameters**

- `connection`: A `GDBusConnection`.

**Returns** `true` if `interface_` is exported on `connection`, `false` otherwise.

_Available since 2.32._

### `setFlags`

```ts
setFlags(flags: Gio.DBusInterfaceSkeletonFlags): void
```

Sets flags describing what the behavior of `skeleton` should be.

**Parameters**

- `flags`: Flags from the `GDBusInterfaceSkeletonFlags` enumeration.

_Available since 2.30._

### `unexport`

```ts
unexport(): void
```

Stops exporting `interface_` on all connections it is exported on.

To unexport `interface_` from only a single connection, use
`g_dbus_interface_skeleton_unexport_from_connection()`

_Available since 2.30._

### `unexportFromConnection`

```ts
unexportFromConnection(connection: Gio.DBusConnection): void
```

Stops exporting `interface_` on `connection`.

To stop exporting on all connections the interface is exported on,
use `g_dbus_interface_skeleton_unexport()`.

**Parameters**

- `connection`: A `GDBusConnection`.

_Available since 2.32._
