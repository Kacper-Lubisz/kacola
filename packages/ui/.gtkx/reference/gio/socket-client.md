---
description: "GSocketClient is a lightweight high-level utility class for connecting to a network host using a connection oriented socket type."
---

# GSocketClient

`GSocketClient` is a lightweight high-level utility class for connecting to
a network host using a connection oriented socket type.

You create a `GSocketClient` object, set any options you want, and then
call a sync or async connect operation, which returns a
`Gio.SocketConnection` subclass on success.

The type of the `Gio.SocketConnection` object returned depends on the
type of the underlying socket that is in use. For instance, for a TCP/IP
connection it will be a `Gio.TcpConnection`.

As `GSocketClient` is a lightweight object, you don't need to cache it. You
can just create a new one any time you need one.

_Available since 2.22._

```tsx
import { GSocketClient } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSocketClient**

## Props

`ref` receives the `Gio.SocketClient` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `enableProxy`

`boolean` · default `true`

Enable proxy support.

_Available since 2.22._

### `family`

`Gio.SocketFamily` · default `G_SOCKET_FAMILY_INVALID`

The address family to use for socket construction.

_Available since 2.22._

### `localAddress`

`Gio.SocketAddress | ReactElement`

The local address constructed sockets will be bound to.

_Available since 2.22._

### `protocol`

`Gio.SocketProtocol` · default `G_SOCKET_PROTOCOL_DEFAULT`

The protocol to use for socket construction, or `0` for default.

_Available since 2.22._

### `proxyResolver`

`Gio.ProxyResolver | ReactElement`

The proxy resolver to use

_Available since 2.36._

### `timeout`

`number` · default `0`

The I/O timeout for sockets, in seconds, or `0` for none.

_Available since 2.22._

### `tls`

`boolean` · default `false`

Whether to create TLS connections.

_Available since 2.22._

### `tlsValidationFlags`

`Gio.TlsCertificateFlags` · default `G_TLS_CERTIFICATE_UNKNOWN_CA | G_TLS_CERTIFICATE_BAD_IDENTITY | G_TLS_CERTIFICATE_NOT_ACTIVATED | G_TLS_CERTIFICATE_EXPIRED | G_TLS_CERTIFICATE_REVOKED | G_TLS_CERTIFICATE_INSECURE | G_TLS_CERTIFICATE_GENERIC_ERROR` · deprecated since 2.72

The TLS validation flags used when creating TLS connections. The
default value is `G_TLS_CERTIFICATE_VALIDATE_ALL`.

GLib guarantees that if certificate verification fails, at least one
flag will be set, but it does not guarantee that all possible flags
will be set. Accordingly, you may not safely decide to ignore any
particular type of error. For example, it would be incorrect to mask
`G_TLS_CERTIFICATE_EXPIRED` if you want to allow expired certificates,
because this could potentially be the only error flag set even if
other problems exist with the certificate. Therefore, there is no
safe way to use this property. This is not a horrible problem,
though, because you should not be attempting to ignore validation
errors anyway. If you really must ignore TLS certificate errors,
connect to the `GSocketClient.event` signal, wait for it to be
emitted with `G_SOCKET_CLIENT_TLS_HANDSHAKING`, and use that to
connect to `GTlsConnection.accept-certificate`.

> **Deprecated since 2.72.** Do not attempt to ignore validation errors.

### `type`

`Gio.SocketType` · default `G_SOCKET_TYPE_STREAM`

The type to use for socket construction.

_Available since 2.22._

## Signals

### `onEvent`

```ts
(event: Gio.SocketClientEvent, connectable: Gio.SocketConnectable, connection: Gio.IOStream | null, self: Gio.SocketClient) => void
```

Emitted when `client`'s activity on `connectable` changes state.
Among other things, this can be used to provide progress
information about a network connection in the UI. The meanings of
the different `event` values are as follows:

- `G_SOCKET_CLIENT_RESOLVING`: `client` is about to look up `connectable`
  in DNS. `connection` will be `null`.

- `G_SOCKET_CLIENT_RESOLVED`:  `client` has successfully resolved
  `connectable` in DNS. `connection` will be `null`.

- `G_SOCKET_CLIENT_CONNECTING`: `client` is about to make a connection
  to a remote host; either a proxy server or the destination server
  itself. `connection` is the `GSocketConnection`, which is not yet
  connected.  Since GLib 2.40, you can access the remote
  address via `g_socket_connection_get_remote_address()`.

- `G_SOCKET_CLIENT_CONNECTED`: `client` has successfully connected
  to a remote host. `connection` is the connected `GSocketConnection`.

- `G_SOCKET_CLIENT_PROXY_NEGOTIATING`: `client` is about to negotiate
  with a proxy to get it to connect to `connectable`. `connection` is
  the `GSocketConnection` to the proxy server.

- `G_SOCKET_CLIENT_PROXY_NEGOTIATED`: `client` has negotiated a
  connection to `connectable` through a proxy server. `connection` is
  the stream returned from `g_proxy_connect()`, which may or may not
  be a `GSocketConnection`.

- `G_SOCKET_CLIENT_TLS_HANDSHAKING`: `client` is about to begin a TLS
  handshake. `connection` is a `GTlsClientConnection`.

- `G_SOCKET_CLIENT_TLS_HANDSHAKED`: `client` has successfully completed
  the TLS handshake. `connection` is a `GTlsClientConnection`.

- `G_SOCKET_CLIENT_COMPLETE`: `client` has either successfully connected
  to `connectable` (in which case `connection` is the `GSocketConnection`
  that it will be returning to the caller) or has failed (in which
  case `connection` is `null` and the client is about to return an error).

Each event except `G_SOCKET_CLIENT_COMPLETE` may be emitted
multiple times (or not at all) for a given connectable (in
particular, if `client` ends up attempting to connect to more than
one address). However, if `client` emits the `GSocketClient.event`
signal at all for a given connectable, then it will always emit
it with `G_SOCKET_CLIENT_COMPLETE` when it is done.

Note that there may be additional `GSocketClientEvent` values in
the future; unrecognized `event` values should be ignored.

**Parameters**

- `event`: the event that is occurring
- `connectable`: the `GSocketConnectable` that `event` is occurring on
- `connection`: the current representation of the connection
- `self`: The instance the signal was emitted on.

_Available since 2.32._

## Methods

Methods are called on the `Gio.SocketClient` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `addApplicationProxy`

```ts
addApplicationProxy(protocol: string): void
```

Enable proxy protocols to be handled by the application. When the
indicated proxy protocol is returned by the `GProxyResolver`,
`GSocketClient` will consider this protocol as supported but will
not try to find a `GProxy` instance to handle handshaking. The
application must check for this case by calling
`g_socket_connection_get_remote_address()` on the returned
`GSocketConnection`, and seeing if it's a `GProxyAddress` of the
appropriate type, to determine whether or not it needs to handle
the proxy handshaking itself.

This should be used for proxy protocols that are dialects of
another protocol such as HTTP proxy. It also allows cohabitation of
proxy protocols that are reused between protocols. A good example
is HTTP. It can be used to proxy HTTP, FTP and Gopher and can also
be use as generic socket proxy through the HTTP CONNECT method.

When the proxy is detected as being an application proxy, TLS handshake
will be skipped. This is required to let the application do the proxy
specific handshake.

**Parameters**

- `protocol`: The proxy protocol

### `connectAsync`

```ts
connectAsync(connectable: Gio.SocketConnectable, cancellable?: Gio.Cancellable | null): Promise<Gio.SocketConnection>
```

This is the asynchronous version of `g_socket_client_connect()`.

You may wish to prefer the asynchronous version even in synchronous
command line programs because, since 2.60, it implements
[RFC 8305](https://tools.ietf.org/html/rfc8305) "Happy Eyeballs"
recommendations to work around long connection timeouts in networks
where IPv6 is broken by performing an IPv4 connection simultaneously
without waiting for IPv6 to time out, which is not supported by the
synchronous call. (This is not an API guarantee, and may change in
the future.)

When the operation is finished `callback` will be
called. You can then call `g_socket_client_connect_finish()` to get
the result of the operation.

**Parameters**

- `connectable`: a `GSocketConnectable` specifying the remote address.
- `cancellable`: a `GCancellable`, or `null`

**Returns** a `GSocketConnection` on success, `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `connectFinish`

