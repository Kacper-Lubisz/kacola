---
description: "GDBusServer is a helper for listening to and accepting D-Bus connections."
---

# GDBusServer

`GDBusServer` is a helper for listening to and accepting D-Bus
connections. This can be used to create a new D-Bus server, allowing two
peers to use the D-Bus protocol for their own specialized communication.
A server instance provided in this way will not perform message routing or
implement the
[`org.freedesktop.DBus` interface](https://dbus.freedesktop.org/doc/dbus-specification.html#message-bus-messages).

To just export an object on a well-known name on a message bus, such as the
session or system bus, you should instead use `Gio.busOwnName()`.

An example of peer-to-peer communication with GDBus can be found
in [gdbus-example-peer.c](https://gitlab.gnome.org/GNOME/glib/-/blob/HEAD/gio/tests/gdbus-example-peer.c).

Note that a minimal `GDBusServer` will accept connections from any
peer. In many use-cases it will be necessary to add a
`Gio.DBusAuthObserver` that only accepts connections that have
successfully authenticated as the same user that is running the
`GDBusServer`. Since GLib 2.68 this can be achieved more simply by passing
the `G_DBUS_SERVER_FLAGS_AUTHENTICATION_REQUIRE_SAME_USER` flag to the
server.

_Available since 2.26._

```tsx
import { GDBusServer } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GDBusServer**

Implements `GInitable`.

## Props

`ref` receives the `Gio.DBusServer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `active`

`boolean` · default `false` · read-only, observe with `onNotifyActive`

Whether the server is currently active.

_Available since 2.26._

### `address`

`string` · default `null` · construct-only

The D-Bus address to listen on.

_Available since 2.26._

### `authenticationObserver`

`Gio.DBusAuthObserver` · construct-only

A `GDBusAuthObserver` object to assist in the authentication process or `null`.

_Available since 2.26._

### `clientAddress`

`string` · default `null` · read-only, observe with `onNotifyClientAddress`

The D-Bus address that clients can use.

_Available since 2.26._

### `flags`

`Gio.DBusServerFlags` · default `G_DBUS_SERVER_FLAGS_NONE` · construct-only

Flags from the `GDBusServerFlags` enumeration.

_Available since 2.26._

### `guid`

`string` · default `null` · construct-only

The GUID of the server.

See `GDBusConnection.guid` for more details.

_Available since 2.26._

## Signals

### `onNewConnection`

```ts
(connection: Gio.DBusConnection, self: Gio.DBusServer) => boolean | undefined
```

Emitted when a new authenticated connection has been made. Use
`g_dbus_connection_get_peer_credentials()` to figure out what
identity (if any), was authenticated.

If you want to accept the connection, take a reference to the
`connection` object and return `true`. When you are done with the
connection call `g_dbus_connection_close()` and give up your
reference. Note that the other peer may disconnect at any time -
a typical thing to do when accepting a connection is to listen to
the `GDBusConnection.closed` signal.

If `GDBusServer.flags` contains `G_DBUS_SERVER_FLAGS_RUN_IN_THREAD`
then the signal is emitted in a new thread dedicated to the
connection. Otherwise the signal is emitted in the thread-default
main context (see `GLib.MainContext.pushThreadDefault()`)
of the thread that `server` was constructed in.

You are guaranteed that signal handlers for this signal runs
before incoming messages on `connection` are processed. This means
that it's suitable to call `g_dbus_connection_register_object()` or
similar from the signal handler.

**Parameters**

- `connection`: A `GDBusConnection` for the new connection.
- `self`: The instance the signal was emitted on.

**Returns** `true` to claim `connection`, `false` to let other handlers
run.

_Available since 2.26._

## Methods

Methods are called on the `Gio.DBusServer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getClientAddress`

```ts
getClientAddress(): string
```

Gets a
[D-Bus address](https://dbus.freedesktop.org/doc/dbus-specification.html#addresses)
string that can be used by clients to connect to `server`.

This is valid and non-empty if initializing the `GDBusServer` succeeded.

**Returns** A D-Bus address string. Do not free, the string is owned
by `server`.

_Available since 2.26._

### `getFlags`

```ts
getFlags(): Gio.DBusServerFlags
```

Gets the flags for `server`.

**Returns** A set of flags from the `GDBusServerFlags` enumeration.

_Available since 2.26._

### `getGuid`

```ts
getGuid(): string
```

Gets the GUID for `server`, as provided to `g_dbus_server_new_sync()`.

**Returns** A D-Bus GUID. Do not free this string, it is owned by `server`.

_Available since 2.26._

### `isActive`

```ts
isActive(): boolean
```

Gets whether `server` is active.

**Returns** `true` if server is active, `false` otherwise.

_Available since 2.26._

### `start`

```ts
start(): void
```

Starts `server`.

_Available since 2.26._

### `stop`

```ts
stop(): void
```

Stops `server`.

_Available since 2.26._
