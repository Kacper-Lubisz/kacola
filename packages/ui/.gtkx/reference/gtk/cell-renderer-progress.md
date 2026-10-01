---
description: "Renders numbers as progress bars GtkCellRendererProgress renders a numeric value as a progress par in a cell."
---

# GtkCellRendererProgress

Renders numbers as progress bars

`GtkCellRendererProgress` renders a numeric value as a progress par in a cell.
Additionally, it can display a text on top of the progress bar.

> **Deprecated since 4.10.** List views use widgets to display their contents. You should use `Gtk.ProgressBar` instead

```tsx
import { GtkCellRendererProgress } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkCellRenderer](.gtkx/reference/gtk/cell-renderer.md) → **GtkCellRendererProgress**

Implements `GtkOrientable`.

## Props

`ref` receives the `Gtk.CellRendererProgress` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `inverted`

`boolean` · default `false`

Whether progess is inverted.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `pulse`

`number` · default `-1`

Setting this to a non-negative value causes the cell renderer to
enter "activity mode", where a block bounces back and forth to
indicate that some progress is made, without specifying exactly how
much.

Each increment of the property causes the block to move by a little
bit.

To indicate that the activity has not started yet, set the property
to zero. To indicate completion, set the property to `G_MAXINT`.

### `text`

`string` · default `null`

The "text" property determines the label which will be drawn
over the progress bar. Setting this property to `null` causes the default
label to be displayed. Setting this property to an empty string causes
no label to be displayed.

### `textXalign`

`number` · default `0.500000`

The "text-xalign" property controls the horizontal alignment of the
text in the progress bar.  Valid values range from 0 (left) to 1
(right).  Reserved for RTL layouts.

### `textYalign`

`number` · default `0.500000`

The "text-yalign" property controls the vertical alignment of the
text in the progress bar.  Valid values range from 0 (top) to 1
(bottom).

### `value`

`number` · default `0`

The "value" property determines the percentage to which the
progress bar will be "filled in".