```ts
connectFinish(result: Gio.AsyncResult): Gio.SocketConnection
```

Finishes an async connect operation. See `g_socket_client_connect_async()`

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** a `GSocketConnection` on success, `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `connectToHost`

```ts
connectToHost(hostAndPort: string, defaultPort: number, cancellable: Gio.Cancellable | null): Gio.SocketConnection
```

This is a helper function for `g_socket_client_connect()`.

Attempts to create a TCP connection to the named host.

`host_and_port` may be in any of a number of recognized formats; an IPv6
address, an IPv4 address, or a domain name (in which case a DNS
lookup is performed).  Quoting with [] is supported for all address
types.  A port override may be specified in the usual way with a
colon.  Ports may be given as decimal numbers or symbolic names (in
which case an /etc/services lookup is performed).

If no port override is given in `host_and_port` then `default_port` will be
used as the port number to connect to.

In general, `host_and_port` is expected to be provided by the user (allowing
them to give the hostname, and a port override if necessary) and
`default_port` is expected to be provided by the application.

In the case that an IP address is given, a single connection
attempt is made.  In the case that a name is given, multiple
connection attempts may be made, in turn and according to the
number of address records in DNS, until a connection succeeds.

Upon a successful connection, a new `GSocketConnection` is constructed
and returned.  The caller owns this new object and must drop their
reference to it when finished with it.

In the event of any failure (DNS error, service not found, no hosts
connectable) `null` is returned and `error` (if non-`null`) is set
accordingly.

**Parameters**

- `hostAndPort`: the name and optionally port of the host to connect to
- `defaultPort`: the default port to connect to
- `cancellable`: a `GCancellable`, or `null`

**Returns** a `GSocketConnection` on success, `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `connectToHostAsync`

