---
description: "A GSocket is a low-level networking primitive."
---

# GSocket

A `GSocket` is a low-level networking primitive. It is a more or less
direct mapping of the BSD socket API in a portable GObject based API.
It supports both the UNIX socket implementations and winsock2 on Windows.

`GSocket` is the platform independent base upon which the higher level
network primitives are based. Applications are not typically meant to
use it directly, but rather through classes like `Gio.SocketClient`,
`Gio.SocketService` and `Gio.SocketConnection`. However there may
be cases where direct use of `GSocket` is useful.

`GSocket` implements the `Gio.Initable` interface, so if it is manually
constructed by e.g. `GObject.Object.new()` you must call
`Gio.Initable.init()` and check the results before using the object.
This is done automatically in `Gio.Socket.new()` and
`Gio.Socket.newFromFd()`, so these functions can return `NULL`.

Sockets operate in two general modes, blocking or non-blocking. When
in blocking mode all operations (which don’t take an explicit blocking
parameter) block until the requested operation
is finished or there is an error. In non-blocking mode all calls that
would block return immediately with a `G_IO_ERROR_WOULD_BLOCK` error.
To know when a call would successfully run you can call
`Gio.Socket.conditionCheck()`, or `Gio.Socket.conditionWait()`.
You can also use `Gio.Socket.createSource()` and attach it to a
`GLib.MainContext` to get callbacks when I/O is possible.
Note that all sockets are always set to non blocking mode in the system, and
blocking mode is emulated in `GSocket`.

When working in non-blocking mode applications should always be able to
handle getting a `G_IO_ERROR_WOULD_BLOCK` error even when some other
function said that I/O was possible. This can easily happen in case
of a race condition in the application, but it can also happen for other
reasons. For instance, on Windows a socket is always seen as writable
until a write returns `G_IO_ERROR_WOULD_BLOCK`.

`GSocket`s can be either connection oriented or datagram based.
For connection oriented types you must first establish a connection by
either connecting to an address or accepting a connection from another
address. For connectionless socket types the target/source address is
specified or received in each I/O operation.

All socket file descriptors are set to be close-on-exec.

Note that creating a `GSocket` causes the signal `SIGPIPE` to be
ignored for the remainder of the program. If you are writing a
command-line utility that uses `GSocket`, you may need to take into
account the fact that your program will not automatically be killed
if it tries to write to `stdout` after it has been closed.

Like most other APIs in GLib, `GSocket` is not inherently thread safe. To use
a `GSocket` concurrently from multiple threads, you must implement your own
locking.

### Nagle’s algorithm

