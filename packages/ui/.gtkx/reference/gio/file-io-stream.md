---
description: "GFileIOStream provides I/O streams that both read and write to the same file handle."
---

# GFileIOStream

`GFileIOStream` provides I/O streams that both read and write to the same
file handle.

`GFileIOStream` implements `Gio.Seekable`, which allows the I/O
stream to jump to arbitrary positions in the file and to truncate
the file, provided the filesystem of the file supports these
operations.

To find the position of a file I/O stream, use `Gio.Seekable.tell()`.

To find out if a file I/O stream supports seeking, use
`Gio.Seekable.canSeek()`. To position a file I/O stream, use
`Gio.Seekable.seek()`. To find out if a file I/O stream supports
truncating, use `Gio.Seekable.canTruncate()`. To truncate a file I/O
stream, use `Gio.Seekable.truncate()`.

The default implementation of all the `GFileIOStream` operations
and the implementation of `Gio.Seekable` just call into the same
operations on the output stream.

_Available since 2.22._

```tsx
import { GFileIOStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GIOStream](.gtkx/reference/gio/io-stream.md) → **GFileIOStream**

Implements `GSeekable`.

## Props

`ref` receives the `Gio.FileIOStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.FileIOStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getEtag`

```ts
getEtag(): string | null
```

Gets the entity tag for the file when it has been written.
This must be called after the stream has been written
and closed, as the etag can change while writing.

**Returns** the entity tag for the stream.

_Available since 2.22._

### `queryInfo`

```ts
queryInfo(attributes: string, cancellable: Gio.Cancellable | null): Gio.FileInfo
```

Queries a file io stream for the given `attributes`.
This function blocks while querying the stream. For the asynchronous
version of this function, see `g_file_io_stream_query_info_async()`.
While the stream is blocked, the stream will set the pending flag
internally, and any other operations on the stream will fail with
`G_IO_ERROR_PENDING`.

Can fail if the stream was already closed (with `error` being set to
`G_IO_ERROR_CLOSED`), the stream has pending operations (with `error` being
set to `G_IO_ERROR_PENDING`), or if querying info is not supported for
the stream's interface (with `error` being set to `G_IO_ERROR_NOT_SUPPORTED`). I
all cases of failure, `null` will be returned.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be set, and `null` will
be returned.

**Parameters**

- `attributes`: a file attribute query string.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `GFileInfo` for the `stream`, or `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `queryInfoAsync`

```ts
queryInfoAsync(attributes: string, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<Gio.FileInfo>
```

Asynchronously queries the `stream` for a `GFileInfo`. When completed,
`callback` will be called with a `GAsyncResult` which can be used to
finish the operation with `g_file_io_stream_query_info_finish()`.

For the synchronous version of this function, see
`g_file_io_stream_query_info()`.

**Parameters**

- `attributes`: a file attribute query string.
- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** A `GFileInfo` for the finished query.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `queryInfoFinish`

```ts
queryInfoFinish(result: Gio.AsyncResult): Gio.FileInfo
```

Finalizes the asynchronous query started
by `g_file_io_stream_query_info_async()`.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** A `GFileInfo` for the finished query.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._
