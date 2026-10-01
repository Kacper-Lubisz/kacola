---
description: "A widget for displaying both trees and lists Widget that displays any object that implements the Gtk.TreeModel interface."
---

# GtkTreeView

A widget for displaying both trees and lists



Widget that displays any object that implements the `Gtk.TreeModel` interface.

Please refer to the [tree widget conceptual overview](section-tree-widget.html)
for an overview of all the objects and data types related to the tree
widget and how they work together.

### Coordinate systems in GtkTreeView API

Several different coordinate systems are exposed in the `GtkTreeView` API.
These are:

![](tree-view-coordinates.png)

- Widget coordinates: Coordinates relative to the widget (usually `widget->window`).

- Bin window coordinates: Coordinates relative to the window that GtkTreeView renders to.

- Tree coordinates: Coordinates relative to the entire scrollable area of GtkTreeView. These
  coordinates start at (0, 0) for row 0 of the tree.

Several functions are available for converting between the different
coordinate systems.  The most common translations are between widget and bin
window coordinates and between bin window and tree coordinates. For the
former you can use `Gtk.TreeView.convertWidgetToBinWindowCoords()`
(and vice versa), for the latter `Gtk.TreeView.convertBinWindowToTreeCoords()`
(and vice versa).

### `GtkTreeView` as `GtkBuildable`

The `GtkTreeView` implementation of the `GtkBuildable` interface accepts
`Gtk.TreeViewColumn` objects as `<child>` elements and exposes the
internal `Gtk.TreeSelection` in UI definitions.

An example of a UI definition fragment with `GtkTreeView`:

```xml
<object class="GtkTreeView" id="treeview">
  <property name="model">liststore1</property>
  <child>
    <object class="GtkTreeViewColumn" id="test-column">
      <property name="title">Test</property>
      <child>
        <object class="GtkCellRendererText" id="test-renderer"/>
        <attributes>
          <attribute name="text">1</attribute>
        </attributes>
      </child>
    </object>
  </child>
  <child internal-child="selection">
    <object class="GtkTreeSelection" id="selection">
      <signal name="changed" handler="on_treeview_selection_changed"/>
    </object>
  </child>
</object>
```

### CSS nodes

```
treeview.view
├── header
│   ├── button
│   │   ╰── [sort-indicator]
┊   ┊
│   ╰── button
│       ╰── [sort-indicator]
│
├── [rubberband]
╰── [dndtarget]
```

`GtkTreeView` has a main CSS node with name `treeview` and style class `.view`.
It has a subnode with name `header`, which is the parent for all the column
header widgets' CSS nodes.

Each column header consists of a `button`, which among other content, has a
child with name `sort-indicator`, which carries the `.ascending` or `.descending`
style classes when the column header should show a sort indicator. The CSS
is expected to provide a suitable image using the `-gtk-icon-source` property.

For rubberband selection, a subnode with name `rubberband` is used.

For the drop target location during DND, a subnode with name `dndtarget` is used.

> **Deprecated since 4.10.** Use `Gtk.ListView` for lists, and `Gtk.ColumnView` for tabular lists

```tsx
import { GtkTreeView } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkTreeView**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkScrollable`.

## Props

`ref` receives the `Gtk.TreeView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `activateOnSingleClick`

`boolean` · default `false`

The activate-on-single-click property specifies whether the "row-activated" signal
will be emitted after a single click.

### `enableGridLines`

`Gtk.TreeViewGridLines` · default `GTK_TREE_VIEW_GRID_LINES_NONE`

### `enableSearch`

`boolean` · default `true`

### `enableTreeLines`

`boolean` · default `false`

### `expanderColumn`

`Gtk.TreeViewColumn | ReactElement`

### `fixedHeightMode`

`boolean` · default `false`

Setting the ::fixed-height-mode property to `true` speeds up
`GtkTreeView` by assuming that all rows have the same height.
Only enable this option if all rows are the same height.
Please see `gtk_tree_view_set_fixed_height_mode()` for more
information on this option.

### `hadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Horizontal `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `headersClickable`

`boolean` · default `true`

### `headersVisible`

`boolean` · default `true`

### `hoverExpand`

`boolean` · default `false`

Enables or disables the hover expansion mode of `tree_view`.
Hover expansion makes rows expand or collapse if the pointer moves
over them.

This mode is primarily intended for treeviews in popups, e.g.
in `GtkComboBox` or `GtkEntryCompletion`.

### `hoverSelection`

`boolean` · default `false`

Enables or disables the hover selection mode of `tree_view`.
Hover selection makes the selected row follow the pointer.
Currently, this works only for the selection modes
`GTK_SELECTION_SINGLE` and `GTK_SELECTION_BROWSE`.

This mode is primarily intended for treeviews in popups, e.g.
in `GtkComboBox` or `GtkEntryCompletion`.

### `hscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when horizontal scrolling should start.

### `levelIndentation`

`number` · default `0`

Extra indentation for each level.

### `model`

`Gtk.TreeModel | ReactElement`

### `reorderable`

`boolean` · default `false`

### `rubberBanding`

`boolean` · default `false`

### `searchColumn`

`number` · default `-1`

### `showExpanders`

`boolean` · default `true`

`true` if the view has expanders.

### `tooltipColumn`

`number` · default `-1`

### `vadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Vertical `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `vscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when vertical scrolling should start.

## Signals

### `onColumnsChanged`

```ts
(self: Gtk.TreeView) => void
```

The number of columns of the treeview has changed.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onCursorChanged`

```ts
(self: Gtk.TreeView) => void
```

The position of the cursor (focused cell) has changed.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onExpandCollapseCursorRow`

```ts
(object: boolean, p0: boolean, p1: boolean, self: Gtk.TreeView) => boolean | undefined
```

**Parameters**

- `self`: The instance the signal was emitted on.

### `onMoveCursor`

```ts
(step: Gtk.MovementStep, direction: number, extend: boolean, modify: boolean, self: Gtk.TreeView) => boolean | undefined
```

