---
description: "Base class for filters that combine multiple filters."
---

# GtkMultiFilter

Base class for filters that combine multiple filters.

```tsx
import { GtkMultiFilter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkFilter](.gtkx/reference/gtk/filter.md) → **GtkMultiFilter**

Implements `GListModel`, `GtkBuildable`.

## Props

`ref` receives the `Gtk.MultiFilter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items.

See `Gio.ListModel.getItemType()`.

_Available since 4.8._

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items.

See `Gio.ListModel.getNItems()`.

_Available since 4.8._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.MultiFilter) => void
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

Methods are called on the `Gtk.MultiFilter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(filter: Gtk.Filter): void
```

Adds a filter.

**Parameters**

- `filter`: a filter to add

### `remove`

```ts
remove(position: number): void
```

Removes a filter.

If `position` is larger than the number of filters,
nothing happens.

**Parameters**

- `position`: position of filter to remove
