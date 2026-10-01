---
description: "Renders a spin button in a cell GtkCellRendererSpin renders text in a cell like GtkCellRendererText from which it is derived."
---

# GtkCellRendererSpin

Renders a spin button in a cell

`GtkCellRendererSpin` renders text in a cell like `GtkCellRendererText` from
which it is derived. But while `GtkCellRendererText` offers a simple entry to
edit the text, `GtkCellRendererSpin` offers a `GtkSpinButton` widget. Of course,
that means that the text has to be parseable as a floating point number.

The range of the spinbutton is taken from the adjustment property of the
cell renderer, which can be set explicitly or mapped to a column in the
tree model, like all properties of cell renders. `GtkCellRendererSpin`
also has properties for the `GtkCellRendererSpin:climb-rate` and the number
of `GtkCellRendererSpin:digits` to display. Other `GtkSpinButton` properties
can be set in a handler for the `GtkCellRenderer::editing-started` signal.

> **Deprecated since 4.10.** List views use widgets to display their contents. You should use `Gtk.SpinButton` instead

```tsx
import { GtkCellRendererSpin } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkCellRenderer](.gtkx/reference/gtk/cell-renderer.md) → [GtkCellRendererText](.gtkx/reference/gtk/cell-renderer-text.md) → **GtkCellRendererSpin**

## Props

`ref` receives the `Gtk.CellRendererSpin` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `adjustment`

`Gtk.Adjustment | ReactElement`

The adjustment that holds the value of the spinbutton.
This must be non-`null` for the cell renderer to be editable.

### `climbRate`

`number` · default `0.000000`

The acceleration rate when you hold down a button.

### `digits`

`number` · default `0`

The number of decimal places to display.
