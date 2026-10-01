---
description: "GtkIconView is a widget which displays data in a grid of icons."
---

# GtkIconView

`GtkIconView` is a widget which displays data in a grid of icons.



`GtkIconView` provides an alternative view on a `GtkTreeModel`.
It displays the model as a grid of icons with labels. Like
`Gtk.TreeView`, it allows to select one or multiple items
(depending on the selection mode, see `Gtk.IconView.setSelectionMode()`).
In addition to selection with the arrow keys, `GtkIconView` supports
rubberband selection, which is controlled by dragging the pointer.

Note that if the tree model is backed by an actual tree store (as
opposed to a flat list where the mapping to icons is obvious),
`GtkIconView` will only display the first level of the tree and
ignore the tree’s branches.

### CSS nodes

```
iconview.view
╰── [rubberband]
```

`GtkIconView` has a single CSS node with name iconview and style class .view.
For rubberband selection, a subnode with name rubberband is used.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

```tsx
import { GtkIconView } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkIconView**

Implements `GtkAccessible`, `GtkBuildable`, `GtkCellLayout`, `GtkConstraintTarget`, `GtkScrollable`.

## Props

`ref` receives the `Gtk.IconView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `activateOnSingleClick`

`boolean` · default `false`

The activate-on-single-click property specifies whether the "item-activated" signal
will be emitted after a single click.

### `cellArea`

`Gtk.CellArea` · construct-only

The `GtkCellArea` used to layout cell renderers for this view.

If no area is specified when creating the icon view with `gtk_icon_view_new_with_area()`
a `GtkCellAreaBox` will be used.

### `columns`

`number` · default `-1`

The columns property contains the number of the columns in which the
items should be displayed. If it is -1, the number of columns will
be chosen automatically to fill the available area.

### `columnSpacing`

`number` · default `6`

The column-spacing property specifies the space which is inserted between
the columns of the icon view.

### `hadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Horizontal `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `hscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when horizontal scrolling should start.

### `itemOrientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_VERTICAL`

The item-orientation property specifies how the cells (i.e. the icon and
the text) of the item are positioned relative to each other.

### `itemPadding`

`number` · default `6`

The item-padding property specifies the padding around each
of the icon view's item.

### `itemWidth`

`number` · default `-1`

The item-width property specifies the width to use for each item.
If it is set to -1, the icon view will automatically determine a
suitable item size.

### `margin`

`number` · default `6`

The margin property specifies the space which is inserted
at the edges of the icon view.

### `markupColumn`

`number` · default `-1`

The ::markup-column property contains the number of the model column
containing markup information to be displayed. The markup column must be
of type `G_TYPE_STRING`. If this property and the :text-column property
are both set to column numbers, it overrides the text column.
If both are set to -1, no texts are displayed.

### `model`

`Gtk.TreeModel | ReactElement`

The model of the icon view.

### `pixbufColumn`

`number` · default `-1`

The ::pixbuf-column property contains the number of the model column
containing the pixbufs which are displayed. The pixbuf column must be
of type `GDK_TYPE_PIXBUF`. Setting this property to -1 turns off the
display of pixbufs.

### `reorderable`

`boolean` · default `false`

The reorderable property specifies if the items can be reordered
by DND.

### `rowSpacing`

`number` · default `6`

The row-spacing property specifies the space which is inserted between
the rows of the icon view.

### `selectionMode`

`Gtk.SelectionMode` · default `GTK_SELECTION_SINGLE`

The ::selection-mode property specifies the selection mode of
icon view. If the mode is `GTK_SELECTION_MULTIPLE`, rubberband selection
is enabled, for the other modes, only keyboard selection is possible.

### `spacing`

`number` · default `0`

The spacing property specifies the space which is inserted between
the cells (i.e. the icon and the text) of an item.

### `textColumn`

`number` · default `-1`

