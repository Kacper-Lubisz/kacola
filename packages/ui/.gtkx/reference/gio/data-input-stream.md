---
description: "Data input stream implements Gio.InputStream and includes functions for reading structured data directly from a binary input stream."
---

# GDataInputStream

Data input stream implements `Gio.InputStream` and includes functions
for reading structured data directly from a binary input stream.

```tsx
import { GDataInputStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInputStream](.gtkx/reference/gio/input-stream.md) → [GFilterInputStream](.gtkx/reference/gio/filter-input-stream.md) → [GBufferedInputStream](.gtkx/reference/gio/buffered-input-stream.md) → **GDataInputStream**

Implements `GSeekable`.

## Props

`ref` receives the `Gio.DataInputStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `byteOrder`

`Gio.DataStreamByteOrder` · default `G_DATA_STREAM_BYTE_ORDER_BIG_ENDIAN`

The :byte-order property determines the byte ordering that
is used when reading multi-byte entities (such as integers)
from the stream.

### `newlineType`

`Gio.DataStreamNewlineType` · default `G_DATA_STREAM_NEWLINE_TYPE_LF`

The :newline-type property determines what is considered
as a line ending when reading complete lines from the stream.

## Methods

Methods are called on the `Gio.DataInputStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getByteOrder`

```ts
getByteOrder(): Gio.DataStreamByteOrder
```

Gets the byte order for the data input stream.

**Returns** the `stream`'s current `GDataStreamByteOrder`.

### `getNewlineType`

```ts
getNewlineType(): Gio.DataStreamNewlineType
```

Gets the current newline type for the `stream`.

**Returns** `GDataStreamNewlineType` for the given `stream`.

### `readByte`

```ts
readByte(cancellable: Gio.Cancellable | null): number
```

Reads an unsigned 8-bit/1-byte value from `stream`.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** an unsigned 8-bit/1-byte value read from the `stream` or `0`
if an error occurred.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readInt16`

```ts
readInt16(cancellable: Gio.Cancellable | null): number
```

Reads a 16-bit/2-byte value from `stream`.

In order to get the correct byte order for this read operation,
see `g_data_input_stream_get_byte_order()` and `g_data_input_stream_set_byte_order()`.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a signed 16-bit/2-byte value read from `stream` or `0` if
an error occurred.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readInt32`

```ts
readInt32(cancellable: Gio.Cancellable | null): number
```

Reads a signed 32-bit/4-byte value from `stream`.

In order to get the correct byte order for this read operation,
see `g_data_input_stream_get_byte_order()` and `g_data_input_stream_set_byte_order()`.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a signed 32-bit/4-byte value read from the `stream` or `0` if
an error occurred.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readInt64`

```ts
readInt64(cancellable: Gio.Cancellable | null): bigint
```

Reads a 64-bit/8-byte value from `stream`.

In order to get the correct byte order for this read operation,
see `g_data_input_stream_get_byte_order()` and `g_data_input_stream_set_byte_order()`.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a signed 64-bit/8-byte value read from `stream` or `0` if
an error occurred.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readLine`

```ts
readLine(cancellable: Gio.Cancellable | null): [Uint8Array | null, number]
```

Reads a line from the data input stream.  Note that no encoding
checks or conversion is performed; the input is not guaranteed to
be UTF-8, and may in fact have embedded NUL characters.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** Tuple of:

