---
description: "A GtkRoot implementation for drag icons."
---

# GtkDragIcon

A `GtkRoot` implementation for drag icons.

A drag icon moves with the pointer during a Drag-and-Drop operation
and is destroyed when the drag ends.

To set up a drag icon and associate it with an ongoing drag operation,
use `Gtk.DragIcon.getForDrag()` to get the icon for a drag. You can
then use it like any other widget and use `Gtk.DragIcon.setChild()`
to set whatever widget should be used for the drag icon.

Keep in mind that drag icons do not allow user input.

```tsx
import { GtkDragIcon } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkDragIcon**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`.

## Props

`ref` receives the `Gtk.DragIcon` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

## Methods

Methods are called on the `Gtk.DragIcon` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the widget currently used as drag icon.

**Returns** The drag icon

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the widget to display as the drag icon.

**Parameters**

- `child`: a `GtkWidget`
