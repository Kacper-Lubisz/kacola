---
description: "Places “overlay” widgets on top of a single main child."
---

# GtkOverlay

Places “overlay” widgets on top of a single main child.



The position of each overlay widget is determined by its
`Gtk.Widget.halign` and `Gtk.Widget.valign`
properties. E.g. a widget with both alignments set to `GTK_ALIGN_START`
will be placed at the top left corner of the `GtkOverlay` container,
whereas an overlay with halign set to `GTK_ALIGN_CENTER` and valign set
to `GTK_ALIGN_END` will be placed a the bottom edge of the `GtkOverlay`,
horizontally centered. The position can be adjusted by setting the margin
properties of the child to non-zero values.

More complicated placement of overlays is possible by connecting
to the `Gtk.Overlay.get-child-position` signal.

An overlay’s minimum and natural sizes are those of its main child.
The sizes of overlay children are not considered when measuring these
preferred sizes.

## GtkOverlay as GtkBuildable

The `GtkOverlay` implementation of the `GtkBuildable` interface
supports placing a child as an overlay by specifying “overlay” as
the “type” attribute of a `<child>` element.

## CSS nodes

`GtkOverlay` has a single CSS node with the name “overlay”. Overlay children
whose alignments cause them to be positioned at an edge get the style classes
“.left”, “.right”, “.top”, and/or “.bottom” according to their position.

```tsx
import { GtkOverlay } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkOverlay**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Overlay` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `overlays`

`ReactNode | null`

Widgets stacked over the main child.

## Signals

### `onGetChildPosition`

```ts
(widget: Gtk.Widget, allocation: Gdk.Rectangle, self: Gtk.Overlay) => boolean | undefined
```

Emitted to determine the position and size of any overlay
child widgets.

A handler for this signal should fill `allocation` with
the desired position and size for `widget`, relative to
the 'main' child of `overlay`.

The default handler for this signal uses the `widget`'s
halign and valign properties to determine the position
and gives the widget its natural size (except that an
alignment of `GTK_ALIGN_FILL` will cause the overlay to
be full-width/height). If the main child is a
`GtkScrolledWindow`, the overlays are placed relative
to its contents.

**Parameters**

- `widget`: the child widget to position
- `allocation`: return location for the allocation
- `self`: The instance the signal was emitted on.

**Returns** `true` if the `allocation` has been filled

## Methods

Methods are called on the `Gtk.Overlay` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addOverlay`

```ts
addOverlay(widget: Gtk.Widget): void
```

Adds `widget` to `overlay`.

The widget will be stacked on top of the main widget
added with `Gtk.Overlay.setChild()`.

The position at which `widget` is placed is determined
from its `Gtk.Widget.halign` and
`Gtk.Widget.valign` properties.

**Parameters**

- `widget`: a `GtkWidget` to be added to the container

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `overlay`.

**Returns** the child widget of `overlay`

### `getClipOverlay`

```ts
getClipOverlay(widget: Gtk.Widget): boolean
```

Gets whether `widget` should be clipped within the parent.

**Parameters**

- `widget`: an overlay child of `GtkOverlay`

**Returns** whether the widget is clipped within the parent.

### `getMeasureOverlay`

```ts
getMeasureOverlay(widget: Gtk.Widget): boolean
```

Gets whether `widget`'s size is included in the measurement of
`overlay`.

**Parameters**

- `widget`: an overlay child of `GtkOverlay`

**Returns** whether the widget is measured

### `removeOverlay`

```ts
removeOverlay(widget: Gtk.Widget): void
```

Removes an overlay that was added with `gtk_overlay_add_overlay()`.

**Parameters**

- `widget`: a `GtkWidget` to be removed

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `overlay`.

**Parameters**

- `child`: the child widget

### `setClipOverlay`

```ts
setClipOverlay(widget: Gtk.Widget, clipOverlay: boolean): void
```

Sets whether `widget` should be clipped within the parent.

**Parameters**

- `widget`: an overlay child of `GtkOverlay`
- `clipOverlay`: whether the child should be clipped

### `setMeasureOverlay`

```ts
setMeasureOverlay(widget: Gtk.Widget, measure: boolean): void
```

Sets whether `widget` is included in the measured size of `overlay`.

The overlay will request the size of the largest child that has
this property set to `true`. Children who are not included may
be drawn outside of `overlay`'s allocation if they are too large.

**Parameters**

- `widget`: an overlay child of `GtkOverlay`
- `measure`: whether the child should be measured