The ::text-column property contains the number of the model column
containing the texts which are displayed. The text column must be
of type `G_TYPE_STRING`. If this property and the :markup-column
property are both set to -1, no texts are displayed.

### `tooltipColumn`

`number` · default `-1`

The column of the icon view model which is being used for displaying
tooltips on it's rows.

### `vadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Vertical `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `vscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when vertical scrolling should start.

## Signals

### `onActivateCursorItem`

```ts
(self: Gtk.IconView) => boolean | undefined
```

A [keybinding signal]`Gtk.SignalAction`
which gets emitted when the user activates the currently
focused item.

Applications should not connect to it, but may emit it with
`g_signal_emit_by_name()` if they need to control activation
programmatically.

The default bindings for this signal are Space, Return and Enter.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** whether the item was activated

### `onItemActivated`

```ts
(path: Gtk.TreePath, self: Gtk.IconView) => void
```

The ::item-activated signal is emitted when the method
`gtk_icon_view_item_activated()` is called, when the user double
clicks an item with the "activate-on-single-click" property set
to `false`, or when the user single clicks an item when the
"activate-on-single-click" property set to `true`. It is also
emitted when a non-editable item is selected and one of the keys:
Space, Return or Enter is pressed.

**Parameters**

- `path`: the `GtkTreePath` for the activated item
- `self`: The instance the signal was emitted on.

### `onMoveCursor`

```ts
(step: Gtk.MovementStep, count: number, extend: boolean, modify: boolean, self: Gtk.IconView) => boolean | undefined
```

The ::move-cursor signal is a
[keybinding signal]`Gtk.SignalAction`
which gets emitted when the user initiates a cursor movement.

Applications should not connect to it, but may emit it with
`g_signal_emit_by_name()` if they need to control the cursor
programmatically.

The default bindings for this signal include
- Arrow keys which move by individual steps
- Home/End keys which move to the first/last item
- PageUp/PageDown which move by "pages"
All of these will extend the selection when combined with
the Shift modifier.

**Parameters**

- `step`: the granularity of the move, as a `GtkMovementStep`
- `count`: the number of `step` units to move
- `extend`: whether to extend the selection
- `modify`: whether to modify the selection
- `self`: The instance the signal was emitted on.

**Returns** whether the cursor was moved

### `onSelectAll`

```ts
(self: Gtk.IconView) => void
```

A [keybinding signal]`Gtk.SignalAction`
which gets emitted when the user selects all items.

Applications should not connect to it, but may emit it with
`g_signal_emit_by_name()` if they need to control selection
programmatically.

The default binding for this signal is Ctrl-a.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onSelectCursorItem`

```ts
(self: Gtk.IconView) => void
```

A [keybinding signal]`Gtk.SignalAction`
which gets emitted when the user selects the item that is currently
focused.

Applications should not connect to it, but may emit it with
`g_signal_emit_by_name()` if they need to control selection
programmatically.

There is no default binding for this signal.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onSelectionChanged`

```ts
(self: Gtk.IconView) => void
```

The ::selection-changed signal is emitted when the selection
(i.e. the set of selected items) changes.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onToggleCursorItem`

```ts
(self: Gtk.IconView) => void
```

A [keybinding signal]`Gtk.SignalAction`
which gets emitted when the user toggles whether the currently
focused item is selected or not. The exact effect of this
depend on the selection mode.

Applications should not connect to it, but may emit it with
`g_signal_emit_by_name()` if they need to control selection
programmatically.

There is no default binding for this signal is Ctrl-Space.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onUnselectAll`

```ts
(self: Gtk.IconView) => void
```

A [keybinding signal]`Gtk.SignalAction`
which gets emitted when the user unselects all items.

Applications should not connect to it, but may emit it with
`g_signal_emit_by_name()` if they need to control selection
programmatically.

The default binding for this signal is Ctrl-Shift-a.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.IconView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `createDragIcon`

```ts
createDragIcon(path: Gtk.TreePath): Gdk.Paintable | null
```

