---
description: "GZlibDecompressor is an implementation of Gio.Converter that decompresses data compressed with zlib."
---

# GZlibDecompressor

`GZlibDecompressor` is an implementation of `Gio.Converter` that
decompresses data compressed with zlib.

```tsx
import { GZlibDecompressor } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GZlibDecompressor**

Implements `GConverter`.

## Props

`ref` receives the `Gio.ZlibDecompressor` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `fileInfo`

`Gio.FileInfo` · read-only, observe with `onNotifyFileInfo`

A `Gio.FileInfo` containing the information found in the gzip header
of the data stream processed.

This will be `NULL` if the header was not yet fully processed, is not
present at all, or the compressor’s `Gio.ZlibDecompressor.format`
property is not `Gio.ZlibCompressorFormat.GZIP`.

_Available since 2.26._

### `format`

`Gio.ZlibCompressorFormat` · default `G_ZLIB_COMPRESSOR_FORMAT_ZLIB` · construct-only

The format of the compressed data.

_Available since 2.24._

## Methods

Methods are called on the `Gio.ZlibDecompressor` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getFileInfo`

```ts
getFileInfo(): Gio.FileInfo | null
```

Gets the `Gio.ZlibDecompressor.fileInfo` property.

**Returns** file info from the gzip header, if available

_Available since 2.26._
