---
description: "Used by list widgets to represent items in a Gio.ListModel."
---

# GtkListItem

Used by list widgets to represent items in a `Gio.ListModel`.

`GtkListItem` objects are managed by the list widget (with its factory)
and cannot be created by applications, but they need to be populated
by application code. This is done by calling `Gtk.ListItem.setChild()`.

`GtkListItem` objects exist in 2 stages:

1. The unbound stage where the listitem is not currently connected to
   an item in the list. In that case, the `Gtk.ListItem.item`
   property is set to `NULL`.

2. The bound stage where the listitem references an item from the list.
   The `Gtk.ListItem.item` property is not `NULL`.

```tsx
import { GtkListItem } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkListItem**

## Props

`ref` receives the `Gtk.ListItem` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accessibleDescription`

`string` · default `null`

The accessible description to set on the listitem.

_Available since 4.12._

### `accessibleLabel`

`string` · default `null`

The accessible label to set on the listitem.

_Available since 4.12._

### `activatable`

`boolean` · default `true`

If the item can be activated by the user.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `focusable`

`boolean` · default `true`

If the item can be focused with the keyboard.

_Available since 4.12._

### `item`

`GObject.Object` · read-only, observe with `onNotifyItem`

Displayed item.

### `position`

`number` · default `4294967295` · read-only, observe with `onNotifyPosition`

Position of the item.

### `selectable`

`boolean` · default `true`

If the item can be selected by the user.

### `selected`

`boolean` · default `false` · read-only, observe with `onNotifySelected`

If the item is currently selected.

## Methods

Methods are called on the `Gtk.ListItem` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAccessibleDescription`

```ts
getAccessibleDescription(): string
```

Gets the accessible description of `self`.

**Returns** the accessible description

_Available since 4.12._

### `getAccessibleLabel`

```ts
getAccessibleLabel(): string
```

Gets the accessible label of `self`.

**Returns** the accessible label

_Available since 4.12._

### `getActivatable`

```ts
getActivatable(): boolean
```

Checks if a listitem has been set to be activatable via
`Gtk.ListItem.setActivatable()`.

**Returns** true if the item is activatable

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child previously set via `Gtk.ListItem.setChild()`
or `NULL` if none was set.

**Returns** The child

### `getFocusable`

```ts
getFocusable(): boolean
```

Checks if a listitem has been set to be focusable via
`Gtk.ListItem.setFocusable()`.

**Returns** true if the item is focusable

_Available since 4.12._

### `getItem`

```ts
getItem(): GObject.Object | null
```

Gets the model item that associated with `self`.

If `self` is unbound, this function returns `NULL`.

**Returns** The item displayed

### `getPosition`

```ts
getPosition(): number
```

Gets the position in the model that `self` currently displays.

If `self` is unbound, `GTK_INVALID_LIST_POSITION` is returned.

**Returns** The position of this item

### `getSelectable`

```ts
getSelectable(): boolean
```

Checks if a listitem has been set to be selectable via
`Gtk.ListItem.setSelectable()`.

Do not confuse this function with `Gtk.ListItem.getSelected()`.

**Returns** true if the item is selectable

### `getSelected`

```ts
getSelected(): boolean
```

Checks if the item is displayed as selected.

The selected state is maintained by the list widget and its model
and cannot be set otherwise.

**Returns** true if the item is selected.

### `setAccessibleDescription`

```ts
setAccessibleDescription(description: string): void
```

Sets the accessible description for the listitem.

The accessible description may be used by e.g. screen readers.

**Parameters**

- `description`: the description

_Available since 4.12._

### `setAccessibleLabel`

```ts
setAccessibleLabel(label: string): void
```

Sets the accessible label for the listitem.

The accessible label may be used by e.g. screen readers.

**Parameters**

- `label`: the label

_Available since 4.12._

### `setActivatable`

```ts
setActivatable(activatable: boolean): void
```

Sets `self` to be activatable.

If an item is activatable, double-clicking on the item, using
the Return key or calling `Gtk.Widget.activate()` will activate
the item. Activating instructs the containing view to handle
activation. `GtkListView` for example will be emitting the
`Gtk.ListView.activate` signal.

By default, listitems are activatable.

**Parameters**

- `activatable`: if the item should be activatable

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child to be used for this listitem.

This function is typically called by applications when
setting up a listitem so that the widget can be reused when
binding it multiple times.

**Parameters**

- `child`: The listitem's child or `NULL` to unset

### `setFocusable`

```ts
setFocusable(focusable: boolean): void
```

Sets `self` to be focusable.

If an item is focusable, it can be focused using the keyboard.
This works similar to `Gtk.Widget.setFocusable()`.

Note that if items are not focusable, the keyboard cannot be used to activate
them and selecting only works if one of the listitem's children is focusable.

By default, listitems are focusable.

**Parameters**

- `focusable`: if the item should be focusable

_Available since 4.12._

### `setSelectable`

```ts
setSelectable(selectable: boolean): void
```

Sets `self` to be selectable.

If an item is selectable, clicking on the item or using the keyboard
will try to select or unselect the item. If this succeeds is up to
the model to determine, as it is managing the selected state.

Note that this means that making an item non-selectable has no
influence on the selected state at all. A non-selectable item
may still be selected.

By default, listitems are selectable. When rebinding them to
a new item, they will also be reset to be selectable by GTK.

**Parameters**

- `selectable`: if the item should be selectable