The `GtkTreeView`::move-cursor signal is a [keybinding
signal]`Gtk.SignalAction` which gets emitted when the user
presses one of the cursor keys.

Applications should not connect to it, but may emit it with
`g_signal_emit_by_name()` if they need to control the cursor
programmatically. In contrast to `gtk_tree_view_set_cursor()` and
`gtk_tree_view_set_cursor_on_cell()` when moving horizontally
`GtkTreeView`::move-cursor does not reset the current selection.

**Parameters**

- `step`: the granularity of the move, as a `GtkMovementStep`. `GTK_MOVEMENT_LOGICAL_POSITIONS`, `GTK_MOVEMENT_VISUAL_POSITIONS`, `GTK_MOVEMENT_DISPLAY_LINES`, `GTK_MOVEMENT_PAGES` and `GTK_MOVEMENT_BUFFER_ENDS` are supported. `GTK_MOVEMENT_LOGICAL_POSITIONS` and `GTK_MOVEMENT_VISUAL_POSITIONS` are treated identically.
- `direction`: the direction to move: +1 to move forwards; -1 to move backwards. The resulting movement is undefined for all other values.
- `extend`: whether to extend the selection
- `modify`: whether to modify the selection
- `self`: The instance the signal was emitted on.

**Returns** `true` if `step` is supported, `false` otherwise.

### `onRowActivated`

```ts
(path: Gtk.TreePath, column: Gtk.TreeViewColumn | null, self: Gtk.TreeView) => void
```

The "row-activated" signal is emitted when the method
`Gtk.TreeView.rowActivated()` is called.

This signal is emitted when the user double-clicks a treeview row with the
`Gtk.TreeView.activateOnSingleClick` property set to `false`,
or when the user single-clicks a row when that property set to `true`.

This signal is also emitted when a non-editable row is selected and one
of the keys: <kbd>Space</kbd>, <kbd>Shift</kbd>+<kbd>Space</kbd>,
<kbd>Return</kbd> or <kbd>Enter</kbd> is pressed.

For selection handling refer to the
[tree widget conceptual overview](section-tree-widget.html)
as well as `GtkTreeSelection`.

**Parameters**

- `path`: the `GtkTreePath` for the activated row
- `column`: the `GtkTreeViewColumn` in which the activation occurred
- `self`: The instance the signal was emitted on.

### `onRowCollapsed`

```ts
(iter: Gtk.TreeIter, path: Gtk.TreePath, self: Gtk.TreeView) => void
```

The given row has been collapsed (child nodes are hidden).

**Parameters**

- `iter`: the tree iter of the collapsed row
- `path`: a tree path that points to the row
- `self`: The instance the signal was emitted on.

### `onRowExpanded`

```ts
(iter: Gtk.TreeIter, path: Gtk.TreePath, self: Gtk.TreeView) => void
```

The given row has been expanded (child nodes are shown).

**Parameters**

- `iter`: the tree iter of the expanded row
- `path`: a tree path that points to the row
- `self`: The instance the signal was emitted on.

### `onSelectAll`

```ts
(self: Gtk.TreeView) => boolean | undefined
```

**Parameters**

- `self`: The instance the signal was emitted on.

### `onSelectCursorParent`

```ts
(self: Gtk.TreeView) => boolean | undefined
```

**Parameters**

- `self`: The instance the signal was emitted on.

### `onSelectCursorRow`

```ts
(object: boolean, self: Gtk.TreeView) => boolean | undefined
```

**Parameters**

- `self`: The instance the signal was emitted on.

### `onStartInteractiveSearch`

```ts
(self: Gtk.TreeView) => boolean | undefined
```

**Parameters**

- `self`: The instance the signal was emitted on.

### `onTestCollapseRow`

```ts
(iter: Gtk.TreeIter, path: Gtk.TreePath, self: Gtk.TreeView) => boolean | undefined
```

The given row is about to be collapsed (hide its children nodes). Use this
signal if you need to control the collapsibility of individual rows.

**Parameters**

- `iter`: the tree iter of the row to collapse
- `path`: a tree path that points to the row
- `self`: The instance the signal was emitted on.

**Returns** `false` to allow collapsing, `true` to reject

### `onTestExpandRow`

```ts
(iter: Gtk.TreeIter, path: Gtk.TreePath, self: Gtk.TreeView) => boolean | undefined
```

The given row is about to be expanded (show its children nodes). Use this
signal if you need to control the expandability of individual rows.

**Parameters**

- `iter`: the tree iter of the row to expand
- `path`: a tree path that points to the row
- `self`: The instance the signal was emitted on.

**Returns** `false` to allow expansion, `true` to reject

### `onToggleCursorRow`

```ts
(self: Gtk.TreeView) => boolean | undefined
```

**Parameters**

- `self`: The instance the signal was emitted on.

### `onUnselectAll`

```ts
(self: Gtk.TreeView) => boolean | undefined
```

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.TreeView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `appendColumn`

```ts
appendColumn(column: Gtk.TreeViewColumn): number
```

Appends `column` to the list of columns. If `tree_view` has “fixed_height”
mode enabled, then `column` must have its “sizing” property set to be
GTK_TREE_VIEW_COLUMN_FIXED.

**Parameters**

- `column`: The `GtkTreeViewColumn` to add.

**Returns** The number of columns in `tree_view` after appending.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `collapseAll`

```ts
collapseAll(): void
```

Recursively collapses all visible, expanded nodes in `tree_view`.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `collapseRow`

```ts
collapseRow(path: Gtk.TreePath): boolean
```

Collapses a row (hides its child rows, if they exist).

**Parameters**

- `path`: path to a row in the `tree_view`

**Returns** `true` if the row was collapsed.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `columnsAutosize`

```ts
columnsAutosize(): void
```

Resizes all columns to their optimal width. Only works after the
treeview has been realized.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `convertBinWindowToTreeCoords`

```ts
convertBinWindowToTreeCoords(bx: number, by: number): [number, number]
```

Converts bin_window coordinates to coordinates for the
tree (the full scrollable area of the tree).

**Parameters**

