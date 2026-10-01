---
description: "Base class for input stream implementations that perform some kind of filtering operation on a base stream."
---

# GFilterInputStream

Base class for input stream implementations that perform some
kind of filtering operation on a base stream. Typical examples
of filtering operations are character set conversion, compression
and byte order flipping.

```tsx
import { GFilterInputStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInputStream](.gtkx/reference/gio/input-stream.md) → **GFilterInputStream**

## Props

`ref` receives the `Gio.FilterInputStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `baseStream`

`Gio.InputStream` · construct-only

The underlying base stream on which the I/O ops will be done.

### `closeBaseStream`

`boolean` · default `true`

Whether the base stream should be closed when the filter stream is closed.

## Methods

Methods are called on the `Gio.FilterInputStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getBaseStream`

```ts
getBaseStream(): Gio.InputStream
```

Gets the base stream for the filter stream.

**Returns** a `GInputStream`.

### `getCloseBaseStream`

```ts
getCloseBaseStream(): boolean
```

Returns whether the base stream will be closed when `stream` is
closed.

**Returns** `true` if the base stream will be closed.

### `setCloseBaseStream`

```ts
setCloseBaseStream(closeBase: boolean): void
```

Sets whether the base stream will be closed when `stream` is closed.

**Parameters**

- `closeBase`: `true` to close the base stream.
