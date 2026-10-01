---
description: "Applies a gives sorter to the levels in a tree."
---

# GtkTreeListRowSorter

Applies a gives sorter to the levels in a tree.

Here is an example for setting up a column view with a tree model and
a `GtkTreeListSorter`:

```c
column_sorter = gtk_column_view_get_sorter (view);
sorter = gtk_tree_list_row_sorter_new (g_object_ref (column_sorter));
sort_model = gtk_sort_list_model_new (tree_model, sorter);
selection = gtk_single_selection_new (sort_model);
gtk_column_view_set_model (view, G_LIST_MODEL (selection));
```

```tsx
import { GtkTreeListRowSorter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkSorter](.gtkx/reference/gtk/sorter.md) → **GtkTreeListRowSorter**

## Props

`ref` receives the `Gtk.TreeListRowSorter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `sorter`

`Gtk.Sorter | ReactElement`

The underlying sorter

## Methods

Methods are called on the `Gtk.TreeListRowSorter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getSorter`

```ts
getSorter(): Gtk.Sorter | null
```

Returns the sorter used by `self`.

**Returns** the sorter used

### `setSorter`

```ts
setSorter(sorter: Gtk.Sorter | null): void
```

Sets the sorter to use for items with the same parent.

This sorter will be passed the `Gtk.TreeListRow.item` of
the tree list rows passed to `self`.

**Parameters**

- `sorter`: The sorter to use
