---
description: "Buffered output stream implements Gio.FilterOutputStream and provides for buffered writes."
---

# GBufferedOutputStream

Buffered output stream implements `Gio.FilterOutputStream` and provides
for buffered writes.

By default, `GBufferedOutputStream`'s buffer size is set at 4 kilobytes.

To create a buffered output stream, use `Gio.BufferedOutputStream.new()`,
or `Gio.BufferedOutputStream.newSized()` to specify the buffer's size
at construction.

To get the size of a buffer within a buffered input stream, use
`Gio.BufferedOutputStream.getBufferSize()`. To change the size of a
buffered output stream's buffer, use `Gio.BufferedOutputStream.setBufferSize()`.
Note that the buffer's size cannot be reduced below the size of the data within the buffer.

```tsx
import { GBufferedOutputStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GOutputStream](.gtkx/reference/gio/output-stream.md) → [GFilterOutputStream](.gtkx/reference/gio/filter-output-stream.md) → **GBufferedOutputStream**

Implements `GSeekable`.

## Props

`ref` receives the `Gio.BufferedOutputStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `autoGrow`

`boolean` · default `false`

Whether the buffer should automatically grow.

### `bufferSize`

`number` · default `4096`

The size of the backend buffer, in bytes.

## Methods

Methods are called on the `Gio.BufferedOutputStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getAutoGrow`

```ts
getAutoGrow(): boolean
```

Checks if the buffer automatically grows as data is added.

**Returns** `TRUE` if the `stream`'s buffer automatically grows,
`FALSE` otherwise.

### `getBufferSize`

```ts
getBufferSize(): number
```

Gets the size of the buffer in the `stream`.

**Returns** the current size of the buffer.

### `setAutoGrow`

```ts
setAutoGrow(autoGrow: boolean): void
```

Sets whether or not the `stream`'s buffer should automatically grow.
If `auto_grow` is true, then each write will just make the buffer
larger, and you must manually flush the buffer to actually write out
the data to the underlying stream.

**Parameters**

- `autoGrow`: a `gboolean`.

### `setBufferSize`

```ts
setBufferSize(size: number): void
```

Sets the size of the internal buffer to `size`.

**Parameters**

- `size`: a `gsize`.
