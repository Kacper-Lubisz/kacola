---
description: "Sorts Gtk.ColumnView columns."
---

# GtkColumnViewSorter

Sorts `Gtk.ColumnView` columns.

The sorter returned by `Gtk.ColumnView.getSorter()` is
a `GtkColumnViewSorter`.

In column views, sorting can be configured by associating
sorters with columns, and users can invert sort order by clicking
on column headers. The API of `GtkColumnViewSorter` is designed
to allow saving and restoring this configuration.

If you are only interested in the primary sort column (i.e. the
column where a sort indicator is shown in the header), then
you can just look at `Gtk.ColumnViewSorter.primarySortColumn`
and `Gtk.ColumnViewSorter.primarySortOrder`.

If you want to store the full sort configuration, including
secondary sort columns that are used for tie breaking, then
you can use `Gtk.ColumnViewSorter.getNthSortColumn()`.
To get notified about changes, use `Gtk.Sorter.changed`.

To restore a saved sort configuration on a `GtkColumnView`,
use code like:

```
sorter = gtk_column_view_get_sorter (view);
for (i = gtk_column_view_sorter_get_n_sort_columns (sorter) - 1; i >= 0; i--)
  {
    column = gtk_column_view_sorter_get_nth_sort_column (sorter, i, &order);
    gtk_column_view_sort_by_column (view, column, order);
  }
```

_Available since 4.10._

```tsx
import { GtkColumnViewSorter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkSorter](.gtkx/reference/gtk/sorter.md) → **GtkColumnViewSorter**

## Props

`ref` receives the `Gtk.ColumnViewSorter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `primarySortColumn`

`Gtk.ColumnViewColumn` · read-only, observe with `onNotifyPrimarySortColumn`

The primary sort column.

The primary sort column is the one that displays the triangle
in a column view header.

_Available since 4.10._

### `primarySortOrder`

`Gtk.SortType` · default `GTK_SORT_ASCENDING` · read-only, observe with `onNotifyPrimarySortOrder`

The primary sort order.

The primary sort order determines whether the triangle displayed
in the column view header of the primary sort column points upwards
or downwards.

_Available since 4.10._

## Methods

Methods are called on the `Gtk.ColumnViewSorter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getNSortColumns`

```ts
getNSortColumns(): number
```

Returns the number of columns by which the sorter sorts.

If the sorter of the primary sort column does not determine
a total order, then the secondary sorters are consulted to
break the ties.

Use the `Gtk.Sorter.changed` signal to get notified
when the number of sort columns changes.

**Returns** the number of sort columns

_Available since 4.10._

### `getNthSortColumn`

```ts
getNthSortColumn(position: number): [Gtk.ColumnViewColumn | null, Gtk.SortType]
```

Gets the `position`'th sort column and its associated sort order.

Use the `Gtk.Sorter.changed` signal to get notified
when sort columns change.

**Parameters**

- `position`: the position of the sort column to retrieve (0 for the primary sort column)

**Returns** Tuple of:

- `result`: the sort column at the `position`
- `sortOrder`: return location for the sort order

_Available since 4.10._

### `getPrimarySortColumn`

```ts
getPrimarySortColumn(): Gtk.ColumnViewColumn | null
```

Returns the primary sort column.

The primary sort column is the one that displays the triangle
in a column view header.

**Returns** the primary sort column

_Available since 4.10._

### `getPrimarySortOrder`

```ts
getPrimarySortOrder(): Gtk.SortType
```

Returns the primary sort order.

The primary sort order determines whether the triangle displayed
in the column view header of the primary sort column points upwards
or downwards.

If there is no primary sort column, then this function returns
`GTK_SORT_ASCENDING`.

**Returns** the primary sort order

_Available since 4.10._
