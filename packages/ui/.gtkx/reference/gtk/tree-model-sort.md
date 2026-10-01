---
description: "A GtkTreeModel which makes an underlying tree model sortable The GtkTreeModelSort is a model which implements the GtkTreeSortable interface."
---

# GtkTreeModelSort

A GtkTreeModel which makes an underlying tree model sortable

The `GtkTreeModelSort` is a model which implements the `GtkTreeSortable`
interface.  It does not hold any data itself, but rather is created with
a child model and proxies its data.  It has identical column types to
this child model, and the changes in the child are propagated.  The
primary purpose of this model is to provide a way to sort a different
model without modifying it. Note that the sort function used by
`GtkTreeModelSort` is not guaranteed to be stable.

The use of this is best demonstrated through an example.  In the
following sample code we create two `GtkTreeView` widgets each with a
view of the same data.  As the model is wrapped here by a
`GtkTreeModelSort`, the two `GtkTreeView`s can each sort their
view of the data without affecting the other.  By contrast, if we
simply put the same model in each widget, then sorting the first would
sort the second.

### Using a `GtkTreeModelSort`

```c
{
  GtkTreeView *tree_view1;
  GtkTreeView *tree_view2;
  GtkTreeModel *sort_model1;
  GtkTreeModel *sort_model2;
  GtkTreeModel *child_model;

  // get the child model
  child_model = get_my_model ();

  // Create the first tree
  sort_model1 = gtk_tree_model_sort_new_with_model (child_model);
  tree_view1 = gtk_tree_view_new_with_model (sort_model1);

  // Create the second tree
  sort_model2 = gtk_tree_model_sort_new_with_model (child_model);
  tree_view2 = gtk_tree_view_new_with_model (sort_model2);

  // Now we can sort the two models independently
  gtk_tree_sortable_set_sort_column_id (GTK_TREE_SORTABLE (sort_model1),
                                        COLUMN_1, GTK_SORT_ASCENDING);
  gtk_tree_sortable_set_sort_column_id (GTK_TREE_SORTABLE (sort_model2),
                                        COLUMN_1, GTK_SORT_DESCENDING);
}
```

To demonstrate how to access the underlying child model from the sort
model, the next example will be a callback for the `GtkTreeSelection`
`GtkTreeSelection::changed` signal.  In this callback, we get a string
from COLUMN_1 of the model.  We then modify the string, find the same
selected row on the child model, and change the row there.

### Accessing the child model of in a selection changed callback

```c
void
selection_changed (GtkTreeSelection *selection, gpointer data)
{
  GtkTreeModel *sort_model = NULL;
  GtkTreeModel *child_model;
  GtkTreeIter sort_iter;
  GtkTreeIter child_iter;
  char *some_data = NULL;
  char *modified_data;

  // Get the current selected row and the model.
  if (! gtk_tree_selection_get_selected (selection,
                                         &sort_model,
                                         &sort_iter))
    return;

  // Look up the current value on the selected row and get
  // a new value to change it to.
  gtk_tree_model_get (GTK_TREE_MODEL (sort_model), &sort_iter,
                      COLUMN_1, &some_data,
                      -1);

  modified_data = change_the_data (some_data);
  g_free (some_data);

  // Get an iterator on the child model, instead of the sort model.
  gtk_tree_model_sort_convert_iter_to_child_iter (GTK_TREE_MODEL_SORT (sort_model),
                                                  &child_iter,
                                                  &sort_iter);

  // Get the child model and change the value of the row. In this
  // example, the child model is a GtkListStore. It could be any other
  // type of model, though.
  child_model = gtk_tree_model_sort_get_model (GTK_TREE_MODEL_SORT (sort_model));
  gtk_list_store_set (GTK_LIST_STORE (child_model), &child_iter,
                      COLUMN_1, &modified_data,
                      -1);
  g_free (modified_data);
}
```

> **Deprecated since 4.10.** Use `Gtk.SortListModel` instead

