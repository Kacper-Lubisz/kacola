---
description: "Combines multiple sorters by trying them in turn."
---

# GtkMultiSorter

Combines multiple sorters by trying them in turn.

If the first sorter compares two items as equal,
the second is tried next, and so on.

```tsx
import { GtkMultiSorter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkSorter](.gtkx/reference/gtk/sorter.md) → **GtkMultiSorter**

Implements `GListModel`, `GtkBuildable`.

## Props

`ref` receives the `Gtk.MultiSorter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items. See `Gio.ListModel.getItemType()`.

_Available since 4.8._

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.8._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.MultiSorter) => void
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

Methods are called on the `Gtk.MultiSorter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(sorter: Gtk.Sorter): void
```

Add `sorter` to `self` to use for sorting at the end.

`self` will consult all existing sorters before it will
sort with the given `sorter`.

**Parameters**

- `sorter`: a sorter to add

### `remove`

```ts
remove(position: number): void
```

Removes the sorter at the given `position` from the list of sorter
used by `self`.

If `position` is larger than the number of sorters, nothing happens.

**Parameters**

- `position`: position of sorter to remove