- `bx`: X coordinate relative to bin_window
- `by`: Y coordinate relative to bin_window

**Returns** Tuple of:

- `tx`: return location for tree X coordinate
- `ty`: return location for tree Y coordinate

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `convertBinWindowToWidgetCoords`

```ts
convertBinWindowToWidgetCoords(bx: number, by: number): [number, number]
```

Converts bin_window coordinates to widget relative coordinates.

**Parameters**

- `bx`: bin_window X coordinate
- `by`: bin_window Y coordinate

**Returns** Tuple of:

- `wx`: return location for widget X coordinate
- `wy`: return location for widget Y coordinate

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `convertTreeToBinWindowCoords`

```ts
convertTreeToBinWindowCoords(tx: number, ty: number): [number, number]
```

Converts tree coordinates (coordinates in full scrollable area of the tree)
to bin_window coordinates.

**Parameters**

- `tx`: tree X coordinate
- `ty`: tree Y coordinate

**Returns** Tuple of:

- `bx`: return location for X coordinate relative to bin_window
- `by`: return location for Y coordinate relative to bin_window

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `convertTreeToWidgetCoords`

```ts
convertTreeToWidgetCoords(tx: number, ty: number): [number, number]
```

Converts tree coordinates (coordinates in full scrollable area of the tree)
to widget coordinates.

**Parameters**

- `tx`: X coordinate relative to the tree
- `ty`: Y coordinate relative to the tree

**Returns** Tuple of:

- `wx`: return location for widget X coordinate
- `wy`: return location for widget Y coordinate

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `convertWidgetToBinWindowCoords`

```ts
convertWidgetToBinWindowCoords(wx: number, wy: number): [number, number]
```

Converts widget coordinates to coordinates for the bin_window.

**Parameters**

- `wx`: X coordinate relative to the widget
- `wy`: Y coordinate relative to the widget

**Returns** Tuple of:

- `bx`: return location for bin_window X coordinate
- `by`: return location for bin_window Y coordinate

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `convertWidgetToTreeCoords`

```ts
convertWidgetToTreeCoords(wx: number, wy: number): [number, number]
```

Converts widget coordinates to coordinates for the
tree (the full scrollable area of the tree).

**Parameters**

- `wx`: X coordinate relative to the widget
- `wy`: Y coordinate relative to the widget

**Returns** Tuple of:

- `tx`: return location for tree X coordinate
- `ty`: return location for tree Y coordinate

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `createRowDragIcon`

```ts
createRowDragIcon(path: Gtk.TreePath): Gdk.Paintable | null
```

Creates a `cairo_surface_t` representation of the row at `path`.
This image is used for a drag icon.

**Parameters**

- `path`: a `GtkTreePath` in `tree_view`

**Returns** a newly-allocated surface of the drag icon.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `enableModelDragDest`

```ts
enableModelDragDest(formats: Gdk.ContentFormats, actions: Gdk.DragAction): void
```

Turns `tree_view` into a drop destination for automatic DND. Calling
this method sets `GtkTreeView`:reorderable to `false`.

**Parameters**

- `formats`: the target formats that the drag will support
- `actions`: the bitmask of possible actions for a drag from this widget

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `enableModelDragSource`

```ts
enableModelDragSource(startButtonMask: Gdk.ModifierType, formats: Gdk.ContentFormats, actions: Gdk.DragAction): void
```

Turns `tree_view` into a drag source for automatic DND. Calling this
method sets `GtkTreeView`:reorderable to `false`.

**Parameters**

- `startButtonMask`: Mask of allowed buttons to start drag
- `formats`: the target formats that the drag will support
- `actions`: the bitmask of possible actions for a drag from this widget

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `expandAll`

```ts
expandAll(): void
```

Recursively expands all nodes in the `tree_view`.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `expandRow`

```ts
expandRow(path: Gtk.TreePath, openAll: boolean): boolean
```

Opens the row so its children are visible.

**Parameters**

- `path`: path to a row
- `openAll`: whether to recursively expand, or just expand immediate children

**Returns** `true` if the row existed and had children

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `expandToPath`

```ts
expandToPath(path: Gtk.TreePath): void
```

Expands the row at `path`. This will also expand all parent rows of
`path` as necessary.

**Parameters**

- `path`: path to a row.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getActivateOnSingleClick`

```ts
getActivateOnSingleClick(): boolean
```

Gets the setting set by `gtk_tree_view_set_activate_on_single_click()`.

**Returns** `true` if row-activated will be emitted on a single click

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getBackgroundArea`

```ts
getBackgroundArea(path: Gtk.TreePath | null, column: Gtk.TreeViewColumn | null): Gdk.Rectangle
```

Fills the bounding rectangle in bin_window coordinates for the cell at the
row specified by `path` and the column specified by `column`.  If `path` is
`null`, or points to a node not found in the tree, the `y` and `height` fields of
the rectangle will be filled with 0. If `column` is `null`, the `x` and `width`
fields will be filled with 0.  The returned rectangle is equivalent to the
`background_area` passed to `gtk_cell_renderer_render()`.  These background
areas tile to cover the entire bin window.  Contrast with the `cell_area`,
returned by `gtk_tree_view_get_cell_area()`, which returns only the cell
itself, excluding surrounding borders and the tree expander area.

**Parameters**

- `path`: a `GtkTreePath` for the row, or `null` to get only horizontal coordinates
- `column`: a `GtkTreeViewColumn` for the column, or `null` to get only vertical coordinates

**Returns** rectangle to fill with cell background rect

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getCellArea`

```ts
getCellArea(path: Gtk.TreePath | null, column: Gtk.TreeViewColumn | null): Gdk.Rectangle
```

Fills the bounding rectangle in bin_window coordinates for the cell at the
row specified by `path` and the column specified by `column`.  If `path` is
`null`, or points to a path not currently displayed, the `y` and `height` fields
of the rectangle will be filled with 0. If `column` is `null`, the `x` and `width`
fields will be filled with 0.  The sum of all cell rects does not cover the
entire tree; there are extra pixels in between rows, for example. The
returned rectangle is equivalent to the `cell_area` passed to
`gtk_cell_renderer_render()`.  This function is only valid if `tree_view` is
realized.

**Parameters**

- `path`: a `GtkTreePath` for the row, or `null` to get only horizontal coordinates
- `column`: a `GtkTreeViewColumn` for the column, or `null` to get only vertical coordinates

**Returns** rectangle to fill with cell rect

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getColumn`

