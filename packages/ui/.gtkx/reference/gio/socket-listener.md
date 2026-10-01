---
description: "A GSocketListener is an object that keeps track of a set of server sockets and helps you accept sockets from any of the socket, either sync or async."
---

# GSocketListener

A `GSocketListener` is an object that keeps track of a set
of server sockets and helps you accept sockets from any of the
socket, either sync or async.

Add addresses and ports to listen on using
`Gio.SocketListener.addAddress()` and
`Gio.SocketListener.addInetPort()`. These will be listened on until
`Gio.SocketListener.close()` is called. Dropping your final reference to
the `GSocketListener` will not cause `Gio.SocketListener.close()` to be
called implicitly, as some references to the `GSocketListener` may be held
internally.

If you want to implement a network server, also look at
`Gio.SocketService` and `Gio.ThreadedSocketService` which are
subclasses of `GSocketListener` that make this even easier.

_Available since 2.22._

```tsx
import { GSocketListener } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSocketListener**

## Props

`ref` receives the `Gio.SocketListener` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `listenBacklog`

`number` · default `10`

The number of outstanding connections in the listen queue.

_Available since 2.22._

## Signals

### `onEvent`

```ts
(event: Gio.SocketListenerEvent, socket: Gio.Socket, self: Gio.SocketListener) => void
```

Emitted when `listener`'s activity on `socket` changes state.
Note that when `listener` is used to listen on both IPv4 and
IPv6, a separate set of signals will be emitted for each, and
the order they happen in is undefined.

**Parameters**

- `event`: the event that is occurring
- `socket`: the `GSocket` the event is occurring on
- `self`: The instance the signal was emitted on.

_Available since 2.46._

## Methods

Methods are called on the `Gio.SocketListener` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `accept`

```ts
accept(cancellable: Gio.Cancellable | null): [Gio.SocketConnection, GObject.Object | null]
```

Blocks waiting for a client to connect to any of the sockets added
to the listener. Returns a `GSocketConnection` for the socket that was
accepted.

If `source_object` is not `null` it will be filled out with the source
object specified when the corresponding socket or address was added
to the listener.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** Tuple of:

- `result`: a `GSocketConnection` on success, `null` on error.
- `sourceObject`: location where `GObject` pointer will be stored, or `null`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `acceptAsync`

```ts
acceptAsync(cancellable?: Gio.Cancellable | null): Promise<[Gio.SocketConnection, GObject.Object | null]>
```

This is the asynchronous version of `g_socket_listener_accept()`.

When the operation is finished `callback` will be
called. You can then call `g_socket_listener_accept_finish()`
to get the result of the operation.

**Parameters**

- `cancellable`: a `GCancellable`, or `null`

**Returns** Tuple of:

- `result`: a `GSocketConnection` on success, `null` on error.
- `sourceObject`: Optional `GObject` identifying this source

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `acceptFinish`

```ts
acceptFinish(result: Gio.AsyncResult): [Gio.SocketConnection, GObject.Object | null]
```

Finishes an async accept operation. See `g_socket_listener_accept_async()`

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** Tuple of:

- `result`: a `GSocketConnection` on success, `null` on error.
- `sourceObject`: Optional `GObject` identifying this source

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `acceptSocket`

```ts
acceptSocket(cancellable: Gio.Cancellable | null): [Gio.Socket, GObject.Object | null]
```

Blocks waiting for a client to connect to any of the sockets added
to the listener. Returns the `GSocket` that was accepted.

If you want to accept the high-level `GSocketConnection`, not a `GSocket`,
which is often the case, then you should use `g_socket_listener_accept()`
instead.

If `source_object` is not `null` it will be filled out with the source
object specified when the corresponding socket or address was added
to the listener.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** Tuple of:

- `result`: a `GSocket` on success, `null` on error.
- `sourceObject`: location where `GObject` pointer will be stored, or `null`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `acceptSocketAsync`

```ts
acceptSocketAsync(cancellable?: Gio.Cancellable | null): Promise<[Gio.Socket, GObject.Object | null]>
```

This is the asynchronous version of `g_socket_listener_accept_socket()`.

When the operation is finished `callback` will be
called. You can then call `g_socket_listener_accept_socket_finish()`
to get the result of the operation.

**Parameters**

- `cancellable`: a `GCancellable`, or `null`

**Returns** Tuple of:

- `result`: a `GSocket` on success, `null` on error.
- `sourceObject`: Optional `GObject` identifying this source

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `acceptSocketFinish`

```ts
acceptSocketFinish(result: Gio.AsyncResult): [Gio.Socket, GObject.Object | null]
```

Finishes an async accept operation. See `g_socket_listener_accept_socket_async()`

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** Tuple of:

- `result`: a `GSocket` on success, `null` on error.
- `sourceObject`: Optional `GObject` identifying this source

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `addAddress`

```ts
addAddress(address: Gio.SocketAddress, type: Gio.SocketType, protocol: Gio.SocketProtocol, sourceObject: GObject.Object | null): [boolean, Gio.SocketAddress]
```

Creates a socket of type `type` and protocol `protocol`, binds
it to `address` and adds it to the set of sockets we're accepting
sockets from.

Note that adding an IPv6 address, depending on the platform,
may or may not result in a listener that also accepts IPv4
connections.  For more deterministic behavior, see
`g_socket_listener_add_inet_port()`.

`source_object` will be passed out in the various calls
to accept to identify this particular source, which is
useful if you're listening on multiple addresses and do
different things depending on what address is connected to.

If successful and `effective_address` is non-`null` then it will
be set to the address that the binding actually occurred at.  This
is helpful for determining the port number that was used for when
requesting a binding to port 0 (ie: "any port").  This address, if
requested, belongs to the caller and must be freed.

Call `g_socket_listener_close()` to stop listening on `address`; this will not
be done automatically when you drop your final reference to `listener`, as
references may be held internally.

**Parameters**

- `address`: a `GSocketAddress`
- `type`: a `GSocketType`
- `protocol`: a `GSocketProtocol`
- `sourceObject`: Optional `GObject` identifying this source

**Returns** Tuple of:

- `result`: `true` on success, `false` on error.
- `effectiveAddress`: location to store the address that was bound to, or `null`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `addAnyInetPort`

```ts
addAnyInetPort(sourceObject: GObject.Object | null): number
```

Listens for TCP connections on any available port number for both
IPv6 and IPv4 (if each is available).

This is useful if you need to have a socket for incoming connections
but don't care about the specific port number.

If possible, the `Gio.SocketListener` will listen on both IPv4 and
IPv6 (listening on the same port on both). If listening on one of the socket
families fails, the `Gio.SocketListener` will only listen on the other.
If listening on both fails, an error will be returned.

If you need to distinguish whether listening on IPv4 or IPv6 or both was
successful, connect to `Gio.SocketListener.event`.

`source_object` will be passed out in the various calls
to accept to identify this particular source, which is
useful if you're listening on multiple addresses and do
different things depending on what address is connected to.

**Parameters**

- `sourceObject`: Optional `GObject` identifying this source

**Returns** the port number, or 0 in case of failure.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.24._

### `addInetPort`

```ts
addInetPort(port: number, sourceObject: GObject.Object | null): boolean
```

Helper function for `g_socket_listener_add_address()` that
creates a TCP/IP socket listening on IPv4 and IPv6 (if
supported) on the specified port on all interfaces.

If possible, the `Gio.SocketListener` will listen on both IPv4 and
IPv6 (listening on the same port on both). If listening on one of the socket
families fails, the `Gio.SocketListener` will only listen on the other.
If listening on both fails, an error will be returned.

If you need to distinguish whether listening on IPv4 or IPv6 or both was
successful, connect to `Gio.SocketListener.event`.

`source_object` will be passed out in the various calls
to accept to identify this particular source, which is
useful if you're listening on multiple addresses and do
different things depending on what address is connected to.

Call `g_socket_listener_close()` to stop listening on `port`; this will not
be done automatically when you drop your final reference to `listener`, as
references may be held internally.

**Parameters**

- `port`: an IP port number (non-zero)
- `sourceObject`: Optional `GObject` identifying this source

**Returns** `true` on success, `false` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `addSocket`

```ts
addSocket(socket: Gio.Socket, sourceObject: GObject.Object | null): boolean
```

Adds `socket` to the set of sockets that we try to accept
new clients from. The socket must be bound to a local
address and listened to.

For parallel calls to `Gio.SocketListener` methods to work, the socket
must be in non-blocking mode. (See `Gio.Socket.blocking`.)

`source_object` will be passed out in the various calls
to accept to identify this particular source, which is
useful if you're listening on multiple addresses and do
different things depending on what address is connected to.

The `socket` will not be automatically closed when the `listener` is finalized
unless the listener held the final reference to the socket. Before GLib 2.42,
the `socket` was automatically closed on finalization of the `listener`, even
if references to it were held elsewhere.

**Parameters**

- `socket`: a listening `GSocket`
- `sourceObject`: Optional `GObject` identifying this source

**Returns** `true` on success, `false` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `close`

```ts
close(): void
```

Closes all the sockets in the listener.

_Available since 2.22._

### `setBacklog`

```ts
setBacklog(listenBacklog: number): void
```

Sets the listen backlog on the sockets in the listener. This must be called
before adding any sockets, addresses or ports to the `GSocketListener` (for
example, by calling `g_socket_listener_add_inet_port()`) to be effective.

See `g_socket_set_listen_backlog()` for details

**Parameters**

- `listenBacklog`: an integer

_Available since 2.22._
