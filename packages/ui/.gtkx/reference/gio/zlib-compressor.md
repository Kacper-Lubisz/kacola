---
description: "GZlibCompressor is an implementation of Gio.Converter that compresses data using zlib."
---

# GZlibCompressor

`GZlibCompressor` is an implementation of `Gio.Converter` that
compresses data using zlib.

```tsx
import { GZlibCompressor } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GZlibCompressor**

Implements `GConverter`.

## Props

`ref` receives the `Gio.ZlibCompressor` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `fileInfo`

`Gio.FileInfo | ReactElement`

A `Gio.FileInfo` containing file information to put into the gzip
header.

The file name and modification time from the file info will be used.

This will only be used if non-`NULL` and
`Gio.ZlibCompressor.format` is
`Gio.ZlibCompressorFormat.GZIP`.

_Available since 2.26._

### `format`

`Gio.ZlibCompressorFormat` · default `G_ZLIB_COMPRESSOR_FORMAT_ZLIB` · construct-only

The format of the compressed data.

_Available since 2.24._

### `level`

`number` · default `-1` · construct-only

The level of compression from `0` (no compression) to `9` (most
compression).

`-1` for the default level.

_Available since 2.24._

### `os`

`number` · default `-1`

The OS code of the gzip header.

This will be used if set to a non-negative value, and if
`Gio.ZlibCompressor.format` is
`Gio.ZlibCompressorFormat.GZIP`, the compressor will set the OS code of
the gzip header to this value.

If the value is unset, zlib will set the OS code depending on the platform.
This may be undesirable when reproducible output is desired. In that case setting
the OS code to `3` (for Unix) is recommended.

_Available since 2.86._

## Methods

Methods are called on the `Gio.ZlibCompressor` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getFileInfo`

```ts
getFileInfo(): Gio.FileInfo | null
```

Gets the `Gio.ZlibCompressor.fileInfo` property.

**Returns** file info for the gzip header, if set

_Available since 2.26._

### `getOs`

```ts
getOs(): number
```

Gets the `Gio.ZlibCompressor.os` property.

**Returns** the previously set OS value, or `-1` if unset

_Available since 2.86._

### `setFileInfo`

```ts
setFileInfo(fileInfo: Gio.FileInfo | null): void
```

Sets the `Gio.ZlibCompressor.fileInfo` property.

Note: it is an error to call this function while a compression is in
progress; it may only be called immediately after creation of `compressor`,
or after resetting it with `Gio.Converter.reset()`.

**Parameters**

- `fileInfo`: file info for the gzip header

_Available since 2.26._

### `setOs`

```ts
setOs(os: number): void
```

Sets the `Gio.ZlibCompressor.os` property.

Note: it is an error to call this function while a compression is in
progress; it may only be called immediately after creation of `compressor`,
or after resetting it with `Gio.Converter.reset()`.

**Parameters**

- `os`: the OS code to use, or `-1` to unset

_Available since 2.86._
