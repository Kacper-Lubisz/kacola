---
description: "Buffered input stream implements Gio.FilterInputStream and provides for buffered reads."
---

# GBufferedInputStream

Buffered input stream implements `Gio.FilterInputStream` and provides
for buffered reads.

By default, `GBufferedInputStream`'s buffer size is set at 4 kilobytes.

To create a buffered input stream, use `Gio.BufferedInputStream.new()`,
or `Gio.BufferedInputStream.newSized()` to specify the buffer's size at
construction.

To get the size of a buffer within a buffered input stream, use
`Gio.BufferedInputStream.getBufferSize()`. To change the size of a
buffered input stream's buffer, use `Gio.BufferedInputStream.setBufferSize()`.
Note that the buffer's size cannot be reduced below the size of the data within the buffer.

```tsx
import { GBufferedInputStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInputStream](.gtkx/reference/gio/input-stream.md) → [GFilterInputStream](.gtkx/reference/gio/filter-input-stream.md) → **GBufferedInputStream**

Implements `GSeekable`.

## Props

`ref` receives the `Gio.BufferedInputStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `bufferSize`

`number` · default `4096`

The size of the backend buffer, in bytes.

## Methods

Methods are called on the `Gio.BufferedInputStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `fill`

```ts
fill(count: number, cancellable: Gio.Cancellable | null): number
```

Tries to read `count` bytes from the stream into the buffer.
Will block during this read.

If `count` is zero, returns zero and does nothing. A value of `count`
larger than `G_MAXSSIZE` will cause a
`Gio.IOErrorEnum.INVALID_ARGUMENT` error.

On success, the number of bytes read into the buffer is returned.
It is not an error if this is not the same as the requested size, as it
can happen e.g. near the end of a file. Zero is returned on end of file
(or if `count` is zero),  but never otherwise.

If `count` is -1 then the attempted read size is equal to the number of
bytes that are required to fill the buffer.

If `cancellable` is not `NULL`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `Gio.IOErrorEnum.CANCELLED` will be returned.
If an operation was partially finished when the operation was cancelled the
partial result will be returned, without an error.

On error `-1` is returned and `error` is set accordingly.

For the asynchronous, non-blocking, version of this function, see
`Gio.BufferedInputStream.fillAsync()`.

**Parameters**

- `count`: the number of bytes that will be read from the stream
- `cancellable`: optional `Gio.Cancellable` object, `NULL` to ignore

**Returns** the number of bytes read into `stream`'s buffer, up to `count`,
    or `-1` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `fillAsync`

```ts
fillAsync(count: number, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<number>
```

Reads data into `stream`'s buffer asynchronously, up to `count` size.
`io_priority` can be used to prioritize reads. For the synchronous
version of this function, see `Gio.BufferedInputStream.fill()`.

If `count` is `-1` then the attempted read size is equal to the number
of bytes that are required to fill the buffer.

**Parameters**

- `count`: the number of bytes that will be read from the stream
- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: optional `Gio.Cancellable` object

**Returns** a `gssize` of the read stream, or `-1` on an error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `fillFinish`

```ts
fillFinish(result: Gio.AsyncResult): number
```

Finishes an asynchronous read.

**Parameters**

- `result`: a `Gio.AsyncResult`

**Returns** a `gssize` of the read stream, or `-1` on an error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `getAvailable`

```ts
getAvailable(): number
```

Gets the size of the available data within the stream.

**Returns** size of the available stream.

### `getBufferSize`

```ts
getBufferSize(): number
```

Gets the size of the input buffer.

**Returns** the current buffer size.

### `peek`

```ts
peek(buffer: Uint8Array | number[], offset: number): number
```

Peeks in the buffered input, copying `count` bytes of data from `offset` bytes
in the buffered input into `buffer`.

**Parameters**

- `buffer`: a pointer to an allocated chunk of memory, which must be at least `count` bytes long
- `offset`: offset into the buffered input to peek from, or zero to peek from the next byte in the buffered input onwards

**Returns** the number of bytes copied, which may be zero

### `peekBuffer`

```ts
peekBuffer(): Uint8Array
```

Returns the buffer with the currently available bytes. The returned
buffer must not be modified and will become invalid when reading from
the stream or filling the buffer.

**Returns** read-only buffer

### `readByte`

```ts
readByte(cancellable: Gio.Cancellable | null): number
```

Tries to read a single byte from the stream or the buffer. Will block
during this read.

On success, the byte read from the stream is returned. On end of stream
`-1` is returned but it's not an exceptional error and `error` is not set.

If `cancellable` is not `NULL`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `Gio.IOErrorEnum.CANCELLED` will be returned.
If an operation was partially finished when the operation was cancelled the
partial result will be returned, without an error.

On error `-1` is returned and `error` is set accordingly.

**Parameters**

- `cancellable`: optional `Gio.Cancellable` object, `NULL` to ignore

**Returns** the byte read from the `stream`, or `-1` on end of stream or error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `setBufferSize`

```ts
setBufferSize(size: number): void
```

Sets the size of the internal buffer of `stream` to `size`, or to the
size of the contents of the buffer. The buffer can never be resized
smaller than its current contents.

**Parameters**

- `size`: a `gsize`
