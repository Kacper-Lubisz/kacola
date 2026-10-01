---
description: "GDBusProxy is a base class used for proxies to access a D-Bus interface on a remote object."
---

# GDBusProxy

`GDBusProxy` is a base class used for proxies to access a D-Bus
interface on a remote object. A `GDBusProxy` can be constructed for
both well-known and unique names.

By default, `GDBusProxy` will cache all properties (and listen to
changes) of the remote object, and proxy all signals that get
emitted. This behaviour can be changed by passing suitable
`Gio.DBusProxyFlags` when the proxy is created. If the proxy is for a
well-known name, the property cache is flushed when the name owner
vanishes and reloaded when a name owner appears.

The unique name owner of the proxy’s name is tracked and can be read from
`Gio.DBusProxy.gNameOwner`. Connect to the
`GObject.Object.notify` signal to get notified of changes.
Additionally, only signals and property changes emitted from the current name
owner are considered and calls are always sent to the current name owner.
This avoids a number of race conditions when the name is lost by one owner
and claimed by another. However, if no name owner currently exists,
then calls will be sent to the well-known name which may result in
the message bus launching an owner (unless
`G_DBUS_PROXY_FLAGS_DO_NOT_AUTO_START` is set).

If the proxy is for a stateless D-Bus service, where the name owner may
be started and stopped between calls, the
`Gio.DBusProxy.gNameOwner` tracking of `GDBusProxy` will cause the
proxy to drop signal and property changes from the service after it has
restarted for the first time. When interacting with a stateless D-Bus
service, do not use `GDBusProxy` — use direct D-Bus method calls and signal
connections.

