---
description: "Implements the GtkMediaStream interface for files."
---

# GtkMediaFile

Implements the `GtkMediaStream` interface for files.

This provides a simple way to play back video files with GTK.

GTK provides a GIO extension point for `GtkMediaFile` implementations
to allow for external implementations using various media frameworks.

GTK itself includes an implementation using GStreamer.

```tsx
import { GtkMediaFile } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkMediaStream](.gtkx/reference/gtk/media-stream.md) → **GtkMediaFile**

Implements `GdkPaintable`.

## Props

`ref` receives the `Gtk.MediaFile` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `file`

`Gio.File | ReactElement`

The file being played back or `null` if not playing a file.

### `inputStream`

`Gio.InputStream | ReactElement`

The stream being played back or `null` if not playing a stream.

This is `null` when playing a file.

## Methods

Methods are called on the `Gtk.MediaFile` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `clear`

```ts
clear(): void
```

Resets the media file to be empty.

### `getFile`

```ts
getFile(): Gio.File | null
```

Returns the file that `self` is currently playing from.

When `self` is not playing or not playing from a file,
`null` is returned.

**Returns** The currently playing file

### `getInputStream`

```ts
getInputStream(): Gio.InputStream | null
```

Returns the stream that `self` is currently playing from.

When `self` is not playing or not playing from a stream,
`null` is returned.

**Returns** The currently playing stream

### `setFile`

```ts
setFile(file: Gio.File | null): void
```

Sets the `GtkMediaFile` to play the given file.

If any file is still playing, stop playing it.

**Parameters**

- `file`: the file to play

### `setFilename`

```ts
setFilename(filename: string | null): void
```

Sets the `GtkMediaFile` to play the given file.

This is a utility function that converts the given `filename`
to a `GFile` and calls `Gtk.MediaFile.setFile()`.

**Parameters**

- `filename`: name of file to play

### `setInputStream`

```ts
setInputStream(stream: Gio.InputStream | null): void
```

Sets the `GtkMediaFile` to play the given stream.

If anything is still playing, stop playing it.

Full control about the `stream` is assumed for the duration of
playback. The stream will not be closed.

**Parameters**

- `stream`: the stream to play from

### `setResource`

```ts
setResource(resourcePath: string | null): void
```

Sets the `GtkMediaFile` to play the given resource.

This is a utility function that converts the given `resource_path`
to a `GFile` and calls `Gtk.MediaFile.setFile()`.

**Parameters**

- `resourcePath`: path to resource to play
