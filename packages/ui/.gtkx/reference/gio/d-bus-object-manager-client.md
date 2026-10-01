---
description: "GDBusObjectManagerClient is used to create, monitor and delete object proxies for remote objects exported by a Gio.DBusObjectManagerServer (or any code implementing the org.freedesktop.DBus.ObjectManager interface)."
---

# GDBusObjectManagerClient

`GDBusObjectManagerClient` is used to create, monitor and delete object
proxies for remote objects exported by a `Gio.DBusObjectManagerServer`
(or any code implementing the
[org.freedesktop.DBus.ObjectManager](http://dbus.freedesktop.org/doc/dbus-specification.html#standard-interfaces-objectmanager)
interface).

Once an instance of this type has been created, you can connect to
the `Gio.DBusObjectManager.object-added` and
[signal@Gio.DBusObjectManager::object-removed signals] and inspect the
`Gio.DBusObjectProxy` objects returned by
`Gio.DBusObjectManager.getObjects()`.

If the name for a `GDBusObjectManagerClient` is not owned by anyone at
object construction time, the default behavior is to request the
message bus to launch an owner for the name. This behavior can be
disabled using the `G_DBUS_OBJECT_MANAGER_CLIENT_FLAGS_DO_NOT_AUTO_START`
flag. It’s also worth noting that this only works if the name of
interest is activatable in the first place. E.g. in some cases it
is not possible to launch an owner for the requested name. In this
case, `GDBusObjectManagerClient` object construction still succeeds but
there will be no object proxies
(e.g. `Gio.DBusObjectManager.getObjects()` returns the empty list) and
the `Gio.DBusObjectManagerClient.nameOwner` property is `NULL`.

The owner of the requested name can come and go (for example
consider a system service being restarted) – `GDBusObjectManagerClient`
handles this case too; simply connect to the `GObject.Object.notify`
signal to watch for changes on the
`Gio.DBusObjectManagerClient.nameOwner` property. When the name
owner vanishes, the behavior is that
`Gio.DBusObjectManagerClient.nameOwner` is set to `NULL` (this
includes emission of the `GObject.Object.notify` signal) and then
`Gio.DBusObjectManager.object-removed` signals are synthesized
for all currently existing object proxies. Since
`Gio.DBusObjectManagerClient.nameOwner` is `NULL` when this
happens, you can use this information to disambiguate a synthesized signal
from a genuine signal caused by object removal on the remote
`Gio.DBusObjectManager`. Similarly, when a new name owner appears,
`Gio.DBusObjectManager.object-added` signals are synthesized
while `Gio.DBusObjectManagerClient.nameOwner` is still `NULL`. Only
when all object proxies have been added, the
`Gio.DBusObjectManagerClient.nameOwner` is set to the new name
owner (this includes emission of the `GObject.Object.notify` signal).
Furthermore, you are guaranteed that
`Gio.DBusObjectManagerClient.nameOwner` will alternate between a
name owner (e.g. `:1.42`) and `NULL` even in the case where
the name of interest is atomically replaced

Ultimately, `GDBusObjectManagerClient` is used to obtain
`Gio.DBusProxy` instances. All signals (including the
`org.freedesktop.DBus.Properties::PropertiesChanged` signal)
delivered to `Gio.DBusProxy` instances are guaranteed to originate
from the name owner. This guarantee along with the behavior
described above, means that certain race conditions including the
“half the proxy is from the old owner and the other half is from
the new owner” problem cannot happen.

To avoid having the application connect to signals on the returned
`Gio.DBusObjectProxy` and `Gio.DBusProxy` objects, the
`Gio.DBusObject.interface-added`,
`Gio.DBusObject.interface-removed`,
`Gio.DBusProxy.g-properties-changed` and
`Gio.DBusProxy.g-signal` signals
are also emitted on the `GDBusObjectManagerClient` instance managing these
objects. The signals emitted are
`Gio.DBusObjectManager.interface-added`,
`Gio.DBusObjectManager.interface-removed`,
`Gio.DBusObjectManagerClient.interface-proxy-properties-changed` and
`Gio.DBusObjectManagerClient.interface-proxy-signal`.

Note that all callbacks and signals are emitted in the
thread-default main context (see
`GLib.MainContext.pushThreadDefault()`) that the
`GDBusObjectManagerClient` object was constructed in. Additionally, the
`Gio.DBusObjectProxy` and `Gio.DBusProxy` objects
originating from the `GDBusObjectManagerClient` object will be created in
the same context and, consequently, will deliver signals in the
same main loop.

_Available since 2.30._

```tsx
import { GDBusObjectManagerClient } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GDBusObjectManagerClient**

Implements `GAsyncInitable`, `GDBusObjectManager`, `GInitable`.

## Props

`ref` receives the `Gio.DBusObjectManagerClient` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `busType`

`Gio.BusType` · default `G_BUS_TYPE_NONE` · construct-only

If this property is not `G_BUS_TYPE_NONE`, then
`GDBusObjectManagerClient.connection` must be `null` and will be set to the
`GDBusConnection` obtained by calling `g_bus_get()` with the value
of this property.

_Available since 2.30._

### `connection`

`Gio.DBusConnection` · construct-only

The `GDBusConnection` to use.

_Available since 2.30._

### `flags`

`Gio.DBusObjectManagerClientFlags` · default `G_DBUS_OBJECT_MANAGER_CLIENT_FLAGS_NONE` · construct-only

Flags from the `GDBusObjectManagerClientFlags` enumeration.

_Available since 2.30._

### `getProxyTypeDestroyNotify`

`bigint` · construct-only

A `GDestroyNotify` for the `gpointer` user_data in `GDBusObjectManagerClient.getProxyTypeUserData`.

_Available since 2.30._

### `getProxyTypeFunc`

`bigint` · construct-only

The `GDBusProxyTypeFunc` to use when determining what `GType` to
use for interface proxies or `null`.

_Available since 2.30._

### `getProxyTypeUserData`

`bigint` · construct-only

The `gpointer` user_data to pass to `GDBusObjectManagerClient.getProxyTypeFunc`.

_Available since 2.30._

### `name`

`string` · default `null` · construct-only

The well-known name or unique name that the manager is for.

_Available since 2.30._

### `nameOwner`

`string` · default `null` · read-only, observe with `onNotifyNameOwner`

The unique name that owns `GDBusObjectManagerClient.name` or `null` if
no-one is currently owning the name. Connect to the
`GObject.notify` signal to track changes to this property.

_Available since 2.30._

### `objectPath`

`string` · default `null` · construct-only

The object path the manager is for.

_Available since 2.30._

## Signals

### `onInterfaceAdded`

```ts
(object: Gio.DBusObject, interface_: Gio.DBusInterface, self: Gio.DBusObjectManagerClient) => void
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

### `onInterfaceProxyPropertiesChanged`

```ts
(objectProxy: Gio.DBusObjectProxy, interfaceProxy: Gio.DBusProxy, changedProperties: GLib.Variant, invalidatedProperties: string[], self: Gio.DBusObjectManagerClient) => void
```

Emitted when one or more D-Bus properties on proxy changes. The
local cache has already been updated when this signal fires. Note
that both `changed_properties` and `invalidated_properties` are
guaranteed to never be `null` (either may be empty though).

This signal exists purely as a convenience to avoid having to
connect signals to all interface proxies managed by `manager`.

This signal is emitted in the thread-default main context
(see `GLib.MainContext.pushThreadDefault()`)
that `manager` was constructed in.

**Parameters**

- `objectProxy`: The `GDBusObjectProxy` on which an interface has properties that are changing.
- `interfaceProxy`: The `GDBusProxy` that has properties that are changing.
- `changedProperties`: A `GVariant` containing the properties that changed (type: `a{sv}`).
- `invalidatedProperties`: A `null` terminated array of properties that were invalidated.
- `self`: The instance the signal was emitted on.

_Available since 2.30._

### `onInterfaceProxySignal`

```ts
(objectProxy: Gio.DBusObjectProxy, interfaceProxy: Gio.DBusProxy, senderName: string, signalName: string, parameters: GLib.Variant, self: Gio.DBusObjectManagerClient) => void
```

Emitted when a D-Bus signal is received on `interface_proxy`.

This signal exists purely as a convenience to avoid having to
connect signals to all interface proxies managed by `manager`.

This signal is emitted in the thread-default main context
(see `GLib.MainContext.pushThreadDefault()`)
that `manager` was constructed in.

**Parameters**

- `objectProxy`: The `GDBusObjectProxy` on which an interface is emitting a D-Bus signal.
- `interfaceProxy`: The `GDBusProxy` that is emitting a D-Bus signal.
- `senderName`: The sender of the signal or NULL if the connection is not a bus connection.
- `signalName`: The signal name.
- `parameters`: A `GVariant` tuple with parameters for the signal.
- `self`: The instance the signal was emitted on.

_Available since 2.30._

### `onInterfaceRemoved`

```ts
(object: Gio.DBusObject, interface_: Gio.DBusInterface, self: Gio.DBusObjectManagerClient) => void
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
(object: Gio.DBusObject, self: Gio.DBusObjectManagerClient) => void
```

From `GDBusObjectManager`.

Emitted when `object` is added to `manager`.

**Parameters**

- `object`: The `GDBusObject` that was added.
- `self`: The instance the signal was emitted on.

_Available since 2.30._

### `onObjectRemoved`

```ts
(object: Gio.DBusObject, self: Gio.DBusObjectManagerClient) => void
```

From `GDBusObjectManager`.

Emitted when `object` is removed from `manager`.

**Parameters**

- `object`: The `GDBusObject` that was removed.
- `self`: The instance the signal was emitted on.

_Available since 2.30._

## Methods

Methods are called on the `Gio.DBusObjectManagerClient` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getConnection`

```ts
getConnection(): Gio.DBusConnection
```

Gets the `GDBusConnection` used by `manager`.

**Returns** A `GDBusConnection` object. Do not free,
  the object belongs to `manager`.

_Available since 2.30._

### `getFlags`

```ts
getFlags(): Gio.DBusObjectManagerClientFlags
```

Gets the flags that `manager` was constructed with.

**Returns** Zero of more flags from the `GDBusObjectManagerClientFlags`
enumeration.

_Available since 2.30._

### `getName`

```ts
getName(): string
```

Gets the name that `manager` is for, or `null` if not a message bus
connection.

**Returns** A unique or well-known name. Do not free, the string
belongs to `manager`.

_Available since 2.30._

### `getNameOwner`

```ts
getNameOwner(): string | null
```

The unique name that owns the name that `manager` is for or `null` if
no-one currently owns that name. You can connect to the
`GObject.notify` signal to track changes to the
`GDBusObjectManagerClient.nameOwner` property.

**Returns** The name owner or `null` if no name owner
exists. Free with `g_free()`.

_Available since 2.30._
