---
description: "A list-like data structure that can be used with the Gtk.TreeView."
---

# GtkListStore

A list-like data structure that can be used with the `Gtk.TreeView`.

The `GtkListStore` object is a list model for use with a `GtkTreeView`
widget.  It implements the `GtkTreeModel` interface, and consequentialy,
can use all of the methods available there.  It also implements the
`GtkTreeSortable` interface so it can be sorted by the view.
Finally, it also implements the tree
[drag](iface.TreeDragSource.html) and [drop](iface.TreeDragDest.html)
interfaces.

The `GtkListStore` can accept most `GType`s as a column type, though
it can’t accept all custom types.  Internally, it will keep a copy of
data passed in (such as a string or a boxed pointer).  Columns that
accept `GObject`s are handled a little differently.  The
`GtkListStore` will keep a reference to the object instead of copying the
value.  As a result, if the object is modified, it is up to the
application writer to call `Gtk.TreeModel.rowChanged()` to emit the
`Gtk.TreeModel.row_changed` signal. This most commonly affects lists
with `Gdk.Texture`s stored.

An example for creating a simple list store:

```c
enum {
  COLUMN_STRING,
  COLUMN_INT,
  COLUMN_BOOLEAN,
  N_COLUMNS
};

{
  GtkListStore *list_store;
  GtkTreePath *path;
  GtkTreeIter iter;
  int i;

  list_store = gtk_list_store_new (N_COLUMNS,
                                   G_TYPE_STRING,
                                   G_TYPE_INT,
                                   G_TYPE_BOOLEAN);

  for (i = 0; i < 10; i++)
    {
      char *some_data;

      some_data = get_some_data (i);

      // Add a new row to the model
      gtk_list_store_append (list_store, &iter);
      gtk_list_store_set (list_store, &iter,
                          COLUMN_STRING, some_data,
                          COLUMN_INT, i,
                          COLUMN_BOOLEAN,  FALSE,
                          -1);

      // As the store will keep a copy of the string internally,
      // we free some_data.
      g_free (some_data);
    }

  // Modify a particular row
  path = gtk_tree_path_new_from_string ("4");
  gtk_tree_model_get_iter (GTK_TREE_MODEL (list_store),
                           &iter,
                           path);
  gtk_tree_path_free (path);
  gtk_list_store_set (list_store, &iter,
                      COLUMN_BOOLEAN, TRUE,
                      -1);
}
```

`GtkListStore` is deprecated since GTK 4.10, and should not be used in newly
written code. You should use `Gio.ListStore` instead, and the various
list models provided by GTK.

### Performance Considerations

Internally, the `GtkListStore` was originally implemented with a linked list
with a tail pointer.  As a result, it was fast at data insertion and deletion,
and not fast at random data access.  The `GtkListStore` sets the
`GTK_TREE_MODEL_ITERS_PERSIST` flag, which means that `GtkTreeIter`s can be
cached while the row exists.  Thus, if access to a particular row is needed
often and your code is expected to run on older versions of GTK, it is worth
keeping the iter around.

### Atomic Operations

It is important to note that only the methods
`gtk_list_store_insert_with_values()` and `gtk_list_store_insert_with_valuesv()`
are atomic, in the sense that the row is being appended to the store and the
values filled in in a single operation with regard to `GtkTreeModel` signaling.
In contrast, using e.g. `gtk_list_store_append()` and then `gtk_list_store_set()`
will first create a row, which triggers the `GtkTreeModel::row-inserted` signal
on `GtkListStore`. The row, however, is still empty, and any signal handler
connecting to `GtkTreeModel::row-inserted` on this particular store should be prepared
for the situation that the row might be empty. This is especially important
if you are wrapping the `GtkListStore` inside a `GtkTreeModel`Filter and are
using a `GtkTreeModel`FilterVisibleFunc. Using any of the non-atomic operations
to append rows to the `GtkListStore` will cause the
`GtkTreeModel`FilterVisibleFunc to be visited with an empty row first; the
function must be prepared for that.

### GtkListStore as GtkBuildable

The GtkListStore implementation of the `Gtk.Buildable` interface allows
to specify the model columns with a `<columns>` element that may contain
multiple `<column>` elements, each specifying one model column. The “type”
attribute specifies the data type for the column.

Additionally, it is possible to specify content for the list store
in the UI definition, with the `<data>` element. It can contain multiple
`<row>` elements, each specifying to content for one row of the list model.
Inside a `<row>`, the `<col>` elements specify the content for individual cells.