Creates a `GdkPaintable` representation of the item at `path`.
This image is used for a drag icon.

**Parameters**

- `path`: a `GtkTreePath` in `icon_view`

**Returns** a newly-allocated `GdkPaintable` of the drag icon.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `enableModelDragDest`

```ts
enableModelDragDest(formats: Gdk.ContentFormats, actions: Gdk.DragAction): void
```

Turns `icon_view` into a drop destination for automatic DND. Calling this
method sets `GtkIconView`:reorderable to `false`.

**Parameters**

- `formats`: the formats that the drag will support
- `actions`: the bitmask of possible actions for a drag to this widget

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `enableModelDragSource`

```ts
enableModelDragSource(startButtonMask: Gdk.ModifierType, formats: Gdk.ContentFormats, actions: Gdk.DragAction): void
```

Turns `icon_view` into a drag source for automatic DND. Calling this
method sets `GtkIconView`:reorderable to `false`.

**Parameters**

- `startButtonMask`: Mask of allowed buttons to start drag
- `formats`: the formats that the drag will support
- `actions`: the bitmask of possible actions for a drag from this widget

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getActivateOnSingleClick`

```ts
getActivateOnSingleClick(): boolean
```

Gets the setting set by `gtk_icon_view_set_activate_on_single_click()`.

**Returns** `true` if item-activated will be emitted on a single click

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getCellRect`

```ts
getCellRect(path: Gtk.TreePath, cell: Gtk.CellRenderer | null): [boolean, Gdk.Rectangle]
```

Fills the bounding rectangle in widget coordinates for the cell specified by
`path` and `cell`. If `cell` is `null` the main cell area is used.

This function is only valid if `icon_view` is realized.

**Parameters**

- `path`: a `GtkTreePath`
- `cell`: a `GtkCellRenderer`

**Returns** Tuple of:

- `result`: `false` if there is no such item, `true` otherwise
- `rect`: rectangle to fill with cell rect

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getColumns`

```ts
getColumns(): number
```

Returns the value of the ::columns property.

**Returns** the number of columns, or -1

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getColumnSpacing`

```ts
getColumnSpacing(): number
```

Returns the value of the ::column-spacing property.

**Returns** the space between columns

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getDestItemAtPos`

```ts
getDestItemAtPos(dragX: number, dragY: number): [boolean, Gtk.TreePath, Gtk.IconViewDropPosition]
```

Determines the destination item for a given position.

**Parameters**

- `dragX`: the position to determine the destination item for
- `dragY`: the position to determine the destination item for

**Returns** Tuple of:

- `result`: whether there is an item at the given position.
- `path`: Return location for the path of the item
- `pos`: Return location for the drop position

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getDragDestItem`

```ts
getDragDestItem(): [Gtk.TreePath | null, Gtk.IconViewDropPosition]
```

Gets information about the item that is highlighted for feedback.

**Returns** Tuple of:

- `path`: Return location for the path of the highlighted item
- `pos`: Return location for the drop position

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getItemAtPos`

```ts
getItemAtPos(x: number, y: number): [boolean, Gtk.TreePath, Gtk.CellRenderer]
```

Gets the path and cell for the icon at the given position.

**Parameters**

- `x`: The x position to be identified
- `y`: The y position to be identified

**Returns** Tuple of:

- `result`: `true` if an item exists at the specified position
- `path`: Return location for the path
- `cell`: Return location for the renderer responsible for the cell at (`x`, `y`)

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getItemColumn`

```ts
getItemColumn(path: Gtk.TreePath): number
```

Gets the column in which the item `path` is currently
displayed. Column numbers start at 0.

**Parameters**

- `path`: the `GtkTreePath` of the item

**Returns** The column in which the item is displayed

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getItemOrientation`

```ts
getItemOrientation(): Gtk.Orientation
```

Returns the value of the ::item-orientation property which determines
whether the labels are drawn beside the icons instead of below.

**Returns** the relative position of texts and icons

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getItemPadding`

