---
description: "GOutputStream is a base class for implementing streaming output."
---

# GOutputStream

`GOutputStream` is a base class for implementing streaming output.

It has functions to write to a stream (`Gio.OutputStream.write()`),
to close a stream (`Gio.OutputStream.close()`) and to flush pending
writes (`Gio.OutputStream.flush()`).

To copy the content of an input stream to an output stream without
manually handling the reads and writes, use `Gio.OutputStream.splice()`.

See the documentation for `Gio.IOStream` for details of thread safety
of streaming APIs.

All of these functions have async variants too.

All classes derived from `GOutputStream` *should* implement synchronous
writing, splicing, flushing and closing streams, but *may* implement
asynchronous versions.

```tsx
import { GOutputStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GOutputStream**

## Props

`ref` receives the `Gio.OutputStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.OutputStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

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

Closing a stream will automatically flush any outstanding buffers in the
stream.

Streams will be automatically closed when the last reference
is dropped, but you might want to call this function to make sure
resources are released as early as possible.

Some streams might keep the backing store of the stream (e.g. a file descriptor)
open after the stream is closed. See the documentation for the individual
stream for details.

On failure the first error that happened will be reported, but the close
operation will finish as much as possible. A stream that failed to
close will still return `G_IO_ERROR_CLOSED` for all operations. Still, it
is important to check and report the error to the user, otherwise
there might be a loss of data as all data might not be written.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned.
Cancelling a close will still leave the stream closed, but there some streams
can use a faster close that doesn't block to e.g. check errors. On
cancellation (as with any error) there is no guarantee that all written
data will reach the target.

**Parameters**

- `cancellable`: optional cancellable object

**Returns** `true` on success, `false` on failure

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `closeAsync`

