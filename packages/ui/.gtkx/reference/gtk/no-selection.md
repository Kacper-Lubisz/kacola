---
description: "A selection model that does not allow selecting anything."
---

# GtkNoSelection

A selection model that does not allow selecting anything.

This model is meant to be used as a simple wrapper around a `GListModel`
when a `GtkSelectionModel` is required.

`GtkNoSelection` passes through sections from the underlying model.

```tsx
import { GtkNoSelection } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkNoSelection**

Implements `GListModel`, `GtkSectionModel`, `GtkSelectionModel`.

## Props

`ref` receives the `Gtk.NoSelection` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items. See `Gio.ListModel.getItemType()`.

_Available since 4.8._

### `model`

`Gio.ListModel | ReactElement`

The model being managed.

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.8._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.NoSelection) => void
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

### `onSectionsChanged`

```ts
(position: number, nItems: number, self: Gtk.NoSelection) => void
```

From `GtkSectionModel`.

Emitted when the start-of-section state of some of the items in `model` changes.

Note that this signal does not specify the new section state of the
items, they need to be queried manually. It is also not necessary for
a model to change the section state of any of the items in the section
model, though it would be rather useless to emit such a signal.

The `Gio.ListModel.items-changed` implies the effect of the
`Gtk.SectionModel.sections-changed` signal for all the items
it covers.

**Parameters**

- `position`: The first item that may have changed
- `nItems`: number of items with changes
- `self`: The instance the signal was emitted on.

_Available since 4.12._

### `onSelectionChanged`

```ts
(position: number, nItems: number, self: Gtk.NoSelection) => void
```

From `GtkSelectionModel`.

Emitted when the selection state of some of the items in `model` changes.

Note that this signal does not specify the new selection state of the
items, they need to be queried manually. It is also not necessary for
a model to change the selection state of any of the items in the selection
model, though it would be rather useless to emit such a signal.

**Parameters**

- `position`: The first item that may have changed
- `nItems`: number of items with changes
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.NoSelection` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getModel`

```ts
getModel(): Gio.ListModel | null
```

Gets the model that `self` is wrapping.

**Returns** The model being wrapped

### `setModel`

```ts
setModel(model: Gio.ListModel | null): void
```

Sets the model that `self` should wrap.

If `model` is `null`, this model will be empty.

**Parameters**

- `model`: A `GListModel` to wrap