```ts
getItemPadding(): number
```

Returns the value of the ::item-padding property.

**Returns** the padding around items

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getItemRow`

```ts
getItemRow(path: Gtk.TreePath): number
```

Gets the row in which the item `path` is currently
displayed. Row numbers start at 0.

**Parameters**

- `path`: the `GtkTreePath` of the item

**Returns** The row in which the item is displayed

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getItemWidth`

```ts
getItemWidth(): number
```

Returns the value of the ::item-width property.

**Returns** the width of a single item, or -1

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getMargin`

```ts
getMargin(): number
```

Returns the value of the ::margin property.

**Returns** the space at the borders

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getMarkupColumn`

```ts
getMarkupColumn(): number
```

Returns the column with markup text for `icon_view`.

**Returns** the markup column, or -1 if it’s unset.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getModel`

```ts
getModel(): Gtk.TreeModel | null
```

Returns the model the `GtkIconView` is based on.  Returns `null` if the
model is unset.

**Returns** The currently used `GtkTreeModel`

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getPathAtPos`

```ts
getPathAtPos(x: number, y: number): Gtk.TreePath | null
```

Gets the path for the icon at the given position.

**Parameters**

- `x`: The x position to be identified
- `y`: The y position to be identified

**Returns** The `GtkTreePath` corresponding
to the icon or `null` if no icon exists at that position.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getPixbufColumn`

```ts
getPixbufColumn(): number
```

Returns the column with pixbufs for `icon_view`.

**Returns** the pixbuf column, or -1 if it’s unset.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getReorderable`

```ts
getReorderable(): boolean
```

Retrieves whether the user can reorder the list via drag-and-drop.
See `gtk_icon_view_set_reorderable()`.

**Returns** `true` if the list can be reordered.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getRowSpacing`

```ts
getRowSpacing(): number
```

Returns the value of the ::row-spacing property.

**Returns** the space between rows

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getSelectedItems`

```ts
getSelectedItems(): Gtk.TreePath[]
```

Creates a list of paths of all selected items. Additionally, if you are
planning on modifying the model after calling this function, you may
want to convert the returned list into a list of `GtkTreeRowReferences`.
To do this, you can use `gtk_tree_row_reference_new()`.

To free the return value, use `g_list_free_full`:

```c
GtkWidget *icon_view = gtk_icon_view_new ();
// Use icon_view

GList *list = gtk_icon_view_get_selected_items (GTK_ICON_VIEW (icon_view));

// use list

g_list_free_full (list, (GDestroyNotify) gtk_tree_path_free);
```

**Returns** A `GList` containing a `GtkTreePath` for each selected row.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getSelectionMode`

```ts
getSelectionMode(): Gtk.SelectionMode
```

Gets the selection mode of the `icon_view`.

**Returns** the current selection mode

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getSpacing`

```ts
getSpacing(): number
```

Returns the value of the ::spacing property.

**Returns** the space between cells

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getTextColumn`

```ts
getTextColumn(): number
```

Returns the column with text for `icon_view`.

**Returns** the text column, or -1 if it’s unset.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getTooltipColumn`

```ts
getTooltipColumn(): number
```

Returns the column of `icon_view`’s model which is being used for
displaying tooltips on `icon_view`’s rows.

