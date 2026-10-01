---
description: "Bypasses gsk rendering by passing the content of its child directly to the compositor."
---

# GtkGraphicsOffload

Bypasses gsk rendering by passing the content of its child directly to the compositor.

Graphics offload is an optimization to reduce overhead and battery use that is
most useful for video content. It only works on some platforms and in certain
situations. GTK will automatically fall back to normal rendering if it doesn't.

Graphics offload is most efficient if there are no controls drawn on top of the
video content.

You should consider using graphics offload for your main widget if it shows
frequently changing content (such as a video, or a VM display) and you provide
the content in the form of dmabuf textures (see `Gdk.DmabufTextureBuilder`),
in particular if it may be fullscreen.

Numerous factors can prohibit graphics offload:

- Unsupported platforms. Currently, graphics offload only works on Linux with Wayland.

- Clipping, such as rounded corners that cause the video content to not be rectangular

- Unsupported dmabuf formats (see `Gdk.Display.getDmabufFormats()`)

- Translucent video content (content with an alpha channel, even if it isn't used)

- Transforms that are more complex than translations and scales

- Filters such as opacity, grayscale or similar

To investigate problems related graphics offload, GTK offers debug flags to print
out information about graphics offload and dmabuf use:

    GDK_DEBUG=offload
    GDK_DEBUG=dmabuf

The GTK inspector provides a visual debugging tool for graphics offload.

_Available since 4.14._

```tsx
import { GtkGraphicsOffload } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkGraphicsOffload**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.GraphicsOffload` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `blackBackground`

`boolean` · default `false`

Whether to draw a black background.

_Available since 4.16._

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `enabled`

`Gtk.GraphicsOffloadEnabled` · default `GTK_GRAPHICS_OFFLOAD_ENABLED`

Whether graphics offload is enabled.

_Available since 4.14._

## Methods

Methods are called on the `Gtk.GraphicsOffload` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getBlackBackground`

```ts
getBlackBackground(): boolean
```

Returns whether the widget draws a black background.

See `Gtk.GraphicsOffload.setBlackBackground()`.

**Returns** `TRUE` if black background is drawn

_Available since 4.16._

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child of `self`.

**Returns** the child widget

_Available since 4.14._

### `getEnabled`

```ts
getEnabled(): Gtk.GraphicsOffloadEnabled
```

Returns whether offload is enabled for `self`.

**Returns** whether offload is enabled

_Available since 4.14._

### `setBlackBackground`

```ts
setBlackBackground(value: boolean): void
```

Sets whether this GtkGraphicsOffload widget will draw a black
background.

A main use case for this is **_letterboxing_** where black bars are
visible next to the content if the aspect ratio of the content does
not match the dimensions of the monitor.

Using this property for letterboxing instead of CSS allows compositors
to show content with maximum efficiency, using direct scanout to avoid
extra copies in the compositor.

On Wayland, this is implemented using the
[single-pixel buffer](https://wayland.app/protocols/single-pixel-buffer-v1)
protocol.

**Parameters**

- `value`: whether to draw a black background behind the content

_Available since 4.16._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child of `self`.

**Parameters**

- `child`: the child widget

_Available since 4.14._

### `setEnabled`

```ts
setEnabled(enabled: Gtk.GraphicsOffloadEnabled): void
```

Sets whether this GtkGraphicsOffload widget will attempt
to offload the content of its child widget.

**Parameters**

- `enabled`: whether to enable offload

_Available since 4.14._
