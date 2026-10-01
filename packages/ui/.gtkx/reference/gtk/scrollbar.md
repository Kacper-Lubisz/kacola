---
description: "Shows a horizontal or vertical scrollbar."
---

# GtkScrollbar

Shows a horizontal or vertical scrollbar.



Its position and movement are controlled by the adjustment that is passed to
or created by `Gtk.Scrollbar.new()`. See `Gtk.Adjustment` for more
details. The `Gtk.Adjustment.value` field sets the position of the
thumb and must be between `Gtk.Adjustment.lower` and
`Gtk.Adjustment.upper` - `Gtk.Adjustment.pageSize`.
The `Gtk.Adjustment.pageSize` represents the size of the visible
scrollable area.

The fields `Gtk.Adjustment.stepIncrement` and
`Gtk.Adjustment.pageIncrement` fields are added to or subtracted
from the `Gtk.Adjustment.value` when the user asks to move by a step
(using e.g. the cursor arrow keys) or by a page (using e.g. the Page Down/Up
keys).

## CSS nodes

```
scrollbar
╰── range[.fine-tune]
    ╰── trough
        ╰── slider
```

`GtkScrollbar` has a main CSS node with name scrollbar and a subnode for its
contents. The main node gets the .horizontal or .vertical style classes applied,
depending on the scrollbar's orientation.

The range node gets the style class .fine-tune added when the scrollbar is
in 'fine-tuning' mode.

Other style classes that may be added to scrollbars inside
`Gtk.ScrolledWindow` include the positional classes (.left, .right,
.top, .bottom) and style classes related to overlay scrolling (.overlay-indicator,
.dragging, .hovering).

## Accessibility

`GtkScrollbar` uses the `Gtk.AccessibleRole.scrollbar` role.

```tsx
import { GtkScrollbar } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkScrollbar**

Implements `GtkAccessible`, `GtkAccessibleRange`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.Scrollbar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `adjustment`

`Gtk.Adjustment | ReactElement`

The `GtkAdjustment` controlled by this scrollbar.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

## Methods

Methods are called on the `Gtk.Scrollbar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAdjustment`

```ts
getAdjustment(): Gtk.Adjustment
```

Returns the scrollbar's adjustment.

**Returns** the scrollbar's adjustment

### `setAdjustment`

```ts
setAdjustment(adjustment: Gtk.Adjustment | null): void
```

Makes the scrollbar use the given adjustment.

**Parameters**

- `adjustment`: the adjustment to set
