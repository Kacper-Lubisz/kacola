---
description: "GIOStream represents an object that has both read and write streams."
---

# GIOStream

`GIOStream` represents an object that has both read and write streams.
Generally the two streams act as separate input and output streams,
but they share some common resources and state. For instance, for
seekable streams, both streams may use the same position.

Examples of `GIOStream` objects are `Gio.SocketConnection`, which represents
a two-way network connection; and `Gio.FileIOStream`, which represents a
file handle opened in read-write mode.

To do the actual reading and writing you need to get the substreams
with `Gio.IOStream.getInputStream()` and
`Gio.IOStream.getOutputStream()`.

The `GIOStream` object owns the input and the output streams, not the other
way around, so keeping the substreams alive will not keep the `GIOStream`
object alive. If the `GIOStream` object is freed it will be closed, thus
closing the substreams, so even if the substreams stay alive they will
always return `G_IO_ERROR_CLOSED` for all operations.

To close a stream use `Gio.IOStream.close()` which will close the common
stream object and also the individual substreams. You can also close
the substreams themselves. In most cases this only marks the
substream as closed, so further I/O on it fails but common state in the
`GIOStream` may still be open. However, some streams may support
‘half-closed’ states where one direction of the stream is actually shut down.

Operations on `GIOStream`s cannot be started while another operation on the
`GIOStream` or its substreams is in progress. Specifically, an application can
read from the `Gio.InputStream` and write to the
`Gio.OutputStream` simultaneously (either in separate threads, or as
asynchronous operations in the same thread), but an application cannot start
any `GIOStream` operation while there is a `GIOStream`, `GInputStream` or
`GOutputStream` operation in progress, and an application can’t start any
`GInputStream` or `GOutputStream` operation while there is a `GIOStream`
operation in progress.

This is a product of individual stream operations being associated with a
given `GLib.MainContext` (the thread-default context at the time the
operation was started), rather than entire streams being associated with a
single `GMainContext`.

GIO may run operations on `GIOStream`s from other (worker) threads, and this
may be exposed to application code in the behaviour of wrapper streams, such
as `Gio.BufferedInputStream` or `Gio.TlsConnection`. With such
wrapper APIs, application code may only run operations on the base (wrapped)
stream when the wrapper stream is idle. Note that the semantics of such
operations may not be well-defined due to the state the wrapper stream leaves
the base stream in (though they are guaranteed not to crash).

_Available since 2.22._

```tsx
import { GIOStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GIOStream**

## Props

`ref` receives the `Gio.IOStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `closed`

`boolean` · default `false` · read-only, observe with `onNotifyClosed`

Whether the stream is closed.

_Available since 2.22._

### `inputStream`

`Gio.InputStream` · read-only, observe with `onNotifyInputStream`

The `Gio.InputStream` to read from.

_Available since 2.22._

### `outputStream`

`Gio.OutputStream` · read-only, observe with `onNotifyOutputStream`

The `Gio.OutputStream` to write to.

_Available since 2.22._

## Methods

Methods are called on the `Gio.IOStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `clearPending`

```ts
clearPending(): void
```

Clears the pending flag on `stream`.

_Available since 2.22._

### `close`

```ts
close(cancellable: Gio.Cancellable | null): boolean
```

Closes the stream, releasing resources related to it. This will also
close the individual input and output streams, if they are not already
closed.

Once the stream is closed, all other operations will return
`G_IO_ERROR_CLOSED`. Closing a stream multiple times will not
return an error.

Closing a stream will automatically flush any outstanding buffers
in the stream.

Streams will be automatically closed when the last reference
is dropped, but you might want to call this function to make sure
resources are released as early as possible.

Some streams might keep the backing store of the stream (e.g. a file
descriptor) open after the stream is closed. See the documentation for
the individual stream for details.

On failure the first error that happened will be reported, but the
close operation will finish as much as possible. A stream that failed
to close will still return `G_IO_ERROR_CLOSED` for all operations.
Still, it is important to check and report the error to the user,
otherwise there might be a loss of data as all data might not be written.

If `cancellable` is not NULL, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned.
Cancelling a close will still leave the stream closed, but some streams
can use a faster close that doesn't block to e.g. check errors.

The default implementation of this method just calls close on the
individual input/output streams.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore

**Returns** `true` on success, `false` on failure

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `closeAsync`

```ts
closeAsync(ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Requests an asynchronous close of the stream, releasing resources
related to it. When the operation is finished `callback` will be
called. You can then call `g_io_stream_close_finish()` to get
the result of the operation.

For behaviour details see `g_io_stream_close()`.

The asynchronous methods have a default fallback that uses threads
to implement asynchronicity, so they are optional for inheriting
classes. However, if you override one you must override all.

**Parameters**

- `ioPriority`: the io priority of the request
- `cancellable`: optional cancellable object

**Returns** `true` if stream was successfully closed, `false` otherwise.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `closeFinish`

```ts
closeFinish(result: Gio.AsyncResult): boolean
```

Closes a stream.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** `true` if stream was successfully closed, `false` otherwise.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `getInputStream`

```ts
getInputStream(): Gio.InputStream
```

Gets the input stream for this object. This is used
for reading.

**Returns** a `GInputStream`, owned by the `GIOStream`.
Do not free.

_Available since 2.22._

### `getOutputStream`

```ts
getOutputStream(): Gio.OutputStream
```

Gets the output stream for this object. This is used for
writing.

**Returns** a `GOutputStream`, owned by the `GIOStream`.
Do not free.

_Available since 2.22._

### `hasPending`

```ts
hasPending(): boolean
```

Checks if a stream has pending actions.

**Returns** `true` if `stream` has pending actions.

_Available since 2.22._

### `isClosed`

```ts
isClosed(): boolean
```

Checks if a stream is closed.

**Returns** `true` if the stream is closed.

_Available since 2.22._

### `setPending`

```ts
setPending(): boolean
```

Sets `stream` to have actions pending. If the pending flag is
already set or `stream` is closed, it will return `false` and set
`error`.

**Returns** `true` if pending was previously unset and is now set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `spliceAsync`

```ts
spliceAsync(stream2: Gio.IOStream, flags: Gio.IOStreamSpliceFlags, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Asynchronously splice the output stream of `stream1` to the input stream of
`stream2`, and splice the output stream of `stream2` to the input stream of
`stream1`.

When the operation is finished `callback` will be called.
You can then call `g_io_stream_splice_finish()` to get the
result of the operation.

**Parameters**

- `stream2`: a `GIOStream`.
- `flags`: a set of `GIOStreamSpliceFlags`.
- `ioPriority`: the io priority of the request.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` on success, `false` otherwise.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.28._
