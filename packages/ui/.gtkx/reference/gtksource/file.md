---
description: "On-disk representation of a Buffer."
---

# GtkSourceFile

On-disk representation of a `Buffer`.

A `GtkSourceFile` object is the on-disk representation of a `Buffer`.
With a `GtkSourceFile`, you can create and configure a `FileLoader`
and `FileSaver` which take by default the values of the
`GtkSourceFile` properties (except for the file loader which auto-detect some
properties). On a successful load or save operation, the `GtkSourceFile`
properties are updated. If an operation fails, the `GtkSourceFile` properties
have still the previous valid values.

```tsx
import { GtkSourceFile } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceFile**

## Props

`ref` receives the `GtkSource.File` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `compressionType`

`GtkSource.CompressionType` · default `GTK_SOURCE_COMPRESSION_TYPE_NONE` · read-only, observe with `onNotifyCompressionType`

The compression type.

### `encoding`

`GtkSource.Encoding` · read-only, observe with `onNotifyEncoding`

The character encoding, initially `null`. After a successful file
loading or saving operation, the encoding is non-`null`.

### `location`

`Gio.File | ReactElement`

The location.

### `newlineType`

`GtkSource.NewlineType` · default `GTK_SOURCE_NEWLINE_TYPE_LF` · read-only, observe with `onNotifyNewlineType`

The line ending type.

### `readOnly`

`boolean` · default `false` · read-only, observe with `onNotifyReadOnly`

Whether the file is read-only or not. The value of this property is
not updated automatically (there is no file monitors).

## Methods

Methods are called on the `GtkSource.File` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `checkFileOnDisk`

```ts
checkFileOnDisk(): void
```

Checks synchronously the file on disk, to know whether the file is externally
modified, or has been deleted, and whether the file is read-only.

`GtkSourceFile` doesn't create a `Gio.FileMonitor` to track those properties, so
this function needs to be called instead. Creating lots of `Gio.FileMonitor`'s
would take lots of resources.

Since this function is synchronous, it is advised to call it only on local
files. See `File.isLocal()`.

### `getCompressionType`

```ts
getCompressionType(): GtkSource.CompressionType
```

**Returns** the compression type.

### `getEncoding`

```ts
getEncoding(): GtkSource.Encoding
```

The encoding is initially `null`. After a successful file loading or saving
operation, the encoding is non-`null`.

**Returns** the character encoding.

### `getLocation`

```ts
getLocation(): Gio.File | null
```

**Returns** the `GFile`.

### `getNewlineType`

```ts
getNewlineType(): GtkSource.NewlineType
```

**Returns** the newline type.

### `isDeleted`

```ts
isDeleted(): boolean
```

Returns whether the file has been deleted. If the
`File.location` is `null`, returns `false`.

To have an up-to-date value, you must first call
`File.checkFileOnDisk()`.

**Returns** whether the file has been deleted.

### `isExternallyModified`

```ts
isExternallyModified(): boolean
```

Returns whether the file is externally modified. If the
`File.location` is `null`, returns `false`.

To have an up-to-date value, you must first call
`File.checkFileOnDisk()`.

**Returns** whether the file is externally modified.

### `isLocal`

```ts
isLocal(): boolean
```

Returns whether the file is local. If the `File.location` is `null`,
returns `false`.

**Returns** whether the file is local.

### `isReadonly`

```ts
isReadonly(): boolean
```

Returns whether the file is read-only. If the
`File.location` is `null`, returns `false`.

To have an up-to-date value, you must first call
`File.checkFileOnDisk()`.

**Returns** whether the file is read-only.

### `setLocation`

```ts
setLocation(location: Gio.File | null): void
```

Sets the location.

**Parameters**

- `location`: the new `GFile`, or `null`.
