---
description: "A visible column in a Gtk.TreeView widget The GtkTreeViewColumn object represents a visible column in a GtkTreeView widget."
---

# GtkTreeViewColumn

A visible column in a `Gtk.TreeView` widget

The `GtkTreeViewColumn` object represents a visible column in a `GtkTreeView` widget.
It allows to set properties of the column header, and functions as a holding pen
for the cell renderers which determine how the data in the column is displayed.

Please refer to the [tree widget conceptual overview](section-tree-widget.html)
for an overview of all the objects and data types related to the tree widget and
how they work together, and to the `Gtk.TreeView` documentation for specifics
about the CSS node structure for treeviews and their headers.

> **Deprecated since 4.10.** Use `Gtk.ColumnView` and `Gtk.ColumnViewColumn` instead of `Gtk.TreeView` to show a tabular list

```tsx
import { GtkTreeViewColumn } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → **GtkTreeViewColumn**

Implements `GtkBuildable`, `GtkCellLayout`.

## Props

`ref` receives the `Gtk.TreeViewColumn` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `alignment`

`number` · default `0.000000`

### `cellArea`

`Gtk.CellArea` · construct-only

The `GtkCellArea` used to layout cell renderers for this column.

If no area is specified when creating the tree view column with `gtk_tree_view_column_new_with_area()`
a horizontally oriented `GtkCellAreaBox` will be used.

### `clickable`

`boolean` · default `false`

### `expand`

`boolean` · default `false`

### `fixedWidth`

`number` · default `-1`

### `maxWidth`

`number` · default `-1`

### `minWidth`

`number` · default `-1`

### `reorderable`

`boolean` · default `false`

### `resizable`

`boolean` · default `false`

### `sizing`

`Gtk.TreeViewColumnSizing` · default `GTK_TREE_VIEW_COLUMN_GROW_ONLY`

### `sortColumnId`

`number` · default `-1`

Logical sort column ID this column sorts on when selected for sorting. Setting the sort column ID makes the column header
clickable. Set to -1 to make the column unsortable.

### `sortIndicator`

`boolean` · default `false`

### `sortOrder`

`Gtk.SortType` · default `GTK_SORT_ASCENDING`

### `spacing`

`number` · default `0`

### `title`

`string`

### `visible`

`boolean` · default `true`

### `widget`

`Gtk.Widget | ReactElement`

### `width`

`number` · default `0` · read-only, observe with `onNotifyWidth`

### `xOffset`

`number` · default `0` · read-only, observe with `onNotifyXOffset`

## Signals

### `onClicked`

```ts
(self: Gtk.TreeViewColumn) => void
```

Emitted when the column's header has been clicked.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.TreeViewColumn` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addAttribute`

```ts
addAttribute(cellRenderer: Gtk.CellRenderer, attribute: string, column: number): void
```

Adds an attribute mapping to the list in `tree_column`.

The `column` is the
column of the model to get a value from, and the `attribute` is the
parameter on `cell_renderer` to be set from the value. So for example
if column 2 of the model contains strings, you could have the
“text” attribute of a `GtkCellRendererText` get its values from
column 2.

**Parameters**

- `cellRenderer`: the `GtkCellRenderer` to set attributes on
- `attribute`: An attribute on the renderer
- `column`: The column position on the model to get the attribute from.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `cellGetPosition`

```ts
cellGetPosition(cellRenderer: Gtk.CellRenderer): [boolean, number, number]
```

Obtains the horizontal position and size of a cell in a column.

If the  cell is not found in the column, `start_pos` and `width`
are not changed and `false` is returned.

**Parameters**

- `cellRenderer`: a `GtkCellRenderer`

**Returns** Tuple of:

- `result`: `true` if `cell` belongs to `tree_column`
- `xOffset`: return location for the horizontal position of `cell` within `tree_column`
- `width`: return location for the width of `cell`

> **Deprecated since 4.10.** Use GtkColumnView instead

### `cellGetSize`

```ts
cellGetSize(): [number, number, number, number]
```

Obtains the width and height needed to render the column.  This is used
primarily by the `GtkTreeView`.

**Returns** Tuple of:

- `xOffset`: location to return x offset of a cell relative to `cell_area`
- `yOffset`: location to return y offset of a cell relative to `cell_area`
- `width`: location to return width needed to render a cell
- `height`: location to return height needed to render a cell

> **Deprecated since 4.10.** Use GtkColumnView instead

### `cellIsVisible`

```ts
cellIsVisible(): boolean
```

Returns `true` if any of the cells packed into the `tree_column` are visible.
For this to be meaningful, you must first initialize the cells with
`gtk_tree_view_column_cell_set_cell_data()`

**Returns** `true`, if any of the cells packed into the `tree_column` are currently visible

> **Deprecated since 4.10.** Use GtkColumnView instead

### `cellSetCellData`

```ts
cellSetCellData(treeModel: Gtk.TreeModel, iter: Gtk.TreeIter, isExpander: boolean, isExpanded: boolean): void
```

Sets the cell renderer based on the `tree_model` and `iter`.  That is, for
every attribute mapping in `tree_column`, it will get a value from the set
column on the `iter`, and use that value to set the attribute on the cell
renderer.  This is used primarily by the `GtkTreeView`.

**Parameters**

- `treeModel`: The `GtkTreeModel` to get the cell renderers attributes from.
- `iter`: The `GtkTreeIter` to get the cell renderer’s attributes from.
- `isExpander`: `true`, if the row has children
- `isExpanded`: `true`, if the row has visible children

> **Deprecated since 4.10.** Use GtkColumnView instead

### `clear`

```ts
clear(): void
```

Unsets all the mappings on all renderers on the `tree_column`.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `clearAttributes`

```ts
clearAttributes(cellRenderer: Gtk.CellRenderer): void
```

Clears all existing attributes previously set with
`gtk_tree_view_column_set_attributes()`.

**Parameters**

- `cellRenderer`: a `GtkCellRenderer` to clear the attribute mapping on.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `clicked`

```ts
clicked(): void
```

Emits the “clicked” signal on the column.  This function will only work if
`tree_column` is clickable.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `focusCell`

```ts
focusCell(cell: Gtk.CellRenderer): void
```

Sets the current keyboard focus to be at `cell`, if the column contains
2 or more editable and activatable cells.

**Parameters**

- `cell`: A `GtkCellRenderer`

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getAlignment`

