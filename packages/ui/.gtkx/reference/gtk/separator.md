---
description: "Draws a horizontal or vertical line to separate other widgets."
---

# GtkSeparator

Draws a horizontal or vertical line to separate other widgets.



A `GtkSeparator` can be used to group the widgets within a window.
It displays a line with a shadow to make it appear sunken into the
interface.

## CSS nodes

`GtkSeparator` has a single CSS node with name separator. The node
gets one of the .horizontal or .vertical style classes.

## Accessibility

`GtkSeparator` uses the `Gtk.AccessibleRole.separator` role.

```tsx
import { GtkSeparator } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkSeparator**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.Separator` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.
