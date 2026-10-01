---
description: "Save a Buffer into a file."
---

# GtkSourceFileSaver

Save a `Buffer` into a file.

A `GtkSourceFileSaver` object permits to save a `Buffer` into a
`Gio.File`.

A file saver should be used only for one save operation, including errors
handling. If an error occurs, you can reconfigure the saver and relaunch the
operation with `FileSaver.saveAsync()`.

```tsx
import { GtkSourceFileSaver } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceFileSaver**

## Props

`ref` receives the `GtkSource.FileSaver` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `buffer`

`GtkSource.Buffer` · construct-only

The `GtkSourceBuffer` to save. The `GtkSourceFileSaver` object has a
weak reference to the buffer.

### `compressionType`

`GtkSource.CompressionType` · default `GTK_SOURCE_COMPRESSION_TYPE_NONE`

The compression type.

### `encoding`

`GtkSource.Encoding`

The file's encoding.

### `file`

`GtkSource.File` · construct-only

The `GtkSourceFile`. The `GtkSourceFileSaver` object has a weak
reference to the file.

### `flags`

`GtkSource.FileSaverFlags` · default `GTK_SOURCE_FILE_SAVER_FLAGS_NONE`

File saving flags.

### `location`

`Gio.File` · construct-only

The `GFile` where to save the buffer. By default the location is taken
from the `GtkSourceFile` at construction time.

### `newlineType`

`GtkSource.NewlineType` · default `GTK_SOURCE_NEWLINE_TYPE_LF`

The newline type.

## Methods

Methods are called on the `GtkSource.FileSaver` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getBuffer`

```ts
getBuffer(): GtkSource.Buffer
```

**Returns** the `GtkSourceBuffer` to save.

### `getCompressionType`

```ts
getCompressionType(): GtkSource.CompressionType
```

**Returns** the compression type.

### `getEncoding`

```ts
getEncoding(): GtkSource.Encoding
```

**Returns** the encoding.

### `getFile`

```ts
getFile(): GtkSource.File
```

**Returns** the `GtkSourceFile`.

### `getFlags`

```ts
getFlags(): GtkSource.FileSaverFlags
```

**Returns** the flags.

### `getLocation`

```ts
getLocation(): Gio.File
```

**Returns** the `GFile` where to save the buffer to.

### `getNewlineType`

```ts
getNewlineType(): GtkSource.NewlineType
```

**Returns** the newline type.

### `saveAsync`

```ts
saveAsync(ioPriority: number, cancellable: Gio.Cancellable | null, progressCallback: Gio.FileProgressCallback | null, callback: Gio.AsyncReadyCallback | null): void
```

Saves asynchronously the buffer into the file.

See the `Gio.AsyncResult` documentation to know how to use this function.

**Parameters**

- `ioPriority`: the I/O priority of the request. E.g. `G_PRIORITY_LOW`, `G_PRIORITY_DEFAULT` or `G_PRIORITY_HIGH`.
- `cancellable`: optional `GCancellable` object, `null` to ignore.
- `progressCallback`: function to call back with progress information, or `null` if progress information is not needed.
- `callback`: a `GAsyncReadyCallback` to call when the request is satisfied.

### `saveFinish`

```ts
saveFinish(result: Gio.AsyncResult): boolean
```

Finishes a file saving started with `FileSaver.saveAsync()`.

If the file has been saved successfully, the following `File`
properties will be updated: the location, the encoding, the newline type and
the compression type.

Since the 3.20 version, `Gtk.TextBuffer.setModified()` is called with `false`
if the file has been saved successfully.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** whether the file was saved successfully.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `setCompressionType`

```ts
setCompressionType(compressionType: GtkSource.CompressionType): void
```

Sets the compression type. By default the compression type is taken from the
`GtkSourceFile`.

**Parameters**

- `compressionType`: the new compression type.

### `setEncoding`

```ts
setEncoding(encoding: GtkSource.Encoding | null): void
```

Sets the encoding. If `encoding` is `null`, the UTF-8 encoding will be set.

By default the encoding is taken from the `GtkSourceFile`.

**Parameters**

- `encoding`: the new encoding, or `null` for UTF-8.

### `setFlags`

```ts
setFlags(flags: GtkSource.FileSaverFlags): void
```

**Parameters**

- `flags`: the new flags.

### `setNewlineType`

```ts
setNewlineType(newlineType: GtkSource.NewlineType): void
```

Sets the newline type. By default the newline type is taken from the
`GtkSourceFile`.

**Parameters**

- `newlineType`: the new newline type.
