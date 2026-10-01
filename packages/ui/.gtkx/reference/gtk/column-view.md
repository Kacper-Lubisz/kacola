---
description: "Presents a large dynamic list of items using multiple columns with headers."
---

# GtkColumnView

Presents a large dynamic list of items using multiple columns with headers.

`GtkColumnView` uses the factories of its columns to generate a cell widget for
each column, for each visible item and displays them together as the row for
this item.

The `Gtk.ColumnView.showRowSeparators` and
`Gtk.ColumnView.showColumnSeparators` properties offer a simple way
to display separators between the rows or columns.

`GtkColumnView` allows the user to select items according to the selection
characteristics of the model. For models that allow multiple selected items,
it is possible to turn on *rubberband selection*, using
`Gtk.ColumnView.enableRubberband`.

The column view supports sorting that can be customized by the user by
clicking on column headers. To set this up, the `GtkSorter` returned by
`Gtk.ColumnView.getSorter()` must be attached to a sort model for the
data that the view is showing, and the columns must have sorters attached to
them by calling `Gtk.ColumnViewColumn.setSorter()`. The initial sort
order can be set with `Gtk.ColumnView.sortByColumn()`.

The column view also supports interactive resizing and reordering of
columns, via Drag-and-Drop of the column headers. This can be enabled or
disabled with the `Gtk.ColumnView.reorderable` and
`Gtk.ColumnViewColumn.resizable` properties.

To learn more about the list widget framework, see the
[overview](section-list-widget.html).

## CSS nodes

```
columnview[.column-separators][.rich-list][.navigation-sidebar][.data-table]
├── header
│   ├── <column header>
┊   ┊
│   ╰── <column header>
│
├── listview
│
┊
╰── [rubberband]
```

`GtkColumnView` uses a single CSS node named columnview. It may carry the
.column-separators style class, when `Gtk.ColumnView.showColumnSeparators`
property is set. Header widgets appear below a node with name header.
The rows are contained in a `GtkListView` widget, so there is a listview
node with the same structure as for a standalone `GtkListView` widget.
If `Gtk.ColumnView.showRowSeparators` is set, it will be passed
on to the list view, causing its CSS node to carry the .separators style class.
For rubberband selection, a node with name rubberband is used.