```ts
getAlignment(): number
```

Returns the current x alignment of `tree_column`.  This value can range
between 0.0 and 1.0.

**Returns** The current alignent of `tree_column`.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getButton`

```ts
getButton(): Gtk.Widget
```

Returns the button used in the treeview column header

**Returns** The button for the column header.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getClickable`

```ts
getClickable(): boolean
```

Returns `true` if the user can click on the header for the column.

**Returns** `true` if user can click the column header.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getExpand`

```ts
getExpand(): boolean
```

Returns `true` if the column expands to fill available space.

**Returns** `true` if the column expands to fill available space.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getFixedWidth`

```ts
getFixedWidth(): number
```

Gets the fixed width of the column.  This may not be the actual displayed
width of the column; for that, use `gtk_tree_view_column_get_width()`.

**Returns** The fixed width of the column.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getMaxWidth`

```ts
getMaxWidth(): number
```

Returns the maximum width in pixels of the `tree_column`, or -1 if no maximum
width is set.

**Returns** The maximum width of the `tree_column`.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getMinWidth`

```ts
getMinWidth(): number
```

Returns the minimum width in pixels of the `tree_column`, or -1 if no minimum
width is set.

**Returns** The minimum width of the `tree_column`.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getReorderable`

```ts
getReorderable(): boolean
```

Returns `true` if the `tree_column` can be reordered by the user.

**Returns** `true` if the `tree_column` can be reordered by the user.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getResizable`

```ts
getResizable(): boolean
```

Returns `true` if the `tree_column` can be resized by the end user.

**Returns** `true`, if the `tree_column` can be resized.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getSizing`

```ts
getSizing(): Gtk.TreeViewColumnSizing
```

Returns the current type of `tree_column`.

**Returns** The type of `tree_column`.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getSortColumnId`

```ts
getSortColumnId(): number
```

Gets the logical `sort_column_id` that the model sorts on
when this column is selected for sorting.

See `Gtk.TreeViewColumn.setSortColumnId()`.

**Returns** the current `sort_column_id` for this column, or -1 if
  this column can’t be used for sorting

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getSortIndicator`

```ts
getSortIndicator(): boolean
```

Gets the value set by `gtk_tree_view_column_set_sort_indicator()`.

**Returns** whether the sort indicator arrow is displayed

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getSortOrder`

