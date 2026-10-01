---
description: "GFileInputStream provides input streams that take their content from a file."
---

# GFileInputStream

`GFileInputStream` provides input streams that take their
content from a file.

`GFileInputStream` implements `Gio.Seekable`, which allows the input
stream to jump to arbitrary positions in the file, provided the
filesystem of the file allows it. To find the position of a file
input stream, use `Gio.Seekable.tell()`. To find out if a file input
stream supports seeking, use `Gio.Seekable.canSeek()`.
To position a file input stream, use `Gio.Seekable.seek()`.

```tsx
import { GFileInputStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInputStream](.gtkx/reference/gio/input-stream.md) → **GFileInputStream**

Implements `GSeekable`.

## Props

`ref` receives the `Gio.FileInputStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.FileInputStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `queryInfo`

```ts
queryInfo(attributes: string, cancellable: Gio.Cancellable | null): Gio.FileInfo
```

Queries a file input stream the given `attributes`. This function blocks
while querying the stream. For the asynchronous (non-blocking) version
of this function, see `g_file_input_stream_query_info_async()`. While the
stream is blocked, the stream will set the pending flag internally, and
any other operations on the stream will fail with `G_IO_ERROR_PENDING`.

**Parameters**

- `attributes`: a file attribute query string.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `GFileInfo`, or `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `queryInfoAsync`

```ts
queryInfoAsync(attributes: string, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<Gio.FileInfo>
```

Queries the stream information asynchronously.
When the operation is finished `callback` will be called.
You can then call `g_file_input_stream_query_info_finish()`
to get the result of the operation.

For the synchronous version of this function,
see `g_file_input_stream_query_info()`.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be set

**Parameters**

- `attributes`: a file attribute query string.
- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `GFileInfo`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `queryInfoFinish`

```ts
queryInfoFinish(result: Gio.AsyncResult): Gio.FileInfo
```

Finishes an asynchronous info query operation.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** `GFileInfo`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.