**Returns** the index of the tooltip column that is currently being
used, or -1 if this is disabled.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getTooltipContext`

```ts
getTooltipContext(x: number, y: number, keyboardTip: boolean): [boolean, Gtk.TreeModel, Gtk.TreePath, Gtk.TreeIter]
```

This function is supposed to be used in a `GtkWidget::query-tooltip`
signal handler for `GtkIconView`. The `x`, `y` and `keyboard_tip` values
which are received in the signal handler, should be passed to this
function without modification.

The return value indicates whether there is an icon view item at the given
coordinates (`true`) or not (`false`) for mouse tooltips. For keyboard
tooltips the item returned will be the cursor item. When `true`, then any of
`model`, `path` and `iter` which have been provided will be set to point to
that row and the corresponding model.

**Parameters**

- `x`: the x coordinate (relative to widget coordinates)
- `y`: the y coordinate (relative to widget coordinates)
- `keyboardTip`: whether this is a keyboard tooltip or not

**Returns** Tuple of:

- `result`: whether or not the given tooltip context points to an item
- `model`: a pointer to receive a `GtkTreeModel`
- `path`: a pointer to receive a `GtkTreePath`
- `iter`: a pointer to receive a `GtkTreeIter`

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `getVisibleRange`

```ts
getVisibleRange(): [boolean, Gtk.TreePath, Gtk.TreePath]
```

Sets `start_path` and `end_path` to be the first and last visible path.
Note that there may be invisible paths in between.

Both paths should be freed with `gtk_tree_path_free()` after use.

**Returns** Tuple of:

- `result`: `true`, if valid paths were placed in `start_path` and `end_path`
- `startPath`: Return location for start of region
- `endPath`: Return location for end of region

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `iconViewGetCursor`

```ts
iconViewGetCursor(): [boolean, Gtk.TreePath, Gtk.CellRenderer]
```

Fills in `path` and `cell` with the current cursor path and cell.
If the cursor isn’t currently set, then *`path` will be `null`.
If no cell currently has focus, then *`cell` will be `null`.

The returned `GtkTreePath` must be freed with `gtk_tree_path_free()`.

**Returns** Tuple of:

- `result`: `true` if the cursor is set.
- `path`: Return location for the current cursor path
- `cell`: Return location the current focus cell

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `iconViewSetCursor`

```ts
iconViewSetCursor(path: Gtk.TreePath, cell: Gtk.CellRenderer | null, startEditing: boolean): void
```

Sets the current keyboard focus to be at `path`, and selects it.  This is
useful when you want to focus the user’s attention on a particular item.
If `cell` is not `null`, then focus is given to the cell specified by
it. Additionally, if `start_editing` is `true`, then editing should be
started in the specified cell.

This function is often followed by `gtk_widget_grab_focus
(icon_view)` in order to give keyboard focus to the widget.
Please note that editing can only happen when the widget is realized.

**Parameters**

- `path`: A `GtkTreePath`
- `cell`: One of the cell renderers of `icon_view`
- `startEditing`: `true` if the specified cell should start being edited.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `itemActivated`

```ts
itemActivated(path: Gtk.TreePath): void
```

Activates the item determined by `path`.

**Parameters**

- `path`: The `GtkTreePath` to be activated

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `pathIsSelected`

```ts
pathIsSelected(path: Gtk.TreePath): boolean
```

Returns `true` if the icon pointed to by `path` is currently
selected. If `path` does not point to a valid location, `false` is returned.

**Parameters**

- `path`: A `GtkTreePath` to check selection on.

**Returns** `true` if `path` is selected.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `scrollToPath`

```ts
scrollToPath(path: Gtk.TreePath, useAlign: boolean, rowAlign: number, colAlign: number): void
```

Moves the alignments of `icon_view` to the position specified by `path`.
`row_align` determines where the row is placed, and `col_align` determines
where `column` is placed.  Both are expected to be between 0.0 and 1.0.
0.0 means left/top alignment, 1.0 means right/bottom alignment, 0.5 means
center.

If `use_align` is `false`, then the alignment arguments are ignored, and the
tree does the minimum amount of work to scroll the item onto the screen.
This means that the item will be scrolled to the edge closest to its current
position.  If the item is currently visible on the screen, nothing is done.

This function only works if the model is set, and `path` is a valid row on
the model. If the model changes before the `icon_view` is realized, the
centered path will be modified to reflect this change.

**Parameters**

- `path`: The path of the item to move to.
- `useAlign`: whether to use alignment arguments, or `false`.
- `rowAlign`: The vertical alignment of the item specified by `path`.
- `colAlign`: The horizontal alignment of the item specified by `path`.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `selectAll`

```ts
selectAll(): void
```

Selects all the icons. `icon_view` must has its selection mode set
to `GTK_SELECTION_MULTIPLE`.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `selectedForeach`

```ts
selectedForeach(func: Gtk.IconViewForeachFunc): void
```

Calls a function for each selected icon. Note that the model or
selection cannot be modified from within this function.

**Parameters**

- `func`: The function to call for each selected icon.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `selectPath`

```ts
selectPath(path: Gtk.TreePath): void
```

Selects the row at `path`.

**Parameters**

- `path`: The `GtkTreePath` to be selected.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setActivateOnSingleClick`