```tsx
import { GtkTreeModelSort } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkTreeModelSort**

Implements `GtkTreeDragSource`, `GtkTreeModel`, `GtkTreeSortable`.

## Props

`ref` receives the `Gtk.TreeModelSort` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `model`

`Gtk.TreeModel` · construct-only

The model of the tree model sort.

## Signals

### `onRowChanged`

```ts
(path: Gtk.TreePath, iter: Gtk.TreeIter, self: Gtk.TreeModelSort) => void
```

From `GtkTreeModel`.

This signal is emitted when a row in the model has changed.

**Parameters**

- `path`: a `GtkTreePath` identifying the changed row
- `iter`: a valid `GtkTreeIter` pointing to the changed row
- `self`: The instance the signal was emitted on.

### `onRowDeleted`

```ts
(path: Gtk.TreePath, self: Gtk.TreeModelSort) => void
```

From `GtkTreeModel`.

This signal is emitted when a row has been deleted.

Note that no iterator is passed to the signal handler,
since the row is already deleted.

This should be called by models after a row has been removed.
The location pointed to by `path` should be the location that
the row previously was at. It may not be a valid location anymore.

**Parameters**

- `path`: a `GtkTreePath` identifying the row
- `self`: The instance the signal was emitted on.

### `onRowHasChildToggled`

```ts
(path: Gtk.TreePath, iter: Gtk.TreeIter, self: Gtk.TreeModelSort) => void
```

From `GtkTreeModel`.

This signal is emitted when a row has gotten the first child
row or lost its last child row.

**Parameters**

- `path`: a `GtkTreePath` identifying the row
- `iter`: a valid `GtkTreeIter` pointing to the row
- `self`: The instance the signal was emitted on.

### `onRowInserted`

```ts
(path: Gtk.TreePath, iter: Gtk.TreeIter, self: Gtk.TreeModelSort) => void
```

From `GtkTreeModel`.

This signal is emitted when a new row has been inserted in
the model.

Note that the row may still be empty at this point, since
it is a common pattern to first insert an empty row, and
then fill it with the desired values.

**Parameters**

- `path`: a `GtkTreePath` identifying the new row
- `iter`: a valid `GtkTreeIter` pointing to the new row
- `self`: The instance the signal was emitted on.

### `onRowsReordered`

```ts
(path: Gtk.TreePath, iter: Gtk.TreeIter, newOrder: bigint | null, self: Gtk.TreeModelSort) => void
```

From `GtkTreeModel`.

This signal is emitted when the children of a node in the
`GtkTreeModel` have been reordered.

Note that this signal is not emitted
when rows are reordered by DND, since this is implemented
by removing and then reinserting the row.

**Parameters**

- `path`: a `GtkTreePath` identifying the tree node whose children have been reordered
- `iter`: a valid `GtkTreeIter` pointing to the node whose children have been reordered, or `null` if the depth of `path` is 0
- `newOrder`: an array of integers mapping the current position of each child to its old position before the re-ordering, i.e. `new_order``[newpos] = oldpos`
- `self`: The instance the signal was emitted on.

### `onSortColumnChanged`

```ts
(self: Gtk.TreeModelSort) => void
```

From `GtkTreeSortable`.

The ::sort-column-changed signal is emitted when the sort column
or sort order of `sortable` is changed. The signal is emitted before
the contents of `sortable` are resorted.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.TreeModelSort` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `clearCache`

```ts
clearCache(): void
```

This function should almost never be called.  It clears the `tree_model_sort`
of any cached iterators that haven’t been reffed with
`gtk_tree_model_ref_node()`.  This might be useful if the child model being
sorted is static (and doesn’t change often) and there has been a lot of
unreffed access to nodes.  As a side effect of this function, all unreffed
iters will be invalid.

> **Deprecated since 4.10.**

### `convertChildIterToIter`

```ts
convertChildIterToIter(childIter: Gtk.TreeIter): [boolean, Gtk.TreeIter]
```

Sets `sort_iter` to point to the row in `tree_model_sort` that corresponds to
the row pointed at by `child_iter`.  If `sort_iter` was not set, `false`
is returned.  Note: a boolean is only returned since 2.14.

**Parameters**

- `childIter`: A valid `GtkTreeIter` pointing to a row on the child model

**Returns** Tuple of:

- `result`: `true`, if `sort_iter` was set, i.e. if `sort_iter` is a valid iterator pointer to a visible row in the child model.
- `sortIter`: An uninitialized `GtkTreeIter`

> **Deprecated since 4.10.**

### `convertChildPathToPath`

```ts
convertChildPathToPath(childPath: Gtk.TreePath): Gtk.TreePath | null
```

Converts `child_path` to a path relative to `tree_model_sort`.  That is,
`child_path` points to a path in the child model.  The returned path will
point to the same row in the sorted model.  If `child_path` isn’t a valid
path on the child model, then `null` is returned.

**Parameters**

- `childPath`: A `GtkTreePath` to convert

**Returns** A newly allocated `GtkTreePath`

> **Deprecated since 4.10.**

### `convertIterToChildIter`

```ts
convertIterToChildIter(sortedIter: Gtk.TreeIter): Gtk.TreeIter
```

Sets `child_iter` to point to the row pointed to by `sorted_iter`.

**Parameters**

- `sortedIter`: A valid `GtkTreeIter` pointing to a row on `tree_model_sort`.

**Returns** An uninitialized `GtkTreeIter`

> **Deprecated since 4.10.**

### `convertPathToChildPath`

```ts
convertPathToChildPath(sortedPath: Gtk.TreePath): Gtk.TreePath | null
```

Converts `sorted_path` to a path on the child model of `tree_model_sort`.
That is, `sorted_path` points to a location in `tree_model_sort`.  The
returned path will point to the same location in the model not being
sorted.  If `sorted_path` does not point to a location in the child model,
`null` is returned.

**Parameters**

- `sortedPath`: A `GtkTreePath` to convert

**Returns** A newly allocated `GtkTreePath`

> **Deprecated since 4.10.**

### `getModel`

```ts
getModel(): Gtk.TreeModel
```

Returns the model the `GtkTreeModelSort` is sorting.

**Returns** the "child model" being sorted

### `iterIsValid`

```ts
iterIsValid(iter: Gtk.TreeIter): boolean
```

> This function is slow. Only use it for debugging and/or testing
> purposes.

Checks if the given iter is a valid iter for this `GtkTreeModelSort`.

**Parameters**

- `iter`: A `GtkTreeIter`

**Returns** `true` if the iter is valid, `false` if the iter is invalid.

> **Deprecated since 4.10.**

### `resetDefaultSortFunc`

```ts
resetDefaultSortFunc(): void
```

This resets the default sort function to be in the “unsorted” state.  That
is, it is in the same order as the child model. It will re-sort the model
to be in the same order as the child model only if the `GtkTreeModelSort`
is in “unsorted” state.

> **Deprecated since 4.10.**
