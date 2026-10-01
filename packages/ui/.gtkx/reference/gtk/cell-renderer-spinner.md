---
description: "Renders a spinning animation in a cell GtkCellRendererSpinner renders a spinning animation in a cell, very similar to GtkSpinner."
---

# GtkCellRendererSpinner

Renders a spinning animation in a cell

`GtkCellRendererSpinner` renders a spinning animation in a cell, very
similar to `GtkSpinner`. It can often be used as an alternative
to a `GtkCellRendererProgress` for displaying indefinite activity,
instead of actual progress.

To start the animation in a cell, set the `GtkCellRendererSpinner:active`
property to `true` and increment the `GtkCellRendererSpinner:pulse` property
at regular intervals. The usual way to set the cell renderer properties
for each cell is to bind them to columns in your tree model using e.g.
`gtk_tree_view_column_add_attribute()`.

> **Deprecated since 4.10.** List views use widgets to display their contents. You should use `Gtk.Spinner` instead

```tsx
import { GtkCellRendererSpinner } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkCellRenderer](.gtkx/reference/gtk/cell-renderer.md) → **GtkCellRendererSpinner**

## Props

`ref` receives the `Gtk.CellRendererSpinner` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `active`

`boolean` · default `false`

Whether the spinner is active (ie. shown) in the cell

### `pulse`

`number` · default `0`

Pulse of the spinner. Increment this value to draw the next frame of the
spinner animation. Usually, you would update this value in a timeout.

By default, the `GtkSpinner` widget draws one full cycle of the animation,
consisting of 12 frames, in 750 milliseconds.

### `size`

`Gtk.IconSize` · default `GTK_ICON_SIZE_INHERIT`

The `GtkIconSize` value that specifies the size of the rendered spinner.
