---
description: "Shows a GtkMediaStream with media controls."
---

# GtkVideo

Shows a `GtkMediaStream` with media controls.



The controls are available separately as `Gtk.MediaControls`.
If you just want to display a video without controls, you can treat it
like any other paintable and for example put it into a `Gtk.Picture`.

`GtkVideo` aims to cover use cases such as previews, embedded animations,
etc. It supports autoplay, looping, and simple media controls. It does
not have support for video overlays, multichannel audio, device
selection, or input. If you are writing a full-fledged video player,
you may want to use the `Gdk.Paintable` API and a media framework
such as Gstreamer directly.

```tsx
import { GtkVideo } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkVideo**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Video` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `autoplay`

`boolean` · default `false`

If the video should automatically begin playing.

### `file`

`Gio.File | ReactElement`

The file played by this video if the video is playing a file.

### `graphicsOffload`

`Gtk.GraphicsOffloadEnabled` · default `GTK_GRAPHICS_OFFLOAD_DISABLED`

Whether to enable graphics offload.

_Available since 4.14._

### `loop`

`boolean` · default `false`

If new media files should be set to loop.

### `mediaStream`

`Gtk.MediaStream | ReactElement`

The media-stream played

## Methods

Methods are called on the `Gtk.Video` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAutoplay`

```ts
getAutoplay(): boolean
```

Returns `true` if videos have been set to loop.

**Returns** `true` if streams should autoplay

### `getFile`

```ts
getFile(): Gio.File | null
```

Gets the file played by `self` or `null` if not playing back
a file.

**Returns** The file played by `self`

### `getGraphicsOffload`

```ts
getGraphicsOffload(): Gtk.GraphicsOffloadEnabled
```

Returns whether graphics offload is enabled.

See `Gtk.GraphicsOffload` for more information on graphics offload.

**Returns** the graphics offload status

_Available since 4.14._

### `getLoop`

```ts
getLoop(): boolean
```

Returns `true` if videos have been set to loop.

**Returns** `true` if streams should loop

### `getMediaStream`

```ts
getMediaStream(): Gtk.MediaStream | null
```

Gets the media stream managed by `self` or `null` if none.

**Returns** The media stream managed by `self`

### `setAutoplay`

```ts
setAutoplay(autoplay: boolean): void
```

Sets whether `self` automatically starts playback when it
becomes visible or when a new file gets loaded.

**Parameters**

- `autoplay`: whether media streams should autoplay

### `setFile`

```ts
setFile(file: Gio.File | null): void
```

Makes `self` play the given `file`.

**Parameters**

- `file`: the file to play

### `setFilename`

```ts
setFilename(filename: string | null): void
```

Makes `self` play the given `filename`.

This is a utility function that calls `gtk_video_set_file()`,

**Parameters**

- `filename`: the filename to play

### `setGraphicsOffload`

```ts
setGraphicsOffload(enabled: Gtk.GraphicsOffloadEnabled): void
```

Sets whether to enable graphics offload.

See `Gtk.GraphicsOffload` for more information on graphics offload.

**Parameters**

- `enabled`: the new graphics offload status

_Available since 4.14._

### `setLoop`

```ts
setLoop(loop: boolean): void
```

Sets whether new files loaded by `self` should be set to loop.

**Parameters**

- `loop`: whether media streams should loop

### `setMediaStream`

```ts
setMediaStream(stream: Gtk.MediaStream | null): void
```

Sets the media stream to be played back.

`self` will take full control of managing the media stream. If you
want to manage a media stream yourself, consider using a
`Gtk.Picture` for display.

If you want to display a file, consider using `Gtk.Video.setFile()`
instead.

**Parameters**

- `stream`: The media stream to play or `null` to unset

### `setResource`

```ts
setResource(resourcePath: string | null): void
```

Makes `self` play the resource at the given `resource_path`.

This is a utility function that calls `Gtk.Video.setFile()`.

**Parameters**

- `resourcePath`: the resource to set
