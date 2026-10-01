---
description: "Puts child widgets in a reflowing grid."
---

# GtkFlowBox

Puts child widgets in a reflowing grid.



For instance, with the horizontal orientation, the widgets will be
arranged from left to right, starting a new row under the previous
row when necessary. Reducing the width in this case will require more
rows, so a larger height will be requested.

Likewise, with the vertical orientation, the widgets will be arranged
from top to bottom, starting a new column to the right when necessary.
Reducing the height will require more columns, so a larger width will
be requested.

The size request of a `GtkFlowBox` alone may not be what you expect;
if you need to be able to shrink it along both axes and dynamically
reflow its children, you may have to wrap it in a `GtkScrolledWindow`
to enable that.

The children of a `GtkFlowBox` can be dynamically sorted and filtered.

Although a `GtkFlowBox` must have only `GtkFlowBoxChild` children, you
can add any kind of widget to it via `Gtk.FlowBox.insert()`, and a
`GtkFlowBoxChild` widget will automatically be inserted between the box
and the widget.

Also see `Gtk.ListBox`.

## Shortcuts and Gestures

The following signals have default keybindings:

- `Gtk.FlowBox.move-cursor`
- `Gtk.FlowBox.select-all`
- `Gtk.FlowBox.toggle-cursor-child`
- `Gtk.FlowBox.unselect-all`

## CSS nodes

```
flowbox
├── flowboxchild
│   ╰── <child>
├── flowboxchild
│   ╰── <child>
┊
╰── [rubberband]
```

`GtkFlowBox` uses a single CSS node with name flowbox. `GtkFlowBoxChild`
uses a single CSS node with name flowboxchild. For rubberband selection,
a subnode with name rubberband is used.

## Accessibility

`GtkFlowBox` uses the `Gtk.AccessibleRole.grid` role, and `GtkFlowBoxChild`
uses the `Gtk.AccessibleRole.grid_cell` role.

```tsx
import { GtkFlowBox } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkFlowBox**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.FlowBox` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

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

### `columnSpacing`

`number` · default `0`

The amount of horizontal space between two children.

### `homogeneous`

`boolean` · default `false`

Determines whether all children should be allocated the
same size.

### `maxChildrenPerLine`

`number` · default `7`

The maximum amount of children to request space for consecutively
in the given orientation.

### `minChildrenPerLine`

`number` · default `0`

The minimum number of children to allocate consecutively
in the given orientation.

Setting the minimum children per line ensures
that a reasonably small height will be requested
for the overall minimum width of the box.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `rowSpacing`

`number` · default `0`

The amount of vertical space between two children.

### `selectionMode`

`Gtk.SelectionMode` · default `GTK_SELECTION_SINGLE`

The selection mode used by the flow box.

## Signals

### `onActivateCursorChild`

```ts
(self: Gtk.FlowBox) => void
```

Emitted when the user activates the `box`.

This is a [keybinding signal](class.SignalAction.html).

**Parameters**

- `self`: The instance the signal was emitted on.

### `onChildActivated`

```ts
(child: Gtk.FlowBoxChild, self: Gtk.FlowBox) => void
```

Emitted when a child has been activated by the user.

**Parameters**

- `child`: the child that is activated
- `self`: The instance the signal was emitted on.

### `onMoveCursor`

```ts
(step: Gtk.MovementStep, count: number, extend: boolean, modify: boolean, self: Gtk.FlowBox) => boolean | undefined
```

Emitted when the user initiates a cursor movement.

This is a [keybinding signal](class.SignalAction.html).
Applications should not connect to it, but may emit it with
`g_signal_emit_by_name()` if they need to control the cursor
programmatically.

The default bindings for this signal come in two variants,
the variant with the Shift modifier extends the selection,
the variant without the Shift modifier does not.
There are too many key combinations to list them all here.

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

**Returns** `true` to stop other handlers from being invoked for the event.
  `false` to propagate the event further.

### `onSelectAll`

```ts
(self: Gtk.FlowBox) => void
```

Emitted to select all children of the box,
if the selection mode permits it.

This is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal is <kbd>Ctrl</kbd>-<kbd>a</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onSelectedChildrenChanged`

```ts
(self: Gtk.FlowBox) => void
```

Emitted when the set of selected children changes.

Use `Gtk.FlowBox.selectedForeach()` or
`Gtk.FlowBox.getSelectedChildren()` to obtain the
selected children.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onToggleCursorChild`

```ts
(self: Gtk.FlowBox) => void
```

Emitted to toggle the selection of the child that has the focus.

