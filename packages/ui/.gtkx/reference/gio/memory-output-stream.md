---
description: "GMemoryOutputStream is a class for using arbitrary memory chunks as output for GIO streaming output operations."
---

# GMemoryOutputStream

`GMemoryOutputStream` is a class for using arbitrary
memory chunks as output for GIO streaming output operations.

As of GLib 2.34, `GMemoryOutputStream` trivially implements
`Gio.PollableOutputStream`: it always polls as ready.

```tsx
import { GMemoryOutputStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GOutputStream](.gtkx/reference/gio/output-stream.md) → **GMemoryOutputStream**

Implements `GPollableOutputStream`, `GSeekable`.

## Props

`ref` receives the `Gio.MemoryOutputStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `data`

`bigint` · construct-only

Pointer to buffer where data will be written.

_Available since 2.24._

### `dataSize`

`bigint` · default `0` · read-only, observe with `onNotifyDataSize`

Size of data written to the buffer.

_Available since 2.24._

### `size`

`bigint` · default `0` · construct-only

Current size of the data buffer.

_Available since 2.24._

## Methods

Methods are called on the `Gio.MemoryOutputStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getData`

```ts
getData(): bigint | null
```

Gets any loaded data from the `ostream`.

Note that the returned pointer may become invalid on the next
write or truncate operation on the stream.

**Returns** pointer to the stream's data, or `null` if the data
   has been stolen

### `getDataSize`

```ts
getDataSize(): number
```

Returns the number of bytes from the start up to including the last
byte written in the stream that has not been truncated away.

**Returns** the number of bytes written to the stream

_Available since 2.18._

### `getSize`

```ts
getSize(): number
```

Gets the size of the currently allocated data area (available from
`g_memory_output_stream_get_data()`).

You probably don't want to use this function on resizable streams.
See `g_memory_output_stream_get_data_size()` instead.  For resizable
streams the size returned by this function is an implementation
detail and may be change at any time in response to operations on the
stream.

If the stream is fixed-sized (ie: no realloc was passed to
`g_memory_output_stream_new()`) then this is the maximum size of the
stream and further writes will return `G_IO_ERROR_NO_SPACE`.

In any case, if you want the number of bytes currently written to the
stream, use `g_memory_output_stream_get_data_size()`.

**Returns** the number of bytes allocated for the data buffer

### `stealAsBytes`

```ts
stealAsBytes(): GLib.Bytes
```

Returns data from the `ostream` as a `GBytes`. `ostream` must be
closed before calling this function.

**Returns** the stream's data

_Available since 2.34._

### `stealData`

```ts
stealData(): bigint | null
```

Gets any loaded data from the `ostream`. Ownership of the data
is transferred to the caller; when no longer needed it must be
freed using the free function set in `ostream`'s
`GMemoryOutputStream.destroyFunction` property.

`ostream` must be closed before calling this function.

**Returns** the stream's data, or `null` if it has previously
   been stolen

_Available since 2.26._