```ts
getColumn(n: number): Gtk.TreeViewColumn | null
```

Gets the `GtkTreeViewColumn` at the given position in the `tree_view`.

**Parameters**

- `n`: The position of the column, counting from 0.

**Returns** The `GtkTreeViewColumn`, or `null` if the
position is outside the range of columns.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getColumns`

```ts
getColumns(): Gtk.TreeViewColumn[]
```

Returns a `GList` of all the `GtkTreeViewColumn`s currently in `tree_view`.
The returned list must be freed with g_list_free ().

**Returns** A list of `GtkTreeViewColumn`s

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getDestRowAtPos`

```ts
getDestRowAtPos(dragX: number, dragY: number): [boolean, Gtk.TreePath | null, Gtk.TreeViewDropPosition]
```

Determines the destination row for a given position.  `drag_x` and
`drag_y` are expected to be in widget coordinates.  This function is only
meaningful if `tree_view` is realized.  Therefore this function will always
return `false` if `tree_view` is not realized or does not have a model.

**Parameters**

- `dragX`: the position to determine the destination row for
- `dragY`: the position to determine the destination row for

**Returns** Tuple of:

- `result`: whether there is a row at the given position, `true` if this is indeed the case.
- `path`: Return location for the path of the highlighted row
- `pos`: Return location for the drop position, or `null`

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getDragDestRow`

```ts
getDragDestRow(): [Gtk.TreePath | null, Gtk.TreeViewDropPosition]
```

Gets information about the row that is highlighted for feedback.

**Returns** Tuple of:

- `path`: Return location for the path of the highlighted row
- `pos`: Return location for the drop position

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getEnableSearch`

```ts
getEnableSearch(): boolean
```

Returns whether or not the tree allows to start interactive searching
by typing in text.

**Returns** whether or not to let the user search interactively

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getEnableTreeLines`

```ts
getEnableTreeLines(): boolean
```

Returns whether or not tree lines are drawn in `tree_view`.

**Returns** `true` if tree lines are drawn in `tree_view`, `false`
otherwise.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getExpanderColumn`

```ts
getExpanderColumn(): Gtk.TreeViewColumn | null
```

Returns the column that is the current expander column,
or `null` if none has been set.
This column has the expander arrow drawn next to it.

**Returns** The expander column.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getFixedHeightMode`

```ts
getFixedHeightMode(): boolean
```

Returns whether fixed height mode is turned on for `tree_view`.

**Returns** `true` if `tree_view` is in fixed height mode

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getGridLines`

```ts
getGridLines(): Gtk.TreeViewGridLines
```

Returns which grid lines are enabled in `tree_view`.

**Returns** a `GtkTreeView`GridLines value indicating which grid lines
are enabled.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getHeadersClickable`

```ts
getHeadersClickable(): boolean
```

Returns whether all header columns are clickable.

**Returns** `true` if all header columns are clickable, otherwise `false`

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getHeadersVisible`

```ts
getHeadersVisible(): boolean
```

Returns `true` if the headers on the `tree_view` are visible.

**Returns** Whether the headers are visible or not.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getHoverExpand`

```ts
getHoverExpand(): boolean
```

Returns whether hover expansion mode is turned on for `tree_view`.

**Returns** `true` if `tree_view` is in hover expansion mode

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getHoverSelection`

```ts
getHoverSelection(): boolean
```

Returns whether hover selection mode is turned on for `tree_view`.

**Returns** `true` if `tree_view` is in hover selection mode

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getLevelIndentation`

```ts
getLevelIndentation(): number
```

Returns the amount, in pixels, of extra indentation for child levels
in `tree_view`.

**Returns** the amount of extra indentation for child levels in
`tree_view`.  A return value of 0 means that this feature is disabled.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getModel`

```ts
getModel(): Gtk.TreeModel | null
```

Returns the model the `GtkTreeView` is based on.  Returns `null` if the
model is unset.

**Returns** A `GtkTreeModel`

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getNColumns`

```ts
getNColumns(): number
```

Queries the number of columns in the given `tree_view`.

**Returns** The number of columns in the `tree_view`

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getPathAtPos`

```ts
getPathAtPos(x: number, y: number): [boolean, Gtk.TreePath | null, Gtk.TreeViewColumn | null, number, number]
```

Finds the path at the point (`x`, `y`), relative to bin_window coordinates.
That is, `x` and `y` are relative to an events coordinates. Widget-relative
coordinates must be converted using
`gtk_tree_view_convert_widget_to_bin_window_coords()`. It is primarily for
things like popup menus. If `path` is non-`null`, then it will be filled
with the `GtkTreePath` at that point.  This path should be freed with
`gtk_tree_path_free()`.  If `column` is non-`null`, then it will be filled
with the column at that point.  `cell_x` and `cell_y` return the coordinates
relative to the cell background (i.e. the `background_area` passed to
`gtk_cell_renderer_render()`).  This function is only meaningful if
`tree_view` is realized.  Therefore this function will always return `false`
if `tree_view` is not realized or does not have a model.

For converting widget coordinates (eg. the ones you get from
GtkWidget::query-tooltip), please see
`gtk_tree_view_convert_widget_to_bin_window_coords()`.

**Parameters**

- `x`: The x position to be identified (relative to bin_window).
- `y`: The y position to be identified (relative to bin_window).

**Returns** Tuple of:

- `result`: `true` if a row exists at that coordinate.
- `path`: A pointer to a `GtkTreePath` pointer to be filled in
- `column`: A pointer to a `GtkTreeViewColumn` pointer to be filled in
- `cellX`: A pointer where the X coordinate relative to the cell can be placed
- `cellY`: A pointer where the Y coordinate relative to the cell can be placed

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getReorderable`

```ts
getReorderable(): boolean
```

Retrieves whether the user can reorder the tree via drag-and-drop. See
`gtk_tree_view_set_reorderable()`.

**Returns** `true` if the tree can be reordered.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getRubberBanding`

```ts
getRubberBanding(): boolean
```

Returns whether rubber banding is turned on for `tree_view`.  If the
selection mode is `GTK_SELECTION_MULTIPLE`, rubber banding will allow the
user to select multiple rows by dragging the mouse.

**Returns** `true` if rubber banding in `tree_view` is enabled.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getSearchColumn`

```ts
getSearchColumn(): number
```

Gets the column searched on by the interactive search code.

**Returns** the column the interactive search code searches in.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getSearchEntry`

```ts
getSearchEntry(): Gtk.Editable | null
```

Returns the `GtkEntry` which is currently in use as interactive search
entry for `tree_view`.  In case the built-in entry is being used, `null`
will be returned.

**Returns** the entry currently in use as search entry.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getSelection`

```ts
getSelection(): Gtk.TreeSelection
```

Gets the `GtkTreeSelection` associated with `tree_view`.

**Returns** A `GtkTreeSelection` object.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getShowExpanders`

```ts
getShowExpanders(): boolean
```

Returns whether or not expanders are drawn in `tree_view`.

**Returns** `true` if expanders are drawn in `tree_view`, `false`
otherwise.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getTooltipColumn`

```ts
getTooltipColumn(): number
```

Returns the column of `tree_view`’s model which is being used for
displaying tooltips on `tree_view`’s rows.

**Returns** the index of the tooltip column that is currently being
used, or -1 if this is disabled.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getTooltipContext`

```ts
getTooltipContext(x: number, y: number, keyboardTip: boolean): [boolean, Gtk.TreeModel | null, Gtk.TreePath, Gtk.TreeIter]
```

This function is supposed to be used in a ::query-tooltip
signal handler for `GtkTreeView`. The `x`, `y` and `keyboard_tip` values
which are received in the signal handler, should be passed to this
function without modification.

The return value indicates whether there is a tree view row at the given
coordinates (`true`) or not (`false`) for mouse tooltips. For keyboard
tooltips the row returned will be the cursor row. When `true`, then any of
`model`, `path` and `iter` which have been provided will be set to point to
that row and the corresponding model. `x` and `y` will always be converted
to be relative to `tree_view`’s bin_window if `keyboard_tooltip` is `false`.

**Parameters**

- `x`: the x coordinate (relative to widget coordinates)
- `y`: the y coordinate (relative to widget coordinates)
- `keyboardTip`: whether this is a keyboard tooltip or not

**Returns** Tuple of:

- `result`: whether or not the given tooltip context points to a row
- `model`: a pointer to receive a `GtkTreeModel`
- `path`: a pointer to receive a `GtkTreePath`
- `iter`: a pointer to receive a `GtkTreeIter`

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getVisibleRange`

```ts
getVisibleRange(): [boolean, Gtk.TreePath, Gtk.TreePath]
```

Sets `start_path` and `end_path` to be the first and last visible path.
Note that there may be invisible paths in between.

The paths should be freed with `gtk_tree_path_free()` after use.

**Returns** Tuple of:

- `result`: `true`, if valid paths were placed in `start_path` and `end_path`.
- `startPath`: Return location for start of region
- `endPath`: Return location for end of region

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `getVisibleRect`

```ts
getVisibleRect(): Gdk.Rectangle
```

Fills `visible_rect` with the currently-visible region of the
buffer, in tree coordinates. Convert to bin_window coordinates with
`gtk_tree_view_convert_tree_to_bin_window_coords()`.
Tree coordinates start at 0,0 for row 0 of the tree, and cover the entire
scrollable area of the tree.

**Returns** rectangle to fill

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `insertColumn`

```ts
insertColumn(column: Gtk.TreeViewColumn, position: number): number
```

This inserts the `column` into the `tree_view` at `position`.  If `position` is
-1, then the column is inserted at the end. If `tree_view` has
“fixed_height” mode enabled, then `column` must have its “sizing” property
set to be GTK_TREE_VIEW_COLUMN_FIXED.

**Parameters**

- `column`: The `GtkTreeViewColumn` to be inserted.
- `position`: The position to insert `column` in.

**Returns** The number of columns in `tree_view` after insertion.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `insertColumnWithDataFunc`

```ts
insertColumnWithDataFunc(position: number, title: string, cell: Gtk.CellRenderer, func: Gtk.TreeCellDataFunc): number
```

Convenience function that inserts a new column into the `GtkTreeView`
with the given cell renderer and a `GtkTreeCellDataFunc` to set cell renderer
attributes (normally using data from the model). See also
`gtk_tree_view_column_set_cell_data_func()`, `gtk_tree_view_column_pack_start()`.
If `tree_view` has “fixed_height” mode enabled, then the new column will have its
“sizing” property set to be GTK_TREE_VIEW_COLUMN_FIXED.

**Parameters**

- `position`: Position to insert, -1 for append
- `title`: column title
- `cell`: cell renderer for column
- `func`: function to set attributes of cell renderer

**Returns** number of columns in the tree view post-insert

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `isBlankAtPos`

```ts
isBlankAtPos(x: number, y: number): [boolean, Gtk.TreePath | null, Gtk.TreeViewColumn | null, number, number]
```

Determine whether the point (`x`, `y`) in `tree_view` is blank, that is no
cell content nor an expander arrow is drawn at the location. If so, the
location can be considered as the background. You might wish to take
special action on clicks on the background, such as clearing a current
selection, having a custom context menu or starting rubber banding.

The `x` and `y` coordinate that are provided must be relative to bin_window
coordinates.  Widget-relative coordinates must be converted using
`gtk_tree_view_convert_widget_to_bin_window_coords()`.

For converting widget coordinates (eg. the ones you get from
GtkWidget::query-tooltip), please see
`gtk_tree_view_convert_widget_to_bin_window_coords()`.

The `path`, `column`, `cell_x` and `cell_y` arguments will be filled in
likewise as for `gtk_tree_view_get_path_at_pos()`.  Please see
`gtk_tree_view_get_path_at_pos()` for more information.

**Parameters**

- `x`: The x position to be identified (relative to bin_window)
- `y`: The y position to be identified (relative to bin_window)

**Returns** Tuple of:

- `result`: `true` if the area at the given coordinates is blank, `false` otherwise.
- `path`: A pointer to a `GtkTreePath` pointer to be filled in
- `column`: A pointer to a `GtkTreeViewColumn` pointer to be filled in
- `cellX`: A pointer where the X coordinate relative to the cell can be placed
- `cellY`: A pointer where the Y coordinate relative to the cell can be placed

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `isRubberBandingActive`

```ts
isRubberBandingActive(): boolean
```

Returns whether a rubber banding operation is currently being done
in `tree_view`.

**Returns** `true` if a rubber banding operation is currently being
done in `tree_view`.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `mapExpandedRows`

```ts
mapExpandedRows(func: Gtk.TreeViewMappingFunc): void
```

Calls `func` on all expanded rows.

**Parameters**

- `func`: A function to be called

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `moveColumnAfter`

```ts
moveColumnAfter(column: Gtk.TreeViewColumn, baseColumn: Gtk.TreeViewColumn | null): void
```

Moves `column` to be after to `base_column`.  If `base_column` is `null`, then
`column` is placed in the first position.

**Parameters**

- `column`: The `GtkTreeViewColumn` to be moved.
- `baseColumn`: The `GtkTreeViewColumn` to be moved relative to

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `removeColumn`

```ts
removeColumn(column: Gtk.TreeViewColumn): number
```

Removes `column` from `tree_view`.

**Parameters**

- `column`: The `GtkTreeViewColumn` to remove.

**Returns** The number of columns in `tree_view` after removing.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `rowActivated`

```ts
rowActivated(path: Gtk.TreePath, column: Gtk.TreeViewColumn | null): void
```

Activates the cell determined by `path` and `column`.

**Parameters**

- `path`: The `GtkTreePath` to be activated.
- `column`: The `GtkTreeViewColumn` to be activated.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `rowExpanded`

```ts
rowExpanded(path: Gtk.TreePath): boolean
```

Returns `true` if the node pointed to by `path` is expanded in `tree_view`.

**Parameters**

- `path`: A `GtkTreePath` to test expansion state.

**Returns** `true` if `path` is expanded.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `scrollToCell`

```ts
scrollToCell(path: Gtk.TreePath | null, column: Gtk.TreeViewColumn | null, useAlign: boolean, rowAlign: number, colAlign: number): void
```

Moves the alignments of `tree_view` to the position specified by `column` and
`path`.  If `column` is `null`, then no horizontal scrolling occurs.  Likewise,
if `path` is `null` no vertical scrolling occurs.  At a minimum, one of `column`
or `path` need to be non-`null`.  `row_align` determines where the row is
placed, and `col_align` determines where `column` is placed.  Both are expected
to be between 0.0 and 1.0. 0.0 means left/top alignment, 1.0 means
right/bottom alignment, 0.5 means center.

If `use_align` is `false`, then the alignment arguments are ignored, and the
tree does the minimum amount of work to scroll the cell onto the screen.
This means that the cell will be scrolled to the edge closest to its current
position.  If the cell is currently visible on the screen, nothing is done.

This function only works if the model is set, and `path` is a valid row on the
model.  If the model changes before the `tree_view` is realized, the centered
path will be modified to reflect this change.

**Parameters**

- `path`: The path of the row to move to
- `column`: The `GtkTreeViewColumn` to move horizontally to
- `useAlign`: whether to use alignment arguments, or `false`.
- `rowAlign`: The vertical alignment of the row specified by `path`.
- `colAlign`: The horizontal alignment of the column specified by `column`.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `scrollToPoint`

```ts
scrollToPoint(treeX: number, treeY: number): void
```

Scrolls the tree view such that the top-left corner of the visible
area is `tree_x`, `tree_y`, where `tree_x` and `tree_y` are specified
in tree coordinates.  The `tree_view` must be realized before
this function is called.  If it isn't, you probably want to be
using `gtk_tree_view_scroll_to_cell()`.

If either `tree_x` or `tree_y` are -1, then that direction isn’t scrolled.

**Parameters**

- `treeX`: X coordinate of new top-left pixel of visible area, or -1
- `treeY`: Y coordinate of new top-left pixel of visible area, or -1

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setActivateOnSingleClick`

```ts
setActivateOnSingleClick(single: boolean): void
```

Cause the `GtkTreeView`::row-activated signal to be emitted
on a single click instead of a double click.

**Parameters**

- `single`: `true` to emit row-activated on a single click

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setColumnDragFunction`

```ts
setColumnDragFunction(func: Gtk.TreeViewColumnDropFunc | null): void
```

Sets a user function for determining where a column may be dropped when
dragged.  This function is called on every column pair in turn at the
beginning of a column drag to determine where a drop can take place.  The
arguments passed to `func` are: the `tree_view`, the `GtkTreeViewColumn` being
dragged, the two `GtkTreeViewColumn`s determining the drop spot, and
`user_data`.  If either of the `GtkTreeViewColumn` arguments for the drop spot
are `null`, then they indicate an edge.  If `func` is set to be `null`, then
`tree_view` reverts to the default behavior of allowing all columns to be
dropped everywhere.

**Parameters**

- `func`: A function to determine which columns are reorderable

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setCursorOnCell`

```ts
setCursorOnCell(path: Gtk.TreePath, focusColumn: Gtk.TreeViewColumn | null, focusCell: Gtk.CellRenderer | null, startEditing: boolean): void
```

