---
description: "GInputStream is a base class for implementing streaming input."
---

# GInputStream

`GInputStream` is a base class for implementing streaming input.

It has functions to read from a stream (`Gio.InputStream.read()`),
to close a stream (`Gio.InputStream.close()`) and to skip some content
(`Gio.InputStream.skip()`).

To copy the content of an input stream to an output stream without
manually handling the reads and writes, use `Gio.OutputStream.splice()`.

See the documentation for `Gio.IOStream` for details of thread safety
of streaming APIs.

All of these functions have async variants too.

```tsx
import { GInputStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GInputStream**

## Props

`ref` receives the `Gio.InputStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.InputStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `clearPending`

```ts
clearPending(): void
```

Clears the pending flag on `stream`.

### `close`

```ts
close(cancellable: Gio.Cancellable | null): boolean
```

Closes the stream, releasing resources related to it.

Once the stream is closed, all other operations will return `G_IO_ERROR_CLOSED`.
Closing a stream multiple times will not return an error.

Streams will be automatically closed when the last reference
is dropped, but you might want to call this function to make sure
resources are released as early as possible.

Some streams might keep the backing store of the stream (e.g. a file descriptor)
open after the stream is closed. See the documentation for the individual
stream for details.

On failure the first error that happened will be reported, but the close
operation will finish as much as possible. A stream that failed to
close will still return `G_IO_ERROR_CLOSED` for all operations. Still, it
is important to check and report the error to the user.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned.
Cancelling a close will still leave the stream closed, but some streams
can use a faster close that doesn't block to e.g. check errors.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` on success, `false` on failure

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `closeAsync`