The main columnview node may also carry style classes to select
the style of [list presentation](section-list-widget.html#list-styles):
.rich-list, .navigation-sidebar or .data-table.

## Accessibility

`GtkColumnView` uses the `Gtk.AccessibleRole.tree_grid` role, header title
widgets are using the `Gtk.AccessibleRole.column_header` role. The row widgets
are using the `Gtk.AccessibleRole.row` role, and individual cells are using
the `Gtk.AccessibleRole.grid_cell` role

```tsx
import { GtkColumnView } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkColumnView**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkScrollable`.

## Props

`ref` receives the `Gtk.ColumnView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `columns`

`Gio.ListModel` · read-only, observe with `onNotifyColumns`

The list of columns.

### `enableRubberband`

`boolean` · default `false`

Allow rubberband selection.

### `hadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Horizontal `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `headerFactory`

`Gtk.ListItemFactory | ReactElement`

Factory for creating header widgets.

The factory must be for configuring `Gtk.ListHeader` objects.

_Available since 4.12._

### `hscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when horizontal scrolling should start.

### `model`

`Gtk.SelectionModel | ReactElement`

Model for the items displayed.

### `reorderable`

`boolean` · default `true`

Whether columns are reorderable.

### `rowFactory`

`Gtk.ListItemFactory | ReactElement`

The factory used for configuring rows.

The factory must be for configuring `Gtk.ColumnViewRow` objects.

_Available since 4.12._

### `showColumnSeparators`

`boolean` · default `false`

Show separators between columns.

### `showRowSeparators`

`boolean` · default `false`

Show separators between rows.

### `singleClickActivate`

`boolean` · default `false`

Activate rows on single click and select them on hover.

### `sorter`

`Gtk.Sorter` · read-only, observe with `onNotifySorter`

Sorter with the sorting choices of the user.

### `tabBehavior`

`Gtk.ListTabBehavior` · default `GTK_LIST_TAB_ALL`

Behavior of the <kbd>Tab</kbd> key

_Available since 4.12._

### `vadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Vertical `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `vscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when vertical scrolling should start.

## Signals

### `onActivate`

```ts
(position: number, self: Gtk.ColumnView) => void
```

Emitted when a row has been activated by the user, usually via activating
the GtkListBase|list.activate-item action.

This allows for a convenient way to handle activation in a columnview.
See `Gtk.ListItem.setActivatable()` for details on how to use this
signal.

**Parameters**

- `position`: position of item to activate
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.ColumnView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `appendColumn`

```ts
appendColumn(column: Gtk.ColumnViewColumn): void
```

Appends the `column` to the end of the columns in `self`.

**Parameters**

- `column`: a column that hasn't been added to a `GtkColumnView` yet

### `getColumns`

```ts
getColumns(): Gio.ListModel
```

Gets the list of columns in this column view.

This list is constant over the lifetime of `self` and can be used to
monitor changes to the columns of `self` by connecting to the
`Gio.ListModel.items-changed` signal.

**Returns** The list managing the columns

### `getEnableRubberband`

```ts
getEnableRubberband(): boolean
```

Returns whether rows can be selected by dragging with the mouse.

**Returns** true if rubberband selection is enabled

### `getHeaderFactory`

```ts
getHeaderFactory(): Gtk.ListItemFactory | null
```

Gets the factory that's currently used to populate section headers.

**Returns** The factory in use

_Available since 4.12._

### `getModel`

```ts
getModel(): Gtk.SelectionModel | null
```

Gets the model that's currently used to read the items displayed.

**Returns** The model in use

### `getReorderable`

```ts
getReorderable(): boolean
```

Returns whether columns are reorderable.

**Returns** true if columns are reorderable

### `getRowFactory`

```ts
getRowFactory(): Gtk.ListItemFactory | null
```

Gets the factory set via `Gtk.ColumnView.setRowFactory()`.

**Returns** The factory

_Available since 4.12._

### `getShowColumnSeparators`

```ts
getShowColumnSeparators(): boolean
```

Returns whether the list should show separators between columns.

**Returns** true if the list shows column separators

### `getShowRowSeparators`

```ts
getShowRowSeparators(): boolean
```

Returns whether the list should show separators between rows.

**Returns** true if the list shows separators

### `getSingleClickActivate`

```ts
getSingleClickActivate(): boolean
```

Returns whether rows will be activated on single click and
selected on hover.

**Returns** true if rows are activated on single click

### `getSorter`

```ts
getSorter(): Gtk.Sorter | null
```

Returns a special sorter that reflects the users sorting
choices in the column view.

To allow users to customizable sorting by clicking on column
headers, this sorter needs to be set on the sort model underneath
the model that is displayed by the view.

See `Gtk.ColumnViewColumn.setSorter()` for setting up
per-column sorting.

Here is an example:
```c
gtk_column_view_column_set_sorter (column, sorter);
gtk_column_view_append_column (view, column);
sorter = g_object_ref (gtk_column_view_get_sorter (view)));
model = gtk_sort_list_model_new (store, sorter);
selection = gtk_no_selection_new (model);
gtk_column_view_set_model (view, selection);
```

**Returns** the `GtkSorter` of `self`

### `getTabBehavior`

```ts
getTabBehavior(): Gtk.ListTabBehavior
```

Gets the behavior set for the <kbd>Tab</kbd> key.

**Returns** The behavior of the <kbd>Tab</kbd> key

_Available since 4.12._

### `insertColumn`

```ts
insertColumn(position: number, column: Gtk.ColumnViewColumn): void
```

Inserts a column at the given position in the columns of `self`.

If `column` is already a column of `self`, it will be repositioned.

**Parameters**

- `position`: the position to insert `column` at
- `column`: the column to insert

### `removeColumn`

```ts
removeColumn(column: Gtk.ColumnViewColumn): void
```

Removes the `column` from the list of columns of `self`.

**Parameters**

- `column`: a column that's part of `self`

### `scrollTo`

```ts
scrollTo(pos: number, column: Gtk.ColumnViewColumn | null, flags: Gtk.ListScrollFlags, scroll: Gtk.ScrollInfo | null): void
```

Scroll to the row at the given position - or cell if a column is
given - and performs the actions specified in `flags`.

This function works no matter if the columnview is shown or focused.
If it isn't, then the changes will take effect once that happens.

**Parameters**

- `pos`: position of the item. Must be less than the number of items in the view.
- `column`: The column to scroll to or `NULL` to not scroll columns
- `flags`: actions to perform
- `scroll`: details of how to perform the scroll operation or `null` to scroll into view

_Available since 4.12._

### `setEnableRubberband`

```ts
setEnableRubberband(enableRubberband: boolean): void
```

Sets whether selections can be changed by dragging with the mouse.

**Parameters**

- `enableRubberband`: whether to enable rubberband selection

### `setHeaderFactory`

```ts
setHeaderFactory(factory: Gtk.ListItemFactory | null): void
```

Sets the factory to use for populating the
`Gtk.ListHeader` objects used in section headers.

If this factory is set to `NULL`, the list will not show
section headers.

**Parameters**

- `factory`: the factory to use

_Available since 4.12._

### `setModel`

```ts
setModel(model: Gtk.SelectionModel | null): void
```

Sets the model to use.

This must be a `Gtk.SelectionModel`.

**Parameters**

- `model`: the model to use

### `setReorderable`

```ts
setReorderable(reorderable: boolean): void
```

Sets whether columns should be reorderable by dragging.

**Parameters**

- `reorderable`: whether columns should be reorderable

### `setRowFactory`

```ts
setRowFactory(factory: Gtk.ListItemFactory | null): void
```

Sets the factory used for configuring rows.

The factory must be for configuring `Gtk.ColumnViewRow` objects.

If this factory is not set - which is the default - then the defaults
will be used.

This factory is not used to set the widgets displayed in the individual
cells. For that see `GtkColumnViewColumn.setFactory()` and
`GtkColumnViewCell`.

**Parameters**

- `factory`: The row factory

_Available since 4.12._

### `setShowColumnSeparators`

```ts
setShowColumnSeparators(showColumnSeparators: boolean): void
```

Sets whether the list should show separators between columns.

**Parameters**

- `showColumnSeparators`: whether to show column separators

### `setShowRowSeparators`

```ts
setShowRowSeparators(showRowSeparators: boolean): void
```

Sets whether the list should show separators between rows.

**Parameters**

- `showRowSeparators`: whether to show row separators

### `setSingleClickActivate`

```ts
setSingleClickActivate(singleClickActivate: boolean): void
```

Sets whether rows should be activated on single click and
selected on hover.

**Parameters**

- `singleClickActivate`: whether to activate items on single click

### `setTabBehavior`

```ts
setTabBehavior(tabBehavior: Gtk.ListTabBehavior): void
```

Sets the <kbd>Tab</kbd> key behavior.

This influences how the <kbd>Tab</kbd> and
<kbd>Shift</kbd>+<kbd>Tab</kbd> keys move the
focus in the columnview.

**Parameters**

- `tabBehavior`: The desired tab behavior

_Available since 4.12._

### `sortByColumn`

```ts
sortByColumn(column: Gtk.ColumnViewColumn | null, direction: Gtk.SortType): void
```

Sets the sorting of the view.

This function should be used to set up the initial sorting.
At runtime, users can change the sorting of a column view
by clicking on the list headers.

This call only has an effect if the sorter returned by
`Gtk.ColumnView.getSorter()` is set on a sort model,
and `Gtk.ColumnViewColumn.setSorter()` has been called
on `column` to associate a sorter with the column.

If `column` is unset, the view will be unsorted.

**Parameters**

- `column`: the column to sort by
- `direction`: the direction to sort in
