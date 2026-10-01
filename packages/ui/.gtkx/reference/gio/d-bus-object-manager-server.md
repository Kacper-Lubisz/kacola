---
description: "GDBusObjectManagerServer is used to export Gio.DBusObject instances using the standardized org.freedesktop.DBus.ObjectManager interface."
---

# GDBusObjectManagerServer

`GDBusObjectManagerServer` is used to export `Gio.DBusObject` instances
using the standardized
[`org.freedesktop.DBus.ObjectManager`](http://dbus.freedesktop.org/doc/dbus-specification.html#standard-interfaces-objectmanager)
interface. For example, remote D-Bus clients can get all objects
and properties in a single call. Additionally, any change in the
object hierarchy is broadcast using signals. This means that D-Bus
clients can keep caches up to date by only listening to D-Bus
signals.

The recommended path to export an object manager at is the path form of the
well-known name of a D-Bus service, or below. For example, if a D-Bus service
is available at the well-known name `net.example.ExampleService1`, the object
manager should typically be exported at `/net/example/ExampleService1`, or
below (to allow for multiple object managers in a service).

It is supported, but not recommended, to export an object manager at the root
path, `/`.

See `Gio.DBusObjectManagerClient` for the client-side code that is
intended to be used with `GDBusObjectManagerServer` or any D-Bus
object implementing the `org.freedesktop.DBus.ObjectManager` interface.

_Available since 2.30._

```tsx
import { GDBusObjectManagerServer } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GDBusObjectManagerServer**

Implements `GDBusObjectManager`.

## Props

`ref` receives the `Gio.DBusObjectManagerServer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `connection`

`Gio.DBusConnection | ReactElement`

The `GDBusConnection` to export objects on.

_Available since 2.30._

### `objectPath`

`string` · default `null` · construct-only

The object path to register the manager object at.

_Available since 2.30._

## Signals

### `onInterfaceAdded`

```ts
(object: Gio.DBusObject, interface_: Gio.DBusInterface, self: Gio.DBusObjectManagerServer) => void
```

From `GDBusObjectManager`.

Emitted when `interface` is added to `object`.

This signal exists purely as a convenience to avoid having to
connect signals to all objects managed by `manager`.

**Parameters**

- `object`: The `GDBusObject` on which an interface was added.
- `interface_`: The `GDBusInterface` that was added.
- `self`: The instance the signal was emitted on.

_Available since 2.30._

### `onInterfaceRemoved`

```ts
(object: Gio.DBusObject, interface_: Gio.DBusInterface, self: Gio.DBusObjectManagerServer) => void
```

From `GDBusObjectManager`.

Emitted when `interface` has been removed from `object`.

This signal exists purely as a convenience to avoid having to
connect signals to all objects managed by `manager`.

**Parameters**

- `object`: The `GDBusObject` on which an interface was removed.
- `interface_`: The `GDBusInterface` that was removed.
- `self`: The instance the signal was emitted on.

_Available since 2.30._

### `onObjectAdded`

```ts
(object: Gio.DBusObject, self: Gio.DBusObjectManagerServer) => void
```

From `GDBusObjectManager`.

Emitted when `object` is added to `manager`.

**Parameters**

- `object`: The `GDBusObject` that was added.
- `self`: The instance the signal was emitted on.

_Available since 2.30._

### `onObjectRemoved`

```ts
(object: Gio.DBusObject, self: Gio.DBusObjectManagerServer) => void
```

From `GDBusObjectManager`.

Emitted when `object` is removed from `manager`.

**Parameters**

- `object`: The `GDBusObject` that was removed.
- `self`: The instance the signal was emitted on.

_Available since 2.30._

## Methods

Methods are called on the `Gio.DBusObjectManagerServer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `export`

```ts
export(object: Gio.DBusObjectSkeleton): void
```

Exports `object` on `manager`.

If there is already a `GDBusObject` exported at the object path,
then the old object is removed.

The object path for `object` must be in the hierarchy rooted by the
object path for `manager`.

Note that `manager` will take a reference on `object` for as long as
it is exported.

**Parameters**

- `object`: A `GDBusObjectSkeleton`.

_Available since 2.30._

### `exportUniquely`

```ts
exportUniquely(object: Gio.DBusObjectSkeleton): void
```

Like `g_dbus_object_manager_server_export()` but appends a string of
the form _N (with N being a natural number) to `object`'s object path
if an object with the given path already exists. As such, the
`GDBusObjectProxy.gObjectPath` property of `object` may be modified.

**Parameters**

- `object`: An object.

_Available since 2.30._

### `getConnection`

```ts
getConnection(): Gio.DBusConnection | null
```

Gets the `GDBusConnection` used by `manager`.

**Returns** A `GDBusConnection` object or `null` if
  `manager` isn't exported on a connection. The returned object should
  be freed with `g_object_unref()`.

_Available since 2.30._

### `isExported`

```ts
isExported(object: Gio.DBusObjectSkeleton): boolean
```

Returns whether `object` is currently exported on `manager`.

**Parameters**

- `object`: An object.

**Returns** `true` if `object` is exported

_Available since 2.34._

### `setConnection`

```ts
setConnection(connection: Gio.DBusConnection | null): void
```

Exports all objects managed by `manager` on `connection`. If
`connection` is `null`, stops exporting objects.

**Parameters**

- `connection`: A `GDBusConnection` or `null`.

### `unexport`

```ts
unexport(objectPath: string): boolean
```

If `manager` has an object at `path`, removes the object. Otherwise
does nothing.

Note that `object_path` must be in the hierarchy rooted by the
object path for `manager`.

**Parameters**

- `objectPath`: An object path.

**Returns** `true` if object at `object_path` was removed, `false` otherwise.

_Available since 2.30._