Since GLib 2.80, `GSocket` will automatically set the `TCP_NODELAY` option on
all `G_SOCKET_TYPE_STREAM` sockets. This disables
[Nagle’s algorithm](https://en.wikipedia.org/wiki/Nagle%27s_algorithm) as it
typically does more harm than good on modern networks.

If your application needs Nagle’s algorithm enabled, call
`Gio.Socket.setOption()` after constructing a `GSocket` to enable it:
```c
socket = g_socket_new (…, G_SOCKET_TYPE_STREAM, …);
if (socket != NULL)
  {
    g_socket_set_option (socket, IPPROTO_TCP, TCP_NODELAY, FALSE, &local_error);
    // handle error if needed
  }
```

_Available since 2.22._

```tsx
import { GSocket } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSocket**

Implements `GDatagramBased`, `GInitable`.

## Props

`ref` receives the `Gio.Socket` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `blocking`

`boolean` · default `true`

Whether I/O on this socket is blocking.

_Available since 2.22._

### `broadcast`

`boolean` · default `false`

Whether the socket should allow sending to broadcast addresses.

_Available since 2.32._

### `family`

`Gio.SocketFamily` · default `G_SOCKET_FAMILY_INVALID` · construct-only

The socket’s address family.

_Available since 2.22._

### `fd`

`number` · default `-1` · construct-only

The socket’s file descriptor.

_Available since 2.22._

### `keepalive`

`boolean` · default `false`

Whether to keep the connection alive by sending periodic pings.

_Available since 2.22._

### `listenBacklog`

`number` · default `10`

The number of outstanding connections in the listen queue.

_Available since 2.22._

### `localAddress`

`Gio.SocketAddress` · read-only, observe with `onNotifyLocalAddress`

The local address the socket is bound to.

_Available since 2.22._

### `multicastLoopback`

`boolean` · default `true`

Whether outgoing multicast packets loop back to the local host.

_Available since 2.32._

### `multicastTtl`

`number` · default `1`

Time-to-live out outgoing multicast packets

_Available since 2.32._

### `protocol`

`Gio.SocketProtocol` · default `G_SOCKET_PROTOCOL_UNKNOWN` · construct-only

The ID of the protocol to use, or `-1` for unknown.

_Available since 2.22._

### `remoteAddress`

`Gio.SocketAddress` · read-only, observe with `onNotifyRemoteAddress`

The remote address the socket is connected to.

_Available since 2.22._

### `timeout`

`number` · default `0`

The timeout in seconds on socket I/O

_Available since 2.26._

### `ttl`

`number` · default `0`

Time-to-live for outgoing unicast packets

_Available since 2.32._

### `type`

`Gio.SocketType` · default `G_SOCKET_TYPE_STREAM` · construct-only

The socket’s type.

_Available since 2.22._

## Methods

Methods are called on the `Gio.Socket` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `accept`

```ts
accept(cancellable: Gio.Cancellable | null): Gio.Socket
```

Accept incoming connections on a connection-based socket. This removes
the first outstanding connection request from the listening socket and
creates a `GSocket` object for it.

The `socket` must be bound to a local address with `g_socket_bind()` and
must be listening for incoming connections (`g_socket_listen()`).

If there are no outstanding connections then the operation will block
or return `G_IO_ERROR_WOULD_BLOCK` if non-blocking I/O is enabled.
To be notified of an incoming connection, wait for the `G_IO_IN` condition.

**Parameters**

- `cancellable`: a `GCancellable` or `null`

**Returns** a new `GSocket`, or `null` on error.
    Free the returned object with `g_object_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `bind`

```ts
bind(address: Gio.SocketAddress, allowReuse: boolean): boolean
```

When a socket is created it is attached to an address family, but it
doesn't have an address in this family. `g_socket_bind()` assigns the
address (sometimes called name) of the socket.

It is generally required to bind to a local address before you can
receive connections. (See `g_socket_listen()` and `g_socket_accept()` ).
In certain situations, you may also want to bind a socket that will be
used to initiate connections, though this is not normally required.

If `socket` is a TCP socket, then `allow_reuse` controls the setting
of the `SO_REUSEADDR` socket option; normally it should be `true` for
server sockets (sockets that you will eventually call
`g_socket_accept()` on), and `false` for client sockets. (Failing to
set this flag on a server socket may cause `g_socket_bind()` to return
`G_IO_ERROR_ADDRESS_IN_USE` if the server program is stopped and then
immediately restarted.)

If `socket` is a UDP socket, then `allow_reuse` determines whether or
not other UDP sockets can be bound to the same address at the same
time. In particular, you can have several UDP sockets bound to the
same address, and they will all receive all of the multicast and
broadcast packets sent to that address. (The behavior of unicast
UDP packets to an address with multiple listeners is not defined.)

**Parameters**

- `address`: a `GSocketAddress` specifying the local address.
- `allowReuse`: whether to allow reusing this address

**Returns** `true` on success, `false` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `checkConnectResult`

```ts
checkConnectResult(): boolean
```

Checks and resets the pending connect error for the socket.
This is used to check for errors when `g_socket_connect()` is
used in non-blocking mode.

**Returns** `true` if no error, `false` otherwise, setting `error` to the error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `close`

```ts
close(): boolean
```

Closes the socket, shutting down any active connection.

Closing a socket does not wait for all outstanding I/O operations
to finish, so the caller should not rely on them to be guaranteed
to complete even if the close returns with no error.

Once the socket is closed, all other operations will return
`G_IO_ERROR_CLOSED`. Closing a socket multiple times will not
return an error.

Sockets will be automatically closed when the last reference
is dropped, but you might want to call this function to make sure
resources are released as early as possible.

Beware that due to the way that TCP works, it is possible for
recently-sent data to be lost if either you close a socket while the
`G_IO_IN` condition is set, or else if the remote connection tries to
send something to you after you close the socket but before it has
finished reading all of the data you sent. There is no easy generic
way to avoid this problem; the easiest fix is to design the network
protocol such that the client will never send data "out of turn".
Another solution is for the server to half-close the connection by
calling `g_socket_shutdown()` with only the `shutdown_write` flag set,
and then wait for the client to notice this and close its side of the
connection, after which the server can safely call `g_socket_close()`.
(This is what `GTcpConnection` does if you call
`g_tcp_connection_set_graceful_disconnect()`. But of course, this
only works if the client will close its connection after the server
does.)

**Returns** `true` on success, `false` on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `conditionCheck`

```ts
conditionCheck(condition: GLib.IOCondition): GLib.IOCondition
```

Checks on the readiness of `socket` to perform operations.
The operations specified in `condition` are checked for and masked
against the currently-satisfied conditions on `socket`. The result
is returned.

Note that on Windows, it is possible for an operation to return
`G_IO_ERROR_WOULD_BLOCK` even immediately after
`g_socket_condition_check()` has claimed that the socket is ready for
writing. Rather than calling `g_socket_condition_check()` and then
writing to the socket if it succeeds, it is generally better to
simply try writing to the socket right away, and try again later if
the initial attempt returns `G_IO_ERROR_WOULD_BLOCK`.

It is meaningless to specify `G_IO_ERR` or `G_IO_HUP` in condition;
these conditions will always be set in the output if they are true.

This call never blocks.

**Parameters**

- `condition`: a `GIOCondition` mask to check

**Returns** the `GIOCondition` mask of the current state

_Available since 2.22._

### `conditionTimedWait`

```ts
conditionTimedWait(condition: GLib.IOCondition, timeoutUs: bigint, cancellable: Gio.Cancellable | null): boolean
```

Waits for up to `timeout_us` microseconds for `condition` to become true
on `socket`. If the condition is met, `true` is returned.

If `cancellable` is cancelled before the condition is met, or if
`timeout_us` (or the socket's `GSocket.timeout`) is reached before the
condition is met, then `false` is returned and `error`, if non-`null`,
is set to the appropriate value (`G_IO_ERROR_CANCELLED` or
`G_IO_ERROR_TIMED_OUT`).

If you don't want a timeout, use `g_socket_condition_wait()`.
(Alternatively, you can pass -1 for `timeout_us`.)

Note that although `timeout_us` is in microseconds for consistency with
other GLib APIs, this function actually only has millisecond
resolution, and the behavior is undefined if `timeout_us` is not an
exact number of milliseconds.

**Parameters**

- `condition`: a `GIOCondition` mask to wait for
- `timeoutUs`: the maximum time (in microseconds) to wait, or -1
- `cancellable`: a `GCancellable`, or `null`

**Returns** `true` if the condition was met, `false` otherwise

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.32._

### `connectionFactoryCreateConnection`

```ts
connectionFactoryCreateConnection(): Gio.SocketConnection
```

Creates a `GSocketConnection` subclass of the right type for
`socket`.

**Returns** a `GSocketConnection`

_Available since 2.22._

### `getAvailableBytes`

```ts
getAvailableBytes(): number
```

Get the amount of data pending in the OS input buffer, without blocking.

If `socket` is a UDP or SCTP socket, this will return the size of
just the next packet, even if additional packets are buffered after
that one.

Note that on Windows, this function is rather inefficient in the
UDP case, and so if you know any plausible upper bound on the size
of the incoming packet, it is better to just do a
`g_socket_receive()` with a buffer of that size, rather than calling
`g_socket_get_available_bytes()` first and then doing a receive of
exactly the right size.

**Returns** the number of bytes that can be read from the socket
without blocking or truncating, or -1 on error.

_Available since 2.32._

### `getBlocking`

```ts
getBlocking(): boolean
```

Gets the blocking mode of the socket. For details on blocking I/O,
see `g_socket_set_blocking()`.

**Returns** `true` if blocking I/O is used, `false` otherwise.

_Available since 2.22._

### `getBroadcast`

```ts
getBroadcast(): boolean
```

Gets the broadcast setting on `socket`; if `true`,
it is possible to send packets to broadcast
addresses.

**Returns** the broadcast setting on `socket`

_Available since 2.32._

### `getCredentials`

```ts
getCredentials(): Gio.Credentials
```

Returns the credentials of the foreign process connected to this
socket, if any (e.g. it is only supported for `G_SOCKET_FAMILY_UNIX`
sockets).

If this operation isn't supported on the OS, the method fails with
the `G_IO_ERROR_NOT_SUPPORTED` error. On Linux this is implemented
by reading the `SO_PEERCRED` option on the underlying socket.

This method can be expected to be available on the following platforms:

- Linux since GLib 2.26
- OpenBSD since GLib 2.30
- Solaris, Illumos and OpenSolaris since GLib 2.40
- NetBSD since GLib 2.42
- macOS, tvOS, iOS since GLib 2.66

Other ways to obtain credentials from a foreign peer includes the
`GUnixCredentialsMessage` type and
`g_unix_connection_send_credentials()` /
`g_unix_connection_receive_credentials()` functions.

**Returns** `null` if `error` is set, otherwise a `GCredentials` object
that must be freed with `g_object_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `getFamily`

```ts
getFamily(): Gio.SocketFamily
```

Gets the socket family of the socket.

**Returns** a `GSocketFamily`

_Available since 2.22._

### `getFd`

```ts
getFd(): number
```

Returns the underlying OS socket object. On unix this
is a socket file descriptor, and on Windows this is
a Winsock2 SOCKET handle. This may be useful for
doing platform specific or otherwise unusual operations
on the socket.

**Returns** the file descriptor of the socket.

_Available since 2.22._

### `getKeepalive`

```ts
getKeepalive(): boolean
```

Gets the keepalive mode of the socket. For details on this,
see `g_socket_set_keepalive()`.

**Returns** `true` if keepalive is active, `false` otherwise.

_Available since 2.22._

### `getListenBacklog`

```ts
getListenBacklog(): number
```

Gets the listen backlog setting of the socket. For details on this,
see `g_socket_set_listen_backlog()`.

**Returns** the maximum number of pending connections.

_Available since 2.22._

### `getLocalAddress`

```ts
getLocalAddress(): Gio.SocketAddress
```

Try to get the local address of a bound socket. This is only
useful if the socket has been bound to a local address,
either explicitly or implicitly when connecting.

**Returns** a `GSocketAddress` or `null` on error.
    Free the returned object with `g_object_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `getMulticastLoopback`

```ts
getMulticastLoopback(): boolean
```

Gets the multicast loopback setting on `socket`; if `true` (the
default), outgoing multicast packets will be looped back to
multicast listeners on the same host.

**Returns** the multicast loopback setting on `socket`

_Available since 2.32._

### `getMulticastTtl`

```ts
getMulticastTtl(): number
```

Gets the multicast time-to-live setting on `socket`; see
`g_socket_set_multicast_ttl()` for more details.

**Returns** the multicast time-to-live setting on `socket`

_Available since 2.32._

### `getOption`

```ts
getOption(level: number, optname: number): [boolean, number]
```

Gets the value of an integer-valued option on `socket`, as with
`getsockopt()`. (If you need to fetch a  non-integer-valued option,
you will need to call `getsockopt()` directly.)

The [`<gio/gnetworking.h>`](networking.html)
header pulls in system headers that will define most of the
standard/portable socket options. For unusual socket protocols or
platform-dependent options, you may need to include additional
headers.

Note that even for socket options that are a single byte in size,
`value` is still a pointer to a `gint` variable, not a `guchar`;
`g_socket_get_option()` will handle the conversion internally.

**Parameters**

- `level`: the "API level" of the option (eg, `SOL_SOCKET`)
- `optname`: the "name" of the option (eg, `SO_BROADCAST`)

**Returns** Tuple of:

- `result`: success or failure. On failure, `error` will be set, and the system error value (`errno` or WSAGetLastError()) will still be set to the result of the `getsockopt()` call.
- `value`: return location for the option value

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.36._

### `getProtocol`

```ts
getProtocol(): Gio.SocketProtocol
```

Gets the socket protocol id the socket was created with.
In case the protocol is unknown, -1 is returned.

**Returns** a protocol id, or -1 if unknown

_Available since 2.22._

### `getRemoteAddress`

```ts
getRemoteAddress(): Gio.SocketAddress
```

Try to get the remote address of a connected socket. This is only
useful for connection oriented sockets that have been connected.

**Returns** a `GSocketAddress` or `null` on error.
    Free the returned object with `g_object_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `getSocketType`

```ts
getSocketType(): Gio.SocketType
```

Gets the socket type of the socket.

**Returns** a `GSocketType`

_Available since 2.22._

### `getTimeout`

```ts
getTimeout(): number
```

Gets the timeout setting of the socket. For details on this, see
`g_socket_set_timeout()`.

**Returns** the timeout in seconds

_Available since 2.26._

### `getTtl`

```ts
getTtl(): number
```

Gets the unicast time-to-live setting on `socket`; see
`g_socket_set_ttl()` for more details.

**Returns** the time-to-live setting on `socket`

_Available since 2.32._

### `isClosed`

```ts
isClosed(): boolean
```

Checks whether a socket is closed.

**Returns** `true` if socket is closed, `false` otherwise

_Available since 2.22._

### `isConnected`

```ts
isConnected(): boolean
```

Check whether the socket is connected. This is only useful for
connection-oriented sockets.

If using `g_socket_shutdown()`, this function will return `true` until the
socket has been shut down for reading and writing. If you do a non-blocking
connect, this function will not return `true` until after you call
`g_socket_check_connect_result()`.

**Returns** `true` if socket is connected, `false` otherwise.

_Available since 2.22._

### `joinMulticastGroup`

```ts
joinMulticastGroup(group: Gio.InetAddress, sourceSpecific: boolean, iface: string | null): boolean
```

Registers `socket` to receive multicast messages sent to `group`.
`socket` must be a `G_SOCKET_TYPE_DATAGRAM` socket, and must have
been bound to an appropriate interface and port with
`g_socket_bind()`.

If `iface` is `null`, the system will automatically pick an interface
to bind to based on `group`.

If `source_specific` is `true`, source-specific multicast as defined
in RFC 4604 is used. Note that on older platforms this may fail
with a `G_IO_ERROR_NOT_SUPPORTED` error.

To bind to a given source-specific multicast address, use
`g_socket_join_multicast_group_ssm()` instead.

**Parameters**

- `group`: a `GInetAddress` specifying the group address to join.
- `sourceSpecific`: `true` if source-specific multicast should be used
- `iface`: Name of the interface to use, or `null`

**Returns** `true` on success, `false` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.32._

### `joinMulticastGroupSsm`

```ts
joinMulticastGroupSsm(group: Gio.InetAddress, sourceSpecific: Gio.InetAddress | null, iface: string | null): boolean
```

Registers `socket` to receive multicast messages sent to `group`.
`socket` must be a `G_SOCKET_TYPE_DATAGRAM` socket, and must have
been bound to an appropriate interface and port with
`g_socket_bind()`.

If `iface` is `null`, the system will automatically pick an interface
to bind to based on `group`.

If `source_specific` is not `null`, use source-specific multicast as
defined in RFC 4604. Note that on older platforms this may fail
with a `G_IO_ERROR_NOT_SUPPORTED` error.

Note that this function can be called multiple times for the same
`group` with different `source_specific` in order to receive multicast
packets from more than one source.

**Parameters**

- `group`: a `GInetAddress` specifying the group address to join.
- `sourceSpecific`: a `GInetAddress` specifying the source-specific multicast address or `null` to ignore.
- `iface`: Name of the interface to use, or `null`

**Returns** `true` on success, `false` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.56._

### `leaveMulticastGroup`

```ts
leaveMulticastGroup(group: Gio.InetAddress, sourceSpecific: boolean, iface: string | null): boolean
```

Removes `socket` from the multicast group defined by `group`, `iface`,
and `source_specific` (which must all have the same values they had
when you joined the group).

`socket` remains bound to its address and port, and can still receive
unicast messages after calling this.

To unbind to a given source-specific multicast address, use
`g_socket_leave_multicast_group_ssm()` instead.

**Parameters**

- `group`: a `GInetAddress` specifying the group address to leave.
- `sourceSpecific`: `true` if source-specific multicast was used
- `iface`: Interface used

**Returns** `true` on success, `false` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.32._

### `leaveMulticastGroupSsm`

```ts
leaveMulticastGroupSsm(group: Gio.InetAddress, sourceSpecific: Gio.InetAddress | null, iface: string | null): boolean
```

Removes `socket` from the multicast group defined by `group`, `iface`,
and `source_specific` (which must all have the same values they had
when you joined the group).

`socket` remains bound to its address and port, and can still receive
unicast messages after calling this.

**Parameters**

- `group`: a `GInetAddress` specifying the group address to leave.
- `sourceSpecific`: a `GInetAddress` specifying the source-specific multicast address or `null` to ignore.
- `iface`: Name of the interface to use, or `null`

**Returns** `true` on success, `false` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.56._

### `listen`

```ts
listen(): boolean
```

Marks the socket as a server socket, i.e. a socket that is used
to accept incoming requests using `g_socket_accept()`.

Before calling this the socket must be bound to a local address using
`g_socket_bind()`.

To set the maximum amount of outstanding clients, use
`g_socket_set_listen_backlog()`.

**Returns** `true` on success, `false` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `receiveBytes`

```ts
receiveBytes(size: number, timeoutUs: bigint, cancellable: Gio.Cancellable | null): GLib.Bytes
```

Receives data (up to `size` bytes) from a socket.

This function is a variant of `Gio.Socket.receive()` which returns a
`GLib.Bytes` rather than a plain buffer.

Pass `-1` to `timeout_us` to block indefinitely until data is received (or
the connection is closed, or there is an error). Pass `0` to use the default
timeout from `Gio.Socket.timeout`, or pass a positive number to wait
for that many microseconds for data before returning `G_IO_ERROR_TIMED_OUT`.

**Parameters**

- `size`: the number of bytes you want to read from the socket
- `timeoutUs`: the timeout to wait for, in microseconds, or `-1` to block indefinitely
- `cancellable`: a `GCancellable`, or `NULL`

**Returns** a bytes buffer containing the
  received bytes, or `NULL` on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.80._

### `receiveBytesFrom`

```ts
receiveBytesFrom(size: number, timeoutUs: bigint, cancellable: Gio.Cancellable | null): [GLib.Bytes, Gio.SocketAddress]
```

Receive data (up to `size` bytes) from a socket.

This function is a variant of `Gio.Socket.receiveFrom()` which returns
a `GLib.Bytes` rather than a plain buffer.

If `address` is non-`null` then `address` will be set equal to the
source address of the received packet.

The `address` is owned by the caller.

Pass `-1` to `timeout_us` to block indefinitely until data is received (or
the connection is closed, or there is an error). Pass `0` to use the default
timeout from `Gio.Socket.timeout`, or pass a positive number to wait
for that many microseconds for data before returning `G_IO_ERROR_TIMED_OUT`.

**Parameters**

- `size`: the number of bytes you want to read from the socket
- `timeoutUs`: the timeout to wait for, in microseconds, or `-1` to block indefinitely
- `cancellable`: a `GCancellable`, or `NULL`

**Returns** Tuple of:

- `result`: a bytes buffer containing the received bytes, or `NULL` on error
- `address`: return location for a `GSocketAddress`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.80._

### `receiveMessage`

```ts
receiveMessage(vectors: Gio.InputVector[], flags: number, cancellable: Gio.Cancellable | null): [number, Gio.SocketAddress, Gio.SocketControlMessage[] | null, number]
```

Receive data from a socket.  For receiving multiple messages, see
`g_socket_receive_messages()`; for easier use, see
`g_socket_receive()` and `g_socket_receive_from()`.

If `address` is non-`null` then `address` will be set equal to the
source address of the received packet.
`address` is owned by the caller.

`vector` must point to an array of `GInputVector` structs and
`num_vectors` must be the length of this array.  These structs
describe the buffers that received data will be scattered into.
If `num_vectors` is -1, then `vectors` is assumed to be terminated
by a `GInputVector` with a `null` buffer pointer.

As a special case, if `num_vectors` is 0 (in which case, `vectors`
may of course be `null`), then a single byte is received and
discarded. This is to facilitate the common practice of sending a
single '\0' byte for the purposes of transferring ancillary data.

`messages`, if non-`null`, will be set to point to a newly-allocated
array of `GSocketControlMessage` instances or `null` if no such
messages was received. These correspond to the control messages
received from the kernel, one `GSocketControlMessage` per message
from the kernel. This array is `null`-terminated and must be freed
by the caller using `g_free()` after calling `g_object_unref()` on each
element. If `messages` is `null`, any control messages received will
be discarded.

`num_messages`, if non-`null`, will be set to the number of control
messages received.

If both `messages` and `num_messages` are non-`null`, then
`num_messages` gives the number of `GSocketControlMessage` instances
in `messages` (ie: not including the `null` terminator).

`flags` is an in/out parameter. The commonly available arguments
for this are available in the `GSocketMsgFlags` enum, but the
values there are the same as the system values, and the flags
are passed in as-is, so you can pass in system-specific flags too
(and `g_socket_receive_message()` may pass system-specific flags out).
Flags passed in to the parameter affect the receive operation; flags returned
out of it are relevant to the specific returned message.

As with `g_socket_receive()`, data may be discarded if `socket` is
`G_SOCKET_TYPE_DATAGRAM` or `G_SOCKET_TYPE_SEQPACKET` and you do not
provide enough buffer space to read a complete message. You can pass
`G_SOCKET_MSG_PEEK` in `flags` to peek at the current message without
removing it from the receive queue, but there is no portable way to find
out the length of the message other than by reading it into a
sufficiently-large buffer.

If the socket is in blocking mode the call will block until there
is some data to receive, the connection is closed, or there is an
error. If there is no data available and the socket is in
non-blocking mode, a `G_IO_ERROR_WOULD_BLOCK` error will be
returned. To be notified when data is available, wait for the
`G_IO_IN` condition.

On error -1 is returned and `error` is set accordingly.

**Parameters**

- `vectors`: an array of `GInputVector` structs
- `flags`: a pointer to an int containing `GSocketMsgFlags` flags, which may additionally contain [other platform specific flags](http://man7.org/linux/man-pages/man2/recv.2.html)
- `cancellable`: a `GCancellable` or `null`

**Returns** Tuple of:

- `result`: Number of bytes read, or 0 if the connection was closed by the peer, or -1 on error
- `address`: a pointer to a `GSocketAddress` pointer, or `null`
- `messages`: a pointer which may be filled with an array of `GSocketControlMessages`, or `null`
- `flags`: a pointer to an int containing `GSocketMsgFlags` flags, which may additionally contain [other platform specific flags](http://man7.org/linux/man-pages/man2/recv.2.html)

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `send`

```ts
send(buffer: Uint8Array | number[], cancellable: Gio.Cancellable | null): number
```

Tries to send `size` bytes from `buffer` on the socket. This is
mainly used by connection-oriented sockets; it is identical to
`g_socket_send_to()` with `address` set to `null`.

If the socket is in blocking mode the call will block until there is
space for the data in the socket queue. If there is no space available
and the socket is in non-blocking mode a `G_IO_ERROR_WOULD_BLOCK` error
will be returned. To be notified when space is available, wait for the
`G_IO_OUT` condition. Note though that you may still receive
`G_IO_ERROR_WOULD_BLOCK` from `g_socket_send()` even if you were previously
notified of a `G_IO_OUT` condition. (On Windows in particular, this is
very common due to the way the underlying APIs work.)

On error -1 is returned and `error` is set accordingly.

**Parameters**

- `buffer`: the buffer containing the data to send.
- `cancellable`: a `GCancellable` or `null`

**Returns** Number of bytes written (which may be less than `size`), or -1
on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `sendMessage`

```ts
sendMessage(address: Gio.SocketAddress | null, vectors: Gio.OutputVector[], messages: Gio.SocketControlMessage[] | null, flags: number, cancellable: Gio.Cancellable | null): number
```

Send data to `address` on `socket`.  For sending multiple messages see
`g_socket_send_messages()`; for easier use, see
`g_socket_send()` and `g_socket_send_to()`.

If `address` is `null` then the message is sent to the default receiver
(set by `g_socket_connect()`).

`vectors` must point to an array of `GOutputVector` structs and
`num_vectors` must be the length of this array. (If `num_vectors` is -1,
then `vectors` is assumed to be terminated by a `GOutputVector` with a
`null` buffer pointer.) The `GOutputVector` structs describe the buffers
that the sent data will be gathered from. Using multiple
`GOutputVectors` is more memory-efficient than manually copying
data from multiple sources into a single buffer, and more
network-efficient than making multiple calls to `g_socket_send()`.

`messages`, if non-`null`, is taken to point to an array of `num_messages`
`GSocketControlMessage` instances. These correspond to the control
messages to be sent on the socket.
If `num_messages` is -1 then `messages` is treated as a `null`-terminated
array.

`flags` modify how the message is sent. The commonly available arguments
for this are available in the `GSocketMsgFlags` enum, but the
values there are the same as the system values, and the flags
are passed in as-is, so you can pass in system-specific flags too.

If the socket is in blocking mode the call will block until there is
space for the data in the socket queue. If there is no space available
and the socket is in non-blocking mode a `G_IO_ERROR_WOULD_BLOCK` error
will be returned. To be notified when space is available, wait for the
`G_IO_OUT` condition. Note though that you may still receive
`G_IO_ERROR_WOULD_BLOCK` from `g_socket_send()` even if you were previously
notified of a `G_IO_OUT` condition. (On Windows in particular, this is
very common due to the way the underlying APIs work.)

The sum of the sizes of each `GOutputVector` in vectors must not be
greater than `G_MAXSSIZE`. If the message can be larger than this,
then it is mandatory to use the `g_socket_send_message_with_timeout()`
function.

On error -1 is returned and `error` is set accordingly.

**Parameters**

- `address`: a `GSocketAddress`, or `null`
- `vectors`: an array of `GOutputVector` structs
- `messages`: a pointer to an array of `GSocketControlMessages`, or `null`.
- `flags`: an int containing `GSocketMsgFlags` flags, which may additionally contain [other platform specific flags](http://man7.org/linux/man-pages/man2/recv.2.html)
- `cancellable`: a `GCancellable` or `null`

**Returns** Number of bytes written (which may be less than `size`), or -1
on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `sendMessageWithTimeout`

```ts
sendMessageWithTimeout(address: Gio.SocketAddress | null, vectors: Gio.OutputVector[], messages: Gio.SocketControlMessage[] | null, flags: number, timeoutUs: bigint, cancellable: Gio.Cancellable | null): [Gio.PollableReturn, number]
```

This behaves exactly the same as `g_socket_send_message()`, except that
the choice of timeout behavior is determined by the `timeout_us` argument
rather than by `socket`'s properties.

On error `G_POLLABLE_RETURN_FAILED` is returned and `error` is set accordingly, or
if the socket is currently not writable `G_POLLABLE_RETURN_WOULD_BLOCK` is
returned. `bytes_written` will contain 0 in both cases.

**Parameters**

- `address`: a `GSocketAddress`, or `null`
- `vectors`: an array of `GOutputVector` structs
- `messages`: a pointer to an array of `GSocketControlMessages`, or `null`.
- `flags`: an int containing `GSocketMsgFlags` flags, which may additionally contain [other platform specific flags](http://man7.org/linux/man-pages/man2/recv.2.html)
- `timeoutUs`: the maximum time (in microseconds) to wait, or -1
- `cancellable`: a `GCancellable` or `null`

**Returns** Tuple of:

- `result`: `G_POLLABLE_RETURN_OK` if all data was successfully written, `G_POLLABLE_RETURN_WOULD_BLOCK` if the socket is currently not writable, or `G_POLLABLE_RETURN_FAILED` if an error happened and `error` is set.
- `bytesWritten`: location to store the number of bytes that were written to the socket

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.60._

### `sendTo`

```ts
sendTo(address: Gio.SocketAddress | null, buffer: Uint8Array | number[], cancellable: Gio.Cancellable | null): number
```

Tries to send `size` bytes from `buffer` to `address`. If `address` is
`null` then the message is sent to the default receiver (set by
`g_socket_connect()`).

See `g_socket_send()` for additional information.

**Parameters**

- `address`: a `GSocketAddress`, or `null`
- `buffer`: the buffer containing the data to send.
- `cancellable`: a `GCancellable` or `null`

**Returns** Number of bytes written (which may be less than `size`), or -1
on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `sendWithBlocking`

```ts
sendWithBlocking(buffer: Uint8Array | number[], blocking: boolean, cancellable: Gio.Cancellable | null): number
```

This behaves exactly the same as `g_socket_send()`, except that
the choice of blocking or non-blocking behavior is determined by
the `blocking` argument rather than by `socket`'s properties.

**Parameters**

- `buffer`: the buffer containing the data to send.
- `blocking`: whether to do blocking or non-blocking I/O
- `cancellable`: a `GCancellable` or `null`

**Returns** Number of bytes written (which may be less than `size`), or -1
on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `setBlocking`

```ts
setBlocking(blocking: boolean): void
```

Sets the blocking mode of the socket. In blocking mode
all operations (which don’t take an explicit blocking parameter) block until
they succeed or there is an error. In
non-blocking mode all functions return results immediately or
with a `G_IO_ERROR_WOULD_BLOCK` error.

All sockets are created in blocking mode. However, note that the
platform level socket is always non-blocking, and blocking mode
is a GSocket level feature.

**Parameters**

- `blocking`: Whether to use blocking I/O or not.

_Available since 2.22._

### `setBroadcast`

```ts
setBroadcast(broadcast: boolean): void
```

Sets whether `socket` should allow sending to broadcast addresses.
This is `false` by default.

**Parameters**

- `broadcast`: whether `socket` should allow sending to broadcast addresses

_Available since 2.32._

### `setKeepalive`

```ts
setKeepalive(keepalive: boolean): void
```

Sets or unsets the `SO_KEEPALIVE` flag on the underlying socket. When
this flag is set on a socket, the system will attempt to verify that the
remote socket endpoint is still present if a sufficiently long period of
time passes with no data being exchanged. If the system is unable to
verify the presence of the remote endpoint, it will automatically close
the connection.

This option is only functional on certain kinds of sockets. (Notably,
`G_SOCKET_PROTOCOL_TCP` sockets.)

The exact time between pings is system- and protocol-dependent, but will
normally be at least two hours. Most commonly, you would set this flag
on a server socket if you want to allow clients to remain idle for long
periods of time, but also want to ensure that connections are eventually
garbage-collected if clients crash or become unreachable.

**Parameters**

- `keepalive`: Value for the keepalive flag

_Available since 2.22._

### `setListenBacklog`

```ts
setListenBacklog(backlog: number): void
```

Sets the maximum number of outstanding connections allowed
when listening on this socket. If more clients than this are
connecting to the socket and the application is not handling them
on time then the new connections will be refused.

Note that this must be called before `g_socket_listen()` and has no
effect if called after that.

**Parameters**

- `backlog`: the maximum number of pending connections.

_Available since 2.22._

### `setMulticastLoopback`

```ts
setMulticastLoopback(loopback: boolean): void
```

Sets whether outgoing multicast packets will be received by sockets
listening on that multicast address on the same host. This is `true`
by default.

**Parameters**

- `loopback`: whether `socket` should receive messages sent to its multicast groups from the local host

_Available since 2.32._

### `setMulticastTtl`

```ts
setMulticastTtl(ttl: number): void
```

Sets the time-to-live for outgoing multicast datagrams on `socket`.
By default, this is 1, meaning that multicast packets will not leave
the local network.

**Parameters**

- `ttl`: the time-to-live value for all multicast datagrams on `socket`

_Available since 2.32._

### `setOption`

```ts
setOption(level: number, optname: number, value: number): boolean
```

Sets the value of an integer-valued option on `socket`, as with
`setsockopt()`. (If you need to set a non-integer-valued option,
you will need to call `setsockopt()` directly.)

The [`<gio/gnetworking.h>`](networking.html)
header pulls in system headers that will define most of the
standard/portable socket options. For unusual socket protocols or
platform-dependent options, you may need to include additional
headers.

**Parameters**

- `level`: the "API level" of the option (eg, `SOL_SOCKET`)
- `optname`: the "name" of the option (eg, `SO_BROADCAST`)
- `value`: the value to set the option to

**Returns** success or failure. On failure, `error` will be set, and
  the system error value (`errno` or WSAGetLastError()) will still
  be set to the result of the `setsockopt()` call.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.36._

### `setTimeout`

```ts
setTimeout(timeout: number): void
```

Sets the time in seconds after which I/O operations on `socket` will
time out if they have not yet completed.

On a blocking socket, this means that any blocking `GSocket`
operation will time out after `timeout` seconds of inactivity,
returning `G_IO_ERROR_TIMED_OUT`.

On a non-blocking socket, calls to `g_socket_condition_wait()` will
also fail with `G_IO_ERROR_TIMED_OUT` after the given time. Sources
created with `g_socket_create_source()` will trigger after
`timeout` seconds of inactivity, with the requested condition
set, at which point calling `g_socket_receive()`, `g_socket_send()`,
`g_socket_check_connect_result()`, etc, will fail with
`G_IO_ERROR_TIMED_OUT`.

If `timeout` is 0 (the default), operations will never time out
on their own.

Note that if an I/O operation is interrupted by a signal, this may
cause the timeout to be reset.

**Parameters**

- `timeout`: the timeout for `socket`, in seconds, or 0 for none

_Available since 2.26._

### `setTtl`

```ts
setTtl(ttl: number): void
```

Sets the time-to-live for outgoing unicast packets on `socket`.
By default the platform-specific default value is used.

**Parameters**

- `ttl`: the time-to-live value for all unicast packets on `socket`

_Available since 2.32._

### `shutdown`

```ts
shutdown(shutdownRead: boolean, shutdownWrite: boolean): boolean
```

Shut down part or all of a full-duplex connection.

If `shutdown_read` is `true` then the receiving side of the connection
is shut down, and further reading is disallowed.

If `shutdown_write` is `true` then the sending side of the connection
is shut down, and further writing is disallowed.

It is allowed for both `shutdown_read` and `shutdown_write` to be `true`.

One example where it is useful to shut down only one side of a connection is
graceful disconnect for TCP connections where you close the sending side,
then wait for the other side to close the connection, thus ensuring that the
other side saw all sent data.

**Parameters**

- `shutdownRead`: whether to shut down the read side
- `shutdownWrite`: whether to shut down the write side

**Returns** `true` on success, `false` on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `socketConditionWait`

```ts
socketConditionWait(condition: GLib.IOCondition, cancellable: Gio.Cancellable | null): boolean
```

Waits for `condition` to become true on `socket`. When the condition
is met, `true` is returned.

If `cancellable` is cancelled before the condition is met, or if the
socket has a timeout set and it is reached before the condition is
met, then `false` is returned and `error`, if non-`null`, is set to
the appropriate value (`G_IO_ERROR_CANCELLED` or
`G_IO_ERROR_TIMED_OUT`).

See also `g_socket_condition_timed_wait()`.

**Parameters**

- `condition`: a `GIOCondition` mask to wait for
- `cancellable`: a `GCancellable`, or `null`

**Returns** `true` if the condition was met, `false` otherwise

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `socketConnect`

```ts
socketConnect(address: Gio.SocketAddress, cancellable: Gio.Cancellable | null): boolean
```

Connect the socket to the specified remote address.

For connection oriented socket this generally means we attempt to make
a connection to the `address`. For a connection-less socket it sets
the default address for `g_socket_send()` and discards all incoming datagrams
from other sources.

Generally connection oriented sockets can only connect once, but
connection-less sockets can connect multiple times to change the
default address.

If the connect call needs to do network I/O it will block, unless
non-blocking I/O is enabled. Then `G_IO_ERROR_PENDING` is returned
and the user can be notified of the connection finishing by waiting
for the G_IO_OUT condition. The result of the connection must then be
checked with `g_socket_check_connect_result()`.

**Parameters**

- `address`: a `GSocketAddress` specifying the remote address.
- `cancellable`: a `GCancellable` or `null`

**Returns** `true` if connected, `false` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `socketReceiveMessages`

```ts
socketReceiveMessages(messages: Gio.InputMessage[], flags: number, cancellable: Gio.Cancellable | null): number
```

Receive multiple data messages from `socket` in one go.  This is the most
complicated and fully-featured version of this call. For easier use, see
`g_socket_receive()`, `g_socket_receive_from()`, and `g_socket_receive_message()`.

`messages` must point to an array of `GInputMessage` structs and
`num_messages` must be the length of this array. Each `GInputMessage`
contains a pointer to an array of `GInputVector` structs describing the
buffers that the data received in each message will be written to. Using
multiple `GInputVectors` is more memory-efficient than manually copying data
out of a single buffer to multiple sources, and more system-call-efficient
than making multiple calls to `g_socket_receive()`, such as in scenarios where
a lot of data packets need to be received (e.g. high-bandwidth video
streaming over RTP/UDP).

`flags` modify how all messages are received. The commonly available
arguments for this are available in the `GSocketMsgFlags` enum, but the
values there are the same as the system values, and the flags
are passed in as-is, so you can pass in system-specific flags too. These
flags affect the overall receive operation. Flags affecting individual
messages are returned in `GInputMessage`.flags.

The other members of `GInputMessage` are treated as described in its
documentation.

If `GSocket.blocking` is `true` the call will block until `num_messages` have
been received, or the end of the stream is reached.

If `GSocket.blocking` is `false` the call will return up to `num_messages`
without blocking, or `G_IO_ERROR_WOULD_BLOCK` if no messages are queued in the
operating system to be received.

In blocking mode, if `GSocket.timeout` is positive and is reached before any
messages are received, `G_IO_ERROR_TIMED_OUT` is returned, otherwise up to
`num_messages` are returned. (Note: This is effectively the
behaviour of `MSG_WAITFORONE` with `recvmmsg()`.)

To be notified when messages are available, wait for the
`G_IO_IN` condition. Note though that you may still receive
`G_IO_ERROR_WOULD_BLOCK` from `g_socket_receive_messages()` even if you were
previously notified of a `G_IO_IN` condition.

If the remote peer closes the connection, any messages queued in the
operating system will be returned, and subsequent calls to
`g_socket_receive_messages()` will return 0 (with no error set).

On error -1 is returned and `error` is set accordingly. An error will only
be returned if zero messages could be received; otherwise the number of
messages successfully received before the error will be returned.

**Parameters**

- `messages`: an array of `GInputMessage` structs
- `flags`: an int containing `GSocketMsgFlags` flags for the overall operation, which may additionally contain [other platform specific flags](http://man7.org/linux/man-pages/man2/recv.2.html)
- `cancellable`: a `GCancellable` or `null`

**Returns** number of messages received, or -1 on error. Note that the number
    of messages received may be smaller than `num_messages` if in non-blocking
    mode, if the peer closed the connection, or if `num_messages`
    was larger than `UIO_MAXIOV` (1024), in which case the caller may re-try
    to receive the remaining messages.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.48._

### `socketSendMessages`

```ts
socketSendMessages(messages: Gio.OutputMessage[], flags: number, cancellable: Gio.Cancellable | null): number
```

Send multiple data messages from `socket` in one go.  This is the most
complicated and fully-featured version of this call. For easier use, see
`g_socket_send()`, `g_socket_send_to()`, and `g_socket_send_message()`.

`messages` must point to an array of `GOutputMessage` structs and
`num_messages` must be the length of this array. Each `GOutputMessage`
contains an address to send the data to, and a pointer to an array of
`GOutputVector` structs to describe the buffers that the data to be sent
for each message will be gathered from. Using multiple `GOutputVectors` is
more memory-efficient than manually copying data from multiple sources
into a single buffer, and more network-efficient than making multiple
calls to `g_socket_send()`. Sending multiple messages in one go avoids the
overhead of making a lot of syscalls in scenarios where a lot of data
packets need to be sent (e.g. high-bandwidth video streaming over RTP/UDP),
or where the same data needs to be sent to multiple recipients.

`flags` modify how the message is sent. The commonly available arguments
for this are available in the `GSocketMsgFlags` enum, but the
values there are the same as the system values, and the flags
are passed in as-is, so you can pass in system-specific flags too.

If the socket is in blocking mode the call will block until there is
space for all the data in the socket queue. If there is no space available
and the socket is in non-blocking mode a `G_IO_ERROR_WOULD_BLOCK` error
will be returned if no data was written at all, otherwise the number of
messages sent will be returned. To be notified when space is available,
wait for the `G_IO_OUT` condition. Note though that you may still receive
`G_IO_ERROR_WOULD_BLOCK` from `g_socket_send()` even if you were previously
notified of a `G_IO_OUT` condition. (On Windows in particular, this is
very common due to the way the underlying APIs work.)

On error -1 is returned and `error` is set accordingly. An error will only
be returned if zero messages could be sent; otherwise the number of messages
successfully sent before the error will be returned.

**Parameters**

- `messages`: an array of `GOutputMessage` structs
- `flags`: an int containing `GSocketMsgFlags` flags, which may additionally contain [other platform specific flags](http://man7.org/linux/man-pages/man2/recv.2.html)
- `cancellable`: a `GCancellable` or `null`

**Returns** number of messages sent, or -1 on error. Note that the number of
    messages sent may be smaller than `num_messages` if the socket is
    non-blocking or if `num_messages` was larger than UIO_MAXIOV (1024),
    in which case the caller may re-try to send the remaining messages.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.44._

### `speaksIpv4`

```ts
speaksIpv4(): boolean
```

Checks if a socket is capable of speaking IPv4.

IPv4 sockets are capable of speaking IPv4.  On some operating systems
and under some combinations of circumstances IPv6 sockets are also
capable of speaking IPv4.  See RFC 3493 section 3.7 for more
information.

No other types of sockets are currently considered as being capable
of speaking IPv4.

**Returns** `true` if this socket can be used with IPv4.

_Available since 2.22._
