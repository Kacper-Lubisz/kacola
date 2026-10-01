---
description: "Renders a pixbuf in a cell A GtkCellRendererPixbuf can be used to render an image in a cell."
---

# GtkCellRendererPixbuf

Renders a pixbuf in a cell

A `GtkCellRendererPixbuf` can be used to render an image in a cell. It allows
to render either a given `GdkPixbuf` (set via the
`GtkCellRendererPixbuf:pixbuf` property) or a named icon (set via the
`GtkCellRendererPixbuf:icon-name` property).

To support the tree view, `GtkCellRendererPixbuf` also supports rendering two
alternative pixbufs, when the `GtkCellRenderer:is-expander` property is `true`.
If the `GtkCellRenderer:is-expanded property` is `true` and the
`GtkCellRendererPixbuf:pixbuf-expander-open` property is set to a pixbuf, it
renders that pixbuf, if the `GtkCellRenderer:is-expanded` property is `false`
and the `GtkCellRendererPixbuf:pixbuf-expander-closed` property is set to a
pixbuf, it renders that one.

> **Deprecated since 4.10.** List views use widgets to display their contents. You should use `Gtk.Image` for icons, and `Gtk.Picture` for images

```tsx
import { GtkCellRendererPixbuf } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkCellRenderer](.gtkx/reference/gtk/cell-renderer.md) → **GtkCellRendererPixbuf**

## Props

`ref` receives the `Gtk.CellRendererPixbuf` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `gicon`

`Gio.Icon | ReactElement`

The GIcon representing the icon to display.
If the icon theme is changed, the image will be updated
automatically.

### `iconName`

`string` · default `null`

The name of the themed icon to display.
This property only has an effect if not overridden by the "pixbuf" property.

### `iconSize`

`Gtk.IconSize` · default `GTK_ICON_SIZE_INHERIT`

The `GtkIconSize` value that specifies the size of the rendered icon.

### `pixbuf`

`GdkPixbuf.Pixbuf | ReactElement`

### `pixbufExpanderClosed`

`GdkPixbuf.Pixbuf | ReactElement`

### `pixbufExpanderOpen`

`GdkPixbuf.Pixbuf | ReactElement`

### `texture`

`Gdk.Texture | ReactElement`
