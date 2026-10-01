---
description: "A list model that can create child models on demand."
---

# GtkTreeListModel

A list model that can create child models on demand.

```tsx
import { GtkTreeListModel } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkTreeListModel**

Implements `GListModel`.

## Props

`ref` receives the `Gtk.TreeListModel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `autoexpand`

`boolean` · default `false`

If all rows should be expanded by default.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items. See `Gio.ListModel.getItemType()`.

_Available since 4.8._

### `model`

`Gio.ListModel` · read-only, observe with `onNotifyModel`

The root model displayed.

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.8._

### `passthrough`

`boolean` · default `false` · construct-only

Gets whether the model is in passthrough mode.

If `false`, the `GListModel` functions for this object return custom
`Gtk.TreeListRow` objects. If `true`, the values of the child
models are pass through unmodified.

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.TreeListModel) => void
```

From `GListModel`.

This signal is emitted whenever items were added to or removed
from `list`. At `position`, `removed` items were removed and `added`
items were added in their place.

Note: If `removed != added`, the positions of all later items
in the model change.

**Parameters**

- `position`: the position at which `list` changed
- `removed`: the number of items removed
- `added`: the number of items added
- `self`: The instance the signal was emitted on.

_Available since 2.44._

## Methods

Methods are called on the `Gtk.TreeListModel` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAutoexpand`

```ts
getAutoexpand(): boolean
```

Gets whether the model is set to automatically expand new rows
that get added.

This can be either rows added by changes to the underlying
models or via `Gtk.TreeListRow.setExpanded()`.

**Returns** `true` if the model is set to autoexpand

### `getChildRow`

```ts
getChildRow(position: number): Gtk.TreeListRow | null
```

Gets the row item corresponding to the child at index `position` for
`self`'s root model.

If `position` is greater than the number of children in the root model,
`null` is returned.

Do not confuse this function with `Gtk.TreeListModel.getRow()`.

**Parameters**

- `position`: position of the child to get

**Returns** the child in `position`

### `getModel`

```ts
getModel(): Gio.ListModel
```

Gets the root model that `self` was created with.

**Returns** the root model

### `getPassthrough`

```ts
getPassthrough(): boolean
```

Gets whether the model is passing through original row items.

If this function returns `false`, the `GListModel` functions for `self`
return custom `GtkTreeListRow` objects. You need to call
`Gtk.TreeListRow.getItem()` on these objects to get the original
item.

If `true`, the values of the child models are passed through in their
original state. You then need to call `Gtk.TreeListModel.getRow()`
to get the custom `GtkTreeListRow`s.

**Returns** `true` if the model is passing through original row items

### `getRow`

```ts
getRow(position: number): Gtk.TreeListRow | null
```

Gets the row object for the given row.

If `position` is greater than the number of items in `self`,
`null` is returned.

The row object can be used to expand and collapse rows as
well as to inspect its position in the tree. See its
documentation for details.

This row object is persistent and will refer to the current
item as long as the row is present in `self`, independent of
other rows being added or removed.

If `self` is set to not be passthrough, this function is
equivalent to calling `g_list_model_get_item()`.

Do not confuse this function with `Gtk.TreeListModel.getChildRow()`.

**Parameters**

- `position`: the position of the row to fetch

**Returns** The row item

### `setAutoexpand`

```ts
setAutoexpand(autoexpand: boolean): void
```

Sets whether the model should autoexpand.

If set to `true`, the model will recursively expand all rows that
get added to the model. This can be either rows added by changes
to the underlying models or via `Gtk.TreeListRow.setExpanded()`.

**Parameters**

- `autoexpand`: `true` to make the model autoexpand its rows