Sets the current keyboard focus to be at `path`, and selects it.  This is
useful when you want to focus the user’s attention on a particular row.  If
`focus_column` is not `null`, then focus is given to the column specified by
it. If `focus_column` and `focus_cell` are not `null`, and `focus_column`
contains 2 or more editable or activatable cells, then focus is given to
the cell specified by `focus_cell`. Additionally, if `focus_column` is
specified, and `start_editing` is `true`, then editing should be started in
the specified cell.  This function is often followed by
`gtk_widget_grab_focus` (`tree_view`) in order to give keyboard focus to the
widget.  Please note that editing can only happen when the widget is
realized.

If `path` is invalid for `model`, the current cursor (if any) will be unset
and the function will return without failing.

**Parameters**

- `path`: A `GtkTreePath`
- `focusColumn`: A `GtkTreeViewColumn`
- `focusCell`: A `GtkCellRenderer`
- `startEditing`: `true` if the specified cell should start being edited.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setDragDestRow`

```ts
setDragDestRow(path: Gtk.TreePath | null, pos: Gtk.TreeViewDropPosition): void
```

Sets the row that is highlighted for feedback.
If `path` is `null`, an existing highlight is removed.

**Parameters**

- `path`: The path of the row to highlight
- `pos`: Specifies whether to drop before, after or into the row

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setEnableSearch`

```ts
setEnableSearch(enableSearch: boolean): void
```

If `enable_search` is set, then the user can type in text to search through
the tree interactively (this is sometimes called "typeahead find").

Note that even if this is `false`, the user can still initiate a search
using the “start-interactive-search” key binding.

**Parameters**

- `enableSearch`: `true`, if the user can search interactively

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setEnableTreeLines`

```ts
setEnableTreeLines(enabled: boolean): void
```

Sets whether to draw lines interconnecting the expanders in `tree_view`.
This does not have any visible effects for lists.

**Parameters**

- `enabled`: `true` to enable tree line drawing, `false` otherwise.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setExpanderColumn`

```ts
setExpanderColumn(column: Gtk.TreeViewColumn | null): void
```

Sets the column to draw the expander arrow at. It must be in `tree_view`.
If `column` is `null`, then the expander arrow is always at the first
visible column.

If you do not want expander arrow to appear in your tree, set the
expander column to a hidden column.

**Parameters**

- `column`: `null`, or the column to draw the expander arrow at.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setFixedHeightMode`

```ts
setFixedHeightMode(enable: boolean): void
```

Enables or disables the fixed height mode of `tree_view`.
Fixed height mode speeds up `GtkTreeView` by assuming that all
rows have the same height.
Only enable this option if all rows are the same height and all
columns are of type `GTK_TREE_VIEW_COLUMN_FIXED`.

**Parameters**

- `enable`: `true` to enable fixed height mode

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setGridLines`

```ts
setGridLines(gridLines: Gtk.TreeViewGridLines): void
```

Sets which grid lines to draw in `tree_view`.

**Parameters**

- `gridLines`: a `GtkTreeView`GridLines value indicating which grid lines to enable.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setHeadersClickable`

```ts
setHeadersClickable(setting: boolean): void
```

Allow the column title buttons to be clicked.

**Parameters**

- `setting`: `true` if the columns are clickable.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setHeadersVisible`

```ts
setHeadersVisible(headersVisible: boolean): void
```

Sets the visibility state of the headers.

**Parameters**

- `headersVisible`: `true` if the headers are visible

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setHoverExpand`

```ts
setHoverExpand(expand: boolean): void
```

Enables or disables the hover expansion mode of `tree_view`.
Hover expansion makes rows expand or collapse if the pointer
moves over them.

**Parameters**

- `expand`: `true` to enable hover selection mode

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setHoverSelection`

```ts
setHoverSelection(hover: boolean): void
```

Enables or disables the hover selection mode of `tree_view`.
Hover selection makes the selected row follow the pointer.
Currently, this works only for the selection modes
`GTK_SELECTION_SINGLE` and `GTK_SELECTION_BROWSE`.

**Parameters**

- `hover`: `true` to enable hover selection mode

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setLevelIndentation`

```ts
setLevelIndentation(indentation: number): void
```

Sets the amount of extra indentation for child levels to use in `tree_view`
in addition to the default indentation.  The value should be specified in
pixels, a value of 0 disables this feature and in this case only the default
indentation will be used.
This does not have any visible effects for lists.

**Parameters**

- `indentation`: the amount, in pixels, of extra indentation in `tree_view`.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setModel`

```ts
setModel(model: Gtk.TreeModel | null): void
```

Sets the model for a `GtkTreeView`.  If the `tree_view` already has a model
set, it will remove it before setting the new model.  If `model` is `null`,
then it will unset the old model.

**Parameters**

- `model`: The model.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setReorderable`

```ts
setReorderable(reorderable: boolean): void
```

This function is a convenience function to allow you to reorder
models that support the `GtkTreeDragSourceIface` and the
`GtkTreeDragDestIface`.  Both `GtkTreeStore` and `GtkListStore` support
these.  If `reorderable` is `true`, then the user can reorder the
model by dragging and dropping rows. The developer can listen to
these changes by connecting to the model’s `GtkTreeModel::row-inserted`
and `GtkTreeModel::row-deleted` signals. The reordering is implemented
by setting up the tree view as a drag source and destination.
Therefore, drag and drop can not be used in a reorderable view for any
other purpose.

This function does not give you any degree of control over the order -- any
reordering is allowed.  If more control is needed, you should probably
handle drag and drop manually.

**Parameters**

- `reorderable`: `true`, if the tree can be reordered.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setRowSeparatorFunc`

```ts
setRowSeparatorFunc(func: Gtk.TreeViewRowSeparatorFunc | null): void
```

Sets the row separator function, which is used to determine
whether a row should be drawn as a separator. If the row separator
function is `null`, no separators are drawn. This is the default value.

**Parameters**

- `func`: a `GtkTreeView`RowSeparatorFunc

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setRubberBanding`

```ts
setRubberBanding(enable: boolean): void
```

Enables or disables rubber banding in `tree_view`.  If the selection mode
is `GTK_SELECTION_MULTIPLE`, rubber banding will allow the user to select
multiple rows by dragging the mouse.

**Parameters**

- `enable`: `true` to enable rubber banding

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setSearchColumn`

