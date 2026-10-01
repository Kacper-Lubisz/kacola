---
description: "A list model that concatenates other list models."
---

# GtkFlattenListModel

A list model that concatenates other list models.

`GtkFlattenListModel` takes a list model containing list models, and flattens
it into a single model. Each list model becomes a section in the single model.

```tsx
import { GtkFlattenListModel } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkFlattenListModel**

Implements `GListModel`, `GtkSectionModel`.

## Props

`ref` receives the `Gtk.FlattenListModel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items. See `Gio.ListModel.getItemType()`.

_Available since 4.8._

### `model`

`Gio.ListModel | ReactElement`

The model being flattened.

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.8._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.FlattenListModel) => void
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
(position: number, nItems: number, self: Gtk.FlattenListModel) => void
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

## Methods

Methods are called on the `Gtk.FlattenListModel` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getModel`

```ts
getModel(): Gio.ListModel | null
```

Gets the model set via `gtk_flatten_list_model_set_model()`.

**Returns** The model flattened by `self`

### `getModelForItem`

```ts
getModelForItem(position: number): Gio.ListModel | null
```

Returns the model containing the item at the given position.

**Parameters**

- `position`: a position

**Returns** the model containing the item at `position`

### `setModel`

```ts
setModel(model: Gio.ListModel | null): void
```

Sets a new model to be flattened.

**Parameters**

- `model`: the new model