The generic `Gio.DBusProxy.g-properties-changed` and
`Gio.DBusProxy.g-signal` signals are not very convenient to work
with. Therefore, the recommended way of working with proxies is to subclass
`GDBusProxy`, and have more natural properties and signals in your derived
class. This [example](migrating-gdbus.html#using-gdbus-codegen) shows how
this can easily be done using the [`gdbus-codegen`](gdbus-codegen.html) tool.

A `GDBusProxy` instance can be used from multiple threads but note
that all signals (e.g. `Gio.DBusProxy.g-signal`,
`Gio.DBusProxy.g-properties-changed` and
`GObject.Object.notify`) are emitted in the thread-default main
context (see `GLib.MainContext.pushThreadDefault()`) of the thread
where the instance was constructed.


### A watch proxy example
An example using a proxy for a well-known name can be found in
[`gdbus-example-watch-proxy.c`](https://gitlab.gnome.org/GNOME/glib/-/blob/HEAD/gio/tests/gdbus-example-watch-proxy.c).

_Available since 2.26._

```tsx
import { GDBusProxy } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GDBusProxy**

Implements `GAsyncInitable`, `GDBusInterface`, `GInitable`.

## Props

`ref` receives the `Gio.DBusProxy` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `gBusType`

`Gio.BusType` · default `G_BUS_TYPE_NONE` · construct-only

If this property is not `G_BUS_TYPE_NONE`, then
`GDBusProxy.gConnection` must be `null` and will be set to the
`GDBusConnection` obtained by calling `g_bus_get()` with the value
of this property.

_Available since 2.26._

### `gConnection`

`Gio.DBusConnection` · construct-only

The `GDBusConnection` the proxy is for.

_Available since 2.26._

### `gDefaultTimeout`

`number` · default `-1`

The timeout to use if -1 (specifying default timeout) is passed
as `timeout_msec` in the `g_dbus_proxy_call()` and
`g_dbus_proxy_call_sync()` functions.

This allows applications to set a proxy-wide timeout for all
remote method invocations on the proxy. If this property is -1,
the default timeout (typically 25 seconds) is used. If set to
`G_MAXINT`, then no timeout is used.

_Available since 2.26._

### `gFlags`

`Gio.DBusProxyFlags` · default `G_DBUS_PROXY_FLAGS_NONE` · construct-only

Flags from the `GDBusProxyFlags` enumeration.

_Available since 2.26._

### `gInterfaceInfo`

`Gio.DBusInterfaceInfo`

Ensure that interactions with this proxy conform to the given
interface. This is mainly to ensure that malformed data received
from the other peer is ignored. The given `GDBusInterfaceInfo` is
said to be the "expected interface".

The checks performed are:
- When completing a method call, if the type signature of
  the reply message isn't what's expected, the reply is
  discarded and the `GError` is set to `G_IO_ERROR_INVALID_ARGUMENT`.

- Received signals that have a type signature mismatch are dropped and
  a warning is logged via `g_warning()`.

- Properties received via the initial `GetAll()` call or via the
  `::PropertiesChanged` signal (on the
  [org.freedesktop.DBus.Properties](http://dbus.freedesktop.org/doc/dbus-specification.html#standard-interfaces-properties)
  interface) or set using `g_dbus_proxy_set_cached_property()`
  with a type signature mismatch are ignored and a warning is
  logged via `g_warning()`.

Note that these checks are never done on methods, signals and
properties that are not referenced in the given
`GDBusInterfaceInfo`, since extending a D-Bus interface on the
service-side is not considered an ABI break.

_Available since 2.26._

### `gInterfaceName`

`string` · default `null` · construct-only

The D-Bus interface name the proxy is for.

_Available since 2.26._

### `gName`

`string` · default `null` · construct-only

The well-known or unique name that the proxy is for.

_Available since 2.26._

### `gNameOwner`

`string` · default `null` · read-only, observe with `onNotifyGNameOwner`

The unique name that owns `GDBusProxy.gName` or `null` if no-one
currently owns that name. You may connect to `GObject.notify` signal to
track changes to this property.

_Available since 2.26._

### `gObjectPath`

`string` · default `null` · construct-only

The object path the proxy is for.

_Available since 2.26._

## Signals

### `onGPropertiesChanged`

```ts
(changedProperties: GLib.Variant, invalidatedProperties: string[], self: Gio.DBusProxy) => void
```

Emitted when one or more D-Bus properties on `proxy` changes. The
local cache has already been updated when this signal fires. Note
that both `changed_properties` and `invalidated_properties` are
guaranteed to never be `null` (either may be empty though).

If the proxy has the flag
`G_DBUS_PROXY_FLAGS_GET_INVALIDATED_PROPERTIES` set, then
`invalidated_properties` will always be empty.

This signal corresponds to the
`PropertiesChanged` D-Bus signal on the
`org.freedesktop.DBus.Properties` interface.

**Parameters**

- `changedProperties`: A `GVariant` containing the properties that changed (type: `a{sv}`)
- `invalidatedProperties`: A `null` terminated array of properties that was invalidated
- `self`: The instance the signal was emitted on.

_Available since 2.26._

### `onGSignal`

```ts
(senderName: string | null, signalName: string, parameters: GLib.Variant, self: Gio.DBusProxy) => void
```

Emitted when a signal from the remote object and interface that `proxy` is for, has been received.

Since 2.72 this signal supports detailed connections. You can connect to
the detailed signal `g-signal::x` in order to receive callbacks only when
signal `x` is received from the remote object.

**Parameters**

- `senderName`: The sender of the signal or `null` if the connection is not a bus connection.
- `signalName`: The name of the signal.
- `parameters`: A `GVariant` tuple with parameters for the signal.
- `self`: The instance the signal was emitted on.

_Available since 2.26._

## Methods

Methods are called on the `Gio.DBusProxy` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `call`

```ts
call(methodName: string, parameters: GLib.Variant | null, flags: Gio.DBusCallFlags, timeoutMsec: number, cancellable?: Gio.Cancellable | null): Promise<GLib.Variant>
```

Asynchronously invokes the `method_name` method on `proxy`.

If `method_name` contains any dots, then `name` is split into interface and
method name parts. This allows using `proxy` for invoking methods on
other interfaces.

If the `GDBusConnection` associated with `proxy` is closed then
the operation will fail with `G_IO_ERROR_CLOSED`. If
`cancellable` is canceled, the operation will fail with
`G_IO_ERROR_CANCELLED`. If `parameters` contains a value not
compatible with the D-Bus protocol, the operation fails with
`G_IO_ERROR_INVALID_ARGUMENT`.

If the `parameters` `GVariant` is floating, it is consumed. This allows
convenient 'inline' use of `g_variant_new()`, e.g.:
```c
g_dbus_proxy_call (proxy,
                    "TwoStrings",
                    g_variant_new ("(ss)",
                                   "Thing One",
                                   "Thing Two"),
                    G_DBUS_CALL_FLAGS_NONE,
                    -1,
                    NULL,
                    (GAsyncReadyCallback) two_strings_done,
                    &data);
```

If `proxy` has an expected interface (see
`GDBusProxy.gInterfaceInfo`) and `method_name` is referenced by it,
then the return value is checked against the return type.

This is an asynchronous method. When the operation is finished,
`callback` will be invoked in the thread-default main context
(see `GLib.MainContext.pushThreadDefault()`)
of the thread you are calling this method from.
You can then call `g_dbus_proxy_call_finish()` to get the result of
the operation. See `g_dbus_proxy_call_sync()` for the synchronous
version of this method.

If `callback` is `null` then the D-Bus method call message will be sent with
the `G_DBUS_MESSAGE_FLAGS_NO_REPLY_EXPECTED` flag set.

**Parameters**

- `methodName`: Name of method to invoke.
- `parameters`: A `GVariant` tuple with parameters for the signal or `null` if not passing parameters.
- `flags`: Flags from the `GDBusCallFlags` enumeration.
- `timeoutMsec`: The timeout in milliseconds (with `G_MAXINT` meaning "infinite") or -1 to use the proxy default timeout.
- `cancellable`: A `GCancellable` or `null`.

**Returns** `null` if `error` is set. Otherwise a `GVariant` tuple with
return values. Free with `g_variant_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `callFinish`

```ts
callFinish(res: Gio.AsyncResult): GLib.Variant
```

Finishes an operation started with `g_dbus_proxy_call()`.

**Parameters**

- `res`: A `GAsyncResult` obtained from the `GAsyncReadyCallback` passed to `g_dbus_proxy_call()`.

**Returns** `null` if `error` is set. Otherwise a `GVariant` tuple with
return values. Free with `g_variant_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `callSync`

```ts
callSync(methodName: string, parameters: GLib.Variant | null, flags: Gio.DBusCallFlags, timeoutMsec: number, cancellable: Gio.Cancellable | null): GLib.Variant
```

Synchronously invokes the `method_name` method on `proxy`.

If `method_name` contains any dots, then `name` is split into interface and
method name parts. This allows using `proxy` for invoking methods on
other interfaces.

If the `GDBusConnection` associated with `proxy` is disconnected then
the operation will fail with `G_IO_ERROR_CLOSED`. If
`cancellable` is canceled, the operation will fail with
`G_IO_ERROR_CANCELLED`. If `parameters` contains a value not
compatible with the D-Bus protocol, the operation fails with
`G_IO_ERROR_INVALID_ARGUMENT`.

If the `parameters` `GVariant` is floating, it is consumed. This allows
convenient 'inline' use of `g_variant_new()`, e.g.:
```c
g_dbus_proxy_call_sync (proxy,
                         "TwoStrings",
                         g_variant_new ("(ss)",
                                        "Thing One",
                                        "Thing Two"),
                         G_DBUS_CALL_FLAGS_NONE,
                         -1,
                         NULL,
                         &error);
```

The calling thread is blocked until a reply is received. See
`g_dbus_proxy_call()` for the asynchronous version of this
method.

If `proxy` has an expected interface (see
`GDBusProxy.gInterfaceInfo`) and `method_name` is referenced by it,
then the return value is checked against the return type.

**Parameters**

- `methodName`: Name of method to invoke.
- `parameters`: A `GVariant` tuple with parameters for the signal or `null` if not passing parameters.
- `flags`: Flags from the `GDBusCallFlags` enumeration.
- `timeoutMsec`: The timeout in milliseconds (with `G_MAXINT` meaning "infinite") or -1 to use the proxy default timeout.
- `cancellable`: A `GCancellable` or `null`.

**Returns** `null` if `error` is set. Otherwise a `GVariant` tuple with
return values. Free with `g_variant_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `callWithUnixFdList`

```ts
callWithUnixFdList(methodName: string, parameters: GLib.Variant | null, flags: Gio.DBusCallFlags, timeoutMsec: number, fdList: Gio.UnixFDList | null, cancellable?: Gio.Cancellable | null): Promise<[GLib.Variant, Gio.UnixFDList | null]>
```

Like `g_dbus_proxy_call()` but also takes a `GUnixFDList` object.

This method is only available on UNIX.

**Parameters**

- `methodName`: Name of method to invoke.
- `parameters`: A `GVariant` tuple with parameters for the signal or `null` if not passing parameters.
- `flags`: Flags from the `GDBusCallFlags` enumeration.
- `timeoutMsec`: The timeout in milliseconds (with `G_MAXINT` meaning "infinite") or -1 to use the proxy default timeout.
- `fdList`: A `GUnixFDList` or `null`.
- `cancellable`: A `GCancellable` or `null`.

**Returns** Tuple of:

- `result`: `null` if `error` is set. Otherwise a `GVariant` tuple with return values. Free with `g_variant_unref()`.
- `outFdList`: Return location for a `GUnixFDList` or `null`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `callWithUnixFdListFinish`

```ts
callWithUnixFdListFinish(res: Gio.AsyncResult): [GLib.Variant, Gio.UnixFDList | null]
```

Finishes an operation started with `g_dbus_proxy_call_with_unix_fd_list()`.

**Parameters**

- `res`: A `GAsyncResult` obtained from the `GAsyncReadyCallback` passed to `g_dbus_proxy_call_with_unix_fd_list()`.

**Returns** Tuple of:

- `result`: `null` if `error` is set. Otherwise a `GVariant` tuple with return values. Free with `g_variant_unref()`.
- `outFdList`: Return location for a `GUnixFDList` or `null`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `callWithUnixFdListSync`

```ts
callWithUnixFdListSync(methodName: string, parameters: GLib.Variant | null, flags: Gio.DBusCallFlags, timeoutMsec: number, fdList: Gio.UnixFDList | null, cancellable: Gio.Cancellable | null): [GLib.Variant, Gio.UnixFDList | null]
```

Like `g_dbus_proxy_call_sync()` but also takes and returns `GUnixFDList` objects.

This method is only available on UNIX.

**Parameters**

- `methodName`: Name of method to invoke.
- `parameters`: A `GVariant` tuple with parameters for the signal or `null` if not passing parameters.
- `flags`: Flags from the `GDBusCallFlags` enumeration.
- `timeoutMsec`: The timeout in milliseconds (with `G_MAXINT` meaning "infinite") or -1 to use the proxy default timeout.
- `fdList`: A `GUnixFDList` or `null`.
- `cancellable`: A `GCancellable` or `null`.

**Returns** Tuple of:

- `result`: `null` if `error` is set. Otherwise a `GVariant` tuple with return values. Free with `g_variant_unref()`.
- `outFdList`: Return location for a `GUnixFDList` or `null`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `getCachedProperty`

```ts
getCachedProperty(propertyName: string): GLib.Variant | null
```

Looks up the value for a property from the cache. This call does no
blocking IO.

If `proxy` has an expected interface (see
`GDBusProxy.gInterfaceInfo`) and `property_name` is referenced by
it, then `value` is checked against the type of the property.

**Parameters**

- `propertyName`: Property name.

**Returns** A reference to the `GVariant` instance
   that holds the value for `property_name` or `null` if the value is not in
   the cache. The returned reference must be freed with `g_variant_unref()`.

_Available since 2.26._

### `getCachedPropertyNames`

```ts
getCachedPropertyNames(): string[] | null
```

Gets the names of all cached properties on `proxy`.

**Returns** A
         `null`-terminated array of strings or `null` if
         `proxy` has no cached properties. Free the returned array with
         `g_strfreev()`.

_Available since 2.26._

### `getConnection`

```ts
getConnection(): Gio.DBusConnection
```

Gets the connection `proxy` is for.

**Returns** A `GDBusConnection` owned by `proxy`. Do not free.

_Available since 2.26._

### `getDefaultTimeout`

```ts
getDefaultTimeout(): number
```

Gets the timeout to use if -1 (specifying default timeout) is
passed as `timeout_msec` in the `g_dbus_proxy_call()` and
`g_dbus_proxy_call_sync()` functions.

See the `GDBusProxy.gDefaultTimeout` property for more details.

**Returns** Timeout to use for `proxy`.

_Available since 2.26._

### `getFlags`

```ts
getFlags(): Gio.DBusProxyFlags
```

Gets the flags that `proxy` was constructed with.

**Returns** Flags from the `GDBusProxyFlags` enumeration.

_Available since 2.26._

### `getInterfaceInfo`

```ts
getInterfaceInfo(): Gio.DBusInterfaceInfo | null
```

Returns the `GDBusInterfaceInfo`, if any, specifying the interface
that `proxy` conforms to. See the `GDBusProxy.gInterfaceInfo`
property for more details.

**Returns** A `GDBusInterfaceInfo` or `null`.
   Do not unref the returned object, it is owned by `proxy`.

_Available since 2.26._

### `getInterfaceName`

```ts
getInterfaceName(): string
```

Gets the D-Bus interface name `proxy` is for.

**Returns** A string owned by `proxy`. Do not free.

_Available since 2.26._

### `getName`

```ts
getName(): string | null
```

Gets the name that `proxy` was constructed for.

When connected to a message bus, this will usually be non-`null`.
However, it may be `null` for a proxy that communicates using a peer-to-peer
pattern.

**Returns** A string owned by `proxy`. Do not free.

_Available since 2.26._

### `getNameOwner`

```ts
getNameOwner(): string | null
```

The unique name that owns the name that `proxy` is for or `null` if
no-one currently owns that name. You may connect to the
`GObject.notify` signal to track changes to the
`GDBusProxy.gNameOwner` property.

**Returns** The name owner or `null` if no name
   owner exists. Free with `g_free()`.

_Available since 2.26._

### `getObjectPath`

```ts
getObjectPath(): string
```

Gets the object path `proxy` is for.

**Returns** A string owned by `proxy`. Do not free.

_Available since 2.26._

### `setCachedProperty`

```ts
setCachedProperty(propertyName: string, value: GLib.Variant | null): void
```

If `value` is not `null`, sets the cached value for the property with
name `property_name` to the value in `value`.

If `value` is `null`, then the cached value is removed from the
property cache.

If `proxy` has an expected interface (see
`GDBusProxy.gInterfaceInfo`) and `property_name` is referenced by
it, then `value` is checked against the type of the property.

If the `value` `GVariant` is floating, it is consumed. This allows
convenient 'inline' use of `g_variant_new()`, e.g.
```c
g_dbus_proxy_set_cached_property (proxy,
                                   "SomeProperty",
                                   g_variant_new ("(si)",
                                                 "A String",
                                                 42));
```

Normally you will not need to use this method since `proxy`
is tracking changes using the
`org.freedesktop.DBus.Properties.PropertiesChanged`
D-Bus signal. However, for performance reasons an object may
decide to not use this signal for some properties and instead
use a proprietary out-of-band mechanism to transmit changes.

As a concrete example, consider an object with a property
`ChatroomParticipants` which is an array of strings. Instead of
transmitting the same (long) array every time the property changes,
it is more efficient to only transmit the delta using e.g. signals
`ChatroomParticipantJoined(String name)` and
`ChatroomParticipantParted(String name)`.

**Parameters**

- `propertyName`: Property name.
- `value`: Value for the property or `null` to remove it from the cache.

_Available since 2.26._

### `setDefaultTimeout`

```ts
setDefaultTimeout(timeoutMsec: number): void
```

Sets the timeout to use if -1 (specifying default timeout) is
passed as `timeout_msec` in the `g_dbus_proxy_call()` and
`g_dbus_proxy_call_sync()` functions.

See the `GDBusProxy.gDefaultTimeout` property for more details.

**Parameters**

- `timeoutMsec`: Timeout in milliseconds.

_Available since 2.26._

### `setInterfaceInfo`

```ts
setInterfaceInfo(info: Gio.DBusInterfaceInfo | null): void
```

Ensure that interactions with `proxy` conform to the given
interface. See the `GDBusProxy.gInterfaceInfo` property for more
details.

**Parameters**

- `info`: Minimum interface this proxy conforms to or `null` to unset.

_Available since 2.26._