Note that it is probably more common to define your models in the code,
and one might consider it a layering violation to specify the content of
a list store in a UI definition, data, not presentation, and common wisdom
is to separate the two, as far as possible.

An example of a UI Definition fragment for a list store:

```xml
<object class="GtkListStore">
  <columns>
    <column type="gchararray"/>
    <column type="gchararray"/>
    <column type="gint"/>
  </columns>
  <data>
    <row>
      <col id="0">John</col>
      <col id="1">Doe</col>
      <col id="2">25</col>
    </row>
    <row>
      <col id="0">Johan</col>
      <col id="1">Dahlin</col>
      <col id="2">50</col>
    </row>
  </data>
</object>
```

> **Deprecated since 4.10.** Use `Gio.ListStore` instead

```tsx
import { GtkListStore } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkListStore**

Implements `GtkBuildable`, `GtkTreeDragDest`, `GtkTreeDragSource`, `GtkTreeModel`, `GtkTreeSortable`.

## Props

`ref` receives the `Gtk.ListStore` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onRowChanged`

```ts
(path: Gtk.TreePath, iter: Gtk.TreeIter, self: Gtk.ListStore) => void
```

From `GtkTreeModel`.

This signal is emitted when a row in the model has changed.

**Parameters**

- `path`: a `GtkTreePath` identifying the changed row
- `iter`: a valid `GtkTreeIter` pointing to the changed row
- `self`: The instance the signal was emitted on.

### `onRowDeleted`

```ts
(path: Gtk.TreePath, self: Gtk.ListStore) => void
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
(path: Gtk.TreePath, iter: Gtk.TreeIter, self: Gtk.ListStore) => void
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
(path: Gtk.TreePath, iter: Gtk.TreeIter, self: Gtk.ListStore) => void
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
(path: Gtk.TreePath, iter: Gtk.TreeIter, newOrder: bigint | null, self: Gtk.ListStore) => void
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
(self: Gtk.ListStore) => void
```

From `GtkTreeSortable`.

The ::sort-column-changed signal is emitted when the sort column
or sort order of `sortable` is changed. The signal is emitted before
the contents of `sortable` are resorted.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.ListStore` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(): Gtk.TreeIter
```

Appends a new row to `list_store`.  `iter` will be changed to point to this new
row.  The row will be empty after this function is called.  To fill in
values, you need to call `gtk_list_store_set()` or `gtk_list_store_set_value()`.

**Returns** An unset `GtkTreeIter` to set to the appended row

> **Deprecated since 4.10.** Use list models

### `clear`

```ts
clear(): void
```

Removes all rows from the list store.

> **Deprecated since 4.10.** Use list models

### `insert`

```ts
insert(position: number): Gtk.TreeIter
```

Creates a new row at `position`.  `iter` will be changed to point to this new
row.  If `position` is -1 or is larger than the number of rows on the list,
then the new row will be appended to the list. The row will be empty after
this function is called.  To fill in values, you need to call
`gtk_list_store_set()` or `gtk_list_store_set_value()`.

**Parameters**

- `position`: position to insert the new row, or -1 for last

**Returns** An unset `GtkTreeIter` to set to the new row

> **Deprecated since 4.10.** Use list models

### `insertAfter`

```ts
insertAfter(sibling: Gtk.TreeIter | null): Gtk.TreeIter
```

Inserts a new row after `sibling`. If `sibling` is `null`, then the row will be
prepended to the beginning of the list. `iter` will be changed to point to
this new row. The row will be empty after this function is called. To fill
in values, you need to call `gtk_list_store_set()` or `gtk_list_store_set_value()`.

**Parameters**

- `sibling`: A valid `GtkTreeIter`

**Returns** An unset `GtkTreeIter` to set to the new row

> **Deprecated since 4.10.** Use list models

### `insertBefore`

```ts
insertBefore(sibling: Gtk.TreeIter | null): Gtk.TreeIter
```

Inserts a new row before `sibling`. If `sibling` is `null`, then the row will
be appended to the end of the list. `iter` will be changed to point to this
new row. The row will be empty after this function is called. To fill in
values, you need to call `gtk_list_store_set()` or `gtk_list_store_set_value()`.

**Parameters**

- `sibling`: A valid `GtkTreeIter`

**Returns** An unset `GtkTreeIter` to set to the new row

> **Deprecated since 4.10.** Use list models

### `insertWithValues`

```ts
insertWithValues(position: number, columns: number[], values: GObject.Value[]): Gtk.TreeIter
```

A variant of `gtk_list_store_insert_with_values()` which
takes the columns and values as two arrays, instead of
varargs.