```ts
connectToHostAsync(hostAndPort: string, defaultPort: number, cancellable?: Gio.Cancellable | null): Promise<Gio.SocketConnection>
```

This is the asynchronous version of `g_socket_client_connect_to_host()`.

When the operation is finished `callback` will be
called. You can then call `g_socket_client_connect_to_host_finish()` to get
the result of the operation.

**Parameters**

- `hostAndPort`: the name and optionally the port of the host to connect to
- `defaultPort`: the default port to connect to
- `cancellable`: a `GCancellable`, or `null`

**Returns** a `GSocketConnection` on success, `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `connectToHostFinish`

```ts
connectToHostFinish(result: Gio.AsyncResult): Gio.SocketConnection
```

Finishes an async connect operation. See `g_socket_client_connect_to_host_async()`

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** a `GSocketConnection` on success, `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `connectToService`

```ts
connectToService(domain: string, service: string, cancellable: Gio.Cancellable | null): Gio.SocketConnection
```

Attempts to create a TCP connection to a service.

This call looks up the SRV record for `service` at `domain` for the
"tcp" protocol.  It then attempts to connect, in turn, to each of
the hosts providing the service until either a connection succeeds
or there are no hosts remaining.

Upon a successful connection, a new `GSocketConnection` is constructed
and returned.  The caller owns this new object and must drop their
reference to it when finished with it.

In the event of any failure (DNS error, service not found, no hosts
connectable) `null` is returned and `error` (if non-`null`) is set
accordingly.

**Parameters**

- `domain`: a domain name
- `service`: the name of the service to connect to
- `cancellable`: a `GCancellable`, or `null`

**Returns** a `GSocketConnection` if successful, or `null` on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `connectToServiceAsync`

```ts
connectToServiceAsync(domain: string, service: string, cancellable?: Gio.Cancellable | null): Promise<Gio.SocketConnection>
```

This is the asynchronous version of
`g_socket_client_connect_to_service()`.

**Parameters**

- `domain`: a domain name
- `service`: the name of the service to connect to
- `cancellable`: a `GCancellable`, or `null`

**Returns** a `GSocketConnection` on success, `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `connectToServiceFinish`

```ts
connectToServiceFinish(result: Gio.AsyncResult): Gio.SocketConnection
```

Finishes an async connect operation. See `g_socket_client_connect_to_service_async()`

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** a `GSocketConnection` on success, `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `connectToUri`

```ts
connectToUri(uri: string, defaultPort: number, cancellable: Gio.Cancellable | null): Gio.SocketConnection
```

This is a helper function for `g_socket_client_connect()`.

Attempts to create a TCP connection with a network URI.

`uri` may be any valid URI containing an "authority" (hostname/port)
component. If a port is not specified in the URI, `default_port`
will be used. TLS will be negotiated if `GSocketClient.tls` is `true`.
(`GSocketClient` does not know to automatically assume TLS for
certain URI schemes.)

Using this rather than `g_socket_client_connect()` or
`g_socket_client_connect_to_host()` allows `GSocketClient` to
determine when to use application-specific proxy protocols.

Upon a successful connection, a new `GSocketConnection` is constructed
and returned.  The caller owns this new object and must drop their
reference to it when finished with it.

In the event of any failure (DNS error, service not found, no hosts
connectable) `null` is returned and `error` (if non-`null`) is set
accordingly.

**Parameters**

- `uri`: A network URI
- `defaultPort`: the default port to connect to
- `cancellable`: a `GCancellable`, or `null`

