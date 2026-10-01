---
description: "Presents a large dynamic grid of items."
---

# GtkGridView

Presents a large dynamic grid of items.

`GtkGridView` uses its factory to generate one child widget for each
visible item and shows them in a grid. The orientation of the grid view
determines if the grid reflows vertically or horizontally.

`GtkGridView` allows the user to select items according to the selection
characteristics of the model. For models that allow multiple selected items,
it is possible to turn on _rubberband selection_, using
`Gtk.GridView.enableRubberband`.

To learn more about the list widget framework, see the
[overview](section-list-widget.html).

## Actions

`GtkGridView` defines a set of built-in actions:

- `list.activate-item` activates the item at given position by emitting the
  the `Gtk.GridView.activate` signal.

## CSS nodes

```
gridview
├── child[.activatable]
│
├── child[.activatable]
│
┊
╰── [rubberband]
```

`GtkGridView` uses a single CSS node with name `gridview`. Each child uses
a single CSS node with name `child`. If the `Gtk.ListItem.activatable`
property is set, the corresponding row will have the `.activatable` style
class. For rubberband selection, a subnode with name `rubberband` is used.

## Accessibility

`GtkGridView` uses the `Gtk.AccessibleRole.grid` role, and the items
use the `Gtk.AccessibleRole.grid_cell` role.

```tsx
import { GtkGridView } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkListBase](.gtkx/reference/gtk/list-base.md) → **GtkGridView**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`, `GtkScrollable`.

## Props

`ref` receives the `Gtk.GridView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `enableRubberband`

`boolean` · default `false`

Allow rubberband selection.

### `factory`

`Gtk.ListItemFactory | ReactElement`

Factory for populating list items.

The factory must be for configuring `Gtk.ListItem` objects.

### `maxColumns`

`number` · default `7`

Maximum number of columns per row.

If this number is smaller than `Gtk.GridView.minColumns`,
that value is used instead.

### `minColumns`

`number` · default `1`

Minimum number of columns per row.

### `model`

`Gtk.SelectionModel | ReactElement`

Model for the items displayed.

### `singleClickActivate`

`boolean` · default `false`

Activate rows on single click and select them on hover.

### `tabBehavior`

`Gtk.ListTabBehavior` · default `GTK_LIST_TAB_ALL`

Behavior of the <kbd>Tab</kbd> key

_Available since 4.12._

## Signals

### `onActivate`

```ts
(position: number, self: Gtk.GridView) => void
```

Emitted when a cell has been activated by the user,
usually via activating the GtkGridView|list.activate-item action.

This allows for a convenient way to handle activation in a gridview.
See `Gtk.ListItem.activatable` for details on how to use
this signal.

**Parameters**

- `position`: position of item to activate
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.GridView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getEnableRubberband`

```ts
getEnableRubberband(): boolean
```

Returns whether rows can be selected by dragging with the mouse.

**Returns** `true` if rubberband selection is enabled

### `getFactory`

```ts
getFactory(): Gtk.ListItemFactory | null
```

Gets the factory that's currently used to populate list items.

**Returns** The factory in use

### `getMaxColumns`

```ts
getMaxColumns(): number
```

Gets the maximum number of columns that the grid will use.

**Returns** The maximum number of columns

### `getMinColumns`

```ts
getMinColumns(): number
```

Gets the minimum number of columns that the grid will use.

**Returns** The minimum number of columns

### `getModel`

```ts
getModel(): Gtk.SelectionModel | null
```

Gets the model that's currently used to read the items displayed.

**Returns** The model in use

### `getSingleClickActivate`

```ts
getSingleClickActivate(): boolean
```

Returns whether items will be activated on single click and
selected on hover.

**Returns** `true` if items are activated on single click

### `getTabBehavior`

```ts
getTabBehavior(): Gtk.ListTabBehavior
```

Gets the behavior set for the <kbd>Tab</kbd> key.

**Returns** The behavior of the <kbd>Tab</kbd> key

_Available since 4.12._

### `scrollTo`

```ts
scrollTo(pos: number, flags: Gtk.ListScrollFlags, scroll: Gtk.ScrollInfo | null): void
```

Scrolls to the item at the given position and performs the actions
specified in `flags`.

This function works no matter if the gridview is shown or focused.
If it isn't, then the changes will take effect once that happens.

**Parameters**

- `pos`: position of the item. Must be less than the number of items in the view.
- `flags`: actions to perform
- `scroll`: details of how to perform the scroll operation or `null` to scroll into view

_Available since 4.12._

### `setEnableRubberband`

```ts
setEnableRubberband(enableRubberband: boolean): void
```

Sets whether selections can be changed by dragging with the mouse.

**Parameters**

- `enableRubberband`: `true` to enable rubberband selection

### `setFactory`

```ts
setFactory(factory: Gtk.ListItemFactory | null): void
```

Sets the `GtkListItemFactory` to use for populating list items.

**Parameters**

- `factory`: the factory to use

### `setMaxColumns`

```ts
setMaxColumns(maxColumns: number): void
```

Sets the maximum number of columns to use.

This number must be at least 1.

If `max_columns` is smaller than the minimum set via
`Gtk.GridView.setMinColumns()`, that value is used instead.

**Parameters**

- `maxColumns`: The maximum number of columns

### `setMinColumns`

```ts
setMinColumns(minColumns: number): void
```

Sets the minimum number of columns to use.

This number must be at least 1.

If `min_columns` is smaller than the minimum set via
`Gtk.GridView.setMaxColumns()`, that value is ignored.

**Parameters**

- `minColumns`: The minimum number of columns

### `setModel`

```ts
setModel(model: Gtk.SelectionModel | null): void
```

Sets the model to use.

This must be a `Gtk.SelectionModel`.

**Parameters**

- `model`: the model to use

### `setSingleClickActivate`

```ts
setSingleClickActivate(singleClickActivate: boolean): void
```

Sets whether items should be activated on single click and
selected on hover.

**Parameters**

- `singleClickActivate`: `true` to activate items on single click

### `setTabBehavior`

```ts
setTabBehavior(tabBehavior: Gtk.ListTabBehavior): void
```

Sets the behavior of the <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd> keys.

**Parameters**

- `tabBehavior`: The desired tab behavior

_Available since 4.12._
