---
description: "A GDBusObjectSkeleton instance is essentially a group of D-Bus interfaces."
---

# GDBusObjectSkeleton

A `GDBusObjectSkeleton` instance is essentially a group of D-Bus
interfaces. The set of exported interfaces on the object may be
dynamic and change at runtime.

This type is intended to be used with `Gio.DBusObjectManager`.

_Available since 2.30._

```tsx
import { GDBusObjectSkeleton } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GDBusObjectSkeleton**

Implements `GDBusObject`.

## Props

`ref` receives the `Gio.DBusObjectSkeleton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `gObjectPath`

`string` · default `null`

The object path where the object is exported.

_Available since 2.30._

## Signals

### `onAuthorizeMethod`

```ts
(interface_: Gio.DBusInterfaceSkeleton, invocation: Gio.DBusMethodInvocation, self: Gio.DBusObjectSkeleton) => boolean | undefined
```

Emitted when a method is invoked by a remote caller and used to
determine if the method call is authorized.

This signal is like `GDBusInterfaceSkeleton`'s
`GDBusInterfaceSkeleton.g-authorize-method` signal,
except that it is for the enclosing object.

The default class handler just returns `true`.

**Parameters**

- `interface_`: The `GDBusInterfaceSkeleton` that `invocation` is for.
- `invocation`: A `GDBusMethodInvocation`.
- `self`: The instance the signal was emitted on.

**Returns** `true` if the call is authorized, `false` otherwise.

_Available since 2.30._

### `onInterfaceAdded`

```ts
(interface_: Gio.DBusInterface, self: Gio.DBusObjectSkeleton) => void
```

From `GDBusObject`.

Emitted when `interface` is added to `object`.

**Parameters**

- `interface_`: The `GDBusInterface` that was added.
- `self`: The instance the signal was emitted on.

_Available since 2.30._

### `onInterfaceRemoved`

```ts
(interface_: Gio.DBusInterface, self: Gio.DBusObjectSkeleton) => void
```

From `GDBusObject`.

Emitted when `interface` is removed from `object`.

**Parameters**

- `interface_`: The `GDBusInterface` that was removed.
- `self`: The instance the signal was emitted on.

_Available since 2.30._

## Methods

Methods are called on the `Gio.DBusObjectSkeleton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `addInterface`

```ts
addInterface(interface_: Gio.DBusInterfaceSkeleton): void
```

Adds `interface_` to `object`.

If `object` already contains a `GDBusInterfaceSkeleton` with the same
interface name, it is removed before `interface_` is added.

Note that `object` takes its own reference on `interface_` and holds
it until removed.

**Parameters**

- `interface_`: A `GDBusInterfaceSkeleton`.

_Available since 2.30._

### `flush`

```ts
flush(): void
```

This method simply calls `g_dbus_interface_skeleton_flush()` on all
interfaces belonging to `object`. See that method for when flushing
is useful.

_Available since 2.30._

### `removeInterface`

```ts
removeInterface(interface_: Gio.DBusInterfaceSkeleton): void
```

Removes `interface_` from `object`.

**Parameters**

- `interface_`: A `GDBusInterfaceSkeleton`.

_Available since 2.30._

### `removeInterfaceByName`

```ts
removeInterfaceByName(interfaceName: string): void
```

Removes the `GDBusInterface` with `interface_name` from `object`.

If no D-Bus interface of the given interface exists, this function
does nothing.

**Parameters**

- `interfaceName`: A D-Bus interface name.

_Available since 2.30._

### `setObjectPath`

```ts
setObjectPath(objectPath: string): void
```

Sets the object path for `object`.

**Parameters**

- `objectPath`: A valid D-Bus object path.

_Available since 2.30._
