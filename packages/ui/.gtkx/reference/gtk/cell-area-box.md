---
description: "A cell area that renders GtkCellRenderers into a row or a column The GtkCellAreaBox renders cell renderers into a row or a column depending on its GtkOrientation."
---

# GtkCellAreaBox

A cell area that renders GtkCellRenderers into a row or a column

The `GtkCellAreaBox` renders cell renderers into a row or a column
depending on its `GtkOrientation`.

GtkCellAreaBox uses a notion of packing. Packing
refers to adding cell renderers with reference to a particular position
in a `GtkCellAreaBox`. There are two reference positions: the
start and the end of the box.
When the `GtkCellAreaBox` is oriented in the `GTK_ORIENTATION_VERTICAL`
orientation, the start is defined as the top of the box and the end is
defined as the bottom. In the `GTK_ORIENTATION_HORIZONTAL` orientation
start is defined as the left side and the end is defined as the right
side.

Alignments of `GtkCellRenderer`s rendered in adjacent rows can be
configured by configuring the `GtkCellAreaBox` align child cell property
with `gtk_cell_area_cell_set_property()` or by specifying the "align"
argument to `gtk_cell_area_box_pack_start()` and `gtk_cell_area_box_pack_end()`.

> **Deprecated since 4.10.** List views use widgets for displaying their contents

```tsx
import { GtkCellAreaBox } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkCellArea](.gtkx/reference/gtk/cell-area.md) → **GtkCellAreaBox**

Implements `GtkBuildable`, `GtkCellLayout`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.CellAreaBox` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `spacing`

`number` · default `0`

The amount of space to reserve between cells.

## Methods

Methods are called on the `Gtk.CellAreaBox` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `cellAreaBoxPackEnd`

```ts
cellAreaBoxPackEnd(renderer: Gtk.CellRenderer, expand: boolean, align: boolean, fixed: boolean): void
```

Adds `renderer` to `box`, packed with reference to the end of `box`.

The `renderer` is packed after (away from end of) any other
`GtkCellRenderer` packed with reference to the end of `box`.

**Parameters**

- `renderer`: the `GtkCellRenderer` to add
- `expand`: whether `renderer` should receive extra space when the area receives more than its natural size
- `align`: whether `renderer` should be aligned in adjacent rows
- `fixed`: whether `renderer` should have the same size in all rows

> **Deprecated since 4.10.**

### `cellAreaBoxPackStart`

```ts
cellAreaBoxPackStart(renderer: Gtk.CellRenderer, expand: boolean, align: boolean, fixed: boolean): void
```

Adds `renderer` to `box`, packed with reference to the start of `box`.

The `renderer` is packed after any other `GtkCellRenderer` packed
with reference to the start of `box`.

**Parameters**

- `renderer`: the `GtkCellRenderer` to add
- `expand`: whether `renderer` should receive extra space when the area receives more than its natural size
- `align`: whether `renderer` should be aligned in adjacent rows
- `fixed`: whether `renderer` should have the same size in all rows

> **Deprecated since 4.10.**

### `getSpacing`

```ts
getSpacing(): number
```

Gets the spacing added between cell renderers.

**Returns** the space added between cell renderers in `box`.

> **Deprecated since 4.10.**

### `setSpacing`

```ts
setSpacing(spacing: number): void
```

Sets the spacing to add between cell renderers in `box`.

**Parameters**

- `spacing`: the space to add between `GtkCellRenderer`s

> **Deprecated since 4.10.**
