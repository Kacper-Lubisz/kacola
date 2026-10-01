---
description: "A list model that presents the selection from a GtkSelectionModel."
---

# GtkSelectionFilterModel

A list model that presents the selection from a `GtkSelectionModel`.

```tsx
import { GtkSelectionFilterModel } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSelectionFilterModel**

Implements `GListModel`.

## Props

`ref` receives the `Gtk.SelectionFilterModel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items. See `Gio.ListModel.getItemType()`.

_Available since 4.8._

### `model`

`Gtk.SelectionModel | ReactElement`

The model being filtered.

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.8._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.SelectionFilterModel) => void
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

Methods are called on the `Gtk.SelectionFilterModel` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getModel`

```ts
getModel(): Gtk.SelectionModel | null
```

Gets the model currently filtered or `null` if none.

**Returns** The model that gets filtered

### `setModel`

```ts
setModel(model: Gtk.SelectionModel | null): void
```

Sets the model to be filtered.

Note that GTK makes no effort to ensure that `model` conforms to
the item type of `self`. It assumes that the caller knows what they
are doing and have set up an appropriate filter to ensure that item
types match.

**Parameters**

- `model`: The model to be filtered
