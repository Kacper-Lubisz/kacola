---
description: "A GSocketService is an object that represents a service that is provided to the network or over local sockets."
---

# GSocketService

A `GSocketService` is an object that represents a service that
is provided to the network or over local sockets.  When a new
connection is made to the service the `Gio.SocketService.incoming`
signal is emitted.

A `GSocketService` is a subclass of `Gio.SocketListener` and you need
to add the addresses you want to accept connections on with the
`Gio.SocketListener` APIs.

There are two options for implementing a network service based on
`GSocketService`. The first is to create the service using
`Gio.SocketService.new()` and to connect to the
`Gio.SocketService.incoming` signal. The second is to subclass
`GSocketService` and override the default signal handler implementation.

In either case, the handler must immediately return, or else it
will block additional incoming connections from being serviced.
If you are interested in writing connection handlers that contain
blocking code then see `Gio.ThreadedSocketService`.

The socket service runs on the main loop of the
thread-default context (see
`GLib.MainContext.pushThreadDefault()`) of the thread it is
created in, and is not threadsafe in general. However, the calls to start and
stop the service are thread-safe so these can be used from threads that
handle incoming clients.

_Available since 2.22._

```tsx
import { GSocketService } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GSocketListener](.gtkx/reference/gio/socket-listener.md) → **GSocketService**

## Props

`ref` receives the `Gio.SocketService` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `active`

`boolean` · default `true`

Whether the service is currently accepting connections.

_Available since 2.46._

## Signals

### `onIncoming`

```ts
(connection: Gio.SocketConnection, sourceObject: GObject.Object | null, self: Gio.SocketService) => boolean | undefined
```

The ::incoming signal is emitted when a new incoming connection
to `service` needs to be handled. The handler must initiate the
handling of `connection`, but may not block; in essence,
asynchronous operations must be used.

`connection` will be unreffed once the signal handler returns,
so you need to ref it yourself if you are planning to use it.

**Parameters**

- `connection`: a new `GSocketConnection` object
- `sourceObject`: the source_object passed to `g_socket_listener_add_address()`
- `self`: The instance the signal was emitted on.

**Returns** `true` to stop other handlers from being called

_Available since 2.22._

## Methods

Methods are called on the `Gio.SocketService` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `isActive`

```ts
isActive(): boolean
```

Check whether the service is active or not. An active
service will accept new clients that connect, while
a non-active service will let connecting clients queue
up until the service is started.

**Returns** `true` if the service is active, `false` otherwise

_Available since 2.22._

### `start`

```ts
start(): void
```

Restarts the service, i.e. start accepting connections
from the added sockets when the mainloop runs. This only needs
to be called after the service has been stopped from
`g_socket_service_stop()`.

This call is thread-safe, so it may be called from a thread
handling an incoming client request.

_Available since 2.22._

### `stop`

```ts
stop(): void
```

Stops the service, i.e. stops accepting connections
from the added sockets when the mainloop runs.

This call is thread-safe, so it may be called from a thread
handling an incoming client request.

Note that this only stops accepting new connections; it does not
close the listening sockets, and you can call
`g_socket_service_start()` again later to begin listening again. To
close the listening sockets, call `g_socket_listener_close()`. (This
will happen automatically when the `GSocketService` is finalized.)

This must be called before calling `g_socket_listener_close()` as
the socket service will start accepting connections immediately
when a new socket is added.

_Available since 2.22._