- `result`: a NUL terminated byte array with the line that was read in (without the newlines). Set `length` to a `gsize` to get the length of the read line. On an error, it will return `null` and `error` will be set. If there's no content to read, it will still return `null`, but `error` won't be set.
- `length`: a `gsize` to get the length of the data read in.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readLineAsync`

```ts
readLineAsync(ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<[Uint8Array | null, number]>
```

The asynchronous version of `g_data_input_stream_read_line()`.  It is
an error to have two outstanding calls to this function.

When the operation is finished, `callback` will be called. You
can then call `g_data_input_stream_read_line_finish()` to get
the result of the operation.

**Parameters**

- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** Tuple of:

- `result`: a NUL-terminated byte array with the line that was read in (without the newlines). Set `length` to a `gsize` to get the length of the read line. On an error, it will return `null` and `error` will be set. If there's no content to read, it will still return `null`, but `error` won't be set.
- `length`: a `gsize` to get the length of the data read in.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.20._

### `readLineFinish`

```ts
readLineFinish(result: Gio.AsyncResult): [Uint8Array | null, number]
```

Finish an asynchronous call started by
`g_data_input_stream_read_line_async()`.  Note the warning about
string encoding in `g_data_input_stream_read_line()` applies here as
well.

**Parameters**

- `result`: the `GAsyncResult` that was provided to the callback.

**Returns** Tuple of:

- `result`: a NUL-terminated byte array with the line that was read in (without the newlines). Set `length` to a `gsize` to get the length of the read line. On an error, it will return `null` and `error` will be set. If there's no content to read, it will still return `null`, but `error` won't be set.
- `length`: a `gsize` to get the length of the data read in.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.20._

### `readLineFinishUtf8`

```ts
readLineFinishUtf8(result: Gio.AsyncResult): [string | null, number]
```

Finish an asynchronous call started by
`g_data_input_stream_read_line_async()`.

**Parameters**

- `result`: the `GAsyncResult` that was provided to the callback.

**Returns** Tuple of:

- `result`: a string with the line that was read in (without the newlines). Set `length` to a `gsize` to get the length of the read line. On an error, it will return `null` and `error` will be set. For UTF-8 conversion errors, the set error domain is `G_CONVERT_ERROR`. If there's no content to read, it will still return `null`, but `error` won't be set.
- `length`: a `gsize` to get the length of the data read in.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `readLineUtf8`

```ts
readLineUtf8(cancellable: Gio.Cancellable | null): [string | null, number]
```

Reads a UTF-8 encoded line from the data input stream.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** Tuple of:

- `result`: a NUL terminated UTF-8 string with the line that was read in (without the newlines). Set `length` to a `gsize` to get the length of the read line. On an error, it will return `null` and `error` will be set. For UTF-8 conversion errors, the set error domain is `G_CONVERT_ERROR`. If there's no content to read, it will still return `null`, but `error` won't be set.
- `length`: a `gsize` to get the length of the data read in.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `readUint16`

```ts
readUint16(cancellable: Gio.Cancellable | null): number
```

Reads an unsigned 16-bit/2-byte value from `stream`.

In order to get the correct byte order for this read operation,
see `g_data_input_stream_get_byte_order()` and `g_data_input_stream_set_byte_order()`.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** an unsigned 16-bit/2-byte value read from the `stream` or `0` if
an error occurred.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readUint32`

```ts
readUint32(cancellable: Gio.Cancellable | null): number
```

Reads an unsigned 32-bit/4-byte value from `stream`.

In order to get the correct byte order for this read operation,
see `g_data_input_stream_get_byte_order()` and `g_data_input_stream_set_byte_order()`.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** an unsigned 32-bit/4-byte value read from the `stream` or `0` if
an error occurred.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readUint64`

```ts
readUint64(cancellable: Gio.Cancellable | null): bigint
```

Reads an unsigned 64-bit/8-byte value from `stream`.

In order to get the correct byte order for this read operation,
see `g_data_input_stream_get_byte_order()`.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** an unsigned 64-bit/8-byte read from `stream` or `0` if
an error occurred.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readUntil`

```ts
readUntil(stopChars: string, cancellable: Gio.Cancellable | null): [string, number]
```

Reads a string from the data input stream, up to the first
occurrence of any of the stop characters.

Note that, in contrast to `g_data_input_stream_read_until_async()`,
this function consumes the stop character that it finds.

Don't use this function in new code.  Its functionality is
inconsistent with `g_data_input_stream_read_until_async()`.  Both
functions will be marked as deprecated in a future release.  Use
`g_data_input_stream_read_upto()` instead, but note that that function
does not consume the stop character.

**Parameters**

- `stopChars`: characters to terminate the read.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** Tuple of:

- `result`: a string with the data that was read before encountering any of the stop characters. Set `length` to a `gsize` to get the length of the string. This function will return `null` on an error.
- `length`: a `gsize` to get the length of the data read in.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

> **Deprecated since 2.56.** Use `g_data_input_stream_read_upto()` instead, which has more consistent behaviour regarding the stop character.

### `readUntilAsync`

```ts
readUntilAsync(stopChars: string, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<[string, number]>
```

The asynchronous version of `g_data_input_stream_read_until()`.
It is an error to have two outstanding calls to this function.

Note that, in contrast to `g_data_input_stream_read_until()`,
this function does not consume the stop character that it finds.  You
must read it for yourself.

When the operation is finished, `callback` will be called. You
can then call `g_data_input_stream_read_until_finish()` to get
the result of the operation.

Don't use this function in new code.  Its functionality is
inconsistent with `g_data_input_stream_read_until()`.  Both functions
will be marked as deprecated in a future release.  Use
`g_data_input_stream_read_upto_async()` instead.

**Parameters**

- `stopChars`: characters to terminate the read.
- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** Tuple of:

- `result`: a string with the data that was read before encountering any of the stop characters. Set `length` to a `gsize` to get the length of the string. This function will return `null` on an error.
- `length`: a `gsize` to get the length of the data read in.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

> **Deprecated since 2.56.** Use `g_data_input_stream_read_upto_async()` instead, which has more consistent behaviour regarding the stop character.

_Available since 2.20._

### `readUntilFinish`

```ts
readUntilFinish(result: Gio.AsyncResult): [string, number]
```

Finish an asynchronous call started by
`g_data_input_stream_read_until_async()`.

**Parameters**

- `result`: the `GAsyncResult` that was provided to the callback.

**Returns** Tuple of:

- `result`: a string with the data that was read before encountering any of the stop characters. Set `length` to a `gsize` to get the length of the string. This function will return `null` on an error.
- `length`: a `gsize` to get the length of the data read in.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

> **Deprecated since 2.56.** Use `g_data_input_stream_read_upto_finish()` instead, which has more consistent behaviour regarding the stop character.

_Available since 2.20._

### `readUpto`

```ts
readUpto(stopChars: string, stopCharsLen: number, cancellable: Gio.Cancellable | null): [string, number]
```

Reads a string from the data input stream, up to the first
occurrence of any of the stop characters.

In contrast to `g_data_input_stream_read_until()`, this function
does not consume the stop character. You have to use
`g_data_input_stream_read_byte()` to get it before calling
`g_data_input_stream_read_upto()` again.

Note that `stop_chars` may contain '\0' if `stop_chars_len` is
specified.

The returned string will always be nul-terminated on success.

**Parameters**

- `stopChars`: characters to terminate the read
- `stopCharsLen`: length of `stop_chars`. May be -1 if `stop_chars` is nul-terminated
- `cancellable`: optional `GCancellable` object, `null` to ignore

**Returns** Tuple of:

- `result`: a string with the data that was read before encountering any of the stop characters. Set `length` to a `gsize` to get the length of the string. This function will return `null` on an error
- `length`: a `gsize` to get the length of the data read in

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `readUptoAsync`

```ts
readUptoAsync(stopChars: string, stopCharsLen: number, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<[string, number]>
```

The asynchronous version of `g_data_input_stream_read_upto()`.
It is an error to have two outstanding calls to this function.

In contrast to `g_data_input_stream_read_until()`, this function
does not consume the stop character. You have to use
`g_data_input_stream_read_byte()` to get it before calling
`g_data_input_stream_read_upto()` again.

Note that `stop_chars` may contain '\0' if `stop_chars_len` is
specified.

When the operation is finished, `callback` will be called. You
can then call `g_data_input_stream_read_upto_finish()` to get
the result of the operation.

**Parameters**

- `stopChars`: characters to terminate the read
- `stopCharsLen`: length of `stop_chars`. May be -1 if `stop_chars` is nul-terminated
- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: optional `GCancellable` object, `null` to ignore

**Returns** Tuple of:

- `result`: a string with the data that was read before encountering any of the stop characters. Set `length` to a `gsize` to get the length of the string. This function will return `null` on an error.
- `length`: a `gsize` to get the length of the data read in

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `readUptoFinish`

```ts
readUptoFinish(result: Gio.AsyncResult): [string, number]
```

Finish an asynchronous call started by
`g_data_input_stream_read_upto_async()`.

Note that this function does not consume the stop character. You
have to use `g_data_input_stream_read_byte()` to get it before calling
`g_data_input_stream_read_upto_async()` again.

The returned string will always be nul-terminated on success.

**Parameters**

- `result`: the `GAsyncResult` that was provided to the callback

**Returns** Tuple of:

- `result`: a string with the data that was read before encountering any of the stop characters. Set `length` to a `gsize` to get the length of the string. This function will return `null` on an error.
- `length`: a `gsize` to get the length of the data read in

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.24._

### `setByteOrder`

```ts
setByteOrder(order: Gio.DataStreamByteOrder): void
```

This function sets the byte order for the given `stream`. All subsequent
reads from the `stream` will be read in the given `order`.

**Parameters**

- `order`: a `GDataStreamByteOrder` to set.

### `setNewlineType`

```ts
setNewlineType(type: Gio.DataStreamNewlineType): void
```

Sets the newline type for the `stream`.

Note that using G_DATA_STREAM_NEWLINE_TYPE_ANY is slightly unsafe. If a read
chunk ends in "CR" we must read an additional byte to know if this is "CR" or
"CR LF", and this might block if there is no more data available.

**Parameters**

- `type`: the type of new line return as `GDataStreamNewlineType`.
