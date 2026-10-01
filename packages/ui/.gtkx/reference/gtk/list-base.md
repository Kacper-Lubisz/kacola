---
description: "The abstract base class for GTK's list widgets."
---

# GtkListBase

The abstract base class for GTK's list widgets.

## Shortcuts and Gestures

`GtkListBase` supports the following keyboard shortcuts:

- <kbd>Ctrl</kbd>+<kbd>A</kbd> or <kbd>Ctrl</kbd>+<kbd>&sol;</kbd>
  selects all items.
- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> or
  <kbd>Ctrl</kbd>+<kbd>&bsol;</kbd> unselects all items.

The focused item is controlled by the navigation keys below, combined
with the <kbd>Ctrl</kbd> modifier to prevent moving the selection,
and the <kbd>Shift</kbd> modifier to extend the current selection.

- <kbd>←</kbd>, <kbd>→</kbd>, <kbd>↑</kbd>, <kbd>↓</kbd> move the focus
  on the next item in the designed direction.
- <kbd>Home</kbd> and <kbd>End</kbd> focus the first or last item.
- <kbd>PgUp</kbd> and <kbd>PgDn</kbd> move the focus one page up or down.

List item widgets support the following keyboard shortcuts:

- <kbd>Enter</kbd> activates the item.
- <kbd>␣</kbd> selects the item, with the same <kbd>Ctrl</kbd> and
  <kbd>Shift</kbd> modifiers combinations as the navigation keys.

## Actions

`GtkListBase` defines a set of built-in actions:

- `list.scroll-to-item` moves the visible area to the item at given position
  with the minimum amount of scrolling required. If the item is already
  visible, nothing happens.
- `list.select-item` changes the selection.
- `list.select-all` selects all items in the model, if the selection model
  supports it.
- `list.unselect-all` unselects all items in the model, if the selection
  model supports it.

List item widgets install the following actions:

- `listitem.select` changes selection if the item is selectable.
- `listitem.scroll-to` moves the visible area of the list to this item with
  the minimum amount of scrolling required.

```tsx
import { GtkListBase } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkListBase**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`, `GtkScrollable`.

## Props

`ref` receives the `Gtk.ListBase` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `hadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Horizontal `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `hscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when horizontal scrolling should start.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_VERTICAL`

The orientation of the list. See GtkOrientable:orientation
for details.

### `vadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Vertical `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `vscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when vertical scrolling should start.
