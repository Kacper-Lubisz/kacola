---
description: "A GtkTreeModel which hides parts of an underlying tree model A GtkTreeModelFilter is a tree model which wraps another tree model, and can do the following things: - Filter specific rows, based on data from a “visible ..."
---

# GtkTreeModelFilter

A `GtkTreeModel` which hides parts of an underlying tree model

A `GtkTreeModelFilter` is a tree model which wraps another tree model,
and can do the following things:

- Filter specific rows, based on data from a “visible column”, a column
  storing booleans indicating whether the row should be filtered or not,
  or based on the return value of a “visible function”, which gets a
  model, iter and user_data and returns a boolean indicating whether the
  row should be filtered or not.

- Modify the “appearance” of the model, using a modify function.
  This is extremely powerful and allows for just changing some
  values and also for creating a completely different model based
  on the given child model.

- Set a different root node, also known as a “virtual root”. You can pass
  in a `GtkTreePath` indicating the root node for the filter at construction
  time.

The basic API is similar to `GtkTreeModelSort`. For an example on its usage,
see the section on `GtkTreeModelSort`.

When using `GtkTreeModelFilter`, it is important to realize that
`GtkTreeModelFilter` maintains an internal cache of all nodes which are
visible in its clients. The cache is likely to be a subtree of the tree
exposed by the child model. `GtkTreeModelFilter` will not cache the entire
child model when unnecessary to not compromise the caching mechanism
that is exposed by the reference counting scheme. If the child model
implements reference counting, unnecessary signals may not be emitted
because of reference counting rule 3, see the `GtkTreeModel`
documentation. (Note that e.g. `GtkTreeStore` does not implement
reference counting and will always emit all signals, even when
the receiving node is not visible).

Because of this, limitations for possible visible functions do apply.
In general, visible functions should only use data or properties from
the node for which the visibility state must be determined, its siblings
or its parents. Usually, having a dependency on the state of any child
node is not possible, unless references are taken on these explicitly.
When no such reference exists, no signals may be received for these child
nodes (see reference counting rule number 3 in the `GtkTreeModel` section).

Determining the visibility state of a given node based on the state
of its child nodes is a frequently occurring use case. Therefore,
`GtkTreeModelFilter` explicitly supports this. For example, when a node
does not have any children, you might not want the node to be visible.
As soon as the first row is added to the node’s child level (or the
last row removed), the node’s visibility should be updated.

This introduces a dependency from the node on its child nodes. In order
to accommodate this, `GtkTreeModelFilter` must make sure the necessary
signals are received from the child model. This is achieved by building,
for all nodes which are exposed as visible nodes to `GtkTreeModelFilter`'s
clients, the child level (if any) and take a reference on the first node
in this level. Furthermore, for every row-inserted, row-changed or
row-deleted signal (also these which were not handled because the node
was not cached), `GtkTreeModelFilter` will check if the visibility state
of any parent node has changed.

Beware, however, that this explicit support is limited to these two
cases. For example, if you want a node to be visible only if two nodes
in a child’s child level (2 levels deeper) are visible, you are on your
own. In this case, either rely on `GtkTreeStore` to emit all signals
because it does not implement reference counting, or for models that
do implement reference counting, obtain references on these child levels
yourself.

> **Deprecated since 4.10.** Use `Gtk.FilterListModel` instead.

```tsx
import { GtkTreeModelFilter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkTreeModelFilter**

Implements `GtkTreeDragSource`, `GtkTreeModel`.

## Props

`ref` receives the `Gtk.TreeModelFilter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `childModel`

`Gtk.TreeModel` · construct-only

The child model of the tree model filter.

### `virtualRoot`

`Gtk.TreePath` · construct-only

The virtual root of the tree model filter.

## Signals

### `onRowChanged`

```ts
(path: Gtk.TreePath, iter: Gtk.TreeIter, self: Gtk.TreeModelFilter) => void
```

From `GtkTreeModel`.

This signal is emitted when a row in the model has changed.

**Parameters**

- `path`: a `GtkTreePath` identifying the changed row
- `iter`: a valid `GtkTreeIter` pointing to the changed row
- `self`: The instance the signal was emitted on.

### `onRowDeleted`

```ts
(path: Gtk.TreePath, self: Gtk.TreeModelFilter) => void
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
(path: Gtk.TreePath, iter: Gtk.TreeIter, self: Gtk.TreeModelFilter) => void
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
(path: Gtk.TreePath, iter: Gtk.TreeIter, self: Gtk.TreeModelFilter) => void
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
(path: Gtk.TreePath, iter: Gtk.TreeIter, newOrder: bigint | null, self: Gtk.TreeModelFilter) => void
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

## Methods

Methods are called on the `Gtk.TreeModelFilter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `clearCache`

```ts
clearCache(): void
```

This function should almost never be called. It clears the `filter`
of any cached iterators that haven’t been reffed with
`gtk_tree_model_ref_node()`. This might be useful if the child model
being filtered is static (and doesn’t change often) and there has been
a lot of unreffed access to nodes. As a side effect of this function,
all unreffed iters will be invalid.

> **Deprecated since 4.10.**