```ts
closeAsync(ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Requests an asynchronous closes of the stream, releasing resources related to it.
When the operation is finished `callback` will be called.
You can then call `g_input_stream_close_finish()` to get the result of the
operation.

For behaviour details see `g_input_stream_close()`.

The asynchronous methods have a default fallback that uses threads to implement
asynchronicity, so they are optional for inheriting classes. However, if you
override one you must override all.

**Parameters**

- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: optional cancellable object

**Returns** `true` if the stream was closed successfully.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `closeFinish`

```ts
closeFinish(result: Gio.AsyncResult): boolean
```

Finishes closing a stream asynchronously, started from `g_input_stream_close_async()`.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** `true` if the stream was closed successfully.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `hasPending`

```ts
hasPending(): boolean
```

Checks if an input stream has pending actions.

**Returns** `true` if `stream` has pending actions.

### `isClosed`

```ts
isClosed(): boolean
```

Checks if an input stream is closed.

**Returns** `true` if the stream is closed.

### `readAllFinish`

```ts
readAllFinish(result: Gio.AsyncResult): [boolean, number]
```

Finishes an asynchronous stream read operation started with
`InputStream.readAllAsync()`.

As a special exception to the normal conventions for functions that
use `GError`, if this function returns `false` (and sets `error`) then
`bytes_read` will be set to the number of bytes that were successfully
read before the error was encountered.  This functionality is only
available from C.  If you need it from another language then you must
write your own loop around `g_input_stream_read_async()`.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** Tuple of:

- `result`: `true` on success, `false` if there was an error
- `bytesRead`: location to store the number of bytes that was read from the stream

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.44._

### `readBytes`

```ts
readBytes(count: number, cancellable: Gio.Cancellable | null): GLib.Bytes
```

Like `g_input_stream_read()`, this tries to read `count` bytes from
the stream in a blocking fashion. However, rather than reading into
a user-supplied buffer, this will create a new `GBytes` containing
the data that was read. This may be easier to use from language
bindings.

If count is zero, returns a zero-length `GBytes` and does nothing. A
value of `count` larger than `G_MAXSSIZE` will cause a
`G_IO_ERROR_INVALID_ARGUMENT` error.

On success, a new `GBytes` is returned. It is not an error if the
size of this object is not the same as the requested size, as it
can happen e.g. near the end of a file. A zero-length `GBytes` is
returned on end of file (or if `count` is zero), but never
otherwise.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned. If an
operation was partially finished when the operation was cancelled the
partial result will be returned, without an error.

On error `null` is returned and `error` is set accordingly.

**Parameters**

- `count`: maximum number of bytes that will be read from the stream. Common values include 4096 and 8192.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a new `GBytes`, or `null` on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.34._

### `readBytesAsync`

```ts
readBytesAsync(count: number, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<GLib.Bytes>
```

Request an asynchronous read of `count` bytes from the stream into a
new `GBytes`. When the operation is finished `callback` will be
called. You can then call `g_input_stream_read_bytes_finish()` to get the
result of the operation.

During an async request no other sync and async calls are allowed
on `stream`, and will result in `G_IO_ERROR_PENDING` errors.

A value of `count` larger than `G_MAXSSIZE` will cause a
`G_IO_ERROR_INVALID_ARGUMENT` error.

On success, the new `GBytes` will be passed to the callback. It is
not an error if this is smaller than the requested size, as it can
happen e.g. near the end of a file, but generally we try to read as
many bytes as requested. Zero is returned on end of file (or if
`count` is zero), but never otherwise.

Any outstanding I/O request with higher priority (lower numerical
value) will be executed before an outstanding request with lower
priority. Default priority is `G_PRIORITY_DEFAULT`.

**Parameters**

- `count`: the number of bytes that will be read from the stream
- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** the newly-allocated `GBytes`, or `null` on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.34._

### `readBytesFinish`

```ts
readBytesFinish(result: Gio.AsyncResult): GLib.Bytes
```

Finishes an asynchronous stream read-into-`GBytes` operation.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** the newly-allocated `GBytes`, or `null` on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.34._

### `readFinish`

```ts
readFinish(result: Gio.AsyncResult): number
```

Finishes an asynchronous stream read operation.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** number of bytes read in, or -1 on error, or 0 on end of file.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `setPending`

```ts
setPending(): boolean
```

Sets `stream` to have actions pending. If the pending flag is
already set or `stream` is closed, it will return `false` and set
`error`.

**Returns** `true` if pending was previously unset and is now set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `skip`

```ts
skip(count: number, cancellable: Gio.Cancellable | null): number
```

Tries to skip `count` bytes from the stream. Will block during the operation.

This is identical to `g_input_stream_read()`, from a behaviour standpoint,
but the bytes that are skipped are not returned to the user. Some
streams have an implementation that is more efficient than reading the data.

This function is optional for inherited classes, as the default implementation
emulates it using read.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned. If an
operation was partially finished when the operation was cancelled the
partial result will be returned, without an error.

**Parameters**

- `count`: the number of bytes that will be skipped from the stream
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** Number of bytes skipped, or -1 on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `skipAsync`

```ts
skipAsync(count: number, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<number>
```

Request an asynchronous skip of `count` bytes from the stream.
When the operation is finished `callback` will be called.
You can then call `g_input_stream_skip_finish()` to get the result
of the operation.

During an async request no other sync and async calls are allowed,
and will result in `G_IO_ERROR_PENDING` errors.

A value of `count` larger than `G_MAXSSIZE` will cause a `G_IO_ERROR_INVALID_ARGUMENT` error.

On success, the number of bytes skipped will be passed to the callback.
It is not an error if this is not the same as the requested size, as it
can happen e.g. near the end of a file, but generally we try to skip
as many bytes as requested. Zero is returned on end of file
(or if `count` is zero), but never otherwise.

Any outstanding i/o request with higher priority (lower numerical value)
will be executed before an outstanding request with lower priority.
Default priority is `G_PRIORITY_DEFAULT`.

The asynchronous methods have a default fallback that uses threads to
implement asynchronicity, so they are optional for inheriting classes.
However, if you override one, you must override all.

**Parameters**

- `count`: the number of bytes that will be skipped from the stream
- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** the size of the bytes skipped, or `-1` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `skipFinish`

```ts
skipFinish(result: Gio.AsyncResult): number
```

Finishes a stream skip operation.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** the size of the bytes skipped, or `-1` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.