This is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is <kbd>Ctrl</kbd>-<kbd>Space</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onUnselectAll`

```ts
(self: Gtk.FlowBox) => void
```

Emitted to unselect all children of the box,
if the selection mode permits it.

This is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal is <kbd>Ctrl</kbd>-<kbd>Shift</kbd>-<kbd>a</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.FlowBox` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(child: Gtk.Widget): void
```

Adds `child` to the end of `self`.

If a sort function is set, the widget will
actually be inserted at the calculated position.

See also: `Gtk.FlowBox.insert()`.

**Parameters**

- `child`: the `GtkWidget` to add

_Available since 4.6._

### `bindModel`

```ts
bindModel(model: Gio.ListModel | null, createWidgetFunc: Gtk.FlowBoxCreateWidgetFunc): void
```

Binds `model` to `box`.

If `box` was already bound to a model, that previous binding is
destroyed.

The contents of `box` are cleared and then filled with widgets that
represent items from `model`. `box` is updated whenever `model` changes.
If `model` is `null`, `box` is left empty.

It is undefined to add or remove widgets directly (for example, with
`Gtk.FlowBox.insert()`) while `box` is bound to a model.

Note that using a model is incompatible with the filtering and sorting
functionality in `GtkFlowBox`. When using a model, filtering and sorting
should be implemented by the model.

**Parameters**

- `model`: the `GListModel` to be bound to `box`
- `createWidgetFunc`: a function that creates widgets for items

### `getActivateOnSingleClick`

```ts
getActivateOnSingleClick(): boolean
```

Returns whether children activate on single clicks.

**Returns** `true` if children are activated on single click,
  `false` otherwise

### `getChildAtIndex`

```ts
getChildAtIndex(idx: number): Gtk.FlowBoxChild | null
```

Gets the nth child in the `box`.

**Parameters**

- `idx`: the position of the child

**Returns** the child widget, which will
  always be a `GtkFlowBoxChild` or `null` in case no child widget
  with the given index exists.

### `getChildAtPos`

```ts
getChildAtPos(x: number, y: number): Gtk.FlowBoxChild | null
```

Gets the child in the (`x`, `y`) position.

Both `x` and `y` are assumed to be relative to the origin of `box`.

**Parameters**

- `x`: the x coordinate of the child
- `y`: the y coordinate of the child

**Returns** the child widget, which will
  always be a `GtkFlowBoxChild` or `null` in case no child widget
  exists for the given x and y coordinates.

### `getColumnSpacing`

```ts
getColumnSpacing(): number
```

Gets the horizontal spacing.

**Returns** the horizontal spacing

### `getHomogeneous`

```ts
getHomogeneous(): boolean
```

Returns whether the box is homogeneous.

**Returns** `true` if the box is homogeneous.

### `getMaxChildrenPerLine`

```ts
getMaxChildrenPerLine(): number
```

Gets the maximum number of children per line.

**Returns** the maximum number of children per line

### `getMinChildrenPerLine`

```ts
getMinChildrenPerLine(): number
```

Gets the minimum number of children per line.

**Returns** the minimum number of children per line

### `getRowSpacing`

```ts
getRowSpacing(): number
```

Gets the vertical spacing.

**Returns** the vertical spacing

### `getSelectedChildren`

```ts
getSelectedChildren(): Gtk.FlowBoxChild[]
```

Creates a list of all selected children.

**Returns** A `GList` containing the `GtkWidget` for each selected child.
  Free with `g_list_free()` when done.

### `getSelectionMode`

```ts
getSelectionMode(): Gtk.SelectionMode
```

Gets the selection mode of `box`.

**Returns** the `GtkSelectionMode`

### `insert`

```ts
insert(widget: Gtk.Widget, position: number): void
```

Inserts the `widget` into `box` at `position`.

If a sort function is set, the widget will actually be inserted
at the calculated position.

If `position` is -1, or larger than the total number of children
in the `box`, then the `widget` will be appended to the end.

**Parameters**

- `widget`: the `GtkWidget` to add
- `position`: the position to insert `child` in

### `invalidateFilter`

```ts
invalidateFilter(): void
```

Updates the filtering for all children.

Call this function when the result of the filter
function on the `box` is changed due to an external
factor. For instance, this would be used if the
filter function just looked for a specific search
term, and the entry with the string has changed.

### `invalidateSort`

```ts
invalidateSort(): void
```

Updates the sorting for all children.

Call this when the result of the sort function on
`box` is changed due to an external factor.

### `prepend`

```ts
prepend(child: Gtk.Widget): void
```

Adds `child` to the start of `self`.

If a sort function is set, the widget will
actually be inserted at the calculated position.

See also: `Gtk.FlowBox.insert()`.

**Parameters**

- `child`: the `GtkWidget` to add

_Available since 4.6._

### `remove`

```ts
remove(widget: Gtk.Widget): void
```

Removes a child from `box`.

**Parameters**

- `widget`: the child widget to remove

### `removeAll`

```ts
removeAll(): void
```

Removes all children from `box`.

This function does nothing if `box` is backed by a model.

_Available since 4.12._

### `selectAll`

```ts
selectAll(): void
```

Select all children of `box`, if the selection
mode allows it.

### `selectChild`

```ts
selectChild(child: Gtk.FlowBoxChild): void
```

Selects a single child of `box`, if the selection
mode allows it.

**Parameters**

- `child`: a child of `box`

### `selectedForeach`

```ts
selectedForeach(func: Gtk.FlowBoxForeachFunc): void
```

Calls a function for each selected child.

Note that the selection cannot be modified from within
this function.

**Parameters**

- `func`: the function to call for each selected child

### `setActivateOnSingleClick`

```ts
setActivateOnSingleClick(single: boolean): void
```

If `single` is `true`, children will be activated when you click
on them, otherwise you need to double-click.

**Parameters**

- `single`: `true` to emit child-activated on a single click

### `setColumnSpacing`

```ts
setColumnSpacing(spacing: number): void
```

Sets the horizontal space to add between children.

**Parameters**

- `spacing`: the spacing to use

### `setFilterFunc`

```ts
setFilterFunc(filterFunc: Gtk.FlowBoxFilterFunc | null): void
```

By setting a filter function on the `box` one can decide dynamically
which of the children to show.

For instance, to implement a search function that only shows the
children matching the search terms.

The `filter_func` will be called for each child after the call, and
it will continue to be called each time a child changes (via
`Gtk.FlowBoxChild.changed()`) or when
`Gtk.FlowBox.invalidateFilter()` is called.

Note that using a filter function is incompatible with using a model
(see `Gtk.FlowBox.bindModel()`).

**Parameters**

- `filterFunc`: callback that lets you filter which children to show

### `setHadjustment`

```ts
setHadjustment(adjustment: Gtk.Adjustment): void
```

Hooks up an adjustment to focus handling in `box`.

The adjustment is also used for autoscrolling during
rubberband selection. See `Gtk.ScrolledWindow.getHadjustment()`
for a typical way of obtaining the adjustment, and
`Gtk.FlowBox.setVadjustment()` for setting the vertical
adjustment.

The adjustments have to be in pixel units and in the same
coordinate system as the allocation for immediate children
of the box.

**Parameters**

- `adjustment`: an adjustment which should be adjusted when the focus is moved among the descendents of `container`

### `setHomogeneous`

```ts
setHomogeneous(homogeneous: boolean): void
```

Sets whether or not all children of `box` are given
equal space in the box.

**Parameters**

- `homogeneous`: `true` to create equal allotments, `false` for variable allotments

### `setMaxChildrenPerLine`

```ts
setMaxChildrenPerLine(nChildren: number): void
```

Sets the maximum number of children to request and
allocate space for in `box`’s orientation.

Setting the maximum number of children per line
limits the overall natural size request to be no more
than `n_children` children long in the given orientation.

**Parameters**

- `nChildren`: the maximum number of children per line

### `setMinChildrenPerLine`

```ts
setMinChildrenPerLine(nChildren: number): void
```

Sets the minimum number of children to line up
in `box`’s orientation before flowing.

**Parameters**

- `nChildren`: the minimum number of children per line

### `setRowSpacing`

```ts
setRowSpacing(spacing: number): void
```

Sets the vertical space to add between children.

**Parameters**

- `spacing`: the spacing to use

### `setSelectionMode`

```ts
setSelectionMode(mode: Gtk.SelectionMode): void
```

Sets how selection works in `box`.

**Parameters**

- `mode`: the new selection mode

### `setSortFunc`

```ts
setSortFunc(sortFunc: Gtk.FlowBoxSortFunc | null): void
```

By setting a sort function on the `box`, one can dynamically
reorder the children of the box, based on the contents of
the children.

The `sort_func` will be called for each child after the call,
and will continue to be called each time a child changes (via
`Gtk.FlowBoxChild.changed()`) and when
`Gtk.FlowBox.invalidateSort()` is called.

Note that using a sort function is incompatible with using a model
(see `Gtk.FlowBox.bindModel()`).

**Parameters**

- `sortFunc`: the sort function

### `setVadjustment`

```ts
setVadjustment(adjustment: Gtk.Adjustment): void
```

Hooks up an adjustment to focus handling in `box`.

The adjustment is also used for autoscrolling during
rubberband selection. See `Gtk.ScrolledWindow.getVadjustment()`
for a typical way of obtaining the adjustment, and
`Gtk.FlowBox.setHadjustment()` for setting the horizontal
adjustment.

The adjustments have to be in pixel units and in the same
coordinate system as the allocation for immediate children
of the box.

**Parameters**

- `adjustment`: an adjustment which should be adjusted when the focus is moved among the descendents of `container`

### `unselectAll`

```ts
unselectAll(): void
```

Unselect all children of `box`, if the selection
mode allows it.

### `unselectChild`

```ts
unselectChild(child: Gtk.FlowBoxChild): void
```

Unselects a single child of `box`, if the selection
mode allows it.

**Parameters**

- `child`: a child of `box`