```ts
getSortOrder(): Gtk.SortType
```

Gets the value set by `gtk_tree_view_column_set_sort_order()`.

**Returns** the sort order the sort indicator is indicating

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getSpacing`

```ts
getSpacing(): number
```

Returns the spacing of `tree_column`.

**Returns** the spacing of `tree_column`.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getTitle`

```ts
getTitle(): string
```

Returns the title of the widget.

**Returns** the title of the column. This string should not be
modified or freed.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getTreeView`

```ts
getTreeView(): Gtk.Widget | null
```

Returns the `GtkTreeView` wherein `tree_column` has been inserted.
If `column` is currently not inserted in any tree view, `null` is
returned.

**Returns** The tree view wherein `column`
  has been inserted

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getVisible`

```ts
getVisible(): boolean
```

Returns `true` if `tree_column` is visible.

**Returns** whether the column is visible or not.  If it is visible, then
the tree will show the column.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getWidget`

```ts
getWidget(): Gtk.Widget | null
```

Returns the `GtkWidget` in the button on the column header.

If a custom widget has not been set then `null` is returned.

**Returns** The `GtkWidget` in the column header

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getWidth`

```ts
getWidth(): number
```

Returns the current size of `tree_column` in pixels.

**Returns** The current width of `tree_column`.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `getXOffset`

```ts
getXOffset(): number
```

Returns the current X offset of `tree_column` in pixels.

**Returns** The current X offset of `tree_column`.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `packEnd`

```ts
packEnd(cell: Gtk.CellRenderer, expand: boolean): void
```

Adds the `cell` to end of the column. If `expand` is `false`, then the `cell`
is allocated no more space than it needs. Any unused space is divided
evenly between cells for which `expand` is `true`.

**Parameters**

- `cell`: The `GtkCellRenderer`
- `expand`: `true` if `cell` is to be given extra space allocated to `tree_column`.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `packStart`

```ts
packStart(cell: Gtk.CellRenderer, expand: boolean): void
```

Packs the `cell` into the beginning of the column. If `expand` is `false`, then
the `cell` is allocated no more space than it needs. Any unused space is divided
evenly between cells for which `expand` is `true`.

**Parameters**

- `cell`: The `GtkCellRenderer`
- `expand`: `true` if `cell` is to be given extra space allocated to `tree_column`.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `queueResize`

```ts
queueResize(): void
```

Flags the column, and the cell renderers added to this column, to have
their sizes renegotiated.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setAlignment`

```ts
setAlignment(xalign: number): void
```

Sets the alignment of the title or custom widget inside the column header.
The alignment determines its location inside the button -- 0.0 for left, 0.5
for center, 1.0 for right.

**Parameters**

- `xalign`: The alignment, which is between [0.0 and 1.0] inclusive.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setCellDataFunc`

```ts
setCellDataFunc(cellRenderer: Gtk.CellRenderer, func: Gtk.TreeCellDataFunc | null): void
```

Sets the `GtkTreeCellDataFunc` to use for the column.

This
function is used instead of the standard attributes mapping for
setting the column value, and should set the value of `tree_column`'s
cell renderer as appropriate.  `func` may be `null` to remove an
older one.

**Parameters**

- `cellRenderer`: A `GtkCellRenderer`
- `func`: The `GtkTreeCellDataFunc` to use.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setClickable`

```ts
setClickable(clickable: boolean): void
```

Sets the header to be active if `clickable` is `true`.  When the header is
active, then it can take keyboard focus, and can be clicked.

**Parameters**

- `clickable`: `true` if the header is active.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setExpand`

```ts
setExpand(expand: boolean): void
```

Sets the column to take available extra space.  This space is shared equally
amongst all columns that have the expand set to `true`.  If no column has this
option set, then the last column gets all extra space.  By default, every
column is created with this `false`.

Along with “fixed-width”, the “expand” property changes when the column is
resized by the user.

**Parameters**