```ts
closeAsync(ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Requests an asynchronous close of the stream, releasing resources
related to it. When the operation is finished `callback` will be
called. You can then call `g_output_stream_close_finish()` to get
the result of the operation.

For behaviour details see `g_output_stream_close()`.

The asynchronous methods have a default fallback that uses threads
to implement asynchronicity, so they are optional for inheriting
classes. However, if you override one you must override all.

**Parameters**

- `ioPriority`: the io priority of the request.
- `cancellable`: optional cancellable object

**Returns** `true` if stream was successfully closed, `false` otherwise.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `closeFinish`

```ts
closeFinish(result: Gio.AsyncResult): boolean
```

Closes an output stream.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** `true` if stream was successfully closed, `false` otherwise.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `flush`

```ts
flush(cancellable: Gio.Cancellable | null): boolean
```

Forces a write of all user-space buffered data for the given
`stream`. Will block during the operation. Closing the stream will
implicitly cause a flush.

This function is optional for inherited classes.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned.

**Parameters**

- `cancellable`: optional cancellable object

**Returns** `true` on success, `false` on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `flushAsync`

```ts
flushAsync(ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Forces an asynchronous write of all user-space buffered data for
the given `stream`.
For behaviour details see `g_output_stream_flush()`.

When the operation is finished `callback` will be
called. You can then call `g_output_stream_flush_finish()` to get the
result of the operation.

**Parameters**

- `ioPriority`: the io priority of the request.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` if flush operation succeeded, `false` otherwise.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `flushFinish`

```ts
flushFinish(result: Gio.AsyncResult): boolean
```

Finishes flushing an output stream.

**Parameters**

- `result`: a GAsyncResult.

**Returns** `true` if flush operation succeeded, `false` otherwise.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `hasPending`

```ts
hasPending(): boolean
```

Checks if an output stream has pending actions.

**Returns** `true` if `stream` has pending actions.

### `isClosed`

```ts
isClosed(): boolean
```

Checks if an output stream has already been closed.

**Returns** `true` if `stream` is closed. `false` otherwise.

### `isClosing`

```ts
isClosing(): boolean
```

Checks if an output stream is being closed. This can be
used inside e.g. a flush implementation to see if the
flush (or other i/o operation) is called from within
the closing operation.

**Returns** `true` if `stream` is being closed. `false` otherwise.

_Available since 2.24._

### `setPending`

```ts
setPending(): boolean
```

Sets `stream` to have actions pending. If the pending flag is
already set or `stream` is closed, it will return `false` and set
`error`.

**Returns** `true` if pending was previously unset and is now set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `splice`

```ts
splice(source: Gio.InputStream, flags: Gio.OutputStreamSpliceFlags, cancellable: Gio.Cancellable | null): number
```

Splices an input stream into an output stream.

**Parameters**

- `source`: a `GInputStream`.
- `flags`: a set of `GOutputStreamSpliceFlags`.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `gssize` containing the size of the data spliced, or
    -1 if an error occurred. Note that if the number of bytes
    spliced is greater than `G_MAXSSIZE`, then that will be
    returned, and there is no way to determine the actual number
    of bytes spliced.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `spliceAsync`

```ts
spliceAsync(source: Gio.InputStream, flags: Gio.OutputStreamSpliceFlags, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<number>
```

Splices a stream asynchronously.
When the operation is finished `callback` will be called.
You can then call `g_output_stream_splice_finish()` to get the
result of the operation.

For the synchronous, blocking version of this function, see
`g_output_stream_splice()`.

**Parameters**

- `source`: a `GInputStream`.
- `flags`: a set of `GOutputStreamSpliceFlags`.
- `ioPriority`: the io priority of the request.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `gssize` of the number of bytes spliced. Note that if the
    number of bytes spliced is greater than `G_MAXSSIZE`, then that
    will be returned, and there is no way to determine the actual
    number of bytes spliced.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `spliceFinish`

```ts
spliceFinish(result: Gio.AsyncResult): number
```

Finishes an asynchronous stream splice operation.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** a `gssize` of the number of bytes spliced. Note that if the
    number of bytes spliced is greater than `G_MAXSSIZE`, then that
    will be returned, and there is no way to determine the actual
    number of bytes spliced.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `write`

```ts
write(buffer: Uint8Array | number[], cancellable: Gio.Cancellable | null): number
```

Tries to write `count` bytes from `buffer` into the stream. Will block
during the operation.

If count is 0, returns 0 and does nothing. A value of `count`
larger than `G_MAXSSIZE` will cause a `G_IO_ERROR_INVALID_ARGUMENT` error.

On success, the number of bytes written to the stream is returned.
It is not an error if this is not the same as the requested size, as it
can happen e.g. on a partial I/O error, or if there is not enough
storage in the stream. All writes block until at least one byte
is written or an error occurs; 0 is never returned (unless
`count` is 0).

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned. If an
operation was partially finished when the operation was cancelled the
partial result will be returned, without an error.

On error -1 is returned and `error` is set accordingly.

**Parameters**

- `buffer`: the buffer containing the data to write.
- `cancellable`: optional cancellable object

**Returns** Number of bytes written, or -1 on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `writeAll`

```ts
writeAll(buffer: Uint8Array | number[], cancellable: Gio.Cancellable | null): [boolean, number]
```

Tries to write `count` bytes from `buffer` into the stream. Will block
during the operation.

This function is similar to `g_output_stream_write()`, except it tries to
write as many bytes as requested, only stopping on an error.

On a successful write of `count` bytes, `true` is returned, and `bytes_written`
is set to `count`.

If there is an error during the operation `false` is returned and `error`
is set to indicate the error status.

As a special exception to the normal conventions for functions that
use `GError`, if this function returns `false` (and sets `error`) then
`bytes_written` will be set to the number of bytes that were
successfully written before the error was encountered.  This
functionality is only available from C.  If you need it from another
language then you must write your own loop around
`g_output_stream_write()`.

**Parameters**

- `buffer`: the buffer containing the data to write.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** Tuple of:

- `result`: `true` on success, `false` if there was an error
- `bytesWritten`: location to store the number of bytes that was written to the stream

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `writeAllAsync`

```ts
writeAllAsync(buffer: Uint8Array | number[], ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<number>
```

Request an asynchronous write of `count` bytes from `buffer` into
the stream. When the operation is finished `callback` will be called.
You can then call `g_output_stream_write_all_finish()` to get the result of the
operation.

This is the asynchronous version of `g_output_stream_write_all()`.

Call `g_output_stream_write_all_finish()` to collect the result.

Any outstanding I/O request with higher priority (lower numerical
value) will be executed before an outstanding request with lower
priority. Default priority is `G_PRIORITY_DEFAULT`.

Note that no copy of `buffer` will be made, so it must stay valid
until `callback` is called.

**Parameters**

- `buffer`: the buffer containing the data to write
- `ioPriority`: the io priority of the request
- `cancellable`: optional `GCancellable` object, `null` to ignore

**Returns** location to store the number of bytes that was written to the stream

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.44._

### `writeAllFinish`

```ts
writeAllFinish(result: Gio.AsyncResult): [boolean, number]
```

Finishes an asynchronous stream write operation started with
`g_output_stream_write_all_async()`.

As a special exception to the normal conventions for functions that
use `GError`, if this function returns `false` (and sets `error`) then
`bytes_written` will be set to the number of bytes that were
successfully written before the error was encountered.  This
functionality is only available from C.  If you need it from another
language then you must write your own loop around
`g_output_stream_write_async()`.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** Tuple of:

- `result`: `true` on success, `false` if there was an error
- `bytesWritten`: location to store the number of bytes that was written to the stream

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.44._

### `writeAsync`

```ts
writeAsync(buffer: Uint8Array | number[], ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<number>
```

Request an asynchronous write of `count` bytes from `buffer` into
the stream. When the operation is finished `callback` will be called.
You can then call `g_output_stream_write_finish()` to get the result of the
operation.

During an async request no other sync and async calls are allowed,
and will result in `G_IO_ERROR_PENDING` errors.

A value of `count` larger than `G_MAXSSIZE` will cause a
`G_IO_ERROR_INVALID_ARGUMENT` error.

On success, the number of bytes written will be passed to the
`callback`. It is not an error if this is not the same as the
requested size, as it can happen e.g. on a partial I/O error,
but generally we try to write as many bytes as requested.

You are guaranteed that this method will never fail with
`G_IO_ERROR_WOULD_BLOCK` - if `stream` can't accept more data, the
method will just wait until this changes.

Any outstanding I/O request with higher priority (lower numerical
value) will be executed before an outstanding request with lower
priority. Default priority is `G_PRIORITY_DEFAULT`.

The asynchronous methods have a default fallback that uses threads
to implement asynchronicity, so they are optional for inheriting
classes. However, if you override one you must override all.

For the synchronous, blocking version of this function, see
`g_output_stream_write()`.

Note that no copy of `buffer` will be made, so it must stay valid
until `callback` is called. See `g_output_stream_write_bytes_async()`
for a `GBytes` version that will automatically hold a reference to
the contents (without copying) for the duration of the call.

**Parameters**

- `buffer`: the buffer containing the data to write.
- `ioPriority`: the io priority of the request.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `gssize` containing the number of bytes written to the stream.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `writeBytes`

```ts
writeBytes(bytes: GLib.Bytes, cancellable: Gio.Cancellable | null): number
```

A wrapper function for `g_output_stream_write()` which takes a
`GBytes` as input.  This can be more convenient for use by language
bindings or in other cases where the refcounted nature of `GBytes`
is helpful over a bare pointer interface.

However, note that this function may still perform partial writes,
just like `g_output_stream_write()`.  If that occurs, to continue
writing, you will need to create a new `GBytes` containing just the
remaining bytes, using `g_bytes_new_from_bytes()`. Passing the same
`GBytes` instance multiple times potentially can result in duplicated
data in the output stream.

**Parameters**

- `bytes`: the `GBytes` to write
- `cancellable`: optional cancellable object

**Returns** Number of bytes written, or -1 on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `writeBytesAsync`

```ts
writeBytesAsync(bytes: GLib.Bytes, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<number>
```

This function is similar to `g_output_stream_write_async()`, but
takes a `GBytes` as input.  Due to the refcounted nature of `GBytes`,
this allows the stream to avoid taking a copy of the data.

However, note that this function may still perform partial writes,
just like `g_output_stream_write_async()`. If that occurs, to continue
writing, you will need to create a new `GBytes` containing just the
remaining bytes, using `g_bytes_new_from_bytes()`. Passing the same
`GBytes` instance multiple times potentially can result in duplicated
data in the output stream.

For the synchronous, blocking version of this function, see
`g_output_stream_write_bytes()`.

**Parameters**

- `bytes`: The bytes to write
- `ioPriority`: the io priority of the request.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `gssize` containing the number of bytes written to the stream.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `writeBytesFinish`

```ts
writeBytesFinish(result: Gio.AsyncResult): number
```

Finishes a stream write-from-`GBytes` operation.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** a `gssize` containing the number of bytes written to the stream.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `writeFinish`

```ts
writeFinish(result: Gio.AsyncResult): number
```

Finishes a stream write operation.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** a `gssize` containing the number of bytes written to the stream.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `writev`

```ts
writev(vectors: Gio.OutputVector[], cancellable: Gio.Cancellable | null): [boolean, number]
```

Tries to write the bytes contained in the `n_vectors` `vectors` into the
stream. Will block during the operation.

If `n_vectors` is 0 or the sum of all bytes in `vectors` is 0, returns 0 and
does nothing.

On success, the number of bytes written to the stream is returned.
It is not an error if this is not the same as the requested size, as it
can happen e.g. on a partial I/O error, or if there is not enough
storage in the stream. All writes block until at least one byte
is written or an error occurs; 0 is never returned (unless
`n_vectors` is 0 or the sum of all bytes in `vectors` is 0).

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned. If an
operation was partially finished when the operation was cancelled the
partial result will be returned, without an error.

Some implementations of `g_output_stream_writev()` may have limitations on the
aggregate buffer size, and will return `G_IO_ERROR_INVALID_ARGUMENT` if these
are exceeded. For example, when writing to a local file on UNIX platforms,
the aggregate buffer size must not exceed `G_MAXSSIZE` bytes.

**Parameters**

- `vectors`: the buffer containing the `GOutputVectors` to write.
- `cancellable`: optional cancellable object

**Returns** Tuple of:

- `result`: `true` on success, `false` if there was an error
- `bytesWritten`: location to store the number of bytes that were written to the stream

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.60._

### `writevAll`

```ts
writevAll(vectors: Gio.OutputVector[], cancellable: Gio.Cancellable | null): [boolean, number]
```

Tries to write the bytes contained in the `n_vectors` `vectors` into the
stream. Will block during the operation.

This function is similar to `g_output_stream_writev()`, except it tries to
write as many bytes as requested, only stopping on an error.

On a successful write of all `n_vectors` vectors, `true` is returned, and
`bytes_written` is set to the sum of all the sizes of `vectors`.

If there is an error during the operation `false` is returned and `error`
is set to indicate the error status.

As a special exception to the normal conventions for functions that
use `GError`, if this function returns `false` (and sets `error`) then
`bytes_written` will be set to the number of bytes that were
successfully written before the error was encountered.  This
functionality is only available from C. If you need it from another
language then you must write your own loop around
`g_output_stream_write()`.

The content of the individual elements of `vectors` might be changed by this
function.

**Parameters**

- `vectors`: the buffer containing the `GOutputVectors` to write.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** Tuple of:

- `result`: `true` on success, `false` if there was an error
- `bytesWritten`: location to store the number of bytes that were written to the stream

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.60._

### `writevAllAsync`

```ts
writevAllAsync(vectors: Gio.OutputVector[], ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<number>
```

Request an asynchronous write of the bytes contained in the `n_vectors` `vectors` into
the stream. When the operation is finished `callback` will be called.
You can then call `g_output_stream_writev_all_finish()` to get the result of the
operation.

This is the asynchronous version of `g_output_stream_writev_all()`.

Call `g_output_stream_writev_all_finish()` to collect the result.

Any outstanding I/O request with higher priority (lower numerical
value) will be executed before an outstanding request with lower
priority. Default priority is `G_PRIORITY_DEFAULT`.

Note that no copy of `vectors` will be made, so it must stay valid
until `callback` is called. The content of the individual elements
of `vectors` might be changed by this function.

**Parameters**

- `vectors`: the buffer containing the `GOutputVectors` to write.
- `ioPriority`: the I/O priority of the request
- `cancellable`: optional `GCancellable` object, `null` to ignore

**Returns** location to store the number of bytes that were written to the stream

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.60._

### `writevAllFinish`

```ts
writevAllFinish(result: Gio.AsyncResult): [boolean, number]
```

Finishes an asynchronous stream write operation started with
`g_output_stream_writev_all_async()`.

As a special exception to the normal conventions for functions that
use `GError`, if this function returns `false` (and sets `error`) then
`bytes_written` will be set to the number of bytes that were
successfully written before the error was encountered.  This
functionality is only available from C.  If you need it from another
language then you must write your own loop around
`g_output_stream_writev_async()`.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** Tuple of:

- `result`: `true` on success, `false` if there was an error
- `bytesWritten`: location to store the number of bytes that were written to the stream

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.60._

### `writevAsync`

```ts
writevAsync(vectors: Gio.OutputVector[], ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<number>
```

Request an asynchronous write of the bytes contained in `n_vectors` `vectors` into
the stream. When the operation is finished `callback` will be called.
You can then call `g_output_stream_writev_finish()` to get the result of the
operation.

During an async request no other sync and async calls are allowed,
and will result in `G_IO_ERROR_PENDING` errors.

On success, the number of bytes written will be passed to the
`callback`. It is not an error if this is not the same as the
requested size, as it can happen e.g. on a partial I/O error,
but generally we try to write as many bytes as requested.

You are guaranteed that this method will never fail with
`G_IO_ERROR_WOULD_BLOCK` — if `stream` can't accept more data, the
method will just wait until this changes.

Any outstanding I/O request with higher priority (lower numerical
value) will be executed before an outstanding request with lower
priority. Default priority is `G_PRIORITY_DEFAULT`.

The asynchronous methods have a default fallback that uses threads
to implement asynchronicity, so they are optional for inheriting
classes. However, if you override one you must override all.

For the synchronous, blocking version of this function, see
`g_output_stream_writev()`.

Note that no copy of `vectors` will be made, so it must stay valid
until `callback` is called.

**Parameters**

- `vectors`: the buffer containing the `GOutputVectors` to write.
- `ioPriority`: the I/O priority of the request.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** location to store the number of bytes that were written to the stream

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.60._

### `writevFinish`

```ts
writevFinish(result: Gio.AsyncResult): [boolean, number]
```

Finishes a stream writev operation.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** Tuple of:

- `result`: `true` on success, `false` if there was an error
- `bytesWritten`: location to store the number of bytes that were written to the stream

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.60._
