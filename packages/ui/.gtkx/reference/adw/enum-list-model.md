---
description: "A Gio.ListModel representing values of a given enum."
---

# AdwEnumListModel

A `Gio.ListModel` representing values of a given enum.

`AdwEnumListModel` contains objects of type `EnumListItem`.

```tsx
import { AdwEnumListModel } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwEnumListModel**

Implements `GListModel`.

## Props

`ref` receives the `Adw.EnumListModel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `enumType`

`GObject.Type` · construct-only

The type of the enum represented by the model.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of the items. See `Gio.ListModel.getItemType()`.

_Available since 1.9._

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 1.9._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Adw.EnumListModel) => void
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

Methods are called on the `Adw.EnumListModel` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `findPosition`

```ts
findPosition(value: number): number
```

Finds the position of a given enum value in `self`.

If the value is not found, `Gtk.INVALID_LIST_POSITION` is returned.

**Parameters**

- `value`: an enum value

**Returns** the position of the value

### `getEnumType`

```ts
getEnumType(): bigint
```

Gets the type of the enum represented by `self`.

**Returns** the enum type
