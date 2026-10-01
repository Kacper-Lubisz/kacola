---
description: "Represents items in a cell in Gtk.ColumnView."
---

# GtkColumnViewCell

Represents items in a cell in `Gtk.ColumnView`.

The `GtkColumnViewCell`s are managed by the `Gtk.ColumnView`
widget (with its factory) and cannot be created by applications, but
they need to be populated by application code. This is done by calling
`Gtk.ColumnViewCell.setChild()`.

`GtkColumnViewCell`s exist in 2 stages:

1. The unbound stage where the listitem is not currently connected to
   an item in the list. In that case, the `Gtk.ColumnViewCell.item`
   property is set to `null`.

2. The bound stage where the listitem references an item from the list.
   The `Gtk.ColumnViewCell.item` property is not `null`.

_Available since 4.12._

```tsx
import { GtkColumnViewCell } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkListItem](.gtkx/reference/gtk/list-item.md) → **GtkColumnViewCell**

## Props

`ref` receives the `Gtk.ColumnViewCell` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `child`

`Gtk.Widget | ReactElement`

Widget used for display.

_Available since 4.12._

### `focusable`

`boolean` · default `false`

If the item can be focused with the keyboard.

_Available since 4.12._

### `item`

`GObject.Object` · read-only, observe with `onNotifyItem`

Displayed item.

_Available since 4.12._

### `position`

`number` · default `4294967295` · read-only, observe with `onNotifyPosition`

Position of the item.

_Available since 4.12._

### `selected`

`boolean` · default `false` · read-only, observe with `onNotifySelected`

If the item is currently selected.

_Available since 4.12._

## Methods

Methods are called on the `Gtk.ColumnViewCell` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child previously set via `gtk_column_view_cell_set_child()` or
`null` if none was set.

**Returns** The child

_Available since 4.12._

### `getFocusable`

```ts
getFocusable(): boolean
```

Checks if a list item has been set to be focusable via
`gtk_column_view_cell_set_focusable()`.

**Returns** `true` if the item is focusable

_Available since 4.12._

### `getItem`

```ts
getItem(): GObject.Object | null
```

Gets the model item that associated with `self`.

If `self` is unbound, this function returns `null`.

**Returns** The item displayed

_Available since 4.12._

### `getPosition`

```ts
getPosition(): number
```

Gets the position in the model that `self` currently displays.

If `self` is unbound, `GTK_INVALID_LIST_POSITION` is returned.

**Returns** The position of this item

_Available since 4.12._

### `getSelected`

```ts
getSelected(): boolean
```

Checks if the item is displayed as selected.

The selected state is maintained by the list widget and its model
and cannot be set otherwise.

**Returns** `true` if the item is selected.

_Available since 4.12._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child to be used for this listitem.

This function is typically called by applications when
setting up a listitem so that the widget can be reused when
binding it multiple times.

**Parameters**

- `child`: The list item's child or `null` to unset

_Available since 4.12._

### `setFocusable`

```ts
setFocusable(focusable: boolean): void
```

Sets `self` to be focusable.

If an item is focusable, it can be focused using the keyboard.
This works similar to `Gtk.Widget.setFocusable()`.

Note that if items are not focusable, the keyboard cannot be used to activate
them and selecting only works if one of the listitem's children is focusable.

By default, list items are focusable.

**Parameters**

- `focusable`: if the item should be focusable

_Available since 4.12._
