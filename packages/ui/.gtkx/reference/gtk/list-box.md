---
description: "Shows a vertical list."
---

# GtkListBox

Shows a vertical list.



A `GtkListBox` only contains `GtkListBoxRow` children. These rows can
by dynamically sorted and filtered, and headers can be added dynamically
depending on the row content. It also allows keyboard and mouse navigation
and selection like a typical list.

Using `GtkListBox` is often an alternative to `GtkTreeView`, especially
when the list contents has a more complicated layout than what is allowed
by a `GtkCellRenderer`, or when the contents is interactive (i.e. has a
button in it).

Although a `GtkListBox` must have only `GtkListBoxRow` children, you can
add any kind of widget to it via `Gtk.ListBox.prepend()`,
`Gtk.ListBox.append()` and `Gtk.ListBox.insert()` and a
`GtkListBoxRow` widget will automatically be inserted between the list
and the widget.

`GtkListBoxRows` can be marked as activatable or selectable. If a row is
activatable, `Gtk.ListBox.row-activated` will be emitted for it when
the user tries to activate it. If it is selectable, the row will be marked
as selected when the user tries to select it.

## GtkListBox as GtkBuildable

The `GtkListBox` implementation of the `GtkBuildable` interface supports
setting a child as the placeholder by specifying “placeholder” as the “type”
attribute of a `<child>` element. See `Gtk.ListBox.setPlaceholder()`
for info.

## Shortcuts and Gestures

The following signals have default keybindings:

- `Gtk.ListBox.move-cursor`
- `Gtk.ListBox.select-all`
- `Gtk.ListBox.toggle-cursor-row`
- `Gtk.ListBox.unselect-all`

## CSS nodes

```
list[.separators][.rich-list][.navigation-sidebar][.boxed-list]
╰── row[.activatable]
```

`GtkListBox` uses a single CSS node named list. It may carry the .separators
style class, when the `Gtk.ListBox.showSeparators` property is set.
Each `GtkListBoxRow` uses a single CSS node named row. The row nodes get the
.activatable style class added when appropriate.

It may also carry the .boxed-list style class. In this case, the list will be
automatically surrounded by a frame and have separators.

