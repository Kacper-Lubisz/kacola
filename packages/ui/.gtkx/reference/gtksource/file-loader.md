---
description: "Load a file into a GtkSourceBuffer."
---

# GtkSourceFileLoader

Load a file into a GtkSourceBuffer.

A `GtkSourceFileLoader` object permits to load the contents of a `Gio.File` or a
`Gio.InputStream` into a `Buffer`.

A file loader should be used only for one load operation, including errors
handling. If an error occurs, you can reconfigure the loader and relaunch the
operation with `FileLoader.loadAsync()`.

Running a `GtkSourceFileLoader` is an undoable action for the
`Buffer`.

After a file loading, the buffer is reset to the contents provided by the
`Gio.File` or `Gio.InputStream`, so the buffer is set as “unmodified”, that is,
`Gtk.TextBuffer.setModified()` is called with `false`. If the contents isn't
saved somewhere (for example if you load from stdin), then you should
probably call `Gtk.TextBuffer.setModified()` with `true` after calling
`FileLoader.loadFinish()`.

```tsx
import { GtkSourceFileLoader } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceFileLoader**

## Props

`ref` receives the `GtkSource.FileLoader` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `buffer`

`GtkSource.Buffer` · construct-only

The `GtkSourceBuffer` to load the contents into. The
`GtkSourceFileLoader` object has a weak reference to the buffer.

### `file`

`GtkSource.File` · construct-only

The `GtkSourceFile`. The `GtkSourceFileLoader` object has a weak
reference to the file.

### `inputStream`

`Gio.InputStream` · construct-only

The `GInputStream` to load. Useful for reading stdin. If this property
is set, the `GtkSourceFileLoader.location` property is ignored.

### `location`

`Gio.File` · construct-only

The `GFile` to load. If the `GtkSourceFileLoader.inputStream` is
`null`, by default the location is taken from the `GtkSourceFile` at
construction time.

## Methods

Methods are called on the `GtkSource.FileLoader` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getBuffer`

```ts
getBuffer(): GtkSource.Buffer
```

**Returns** the `GtkSourceBuffer` to load the contents into.

### `getCompressionType`

```ts
getCompressionType(): GtkSource.CompressionType
```

**Returns** the detected compression type.

### `getEncoding`

```ts
getEncoding(): GtkSource.Encoding
```

**Returns** the detected file encoding.

### `getFile`

```ts
getFile(): GtkSource.File
```

**Returns** the `GtkSourceFile`.

### `getInputStream`

```ts
getInputStream(): Gio.InputStream | null
```

**Returns** the `GInputStream` to load, or `null`
if a `GFile` is used.

### `getLocation`

```ts
getLocation(): Gio.File | null
```

**Returns** the `GFile` to load, or `null`
if an input stream is used.

### `getNewlineType`

```ts
getNewlineType(): GtkSource.NewlineType
```

**Returns** the detected newline type.

### `loadAsync`

```ts
loadAsync(ioPriority: number, cancellable: Gio.Cancellable | null, progressCallback: Gio.FileProgressCallback | null, callback: Gio.AsyncReadyCallback | null): void
```

Loads asynchronously the file or input stream contents into the `Buffer`.

See the `Gio.AsyncResult` documentation to know how to use this
function.

**Parameters**

- `ioPriority`: the I/O priority of the request. E.g. `G_PRIORITY_LOW`, `G_PRIORITY_DEFAULT` or `G_PRIORITY_HIGH`.
- `cancellable`: optional `GCancellable` object, `null` to ignore.
- `progressCallback`: function to call back with progress information, or `null` if progress information is not needed.
- `callback`: a `GAsyncReadyCallback` to call when the request is satisfied.

### `loadFinish`

```ts
loadFinish(result: Gio.AsyncResult): boolean
```

Finishes a file loading started with `FileLoader.loadAsync()`.

If the contents has been loaded, the following `File` properties will
be updated: the location, the encoding, the newline type and the compression
type.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** whether the contents has been loaded successfully.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `setCandidateEncodings`

```ts
setCandidateEncodings(candidateEncodings: GtkSource.Encoding[]): void
```

Sets the candidate encodings for the file loading.

The encodings are tried in the same order as the list.

For convenience, `candidate_encodings` can contain duplicates. Only the first
occurrence of a duplicated encoding is kept in the list.

By default the candidate encodings are (in that order in the list):

1. If set, the `File`'s encoding as returned by `File.getEncoding()`.
2. The default candidates as returned by `Encoding.getDefaultCandidates()`.

**Parameters**

- `candidateEncodings`: a list of `GtkSourceEncoding`s.