This function is mainly intended for language-bindings.

**Parameters**

- `position`: position to insert the new row, or -1 for last
- `columns`: an array of column numbers
- `values`: an array of GValues

**Returns** An unset `GtkTreeIter` to set to the new row

> **Deprecated since 4.10.** Use list models

### `iterIsValid`

```ts
iterIsValid(iter: Gtk.TreeIter): boolean
```

Checks if the given iter is a valid iter for this `GtkListStore`.

This function is slow. Only use it for debugging and/or testing
purposes.

**Parameters**

- `iter`: the iterator to check

**Returns** `true` if the iter is valid, `false` if the iter is invalid.

> **Deprecated since 4.10.** Use list models

### `moveAfter`

```ts
moveAfter(iter: Gtk.TreeIter, position: Gtk.TreeIter | null): void
```

Moves `iter` in `store` to the position after `position`. Note that this
function only works with unsorted stores. If `position` is `null`, `iter`
will be moved to the start of the list.

**Parameters**

- `iter`: A `GtkTreeIter`
- `position`: A `GtkTreeIter`

> **Deprecated since 4.10.** Use list models

### `moveBefore`

```ts
moveBefore(iter: Gtk.TreeIter, position: Gtk.TreeIter | null): void
```

Moves `iter` in `store` to the position before `position`. Note that this
function only works with unsorted stores. If `position` is `null`, `iter`
will be moved to the end of the list.

**Parameters**

- `iter`: A `GtkTreeIter`
- `position`: A `GtkTreeIter`

> **Deprecated since 4.10.** Use list models

### `prepend`

```ts
prepend(): Gtk.TreeIter
```

Prepends a new row to `list_store`. `iter` will be changed to point to this new
row. The row will be empty after this function is called. To fill in
values, you need to call `gtk_list_store_set()` or `gtk_list_store_set_value()`.

**Returns** An unset `GtkTreeIter` to set to the prepend row

> **Deprecated since 4.10.** Use list models

### `remove`

```ts
remove(iter: Gtk.TreeIter): boolean
```

Removes the given row from the list store.  After being removed,
`iter` is set to be the next valid row, or invalidated if it pointed
to the last row in `list_store`.

**Parameters**

- `iter`: A valid `GtkTreeIter`

**Returns** `true` if `iter` is valid, `false` if not.

> **Deprecated since 4.10.** Use list models

### `reorder`

```ts
reorder(newOrder: number[]): void
```

Reorders `store` to follow the order indicated by `new_order`. Note that
this function only works with unsorted stores.

**Parameters**

- `newOrder`: an array of integers mapping the new position of each child to its old position before the re-ordering, i.e. `new_order``[newpos] = oldpos`. It must have exactly as many items as the list store’s length.

> **Deprecated since 4.10.** Use list models

### `set`

```ts
set(iter: Gtk.TreeIter, columns: number[], values: GObject.Value[]): void
```

A variant of `gtk_list_store_set_valist()` which
takes the columns and values as two arrays, instead of
varargs. This function is mainly intended for
language-bindings and in case the number of columns to
change is not known until run-time.

**Parameters**

- `iter`: A valid `GtkTreeIter` for the row being modified
- `columns`: an array of column numbers
- `values`: an array of GValues

> **Deprecated since 4.10.** Use list models

### `setColumnTypes`

```ts
setColumnTypes(types: (bigint | AnyClass<TypedClass>)[]): void
```

Sets the types of the columns of a list store.

This function is meant primarily for objects that inherit
from `GtkListStore`, and should only be used when constructing
a new instance.

This function cannot be called after a row has been added, or
a method on the `GtkTreeModel` interface is called.

**Parameters**

- `types`: An array length n of `GType`s

> **Deprecated since 4.10.** Use list models

### `setValue`

```ts
setValue(iter: Gtk.TreeIter, column: number, value: GObject.Value): void
```

Sets the data in the cell specified by `iter` and `column`.
The type of `value` must be convertible to the type of the
column.

**Parameters**

- `iter`: A valid `GtkTreeIter` for the row being modified
- `column`: column number to modify
- `value`: new value for the cell

> **Deprecated since 4.10.** Use list models

### `swap`

```ts
swap(a: Gtk.TreeIter, b: Gtk.TreeIter): void
```

Swaps `a` and `b` in `store`. Note that this function only works with
unsorted stores.

**Parameters**

- `a`: A `GtkTreeIter`
- `b`: Another `GtkTreeIter`

> **Deprecated since 4.10.** Use list models
