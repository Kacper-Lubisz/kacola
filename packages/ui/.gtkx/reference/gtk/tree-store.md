---
description: "A tree-like data structure that can be used with the Gtk.TreeView."
---

# GtkTreeStore

A tree-like data structure that can be used with the `Gtk.TreeView`.

The `GtkTreeStore` object is a list model for use with a `GtkTreeView`
widget. It implements the `Gtk.TreeModel` interface, and consequently,
can use all of the methods available there. It also implements the
`Gtk.TreeSortable` interface so it can be sorted by the view.
Finally, it also implements the tree [drag]`Gtk.TreeDragSource`
and [drop]`Gtk.TreeDragDest` interfaces.

`GtkTreeStore` is deprecated since GTK 4.10, and should not be used in newly
written code. You should use `Gtk.TreeListModel` for a tree-like model
object.

### GtkTreeStore as GtkBuildable

The GtkTreeStore implementation of the `GtkBuildable` interface allows
to specify the model columns with a `<columns>` element that may contain
multiple `<column>` elements, each specifying one model column. The “type”
attribute specifies the data type for the column.

An example of a UI Definition fragment for a tree store:

```xml
<object class="GtkTreeStore">
  <columns>
    <column type="gchararray"/>
    <column type="gchararray"/>
    <column type="gint"/>
  </columns>
</object>
```

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

```tsx
import { GtkTreeStore } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkTreeStore**

Implements `GtkBuildable`, `GtkTreeDragDest`, `GtkTreeDragSource`, `GtkTreeModel`, `GtkTreeSortable`.

## Props

`ref` receives the `Gtk.TreeStore` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onRowChanged`

```ts
(path: Gtk.TreePath, iter: Gtk.TreeIter, self: Gtk.TreeStore) => void
```

From `GtkTreeModel`.

This signal is emitted when a row in the model has changed.

**Parameters**

- `path`: a `GtkTreePath` identifying the changed row
- `iter`: a valid `GtkTreeIter` pointing to the changed row
- `self`: The instance the signal was emitted on.

### `onRowDeleted`

```ts
(path: Gtk.TreePath, self: Gtk.TreeStore) => void
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
(path: Gtk.TreePath, iter: Gtk.TreeIter, self: Gtk.TreeStore) => void
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
(path: Gtk.TreePath, iter: Gtk.TreeIter, self: Gtk.TreeStore) => void
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
(path: Gtk.TreePath, iter: Gtk.TreeIter, newOrder: bigint | null, self: Gtk.TreeStore) => void
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
(self: Gtk.TreeStore) => void
```

From `GtkTreeSortable`.

The ::sort-column-changed signal is emitted when the sort column
or sort order of `sortable` is changed. The signal is emitted before
the contents of `sortable` are resorted.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.TreeStore` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(parent: Gtk.TreeIter | null): Gtk.TreeIter
```

Appends a new row to `tree_store`.

If `parent` is non-`null`, then it will append the new row after the last
child of `parent`, otherwise it will append a row to the top level.

The `iter` parameter will be changed to point to this new row. The row will
be empty after this function is called. To fill in values, you need to call
`gtk_tree_store_set()` or `gtk_tree_store_set_value()`.

**Parameters**

- `parent`: A valid `GtkTreeIter`

**Returns** An unset `GtkTreeIter` to set to the appended row

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `clear`

```ts
clear(): void
```

Removes all rows from `tree_store`

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `insert`

```ts
insert(parent: Gtk.TreeIter | null, position: number): Gtk.TreeIter
```

Creates a new row at `position`.

If parent is non-`null`, then the row will be made a child of `parent`.
Otherwise, the row will be created at the toplevel.

If `position` is `-1` or is larger than the number of rows at that level,
then the new row will be inserted to the end of the list.

The `iter` parameter will be changed to point to this new row. The row
will be empty after this function is called. To fill in values, you
need to call `gtk_tree_store_set()` or `gtk_tree_store_set_value()`.

**Parameters**

- `parent`: A valid `GtkTreeIter`
- `position`: position to insert the new row, or -1 for last

**Returns** An unset `GtkTreeIter` to set to the new row

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `insertAfter`

```ts
insertAfter(parent: Gtk.TreeIter | null, sibling: Gtk.TreeIter | null): Gtk.TreeIter
```

Inserts a new row after `sibling`.

If `sibling` is `null`, then the row will be prepended to `parent`’s children.

If `parent` and `sibling` are `null`, then the row will be prepended to the
toplevel.

If both `sibling` and `parent` are set, then `parent` must be the parent
of `sibling`. When `sibling` is set, `parent` is optional.

The `iter` parameter will be changed to point to this new row. The row will
be empty after this function is called. To fill in values, you need to call
`gtk_tree_store_set()` or `gtk_tree_store_set_value()`.

**Parameters**

- `parent`: A valid `GtkTreeIter`
- `sibling`: A valid `GtkTreeIter`

**Returns** An unset `GtkTreeIter` to set to the new row

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `insertBefore`

```ts
insertBefore(parent: Gtk.TreeIter | null, sibling: Gtk.TreeIter | null): Gtk.TreeIter
```

Inserts a new row before `sibling`.

If `sibling` is `null`, then the row will be appended to `parent`’s children.

If `parent` and `sibling` are `null`, then the row will be appended to the
toplevel.

