---
description: "A list model that presents a slice of another model."
---

# GtkSliceListModel

A list model that presents a slice of another model.

This is useful when implementing paging by setting the size to the number
of elements per page and updating the offset whenever a different page is
opened.

`GtkSliceListModel` passes through sections from the underlying model.

```tsx
import { GtkSliceListModel } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSliceListModel**

Implements `GListModel`, `GtkSectionModel`.

## Props

`ref` receives the `Gtk.SliceListModel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items. See `Gio.ListModel.getItemType()`.

_Available since 4.8._

### `model`

`Gio.ListModel | ReactElement`

Child model to take slice from.

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.8._

### `offset`

`number` · default `0`

Offset of slice.

### `size`

`number` · default `10`

Maximum size of slice.

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.SliceListModel) => void
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
(position: number, nItems: number, self: Gtk.SliceListModel) => void
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

Methods are called on the `Gtk.SliceListModel` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getModel`

```ts
getModel(): Gio.ListModel | null
```

Gets the model that is currently being used or `null` if none.

**Returns** The model in use

### `getOffset`

```ts
getOffset(): number
```

Gets the offset set via `gtk_slice_list_model_set_offset()`.

**Returns** The offset

### `getSize`

```ts
getSize(): number
```

Gets the size set via `gtk_slice_list_model_set_size()`.

**Returns** The size

### `setModel`

```ts
setModel(model: Gio.ListModel | null): void
```

Sets the model to show a slice of.

The model's item type must conform to `self`'s item type.

**Parameters**

- `model`: The model to be sliced

### `setOffset`

```ts
setOffset(offset: number): void
```

Sets the offset into the original model for this slice.

If the offset is too large for the sliced model,
`self` will end up empty.

**Parameters**

- `offset`: the new offset to use

### `setSize`

```ts
setSize(size: number): void
```

Sets the maximum size. `self` will never have more items
than `size`.

It can however have fewer items if the offset is too large
or the model sliced from doesn't have enough items.

**Parameters**

- `size`: the maximum size
