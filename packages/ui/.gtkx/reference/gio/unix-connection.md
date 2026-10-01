---
description: "This is the subclass of Gio.SocketConnection that is created for UNIX domain sockets."
---

# GUnixConnection

This is the subclass of `Gio.SocketConnection` that is created
for UNIX domain sockets.

It contains functions to do some of the UNIX socket specific
functionality like passing file descriptors.

Since GLib 2.72, `GUnixConnection` is available on all platforms. It requires
underlying system support (such as Windows 10 with `AF_UNIX`) at run time.

Before GLib 2.72, `<gio/gunixconnection.h>` belonged to the UNIX-specific GIO
interfaces, thus you had to use the `gio-unix-2.0.pc` pkg-config file when
using it. This is no longer necessary since GLib 2.72.

_Available since 2.22._

```tsx
import { GUnixConnection } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GIOStream](.gtkx/reference/gio/io-stream.md) → [GSocketConnection](.gtkx/reference/gio/socket-connection.md) → **GUnixConnection**

## Props

`ref` receives the `Gio.UnixConnection` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.UnixConnection` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `receiveCredentials`

```ts
receiveCredentials(cancellable: Gio.Cancellable | null): Gio.Credentials
```

Receives credentials from the sending end of the connection.  The
sending end has to call `g_unix_connection_send_credentials()` (or
similar) for this to work.

As well as reading the credentials this also reads (and discards) a
single byte from the stream, as this is required for credentials
passing to work on some implementations.

This method can be expected to be available on the following platforms:

- Linux since GLib 2.26
- FreeBSD since GLib 2.26
- GNU/kFreeBSD since GLib 2.36
- Solaris, Illumos and OpenSolaris since GLib 2.40
- GNU/Hurd since GLib 2.40

Other ways to exchange credentials with a foreign peer includes the
`GUnixCredentialsMessage` type and `g_socket_get_credentials()` function.

**Parameters**

- `cancellable`: A `GCancellable` or `null`.

**Returns** Received credentials on success (free with
`g_object_unref()`), `null` if `error` is set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `receiveCredentialsAsync`

```ts
receiveCredentialsAsync(cancellable?: Gio.Cancellable | null): Promise<Gio.Credentials>
```

Asynchronously receive credentials.

For more details, see `g_unix_connection_receive_credentials()` which is
the synchronous version of this call.

When the operation is finished, `callback` will be called. You can then call
`g_unix_connection_receive_credentials_finish()` to get the result of the operation.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `GCredentials`, or `null` on error.
    Free the returned object with `g_object_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.32._

### `receiveCredentialsFinish`

```ts
receiveCredentialsFinish(result: Gio.AsyncResult): Gio.Credentials
```

Finishes an asynchronous receive credentials operation started with
`g_unix_connection_receive_credentials_async()`.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** a `GCredentials`, or `null` on error.
    Free the returned object with `g_object_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.32._

### `receiveFd`

```ts
receiveFd(cancellable: Gio.Cancellable | null): number
```

Receives a file descriptor from the sending end of the connection.
The sending end has to call `g_unix_connection_send_fd()` for this
to work.

As well as reading the fd this also reads a single byte from the
stream, as this is required for fd passing to work on some
implementations.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore

**Returns** a file descriptor on success, -1 on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `sendCredentials`

```ts
sendCredentials(cancellable: Gio.Cancellable | null): boolean
```

Passes the credentials of the current user the receiving side
of the connection. The receiving end has to call
`g_unix_connection_receive_credentials()` (or similar) to accept the
credentials.

As well as sending the credentials this also writes a single NUL
byte to the stream, as this is required for credentials passing to
work on some implementations.

This method can be expected to be available on the following platforms:

- Linux since GLib 2.26
- FreeBSD since GLib 2.26
- GNU/kFreeBSD since GLib 2.36
- Solaris, Illumos and OpenSolaris since GLib 2.40
- GNU/Hurd since GLib 2.40

Other ways to exchange credentials with a foreign peer includes the
`GUnixCredentialsMessage` type and `g_socket_get_credentials()` function.

**Parameters**

- `cancellable`: A `GCancellable` or `null`.

**Returns** `true` on success, `false` if `error` is set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `sendCredentialsAsync`

```ts
sendCredentialsAsync(cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Asynchronously send credentials.

For more details, see `g_unix_connection_send_credentials()` which is
the synchronous version of this call.

When the operation is finished, `callback` will be called. You can then call
`g_unix_connection_send_credentials_finish()` to get the result of the operation.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` if the operation was successful, otherwise `false`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.32._

### `sendCredentialsFinish`

```ts
sendCredentialsFinish(result: Gio.AsyncResult): boolean
```

Finishes an asynchronous send credentials operation started with
`g_unix_connection_send_credentials_async()`.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** `true` if the operation was successful, otherwise `false`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.32._

### `sendFd`

```ts
sendFd(fd: number, cancellable: Gio.Cancellable | null): boolean
```

Passes a file descriptor to the receiving side of the
connection. The receiving end has to call `g_unix_connection_receive_fd()`
to accept the file descriptor.

As well as sending the fd this also writes a single byte to the
stream, as this is required for fd passing to work on some
implementations.

**Parameters**

- `fd`: a file descriptor
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `true` on success, `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._
