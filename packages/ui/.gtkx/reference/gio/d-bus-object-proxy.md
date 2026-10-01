---
description: "A GDBusObjectProxy is an object used to represent a remote object with one or more D-Bus interfaces."
---

# GDBusObjectProxy

A `GDBusObjectProxy` is an object used to represent a remote object
with one or more D-Bus interfaces. Normally, you don’t instantiate
a `GDBusObjectProxy` yourself — typically `Gio.DBusObjectManagerClient`
is used to obtain it.

_Available since 2.30._

```tsx
import { GDBusObjectProxy } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GDBusObjectProxy**

Implements `GDBusObject`.

## Props

`ref` receives the `Gio.DBusObjectProxy` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `gConnection`

`Gio.DBusConnection` · construct-only

The connection of the proxy.

_Available since 2.30._

### `gObjectPath`

`string` · default `null` · construct-only

The object path of the proxy.

_Available since 2.30._

## Signals

### `onInterfaceAdded`

```ts
(interface_: Gio.DBusInterface, self: Gio.DBusObjectProxy) => void
```

From `GDBusObject`.

Emitted when `interface` is added to `object`.

**Parameters**

- `interface_`: The `GDBusInterface` that was added.
- `self`: The instance the signal was emitted on.

_Available since 2.30._

### `onInterfaceRemoved`

```ts
(interface_: Gio.DBusInterface, self: Gio.DBusObjectProxy) => void
```

From `GDBusObject`.

Emitted when `interface` is removed from `object`.

**Parameters**

- `interface_`: The `GDBusInterface` that was removed.
- `self`: The instance the signal was emitted on.

_Available since 2.30._

## Methods

Methods are called on the `Gio.DBusObjectProxy` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getConnection`

```ts
getConnection(): Gio.DBusConnection
```

Gets the connection that `proxy` is for.

**Returns** A `GDBusConnection`. Do not free, the
  object is owned by `proxy`.

_Available since 2.30._