If both `sibling` and `parent` are set, then `parent` must be the parent
of `sibling`. When `sibling` is set, `parent` is optional.

The `iter` parameter will be changed to point to this new row. The row will
be empty after this function is called. To fill in values, you need to call
`gtk_tree_store_set()` or `gtk_tree_store_set_value()`.

**Parameters**

- `parent`: A valid `GtkTreeIter`
- `sibling`: A valid `GtkTreeIter`

**Returns** An unset `GtkTreeIter` to set to the new row

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `insertWithValues`

```ts
insertWithValues(parent: Gtk.TreeIter | null, position: number, columns: number[], values: GObject.Value[]): Gtk.TreeIter
```

A variant of `gtk_tree_store_insert_with_values()` which takes
the columns and values as two arrays, instead of varargs.

This function is mainly intended for language bindings.

**Parameters**

- `parent`: A valid `GtkTreeIter`
- `position`: position to insert the new row, or -1 for last
- `columns`: an array of column numbers
- `values`: an array of GValues

**Returns** An unset `GtkTreeIter` to set the new row

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `isAncestor`

```ts
isAncestor(iter: Gtk.TreeIter, descendant: Gtk.TreeIter): boolean
```

Checks if `iter` is an ancestor of `descendant`.

**Parameters**

- `iter`: A valid `GtkTreeIter`
- `descendant`: A valid `GtkTreeIter`

**Returns** true if `iter` is an ancestor of `descendant`, and false otherwise

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `iterDepth`

```ts
iterDepth(iter: Gtk.TreeIter): number
```

Returns the depth of the position pointed by the iterator

The depth will be 0 for anything on the root level, 1 for anything down
a level, etc.

**Parameters**

- `iter`: A valid `GtkTreeIter`

**Returns** The depth of the position pointed by the iterator

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `iterIsValid`

```ts
iterIsValid(iter: Gtk.TreeIter): boolean
```

Checks if the given iter is a valid iter for this `GtkTreeStore`.

This function is slow. Only use it for debugging and/or testing
purposes.

**Parameters**

- `iter`: the iterator to check

**Returns** true if the iter is valid, and false otherwise

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `moveAfter`

```ts
moveAfter(iter: Gtk.TreeIter, position: Gtk.TreeIter | null): void
```

Moves `iter` in `tree_store` to the position after `position`.

`iter` and `position` should be in the same level.

Note that this function only works with unsorted stores.

If `position` is `null`, `iter` will be moved to the start of the level.

**Parameters**

- `iter`: A `GtkTreeIter`.
- `position`: A `GtkTreeIter`.

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `moveBefore`

```ts
moveBefore(iter: Gtk.TreeIter, position: Gtk.TreeIter | null): void
```

Moves `iter` in `tree_store` to the position before `position`.

`iter` and `position` should be in the same level.

Note that this function only works with unsorted stores.

If `position` is `null`, `iter` will be moved to the end of the level.

**Parameters**

- `iter`: A `GtkTreeIter`
- `position`: A `GtkTreeIter`

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `prepend`

```ts
prepend(parent: Gtk.TreeIter | null): Gtk.TreeIter
```

Prepends a new row to `tree_store`.

If `parent` is non-`null`, then it will prepend the new row before the first
child of `parent`, otherwise it will prepend a row to the top level. The
`iter` parameter will be changed to point to this new row.  The row will
be empty after this function is called. To fill in values, you need to
call `gtk_tree_store_set()` or `gtk_tree_store_set_value()`.

**Parameters**

- `parent`: A valid `GtkTreeIter`

**Returns** An unset `GtkTreeIter` to set to the prepended row

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `remove`

```ts
remove(iter: Gtk.TreeIter): boolean
```

Removes `iter` from `tree_store`.

After being removed, `iter` is set to the next valid row at that level, or
invalidated if it previously pointed to the last one.

**Parameters**

- `iter`: A valid `GtkTreeIter`

**Returns** true if `iter` is still valid, and false otherwise

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `set`

```ts
set(iter: Gtk.TreeIter, columns: number[], values: GObject.Value[]): void
```

A variant of `gtk_tree_store_set_valist()` which takes
the columns and values as two arrays, instead of using variadic
arguments.

This function is mainly intended for language bindings or in case
the number of columns to change is not known until run-time.

**Parameters**

- `iter`: A valid `GtkTreeIter` for the row being modified
- `columns`: an array of column numbers
- `values`: an array of GValues

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `setColumnTypes`

```ts
setColumnTypes(types: (bigint | AnyClass<TypedClass>)[]): void
```

Sets the type of the columns in a tree store.

This function is meant primarily for types that inherit from
`GtkTreeStore`, and should only be used when constructing a new
`GtkTreeStore`.

This functions cannot be called after a row has been added,
or a method on the `GtkTreeModel` interface is called on the
tree store.

**Parameters**

- `types`: An array of `GType` types, one for each column

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

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

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead

### `swap`

```ts
swap(a: Gtk.TreeIter, b: Gtk.TreeIter): void
```

Swaps `a` and `b` in the same level of `tree_store`.

Note that this function only works with unsorted stores.

**Parameters**

- `a`: A `GtkTreeIter`.
- `b`: Another `GtkTreeIter`.

> **Deprecated since 4.10.** Use `Gtk.TreeListModel` instead
