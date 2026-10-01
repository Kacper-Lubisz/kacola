---
description: "Data output stream implements Gio.OutputStream and includes functions for writing data directly to an output stream."
---

# GDataOutputStream

Data output stream implements `Gio.OutputStream` and includes functions
for writing data directly to an output stream.

```tsx
import { GDataOutputStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GOutputStream](.gtkx/reference/gio/output-stream.md) → [GFilterOutputStream](.gtkx/reference/gio/filter-output-stream.md) → **GDataOutputStream**

Implements `GSeekable`.

## Props

`ref` receives the `Gio.DataOutputStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `byteOrder`

`Gio.DataStreamByteOrder` · default `G_DATA_STREAM_BYTE_ORDER_BIG_ENDIAN`

Determines the byte ordering that is used when writing
multi-byte entities (such as integers) to the stream.

## Methods

Methods are called on the `Gio.DataOutputStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getByteOrder`

```ts
getByteOrder(): Gio.DataStreamByteOrder
```

Gets the byte order for the stream.

**Returns** the `GDataStreamByteOrder` for the `stream`.

### `putByte`

```ts
putByte(data: number, cancellable: Gio.Cancellable | null): boolean
```

Puts a byte into the output stream.

**Parameters**

- `data`: a `guchar`.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` if `data` was successfully added to the `stream`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `putInt16`

```ts
putInt16(data: number, cancellable: Gio.Cancellable | null): boolean
```

Puts a signed 16-bit integer into the output stream.

**Parameters**

- `data`: a `gint16`.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` if `data` was successfully added to the `stream`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `putInt32`

```ts
putInt32(data: number, cancellable: Gio.Cancellable | null): boolean
```

Puts a signed 32-bit integer into the output stream.

**Parameters**

- `data`: a `gint32`.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` if `data` was successfully added to the `stream`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `putInt64`

```ts
putInt64(data: bigint, cancellable: Gio.Cancellable | null): boolean
```

Puts a signed 64-bit integer into the stream.

**Parameters**

- `data`: a `gint64`.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` if `data` was successfully added to the `stream`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `putString`

```ts
putString(str: string, cancellable: Gio.Cancellable | null): boolean
```

Puts a string into the output stream.

**Parameters**

- `str`: a string.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` if `string` was successfully added to the `stream`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `putUint16`

```ts
putUint16(data: number, cancellable: Gio.Cancellable | null): boolean
```

Puts an unsigned 16-bit integer into the output stream.

**Parameters**

- `data`: a `guint16`.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` if `data` was successfully added to the `stream`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `putUint32`

```ts
putUint32(data: number, cancellable: Gio.Cancellable | null): boolean
```

Puts an unsigned 32-bit integer into the stream.

**Parameters**

- `data`: a `guint32`.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` if `data` was successfully added to the `stream`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `putUint64`

```ts
putUint64(data: bigint, cancellable: Gio.Cancellable | null): boolean
```

Puts an unsigned 64-bit integer into the stream.

**Parameters**

- `data`: a `guint64`.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` if `data` was successfully added to the `stream`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `setByteOrder`

```ts
setByteOrder(order: Gio.DataStreamByteOrder): void
```

Sets the byte order of the data output stream to `order`.

**Parameters**

- `order`: a `GDataStreamByteOrder`.
