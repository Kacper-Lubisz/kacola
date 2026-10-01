---
description: "A GdkPaintable that displays the contents of a widget."
---

# GtkWidgetPaintable

A `GdkPaintable` that displays the contents of a widget.

`GtkWidgetPaintable` will also take care of the widget not being in a
state where it can be drawn (like when it isn't shown) and just draw
nothing or where it does not have a size (like when it is hidden) and
report no size in that case.

Of course, `GtkWidgetPaintable` allows you to monitor widgets for size
changes by emitting the `Gdk.Paintable.invalidate-size` signal
whenever the size of the widget changes as well as for visual changes by
emitting the `Gdk.Paintable.invalidate-contents` signal whenever
the widget changes.

You can use a `GtkWidgetPaintable` everywhere a `GdkPaintable` is allowed,
including using it on a `GtkPicture` (or one of its parents) that it was
set on itself via `gtk_picture_set_paintable()`. The paintable will take care
of recursion when this happens. If you do this however, ensure that the
`Gtk.Picture.canShrink` property is set to `true` or you might
end up with an infinitely growing widget.

```tsx
import { GtkWidgetPaintable } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkWidgetPaintable**

Implements `GdkPaintable`.

## Props

`ref` receives the `Gtk.WidgetPaintable` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `widget`

`Gtk.Widget | ReactElement`

The observed widget or `null` if none.

## Signals

### `onInvalidateContents`

```ts
(self: Gtk.WidgetPaintable) => void
```

From `GdkPaintable`.

Emitted when the contents of the `paintable` change.

Examples for such an event would be videos changing to the next frame or
the icon theme for an icon changing.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onInvalidateSize`

```ts
(self: Gtk.WidgetPaintable) => void
```

From `GdkPaintable`.

Emitted when the intrinsic size of the `paintable` changes.

This means the values reported by at least one of
`Gdk.Paintable.getIntrinsicWidth()`,
`Gdk.Paintable.getIntrinsicHeight()` or
`Gdk.Paintable.getIntrinsicAspectRatio()`
has changed.

Examples for such an event would be a paintable displaying
the contents of a toplevel surface being resized.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.WidgetPaintable` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getWidget`

```ts
getWidget(): Gtk.Widget | null
```

Returns the widget that is observed or `null` if none.

**Returns** the observed widget.

### `setWidget`

```ts
setWidget(widget: Gtk.Widget | null): void
```

Sets the widget that should be observed.

**Parameters**

- `widget`: the widget to observe
