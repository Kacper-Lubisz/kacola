---
description: "The selection object for GtkTreeView The GtkTreeSelection object is a helper object to manage the selection for a GtkTreeView widget."
---

# GtkTreeSelection

The selection object for GtkTreeView

The `GtkTreeSelection` object is a helper object to manage the selection
for a `GtkTreeView` widget.  The `GtkTreeSelection` object is
automatically created when a new `GtkTreeView` widget is created, and
cannot exist independently of this widget.  The primary reason the
`GtkTreeSelection` objects exists is for cleanliness of code and API.
That is, there is no conceptual reason all these functions could not be
methods on the `GtkTreeView` widget instead of a separate function.

The `GtkTreeSelection` object is gotten from a `GtkTreeView` by calling
`gtk_tree_view_get_selection()`.  It can be manipulated to check the
selection status of the tree, as well as select and deselect individual
rows.  Selection is done completely view side.  As a result, multiple
views of the same model can have completely different selections.
Additionally, you cannot change the selection of a row on the model that
is not currently displayed by the view without expanding its parents
first.

One of the important things to remember when monitoring the selection of
a view is that the `GtkTreeSelection`::changed signal is mostly a hint.
That is, it may only emit one signal when a range of rows is selected.
Additionally, it may on occasion emit a `GtkTreeSelection`::changed signal
when nothing has happened (mostly as a result of programmers calling
select_row on an already selected row).

> **Deprecated since 4.10.** Use `Gtk.SelectionModel` instead

```tsx
import { GtkTreeSelection } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkTreeSelection**

## Props

`ref` receives the `Gtk.TreeSelection` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `mode`

`Gtk.SelectionMode` · default `GTK_SELECTION_SINGLE`

Selection mode.
See `gtk_tree_selection_set_mode()` for more information on this property.

## Signals

### `onChanged`

```ts
(self: Gtk.TreeSelection) => void
```

Emitted whenever the selection has (possibly) changed. Please note that
this signal is mostly a hint.  It may only be emitted once when a range
of rows are selected, and it may occasionally be emitted when nothing
has happened.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.TreeSelection` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `countSelectedRows`

```ts
countSelectedRows(): number
```

Returns the number of rows that have been selected in `tree`.

**Returns** The number of rows selected.

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `getMode`

```ts
getMode(): Gtk.SelectionMode
```

Gets the selection mode for `selection`. See
`gtk_tree_selection_set_mode()`.

**Returns** the current selection mode

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `getSelected`

```ts
getSelected(): [boolean, Gtk.TreeModel, Gtk.TreeIter]
```

Sets `iter` to the currently selected node if `selection` is set to
`GTK_SELECTION_SINGLE` or `GTK_SELECTION_BROWSE`.  `iter` may be NULL if you
just want to test if `selection` has any selected nodes.  `model` is filled
with the current model as a convenience.  This function will not work if you
use `selection` is `GTK_SELECTION_MULTIPLE`.

**Returns** Tuple of:

- `result`: TRUE, if there is a selected node.
- `model`: A pointer to set to the `GtkTreeModel`
- `iter`: The `GtkTreeIter`

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `getSelectedRows`

```ts
getSelectedRows(): [Gtk.TreePath[], Gtk.TreeModel]
```

Creates a list of path of all selected rows. Additionally, if you are
planning on modifying the model after calling this function, you may
want to convert the returned list into a list of `GtkTreeRowReference`s.
To do this, you can use `gtk_tree_row_reference_new()`.

To free the return value, use:

```c
g_list_free_full (list, (GDestroyNotify) gtk_tree_path_free);
```

**Returns** Tuple of:

- `result`: A `GList` containing a `GtkTreePath` for each selected row.
- `model`: A pointer to set to the `GtkTreeModel`

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `getTreeView`

```ts
getTreeView(): Gtk.TreeView
```

Returns the tree view associated with `selection`.

**Returns** A `GtkTreeView`

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `iterIsSelected`

```ts
iterIsSelected(iter: Gtk.TreeIter): boolean
```

Returns `true` if the row at `iter` is currently selected.

**Parameters**

- `iter`: A valid `GtkTreeIter`

**Returns** `true`, if `iter` is selected

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `pathIsSelected`

```ts
pathIsSelected(path: Gtk.TreePath): boolean
```

Returns `true` if the row pointed to by `path` is currently selected.  If `path`
does not point to a valid location, `false` is returned

**Parameters**

- `path`: A `GtkTreePath` to check selection on.

**Returns** `true` if `path` is selected.

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `selectAll`

```ts
selectAll(): void
```

Selects all the nodes. `selection` must be set to `GTK_SELECTION_MULTIPLE`
mode.

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `selectedForeach`

```ts
selectedForeach(func: Gtk.TreeSelectionForeachFunc): void
```

Calls a function for each selected node. Note that you cannot modify
the tree or selection from within this function. As a result,
`gtk_tree_selection_get_selected_rows()` might be more useful.

**Parameters**

- `func`: The function to call for each selected node.

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `selectIter`

```ts
selectIter(iter: Gtk.TreeIter): void
```

Selects the specified iterator.

**Parameters**

- `iter`: The `GtkTreeIter` to be selected.

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `selectPath`

```ts
selectPath(path: Gtk.TreePath): void
```

Select the row at `path`.

**Parameters**

- `path`: The `GtkTreePath` to be selected.

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `selectRange`

```ts
selectRange(startPath: Gtk.TreePath, endPath: Gtk.TreePath): void
```

Selects a range of nodes, determined by `start_path` and `end_path` inclusive.
`selection` must be set to `GTK_SELECTION_MULTIPLE` mode.

**Parameters**

- `startPath`: The initial node of the range.
- `endPath`: The final node of the range.

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `setMode`

```ts
setMode(type: Gtk.SelectionMode): void
```

Sets the selection mode of the `selection`.  If the previous type was
`GTK_SELECTION_MULTIPLE`, then the anchor is kept selected, if it was
previously selected.

**Parameters**

- `type`: The selection mode

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `setSelectFunction`

```ts
setSelectFunction(func: Gtk.TreeSelectionFunc | null): void
```

Sets the selection function.

If set, this function is called before any node is selected or unselected,
giving some control over which nodes are selected. The select function
should return `true` if the state of the node may be toggled, and `false`
if the state of the node should be left unchanged.

**Parameters**

- `func`: The selection function. May be `null`

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `unselectAll`

```ts
unselectAll(): void
```

Unselects all the nodes.

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `unselectIter`

```ts
unselectIter(iter: Gtk.TreeIter): void
```

Unselects the specified iterator.

**Parameters**

- `iter`: The `GtkTreeIter` to be unselected.

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `unselectPath`

```ts
unselectPath(path: Gtk.TreePath): void
```

Unselects the row at `path`.

**Parameters**

- `path`: The `GtkTreePath` to be unselected.

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView

### `unselectRange`

```ts
unselectRange(startPath: Gtk.TreePath, endPath: Gtk.TreePath): void
```

Unselects a range of nodes, determined by `start_path` and `end_path`
inclusive.

**Parameters**

- `startPath`: The initial node of the range.
- `endPath`: The initial node of the range.

> **Deprecated since 4.10.** Use GtkListView or GtkColumnView
