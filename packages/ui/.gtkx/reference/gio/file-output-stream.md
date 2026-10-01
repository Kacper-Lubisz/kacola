---
description: "GFileOutputStream provides output streams that write their content to a file."
---

# GFileOutputStream

`GFileOutputStream` provides output streams that write their
content to a file.

`GFileOutputStream` implements `Gio.Seekable`, which allows the output
stream to jump to arbitrary positions in the file and to truncate
the file, provided the filesystem of the file supports these
operations.

To find the position of a file output stream, use `Gio.Seekable.tell()`.
To find out if a file output stream supports seeking, use
`Gio.Seekable.canSeek()`.To position a file output stream, use
`Gio.Seekable.seek()`. To find out if a file output stream supports
truncating, use `Gio.Seekable.canTruncate()`. To truncate a file output
stream, use `Gio.Seekable.truncate()`.

```tsx
import { GFileOutputStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GOutputStream](.gtkx/reference/gio/output-stream.md) → **GFileOutputStream**

Implements `GSeekable`.

## Props

`ref` receives the `Gio.FileOutputStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.FileOutputStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getEtag`

```ts
getEtag(): string | null
```

Gets the entity tag for the file when it has been written.
This must be called after the stream has been written
and closed, as the etag can change while writing.

**Returns** the entity tag for the stream.

### `queryInfo`

```ts
queryInfo(attributes: string, cancellable: Gio.Cancellable | null): Gio.FileInfo
```

Queries a file output stream for the given `attributes`.
This function blocks while querying the stream. For the asynchronous
version of this function, see `g_file_output_stream_query_info_async()`.
While the stream is blocked, the stream will set the pending flag
internally, and any other operations on the stream will fail with
`G_IO_ERROR_PENDING`.

Can fail if the stream was already closed (with `error` being set to
`G_IO_ERROR_CLOSED`), the stream has pending operations (with `error` being
set to `G_IO_ERROR_PENDING`), or if querying info is not supported for
the stream's interface (with `error` being set to `G_IO_ERROR_NOT_SUPPORTED`). In
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

### `queryInfoAsync`

```ts
queryInfoAsync(attributes: string, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<Gio.FileInfo>
```

Asynchronously queries the `stream` for a `GFileInfo`. When completed,
`callback` will be called with a `GAsyncResult` which can be used to
finish the operation with `g_file_output_stream_query_info_finish()`.

For the synchronous version of this function, see
`g_file_output_stream_query_info()`.

**Parameters**

- `attributes`: a file attribute query string.
- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** A `GFileInfo` for the finished query.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `queryInfoFinish`

```ts
queryInfoFinish(result: Gio.AsyncResult): Gio.FileInfo
```

Finalizes the asynchronous query started
by `g_file_output_stream_query_info_async()`.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** A `GFileInfo` for the finished query.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.