The main list node may also carry style classes to select
the style of [list presentation](section-list-widget.html#list-styles):
.rich-list, .navigation-sidebar or .data-table.

## Accessibility

`GtkListBox` uses the `Gtk.AccessibleRole.list` role and `GtkListBoxRow` uses
the `Gtk.AccessibleRole.list_item` role.

```tsx
import { GtkListBox } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkListBox**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ListBox` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `acceptUnpairedRelease`

`boolean` · default `false`

Whether to accept unpaired release events.

### `activateOnSingleClick`

`boolean` · default `true`

Determines whether children can be activated with a single
click, or require a double-click.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `selectedIndex`

`number | null`

Index of the row to select; `-1` or `null` selects none. Applied once the row exists, and re-applied whenever the box's own selection drifts from it. Left alone while the prop is absent.

### `selectionMode`

`Gtk.SelectionMode` · default `GTK_SELECTION_SINGLE`

The selection mode used by the list box.

### `showSeparators`

`boolean` · default `false`

Whether to show separators between rows.

### `tabBehavior`

`Gtk.ListTabBehavior` · default `GTK_LIST_TAB_ALL`

Behavior of the <kbd>Tab</kbd> key

_Available since 4.18._

## Signals

### `onActivateCursorRow`

```ts
(self: Gtk.ListBox) => void
```

Emitted when the cursor row is activated.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onMoveCursor`

```ts
(step: Gtk.MovementStep, count: number, extend: boolean, modify: boolean, self: Gtk.ListBox) => void
```

Emitted when the user initiates a cursor movement.

The default bindings for this signal come in two variants, the variant with
the Shift modifier extends the selection, the variant without the Shift
modifier does not. There are too many key combinations to list them all
here.

- <kbd>←</kbd>, <kbd>→</kbd>, <kbd>↑</kbd>, <kbd>↓</kbd>
  move by individual children
- <kbd>Home</kbd>, <kbd>End</kbd> move to the ends of the box
- <kbd>PgUp</kbd>, <kbd>PgDn</kbd> move vertically by pages

**Parameters**

- `step`: the granularity of the move, as a `GtkMovementStep`
- `count`: the number of `step` units to move
- `extend`: whether to extend the selection
- `modify`: whether to modify the selection
- `self`: The instance the signal was emitted on.

### `onRowActivated`

```ts
(row: Gtk.ListBoxRow, self: Gtk.ListBox) => void
```

Emitted when a row has been activated by the user.

**Parameters**

- `row`: the activated row
- `self`: The instance the signal was emitted on.

### `onRowSelected`

```ts
(row: Gtk.ListBoxRow | null, self: Gtk.ListBox) => void
```

Emitted when a new row is selected, or (with a `null` `row`)
when the selection is cleared.

When the `box` is using `GTK_SELECTION_MULTIPLE`, this signal will not
give you the full picture of selection changes, and you should use
the `Gtk.ListBox.selected-rows-changed` signal instead.

**Parameters**

- `row`: the selected row
- `self`: The instance the signal was emitted on.

### `onSelectAll`

```ts
(self: Gtk.ListBox) => void
```

Emitted to select all children of the box, if the selection
mode permits it.

This is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is <kbd>Ctrl</kbd>-<kbd>a</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onSelectedRowsChanged`

```ts
(self: Gtk.ListBox) => void
```

Emitted when the set of selected rows changes.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onToggleCursorRow`

```ts
(self: Gtk.ListBox) => void
```

Emitted when the cursor row is toggled.

The default bindings for this signal is <kbd>Ctrl</kbd>+<kbd>␣</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onUnselectAll`

```ts
(self: Gtk.ListBox) => void
```

Emitted to unselect all children of the box, if the selection
mode permits it.

This is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is
<kbd>Ctrl</kbd>-<kbd>Shift</kbd>-<kbd>a</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.ListBox` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(child: Gtk.Widget): void
```

Append a widget to the list.

If a sort function is set, the widget will
actually be inserted at the calculated position.

**Parameters**

- `child`: the `GtkWidget` to add

### `bindModel`

```ts
bindModel(model: Gio.ListModel | null, createWidgetFunc: Gtk.ListBoxCreateWidgetFunc | null): void
```

Binds `model` to `box`.

If `box` was already bound to a model, that previous binding is
destroyed.

The contents of `box` are cleared and then filled with widgets that
represent items from `model`. `box` is updated whenever `model` changes.
If `model` is `null`, `box` is left empty.

It is undefined to add or remove widgets directly (for example, with
`Gtk.ListBox.insert()`) while `box` is bound to a model.

Note that using a model is incompatible with the filtering and sorting
functionality in `GtkListBox`. When using a model, filtering and sorting
should be implemented by the model.

**Parameters**

- `model`: the `GListModel` to be bound to `box`
- `createWidgetFunc`: a function that creates widgets for items or `null` in case you also passed `null` as `model`

### `dragHighlightRow`

```ts
dragHighlightRow(row: Gtk.ListBoxRow): void
```

Add a drag highlight to a row.

This is a helper function for implementing DnD onto a `GtkListBox`.
The passed in `row` will be highlighted by setting the
`GTK_STATE_FLAG_DROP_ACTIVE` state and any previously highlighted
row will be unhighlighted.

The row will also be unhighlighted when the widget gets
a drag leave event.

**Parameters**

- `row`: a `GtkListBoxRow`

### `dragUnhighlightRow`

```ts
dragUnhighlightRow(): void
```

If a row has previously been highlighted via `gtk_list_box_drag_highlight_row()`,
it will have the highlight removed.

### `getActivateOnSingleClick`

```ts
getActivateOnSingleClick(): boolean
```

Returns whether rows activate on single clicks.

**Returns** `true` if rows are activated on single click, `false` otherwise

### `getAdjustment`

```ts
getAdjustment(): Gtk.Adjustment | null
```

Gets the adjustment (if any) that the widget uses to
for vertical scrolling.

**Returns** the adjustment

### `getRowAtIndex`

```ts
getRowAtIndex(index: number): Gtk.ListBoxRow | null
```

Gets the n-th child in the list (not counting headers).

If `index_` is negative or larger than the number of items in the
list, `null` is returned.

**Parameters**

- `index`: the index of the row

**Returns** the child `GtkWidget`

### `getRowAtY`

```ts
getRowAtY(y: number): Gtk.ListBoxRow | null
```

Gets the row at the `y` position.

**Parameters**

- `y`: position

**Returns** the row

### `getSelectedRow`

```ts
getSelectedRow(): Gtk.ListBoxRow | null
```

Gets the selected row, or `null` if no rows are selected.

Note that the box may allow multiple selection, in which
case you should use `Gtk.ListBox.selectedForeach()` to
find all selected rows.

**Returns** the selected row

### `getSelectedRows`

```ts
getSelectedRows(): Gtk.ListBoxRow[]
```

Creates a list of all selected children.

**Returns** A `GList` containing the `GtkWidget` for each selected child.
  Free with `g_list_free()` when done.

### `getSelectionMode`

```ts
getSelectionMode(): Gtk.SelectionMode
```

Gets the selection mode of the listbox.

**Returns** a `GtkSelectionMode`

### `getShowSeparators`

```ts
getShowSeparators(): boolean
```

Returns whether the list box should show separators
between rows.

**Returns** `true` if the list box shows separators

### `getTabBehavior`

```ts
getTabBehavior(): Gtk.ListTabBehavior
```

Returns the behavior of the <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd> keys.

**Returns** the tab behavior

_Available since 4.18._

### `insert`

```ts
insert(child: Gtk.Widget, position: number): void
```

Insert the `child` into the `box` at `position`.

If a sort function is
set, the widget will actually be inserted at the calculated position.

If `position` is -1, or larger than the total number of items in the
`box`, then the `child` will be appended to the end.

**Parameters**

- `child`: the `GtkWidget` to add
- `position`: the position to insert `child` in

### `invalidateFilter`

```ts
invalidateFilter(): void
```

Update the filtering for all rows.

Call this when result
of the filter function on the `box` is changed due
to an external factor. For instance, this would be used
if the filter function just looked for a specific search
string and the entry with the search string has changed.

### `invalidateHeaders`

```ts
invalidateHeaders(): void
```

Update the separators for all rows.

Call this when result
of the header function on the `box` is changed due
to an external factor.

### `invalidateSort`

```ts
invalidateSort(): void
```

Update the sorting for all rows.

Call this when result
of the sort function on the `box` is changed due
to an external factor.

### `prepend`

```ts
prepend(child: Gtk.Widget): void
```

Prepend a widget to the list.

If a sort function is set, the widget will
actually be inserted at the calculated position.

**Parameters**

- `child`: the `GtkWidget` to add

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes a child from `box`.

**Parameters**

- `child`: the child to remove

### `removeAll`

```ts
removeAll(): void
```

Removes all rows from `box`.

This function does nothing if `box` is backed by a model.

_Available since 4.12._

### `selectAll`

```ts
selectAll(): void
```

Select all children of `box`, if the selection mode allows it.

### `selectedForeach`

```ts
selectedForeach(func: Gtk.ListBoxForeachFunc): void
```

Calls a function for each selected child.

Note that the selection cannot be modified from within this function.

**Parameters**

- `func`: the function to call for each selected child

### `selectRow`

```ts
selectRow(row: Gtk.ListBoxRow | null): void
```

Make `row` the currently selected row.

**Parameters**

- `row`: The row to select

### `setActivateOnSingleClick`

```ts
setActivateOnSingleClick(single: boolean): void
```

If `single` is `true`, rows will be activated when you click on them,
otherwise you need to double-click.

**Parameters**

- `single`: a boolean

### `setAdjustment`

```ts
setAdjustment(adjustment: Gtk.Adjustment | null): void
```

Sets the adjustment (if any) that the widget uses to
for vertical scrolling.

For instance, this is used to get the page size for
PageUp/Down key handling.

In the normal case when the `box` is packed inside
a `GtkScrolledWindow` the adjustment from that will
be picked up automatically, so there is no need
to manually do that.

**Parameters**

- `adjustment`: the adjustment

### `setFilterFunc`

```ts
setFilterFunc(filterFunc: Gtk.ListBoxFilterFunc | null): void
```

By setting a filter function on the `box` one can decide dynamically which
of the rows to show.

For instance, to implement a search function on a list that
filters the original list to only show the matching rows.

The `filter_func` will be called for each row after the call, and
it will continue to be called each time a row changes (via
`Gtk.ListBoxRow.changed()`) or when `Gtk.ListBox.invalidateFilter()`
is called.

Note that using a filter function is incompatible with using a model
(see `Gtk.ListBox.bindModel()`).

**Parameters**

- `filterFunc`: callback that lets you filter which rows to show

### `setHeaderFunc`

```ts
setHeaderFunc(updateHeader: Gtk.ListBoxUpdateHeaderFunc | null): void
```

Sets a header function.

By setting a header function on the `box` one can dynamically add headers
in front of rows, depending on the contents of the row and its position
in the list.

For instance, one could use it to add headers in front of the first item
of a new kind, in a list sorted by the kind.

The `update_header` can look at the current header widget using
`Gtk.ListBoxRow.getHeader()` and either update the state of the widget
as needed, or set a new one using `Gtk.ListBoxRow.setHeader()`. If no
header is needed, set the header to `null`.

Note that you may get many calls `update_header` to this for a particular
row when e.g. changing things that don’t affect the header. In this case
it is important for performance to not blindly replace an existing header
with an identical one.

The `update_header` function will be called for each row after the call,
and it will continue to be called each time a row changes (via
`Gtk.ListBoxRow.changed()`) and when the row before changes (either
by `Gtk.ListBoxRow.changed()` on the previous row, or when the previous
row becomes a different row). It is also called for all rows when
`Gtk.ListBox.invalidateHeaders()` is called.

**Parameters**

- `updateHeader`: callback that lets you add row headers

### `setPlaceholder`

```ts
setPlaceholder(placeholder: Gtk.Widget | null): void
```

Sets the placeholder widget that is shown in the list when
it doesn't display any visible children.

**Parameters**

- `placeholder`: a `GtkWidget`

### `setSelectionMode`

```ts
setSelectionMode(mode: Gtk.SelectionMode): void
```

Sets how selection works in the listbox.

**Parameters**

- `mode`: The `GtkSelectionMode`

### `setShowSeparators`

```ts
setShowSeparators(showSeparators: boolean): void
```

Sets whether the list box should show separators
between rows.

**Parameters**

- `showSeparators`: `true` to show separators

### `setSortFunc`

```ts
setSortFunc(sortFunc: Gtk.ListBoxSortFunc | null): void
```

Sets a sort function.

By setting a sort function on the `box` one can dynamically reorder
the rows of the list, based on the contents of the rows.

The `sort_func` will be called for each row after the call, and will
continue to be called each time a row changes (via
`Gtk.ListBoxRow.changed()`) and when `Gtk.ListBox.invalidateSort()`
is called.

Note that using a sort function is incompatible with using a model
(see `Gtk.ListBox.bindModel()`).

**Parameters**

- `sortFunc`: the sort function

### `setTabBehavior`

```ts
setTabBehavior(behavior: Gtk.ListTabBehavior): void
```

Sets the behavior of the <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd> keys.

**Parameters**

- `behavior`: the tab behavior

_Available since 4.18._

### `unselectAll`

```ts
unselectAll(): void
```

Unselect all children of `box`, if the selection mode allows it.

### `unselectRow`

```ts
unselectRow(row: Gtk.ListBoxRow): void
```

Unselects a single row of `box`, if the selection mode allows it.

**Parameters**

- `row`: the row to unselect
