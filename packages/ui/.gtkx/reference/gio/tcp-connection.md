---
description: "This is the subclass of Gio.SocketConnection that is created for TCP/IP sockets."
---

# GTcpConnection

This is the subclass of `Gio.SocketConnection` that is created
for TCP/IP sockets.

_Available since 2.22._

```tsx
import { GTcpConnection } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GIOStream](.gtkx/reference/gio/io-stream.md) → [GSocketConnection](.gtkx/reference/gio/socket-connection.md) → **GTcpConnection**

## Props

`ref` receives the `Gio.TcpConnection` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `gracefulDisconnect`

`boolean` · default `false`

Whether `Gio.IOStream.close()` does a graceful disconnect.

_Available since 2.22._

## Methods

Methods are called on the `Gio.TcpConnection` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getGracefulDisconnect`

```ts
getGracefulDisconnect(): boolean
```

Checks if graceful disconnects are used. See
`g_tcp_connection_set_graceful_disconnect()`.

**Returns** `true` if graceful disconnect is used on close, `false` otherwise

_Available since 2.22._

### `setGracefulDisconnect`

```ts
setGracefulDisconnect(gracefulDisconnect: boolean): void
```

This enables graceful disconnects on close. A graceful disconnect
means that we signal the receiving end that the connection is terminated
and wait for it to close the connection before closing the connection.

A graceful disconnect means that we can be sure that we successfully sent
all the outstanding data to the other end, or get an error reported.
However, it also means we have to wait for all the data to reach the
other side and for it to acknowledge this by closing the socket, which may
take a while. For this reason it is disabled by default.

**Parameters**

- `gracefulDisconnect`: Whether to do graceful disconnects or not

_Available since 2.22._
