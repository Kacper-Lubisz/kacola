---
description: "Shows controls for video playback."
---

# GtkMediaControls

Shows controls for video playback.



Usually, `GtkMediaControls` is used as part of `Gtk.Video`.

```tsx
import { GtkMediaControls } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkMediaControls**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.MediaControls` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `mediaStream`

`Gtk.MediaStream | ReactElement`

The media-stream managed by this object or `null` if none.

## Methods

Methods are called on the `Gtk.MediaControls` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getMediaStream`

```ts
getMediaStream(): Gtk.MediaStream | null
```

Gets the media stream managed by `controls` or `null` if none.

**Returns** The media stream managed by `controls`

### `setMediaStream`

```ts
setMediaStream(stream: Gtk.MediaStream | null): void
```

Sets the stream that is controlled by `controls`.

**Parameters**

- `stream`: a `GtkMediaStream`