```ts
setActivateOnSingleClick(single: boolean): void
```

Causes the `GtkIconView`::item-activated signal to be emitted on
a single click instead of a double click.

**Parameters**

- `single`: `true` to emit item-activated on a single click

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setColumns`

```ts
setColumns(columns: number): void
```

Sets the ::columns property which determines in how
many columns the icons are arranged. If `columns` is
-1, the number of columns will be chosen automatically
to fill the available area.

**Parameters**

- `columns`: the number of columns

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setColumnSpacing`

```ts
setColumnSpacing(columnSpacing: number): void
```

Sets the ::column-spacing property which specifies the space
which is inserted between the columns of the icon view.

**Parameters**

- `columnSpacing`: the column spacing

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setDragDestItem`

```ts
setDragDestItem(path: Gtk.TreePath | null, pos: Gtk.IconViewDropPosition): void
```

Sets the item that is highlighted for feedback.

**Parameters**

- `path`: The path of the item to highlight
- `pos`: Specifies where to drop, relative to the item

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setItemOrientation`

```ts
setItemOrientation(orientation: Gtk.Orientation): void
```

Sets the ::item-orientation property which determines whether the labels
are drawn beside the icons instead of below.

**Parameters**

- `orientation`: the relative position of texts and icons

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setItemPadding`

```ts
setItemPadding(itemPadding: number): void
```

Sets the `GtkIconView`:item-padding property which specifies the padding
around each of the icon view’s items.

**Parameters**

- `itemPadding`: the item padding

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setItemWidth`

```ts
setItemWidth(itemWidth: number): void
```

Sets the ::item-width property which specifies the width
to use for each item. If it is set to -1, the icon view will
automatically determine a suitable item size.

**Parameters**

- `itemWidth`: the width for each item

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setMargin`

```ts
setMargin(margin: number): void
```

Sets the ::margin property which specifies the space
which is inserted at the top, bottom, left and right
of the icon view.

**Parameters**

- `margin`: the margin

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setMarkupColumn`

```ts
setMarkupColumn(column: number): void
```

Sets the column with markup information for `icon_view` to be
`column`. The markup column must be of type `G_TYPE_STRING`.
If the markup column is set to something, it overrides
the text column set by `gtk_icon_view_set_text_column()`.

**Parameters**

- `column`: A column in the currently used model, or -1 to display no text

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setModel`

```ts
setModel(model: Gtk.TreeModel | null): void
```

Sets the model for a `GtkIconView`.
If the `icon_view` already has a model set, it will remove
it before setting the new model.  If `model` is `null`, then
it will unset the old model.

**Parameters**

- `model`: The model.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setPixbufColumn`

```ts
setPixbufColumn(column: number): void
```

Sets the column with pixbufs for `icon_view` to be `column`. The pixbuf
column must be of type `GDK_TYPE_PIXBUF`

**Parameters**

