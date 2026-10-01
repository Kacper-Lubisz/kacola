---
description: "A GThreadedSocketService is a simple subclass of Gio.SocketService that handles incoming connections by creating a worker thread and dispatching the connection to it by emitting the [signal@Gio.ThreadedSocketService::..."
---

# GThreadedSocketService

A `GThreadedSocketService` is a simple subclass of `Gio.SocketService`
that handles incoming connections by creating a worker thread and
dispatching the connection to it by emitting the
[signal@Gio.ThreadedSocketService::run signal] in the new thread.

The signal handler may perform blocking I/O and need not return
until the connection is closed.

The service is implemented using a thread pool, so there is a
limited amount of threads available to serve incoming requests.
The service automatically stops the `Gio.SocketService` from accepting
new connections when all threads are busy.

As with `Gio.SocketService`, you may connect to
`Gio.ThreadedSocketService.run`, or subclass and override the default
handler.

_Available since 2.22._

```tsx
import { GThreadedSocketService } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GSocketListener](.gtkx/reference/gio/socket-listener.md) → [GSocketService](.gtkx/reference/gio/socket-service.md) → **GThreadedSocketService**

## Props

`ref` receives the `Gio.ThreadedSocketService` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `maxThreads`

`number` · default `10` · construct-only

The maximum number of threads handling clients for this service.

_Available since 2.22._

## Signals

### `onRun`

```ts
(connection: Gio.SocketConnection, sourceObject: GObject.Object | null, self: Gio.ThreadedSocketService) => boolean | undefined
```

The ::run signal is emitted in a worker thread in response to an
incoming connection. This thread is dedicated to handling
`connection` and may perform blocking IO. The signal handler need
not return until the connection is closed.

**Parameters**

- `connection`: a new `GSocketConnection` object.
- `sourceObject`: the source_object passed to `g_socket_listener_add_address()`.
- `self`: The instance the signal was emitted on.

**Returns** `true` to stop further signal handlers from being called