```ts
setSearchColumn(column: number): void
```

Sets `column` as the column where the interactive search code should
search in for the current model.

If the search column is set, users can use the “start-interactive-search”
key binding to bring up search popup. The enable-search property controls
whether simply typing text will also start an interactive search.

Note that `column` refers to a column of the current model. The search
column is reset to -1 when the model is changed.

**Parameters**

- `column`: the column of the model to search in, or -1 to disable searching

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setSearchEntry`

```ts
setSearchEntry(entry: Gtk.Editable | null): void
```

Sets the entry which the interactive search code will use for this
`tree_view`.  This is useful when you want to provide a search entry
in our interface at all time at a fixed position.  Passing `null` for
`entry` will make the interactive search code use the built-in popup
entry again.

**Parameters**

- `entry`: the entry the interactive search code of `tree_view` should use

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setSearchEqualFunc`

```ts
setSearchEqualFunc(searchEqualFunc: Gtk.TreeViewSearchEqualFunc): void
```

Sets the compare function for the interactive search capabilities; note
that somewhat like `strcmp()` returning 0 for equality
`GtkTreeView`SearchEqualFunc returns `false` on matches.

**Parameters**

- `searchEqualFunc`: the compare function to use during the search

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setShowExpanders`

```ts
setShowExpanders(enabled: boolean): void
```

Sets whether to draw and enable expanders and indent child rows in
`tree_view`.  When disabled there will be no expanders visible in trees
and there will be no way to expand and collapse rows by default.  Also
note that hiding the expanders will disable the default indentation.  You
can set a custom indentation in this case using
`gtk_tree_view_set_level_indentation()`.
This does not have any visible effects for lists.

**Parameters**

- `enabled`: `true` to enable expander drawing, `false` otherwise.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setTooltipCell`

```ts
setTooltipCell(tooltip: Gtk.Tooltip, path: Gtk.TreePath | null, column: Gtk.TreeViewColumn | null, cell: Gtk.CellRenderer | null): void
```

Sets the tip area of `tooltip` to the area `path`, `column` and `cell` have
in common.  For example if `path` is `null` and `column` is set, the tip
area will be set to the full area covered by `column`.  See also
`gtk_tooltip_set_tip_area()`.

Note that if `path` is not specified and `cell` is set and part of a column
containing the expander, the tooltip might not show and hide at the correct
position.  In such cases `path` must be set to the current node under the
mouse cursor for this function to operate correctly.

See also `gtk_tree_view_set_tooltip_column()` for a simpler alternative.

**Parameters**

- `tooltip`: a `GtkTooltip`
- `path`: a `GtkTreePath`
- `column`: a `GtkTreeViewColumn`
- `cell`: a `GtkCellRenderer`

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setTooltipColumn`

```ts
setTooltipColumn(column: number): void
```

If you only plan to have simple (text-only) tooltips on full rows, you
can use this function to have `GtkTreeView` handle these automatically
for you. `column` should be set to the column in `tree_view`’s model
containing the tooltip texts, or -1 to disable this feature.

When enabled, `GtkWidget:has-tooltip` will be set to `true` and
`tree_view` will connect a `GtkWidget::query-tooltip` signal handler.

Note that the signal handler sets the text with `gtk_tooltip_set_markup()`,
so &, <, etc have to be escaped in the text.

**Parameters**

- `column`: an integer, which is a valid column number for `tree_view`’s model

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `setTooltipRow`

```ts
setTooltipRow(tooltip: Gtk.Tooltip, path: Gtk.TreePath): void
```

Sets the tip area of `tooltip` to be the area covered by the row at `path`.
See also `gtk_tree_view_set_tooltip_column()` for a simpler alternative.
See also `gtk_tooltip_set_tip_area()`.

**Parameters**

- `tooltip`: a `GtkTooltip`
- `path`: a `GtkTreePath`

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `treeViewGetCursor`

```ts
treeViewGetCursor(): [Gtk.TreePath | null, Gtk.TreeViewColumn | null]
```

Fills in `path` and `focus_column` with the current path and focus column.  If
the cursor isn’t currently set, then *`path` will be `null`.  If no column
currently has focus, then *`focus_column` will be `null`.

The returned `GtkTreePath` must be freed with `gtk_tree_path_free()` when
you are done with it.

**Returns** Tuple of:

- `path`: A pointer to be filled with the current cursor path
- `focusColumn`: A pointer to be filled with the current focus column

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `treeViewSetCursor`

```ts
treeViewSetCursor(path: Gtk.TreePath, focusColumn: Gtk.TreeViewColumn | null, startEditing: boolean): void
```

Sets the current keyboard focus to be at `path`, and selects it.  This is
useful when you want to focus the user’s attention on a particular row.  If
`focus_column` is not `null`, then focus is given to the column specified by
it. Additionally, if `focus_column` is specified, and `start_editing` is
`true`, then editing should be started in the specified cell.
This function is often followed by `gtk_widget_grab_focus` (`tree_view`)
in order to give keyboard focus to the widget.  Please note that editing
can only happen when the widget is realized.

If `path` is invalid for `model`, the current cursor (if any) will be unset
and the function will return without failing.

**Parameters**

- `path`: A `GtkTreePath`
- `focusColumn`: A `GtkTreeViewColumn`
- `startEditing`: `true` if the specified cell should start being edited.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `unsetRowsDragDest`

```ts
unsetRowsDragDest(): void
```

Undoes the effect of
`gtk_tree_view_enable_model_drag_dest()`. Calling this method sets
`GtkTreeView`:reorderable to `false`.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead

### `unsetRowsDragSource`

```ts
unsetRowsDragSource(): void
```

Undoes the effect of
`gtk_tree_view_enable_model_drag_source()`. Calling this method sets
`GtkTreeView`:reorderable to `false`.

> **Deprecated since 4.10.** Use `Gtk.ListView` or `Gtk.ColumnView` instead