### `convertChildIterToIter`

```ts
convertChildIterToIter(childIter: Gtk.TreeIter): [boolean, Gtk.TreeIter]
```

Sets `filter_iter` to point to the row in `filter` that corresponds to the
row pointed at by `child_iter`.  If `filter_iter` was not set, `false` is
returned.

**Parameters**

- `childIter`: A valid `GtkTreeIter` pointing to a row on the child model.

**Returns** Tuple of:

- `result`: `true`, if `filter_iter` was set, i.e. if `child_iter` is a valid iterator pointing to a visible row in child model.
- `filterIter`: An uninitialized `GtkTreeIter`

> **Deprecated since 4.10.**

### `convertChildPathToPath`

```ts
convertChildPathToPath(childPath: Gtk.TreePath): Gtk.TreePath | null
```

Converts `child_path` to a path relative to `filter`. That is, `child_path`
points to a path in the child model. The rerturned path will point to the
same row in the filtered model. If `child_path` isn’t a valid path on the
child model or points to a row which is not visible in `filter`, then `null`
is returned.

**Parameters**

- `childPath`: A `GtkTreePath` to convert.

**Returns** A newly allocated `GtkTreePath`

> **Deprecated since 4.10.**

### `convertIterToChildIter`

```ts
convertIterToChildIter(filterIter: Gtk.TreeIter): Gtk.TreeIter
```

Sets `child_iter` to point to the row pointed to by `filter_iter`.

**Parameters**

- `filterIter`: A valid `GtkTreeIter` pointing to a row on `filter`.

**Returns** An uninitialized `GtkTreeIter`

> **Deprecated since 4.10.**

### `convertPathToChildPath`

```ts
convertPathToChildPath(filterPath: Gtk.TreePath): Gtk.TreePath | null
```

Converts `filter_path` to a path on the child model of `filter`. That is,
`filter_path` points to a location in `filter`. The returned path will
point to the same location in the model not being filtered. If `filter_path`
does not point to a location in the child model, `null` is returned.

**Parameters**

- `filterPath`: A `GtkTreePath` to convert.

**Returns** A newly allocated `GtkTreePath`

> **Deprecated since 4.10.**

### `getModel`

```ts
getModel(): Gtk.TreeModel
```

Returns a pointer to the child model of `filter`.

**Returns** A pointer to a `GtkTreeModel`

> **Deprecated since 4.10.**

### `refilter`

```ts
refilter(): void
```

Emits ::row_changed for each row in the child model, which causes
the filter to re-evaluate whether a row is visible or not.

> **Deprecated since 4.10.**

### `setModifyFunc`

```ts
setModifyFunc(types: (bigint | AnyClass<TypedClass>)[], func: Gtk.TreeModelFilterModifyFunc): void
```

With the `n_columns` and `types` parameters, you give an array of column
types for this model (which will be exposed to the parent model/view).
The `func`, `data` and `destroy` parameters are for specifying the modify
function. The modify function will get called for each
data access, the goal of the modify function is to return the data which
should be displayed at the location specified using the parameters of the
modify function.

Note that `gtk_tree_model_filter_set_modify_func()`
can only be called once for a given filter model.

**Parameters**

- `types`: The `GType`s of the columns.
- `func`: A `GtkTreeModelFilterModifyFunc`

> **Deprecated since 4.10.**

### `setVisibleColumn`

```ts
setVisibleColumn(column: number): void
```

Sets `column` of the child_model to be the column where `filter` should
look for visibility information. `columns` should be a column of type
`G_TYPE_BOOLEAN`, where `true` means that a row is visible, and `false`
if not.

Note that `gtk_tree_model_filter_set_visible_func()` or
`gtk_tree_model_filter_set_visible_column()` can only be called
once for a given filter model.

**Parameters**

- `column`: A `int` which is the column containing the visible information

> **Deprecated since 4.10.**

### `setVisibleFunc`

```ts
setVisibleFunc(func: Gtk.TreeModelFilterVisibleFunc): void
```

Sets the visible function used when filtering the `filter` to be `func`.
The function should return `true` if the given row should be visible and
`false` otherwise.

If the condition calculated by the function changes over time (e.g.
because it depends on some global parameters), you must call
`gtk_tree_model_filter_refilter()` to keep the visibility information
of the model up-to-date.

Note that `func` is called whenever a row is inserted, when it may still
be empty. The visible function should therefore take special care of empty
rows, like in the example below.

```c
static gboolean
visible_func (GtkTreeModel *model,
              GtkTreeIter  *iter,
              gpointer      data)
{
  // Visible if row is non-empty and first column is “HI”
  char *str;
  gboolean visible = FALSE;

  gtk_tree_model_get (model, iter, 0, &str, -1);
  if (str && strcmp (str, "HI") == 0)
    visible = TRUE;
  g_free (str);

  return visible;
}
```

Note that `gtk_tree_model_filter_set_visible_func()` or
`gtk_tree_model_filter_set_visible_column()` can only be called
once for a given filter model.

**Parameters**

- `func`: A `GtkTreeModelFilterVisibleFunc`, the visible function

> **Deprecated since 4.10.**