**Returns** a `GSocketConnection` on success, `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `connectToUriAsync`

```ts
connectToUriAsync(uri: string, defaultPort: number, cancellable?: Gio.Cancellable | null): Promise<Gio.SocketConnection>
```

This is the asynchronous version of `g_socket_client_connect_to_uri()`.

When the operation is finished `callback` will be
called. You can then call `g_socket_client_connect_to_uri_finish()` to get
the result of the operation.

**Parameters**

- `uri`: a network uri
- `defaultPort`: the default port to connect to
- `cancellable`: a `GCancellable`, or `null`

**Returns** a `GSocketConnection` on success, `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `connectToUriFinish`

```ts
connectToUriFinish(result: Gio.AsyncResult): Gio.SocketConnection
```

Finishes an async connect operation. See `g_socket_client_connect_to_uri_async()`

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** a `GSocketConnection` on success, `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `getEnableProxy`

```ts
getEnableProxy(): boolean
```

Gets the proxy enable state; see `g_socket_client_set_enable_proxy()`

**Returns** whether proxying is enabled

_Available since 2.26._

### `getFamily`

```ts
getFamily(): Gio.SocketFamily
```

Gets the socket family of the socket client.

See `g_socket_client_set_family()` for details.

**Returns** a `GSocketFamily`

_Available since 2.22._

### `getLocalAddress`

```ts
getLocalAddress(): Gio.SocketAddress | null
```

Gets the local address of the socket client.

See `g_socket_client_set_local_address()` for details.

**Returns** a `GSocketAddress` or `null`. Do not free.

_Available since 2.22._

### `getProtocol`

```ts
getProtocol(): Gio.SocketProtocol
```

Gets the protocol name type of the socket client.

See `g_socket_client_set_protocol()` for details.

**Returns** a `GSocketProtocol`

_Available since 2.22._

### `getProxyResolver`

```ts
getProxyResolver(): Gio.ProxyResolver
```

Gets the `GProxyResolver` being used by `client`. Normally, this will
be the resolver returned by `g_proxy_resolver_get_default()`, but you
can override it with `g_socket_client_set_proxy_resolver()`.

**Returns** The `GProxyResolver` being used by
  `client`.

_Available since 2.36._

### `getSocketType`

```ts
getSocketType(): Gio.SocketType
```

Gets the socket type of the socket client.

See `g_socket_client_set_socket_type()` for details.

**Returns** a `GSocketFamily`

_Available since 2.22._

### `getTimeout`

```ts
getTimeout(): number
```

Gets the I/O timeout time for sockets created by `client`.

See `g_socket_client_set_timeout()` for details.

**Returns** the timeout in seconds

_Available since 2.26._

### `getTls`

```ts
getTls(): boolean
```

Gets whether `client` creates TLS connections. See
`g_socket_client_set_tls()` for details.

**Returns** whether `client` uses TLS

_Available since 2.28._

### `getTlsValidationFlags`

```ts
getTlsValidationFlags(): Gio.TlsCertificateFlags
```

Gets the TLS validation flags used creating TLS connections via
`client`.

This function does not work as originally designed and is impossible
to use correctly. See `GSocketClient.tlsValidationFlags` for more
information.

**Returns** the TLS validation flags

> **Deprecated since 2.72.** Do not attempt to ignore validation errors.

_Available since 2.28._

### `setEnableProxy`

```ts
setEnableProxy(enable: boolean): void
```

Sets whether or not `client` attempts to make connections via a
proxy server. When enabled (the default), `GSocketClient` will use a
`GProxyResolver` to determine if a proxy protocol such as SOCKS is
needed, and automatically do the necessary proxy negotiation.

See also `g_socket_client_set_proxy_resolver()`.

**Parameters**

- `enable`: whether to enable proxies

_Available since 2.26._

### `setFamily`

```ts
setFamily(family: Gio.SocketFamily): void
```

Sets the socket family of the socket client.
If this is set to something other than `G_SOCKET_FAMILY_INVALID`
then the sockets created by this object will be of the specified
family.

This might be useful for instance if you want to force the local
connection to be an ipv4 socket, even though the address might
be an ipv6 mapped to ipv4 address.

**Parameters**

- `family`: a `GSocketFamily`

_Available since 2.22._

### `setLocalAddress`

```ts
setLocalAddress(address: Gio.SocketAddress | null): void
```

Sets the local address of the socket client.
The sockets created by this object will bound to the
specified address (if not `null`) before connecting.

This is useful if you want to ensure that the local
side of the connection is on a specific port, or on
a specific interface.

**Parameters**

- `address`: a `GSocketAddress`, or `null`

_Available since 2.22._

### `setProtocol`

```ts
setProtocol(protocol: Gio.SocketProtocol): void
```

Sets the protocol of the socket client.
The sockets created by this object will use of the specified
protocol.

If `protocol` is `G_SOCKET_PROTOCOL_DEFAULT` that means to use the default
protocol for the socket family and type.

**Parameters**

- `protocol`: a `GSocketProtocol`

_Available since 2.22._

### `setProxyResolver`

```ts
setProxyResolver(proxyResolver: Gio.ProxyResolver | null): void
```

Overrides the `GProxyResolver` used by `client`. You can call this if
you want to use specific proxies, rather than using the system
default proxy settings.

Note that whether or not the proxy resolver is actually used
depends on the setting of `GSocketClient.enableProxy`, which is not
changed by this function (but which is `true` by default)

**Parameters**

- `proxyResolver`: a `GProxyResolver`, or `null` for the default.

_Available since 2.36._

### `setSocketType`

```ts
setSocketType(type: Gio.SocketType): void
```

Sets the socket type of the socket client.
The sockets created by this object will be of the specified
type.

It doesn't make sense to specify a type of `G_SOCKET_TYPE_DATAGRAM`,
as GSocketClient is used for connection oriented services.

**Parameters**

- `type`: a `GSocketType`

_Available since 2.22._

### `setTimeout`

```ts
setTimeout(timeout: number): void
```

Sets the I/O timeout for sockets created by `client`. `timeout` is a
time in seconds, or 0 for no timeout (the default).

The timeout value affects the initial connection attempt as well,
so setting this may cause calls to `g_socket_client_connect()`, etc,
to fail with `G_IO_ERROR_TIMED_OUT`.

**Parameters**

- `timeout`: the timeout

_Available since 2.26._

### `setTls`

```ts
setTls(tls: boolean): void
```

Sets whether `client` creates TLS (aka SSL) connections. If `tls` is
`true`, `client` will wrap its connections in a `GTlsClientConnection`
and perform a TLS handshake when connecting.

Note that since `GSocketClient` must return a `GSocketConnection`,
but `GTlsClientConnection` is not a `GSocketConnection`, this
actually wraps the resulting `GTlsClientConnection` in a
`GTcpWrapperConnection` when returning it. You can use
`g_tcp_wrapper_connection_get_base_io_stream()` on the return value
to extract the `GTlsClientConnection`.

If you need to modify the behavior of the TLS handshake (eg, by
setting a client-side certificate to use, or connecting to the
`GTlsConnection.accept-certificate` signal), you can connect to
`client`'s `GSocketClient.event` signal and wait for it to be
emitted with `G_SOCKET_CLIENT_TLS_HANDSHAKING`, which will give you
a chance to see the `GTlsClientConnection` before the handshake
starts.

**Parameters**

- `tls`: whether to use TLS

_Available since 2.28._

### `setTlsValidationFlags`

```ts
setTlsValidationFlags(flags: Gio.TlsCertificateFlags): void
```

Sets the TLS validation flags used when creating TLS connections
via `client`. The default value is `G_TLS_CERTIFICATE_VALIDATE_ALL`.

This function does not work as originally designed and is impossible
to use correctly. See `GSocketClient.tlsValidationFlags` for more
information.

**Parameters**

- `flags`: the validation flags

> **Deprecated since 2.72.** Do not attempt to ignore validation errors.

_Available since 2.28._

### `socketClientConnect`

```ts
socketClientConnect(connectable: Gio.SocketConnectable, cancellable: Gio.Cancellable | null): Gio.SocketConnection
```

Tries to resolve the `connectable` and make a network connection to it.

Upon a successful connection, a new `GSocketConnection` is constructed
and returned.  The caller owns this new object and must drop their
reference to it when finished with it.

The type of the `GSocketConnection` object returned depends on the type of
the underlying socket that is used. For instance, for a TCP/IP connection
it will be a `GTcpConnection`.

The socket created will be the same family as the address that the
`connectable` resolves to, unless family is set with `g_socket_client_set_family()`
or indirectly via `g_socket_client_set_local_address()`. The socket type
defaults to `G_SOCKET_TYPE_STREAM` but can be set with
`g_socket_client_set_socket_type()`.

If a local address is specified with `g_socket_client_set_local_address()` the
socket will be bound to this address before connecting.

**Parameters**

- `connectable`: a `GSocketConnectable` specifying the remote address.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `GSocketConnection` on success, `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._
