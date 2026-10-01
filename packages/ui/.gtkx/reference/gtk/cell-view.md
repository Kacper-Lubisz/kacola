---
description: "A widget displaying a single row of a GtkTreeModel A GtkCellView displays a single row of a GtkTreeModel using a GtkCellArea and GtkCellAreaContext."
---

# GtkCellView

A widget displaying a single row of a GtkTreeModel

A `GtkCellView` displays a single row of a `GtkTreeModel` using a `GtkCellArea`
and `GtkCellAreaContext`. A `GtkCellAreaContext` can be provided to the
`GtkCellView` at construction time in order to keep the cellview in context
of a group of cell views, this ensures that the renderers displayed will
be properly aligned with each other (like the aligned cells in the menus
of `GtkComboBox`).

`GtkCellView` is `GtkOrientable` in order to decide in which orientation
the underlying `GtkCellAreaContext` should be allocated. Taking the `GtkComboBox`
menu as an example, cellviews should be oriented horizontally if the menus are
listed top-to-bottom and thus all share the same width but may have separate
individual heights (left-to-right menus should be allocated vertically since
they all share the same height but may have variable widths).

### CSS nodes

GtkCellView has a single CSS node with name cellview.

> **Deprecated since 4.10.** List views use widgets to display their contents. You can use `Gtk.Box` instead

```tsx
import { GtkCellView } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkCellView**

Implements `GtkAccessible`, `GtkBuildable`, `GtkCellLayout`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.CellView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `cellArea`

`Gtk.CellArea` · construct-only

The `GtkCellArea` rendering cells

If no area is specified when creating the cell view with `gtk_cell_view_new_with_context()`
a horizontally oriented `GtkCellArea`Box will be used.

since 3.0

### `cellAreaContext`

`Gtk.CellAreaContext` · construct-only

The `GtkCellAreaContext` used to compute the geometry of the cell view.

A group of cell views can be assigned the same context in order to
ensure the sizes and cell alignments match across all the views with
the same context.

`GtkComboBox` menus uses this to assign the same context to all cell views
in the menu items for a single menu (each submenu creates its own
context since the size of each submenu does not depend on parent
or sibling menus).

since 3.0

### `drawSensitive`

`boolean` · default `false`

Whether all cells should be draw as sensitive for this view regardless
of the actual cell properties (used to make menus with submenus appear
sensitive when the items in submenus might be insensitive).

since 3.0

### `fitModel`

`boolean` · default `false`

Whether the view should request enough space to always fit
the size of every row in the model (used by the combo box to
ensure the combo box size doesn't change when different items
are selected).

since 3.0

### `model`

`Gtk.TreeModel | ReactElement`

The model for cell view

since 2.10

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

## Methods

Methods are called on the `Gtk.CellView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getDisplayedRow`

```ts
getDisplayedRow(): Gtk.TreePath | null
```

Returns a `GtkTreePath` referring to the currently
displayed row. If no row is currently displayed,
`null` is returned.

**Returns** the currently displayed row

> **Deprecated since 4.10.**

### `getDrawSensitive`

```ts
getDrawSensitive(): boolean
```

Gets whether `cell_view` is configured to draw all of its
cells in a sensitive state.

**Returns** whether `cell_view` draws all of its
cells in a sensitive state

> **Deprecated since 4.10.**

### `getFitModel`

```ts
getFitModel(): boolean
```

Gets whether `cell_view` is configured to request space
to fit the entire `GtkTreeModel`.

**Returns** whether `cell_view` requests space to fit
the entire `GtkTreeModel`.

> **Deprecated since 4.10.**

### `getModel`

```ts
getModel(): Gtk.TreeModel | null
```

Returns the model for `cell_view`. If no model is used `null` is
returned.

**Returns** a `GtkTreeModel` used

> **Deprecated since 4.10.**

### `setDisplayedRow`

```ts
setDisplayedRow(path: Gtk.TreePath | null): void
```

Sets the row of the model that is currently displayed
by the `GtkCellView`. If the path is unset, then the
contents of the cellview “stick” at their last value;
this is not normally a desired result, but may be
a needed intermediate state if say, the model for
the `GtkCellView` becomes temporarily empty.

**Parameters**

- `path`: a `GtkTreePath` or `null` to unset.

> **Deprecated since 4.10.**

### `setDrawSensitive`

```ts
setDrawSensitive(drawSensitive: boolean): void
```

Sets whether `cell_view` should draw all of its
cells in a sensitive state, this is used by `GtkComboBox` menus
to ensure that rows with insensitive cells that contain
children appear sensitive in the parent menu item.

**Parameters**

- `drawSensitive`: whether to draw all cells in a sensitive state.

> **Deprecated since 4.10.**

### `setFitModel`

```ts
setFitModel(fitModel: boolean): void
```

Sets whether `cell_view` should request space to fit the entire `GtkTreeModel`.

This is used by `GtkComboBox` to ensure that the cell view displayed on
the combo box’s button always gets enough space and does not resize
when selection changes.

**Parameters**

- `fitModel`: whether `cell_view` should request space for the whole model.

> **Deprecated since 4.10.**

### `setModel`

```ts
setModel(model: Gtk.TreeModel | null): void
```

Sets the model for `cell_view`.  If `cell_view` already has a model
set, it will remove it before setting the new model.  If `model` is
`null`, then it will unset the old model.

**Parameters**

- `model`: a `GtkTreeModel`

> **Deprecated since 4.10.**