- `expand`: `true` if the column should expand to fill available space.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setFixedWidth`

```ts
setFixedWidth(fixedWidth: number): void
```

If `fixed_width` is not -1, sets the fixed width of `tree_column`; otherwise
unsets it.  The effective value of `fixed_width` is clamped between the
minimum and maximum width of the column; however, the value stored in the
“fixed-width” property is not clamped.  If the column sizing is
`GTK_TREE_VIEW_COLUMN_GROW_ONLY` or `GTK_TREE_VIEW_COLUMN_AUTOSIZE`, setting
a fixed width overrides the automatically calculated width.  Note that
`fixed_width` is only a hint to GTK; the width actually allocated to the
column may be greater or less than requested.

Along with “expand”, the “fixed-width” property changes when the column is
resized by the user.

**Parameters**

- `fixedWidth`: The new fixed width, in pixels, or -1.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setMaxWidth`

```ts
setMaxWidth(maxWidth: number): void
```

Sets the maximum width of the `tree_column`.  If `max_width` is -1, then the
maximum width is unset.  Note, the column can actually be wider than max
width if it’s the last column in a view.  In this case, the column expands to
fill any extra space.

**Parameters**

- `maxWidth`: The maximum width of the column in pixels, or -1.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setMinWidth`

```ts
setMinWidth(minWidth: number): void
```

Sets the minimum width of the `tree_column`.  If `min_width` is -1, then the
minimum width is unset.

**Parameters**

- `minWidth`: The minimum width of the column in pixels, or -1.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setReorderable`

```ts
setReorderable(reorderable: boolean): void
```

If `reorderable` is `true`, then the column can be reordered by the end user
dragging the header.

**Parameters**

- `reorderable`: `true`, if the column can be reordered.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setResizable`

```ts
setResizable(resizable: boolean): void
```

If `resizable` is `true`, then the user can explicitly resize the column by
grabbing the outer edge of the column button.

If resizable is `true` and
sizing mode of the column is `GTK_TREE_VIEW_COLUMN_AUTOSIZE`, then the sizing
mode is changed to `GTK_TREE_VIEW_COLUMN_GROW_ONLY`.

**Parameters**

- `resizable`: `true`, if the column can be resized

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setSizing`

```ts
setSizing(type: Gtk.TreeViewColumnSizing): void
```

Sets the growth behavior of `tree_column` to `type`.

**Parameters**

- `type`: The `GtkTreeViewColumn`Sizing.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setSortColumnId`

```ts
setSortColumnId(sortColumnId: number): void
```

Sets the logical `sort_column_id` that this column sorts on when this column
is selected for sorting.  Doing so makes the column header clickable.

**Parameters**

- `sortColumnId`: The `sort_column_id` of the model to sort on.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setSortIndicator`

```ts
setSortIndicator(setting: boolean): void
```

Call this function with a `setting` of `true` to display an arrow in
the header button indicating the column is sorted. Call
`gtk_tree_view_column_set_sort_order()` to change the direction of
the arrow.

**Parameters**

- `setting`: `true` to display an indicator that the column is sorted

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setSortOrder`

```ts
setSortOrder(order: Gtk.SortType): void
```

Changes the appearance of the sort indicator.

This does not actually sort the model.  Use
`gtk_tree_view_column_set_sort_column_id()` if you want automatic sorting
support.  This function is primarily for custom sorting behavior, and should
be used in conjunction with `gtk_tree_sortable_set_sort_column_id()` to do
that. For custom models, the mechanism will vary.

The sort indicator changes direction to indicate normal sort or reverse sort.
Note that you must have the sort indicator enabled to see anything when
calling this function; see `gtk_tree_view_column_set_sort_indicator()`.

**Parameters**

- `order`: sort order that the sort indicator should indicate

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setSpacing`

```ts
setSpacing(spacing: number): void
```

Sets the spacing field of `tree_column`, which is the number of pixels to
place between cell renderers packed into it.

**Parameters**

- `spacing`: distance between cell renderers in pixels.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title of the `tree_column`.  If a custom widget has been set, then
this value is ignored.

**Parameters**

- `title`: The title of the `tree_column`.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setVisible`

```ts
setVisible(visible: boolean): void
```

Sets the visibility of `tree_column`.

**Parameters**

- `visible`: `true` if the `tree_column` is visible.

> **Deprecated since 4.10.** Use GtkColumnView instead

### `setWidget`

```ts
setWidget(widget: Gtk.Widget | null): void
```

Sets the widget in the header to be `widget`.  If widget is `null`, then the
header button is set with a `GtkLabel` set to the title of `tree_column`.

**Parameters**

- `widget`: A child `GtkWidget`

> **Deprecated since 4.10.** Use GtkColumnView instead