- `column`: A column in the currently used model, or -1 to disable

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setReorderable`

```ts
setReorderable(reorderable: boolean): void
```

This function is a convenience function to allow you to reorder models that
support the `GtkTreeDragSourceIface` and the `GtkTreeDragDestIface`. Both
`GtkTreeStore` and `GtkListStore` support these. If `reorderable` is `true`, then
the user can reorder the model by dragging and dropping rows.  The
developer can listen to these changes by connecting to the model's
row_inserted and row_deleted signals. The reordering is implemented by setting up
the icon view as a drag source and destination. Therefore, drag and
drop can not be used in a reorderable view for any other purpose.

This function does not give you any degree of control over the order -- any
reordering is allowed.  If more control is needed, you should probably
handle drag and drop manually.

**Parameters**

- `reorderable`: `true`, if the list of items can be reordered.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setRowSpacing`

```ts
setRowSpacing(rowSpacing: number): void
```

Sets the ::row-spacing property which specifies the space
which is inserted between the rows of the icon view.

**Parameters**

- `rowSpacing`: the row spacing

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setSelectionMode`

```ts
setSelectionMode(mode: Gtk.SelectionMode): void
```

Sets the selection mode of the `icon_view`.

**Parameters**

- `mode`: The selection mode

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setSpacing`

```ts
setSpacing(spacing: number): void
```

Sets the ::spacing property which specifies the space
which is inserted between the cells (i.e. the icon and
the text) of an item.

**Parameters**

- `spacing`: the spacing

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setTextColumn`

```ts
setTextColumn(column: number): void
```

Sets the column with text for `icon_view` to be `column`. The text
column must be of type `G_TYPE_STRING`.

**Parameters**

- `column`: A column in the currently used model, or -1 to display no text

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setTooltipCell`

```ts
setTooltipCell(tooltip: Gtk.Tooltip, path: Gtk.TreePath, cell: Gtk.CellRenderer | null): void
```

Sets the tip area of `tooltip` to the area which `cell` occupies in
the item pointed to by `path`. See also `gtk_tooltip_set_tip_area()`.

See also `gtk_icon_view_set_tooltip_column()` for a simpler alternative.

**Parameters**

- `tooltip`: a `GtkTooltip`
- `path`: a `GtkTreePath`
- `cell`: a `GtkCellRenderer`

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setTooltipColumn`

```ts
setTooltipColumn(column: number): void
```

If you only plan to have simple (text-only) tooltips on full items, you
can use this function to have `GtkIconView` handle these automatically
for you. `column` should be set to the column in `icon_view`’s model
containing the tooltip texts, or -1 to disable this feature.

When enabled, `GtkWidget:has-tooltip` will be set to `true` and
`icon_view` will connect a `GtkWidget::query-tooltip` signal handler.

Note that the signal handler sets the text with `gtk_tooltip_set_markup()`,
so &, <, etc have to be escaped in the text.

**Parameters**

- `column`: an integer, which is a valid column number for `icon_view`’s model

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `setTooltipItem`

```ts
setTooltipItem(tooltip: Gtk.Tooltip, path: Gtk.TreePath): void
```

Sets the tip area of `tooltip` to be the area covered by the item at `path`.
See also `gtk_icon_view_set_tooltip_column()` for a simpler alternative.
See also `gtk_tooltip_set_tip_area()`.

**Parameters**

- `tooltip`: a `GtkTooltip`
- `path`: a `GtkTreePath`

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `unselectAll`

```ts
unselectAll(): void
```

Unselects all the icons.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `unselectPath`

```ts
unselectPath(path: Gtk.TreePath): void
```

Unselects the row at `path`.

**Parameters**

- `path`: The `GtkTreePath` to be unselected.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `unsetModelDragDest`

```ts
unsetModelDragDest(): void
```

Undoes the effect of `gtk_icon_view_enable_model_drag_dest()`. Calling this
method sets `GtkIconView`:reorderable to `false`.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead

### `unsetModelDragSource`

```ts
unsetModelDragSource(): void
```

Undoes the effect of `gtk_icon_view_enable_model_drag_source()`. Calling this
method sets `GtkIconView`:reorderable to `false`.

> **Deprecated since 4.10.** Use `Gtk.GridView` instead
