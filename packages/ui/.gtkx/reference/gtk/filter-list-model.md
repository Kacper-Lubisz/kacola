---
description: "A list model that filters the elements of another model."
---

# GtkFilterListModel

A list model that filters the elements of another model.

It hides some elements from the underlying model according to
criteria given by a `GtkFilter`.

The model can be set up to do incremental filtering, so that
filtering long lists doesn't block the UI. See
`Gtk.FilterListModel.setIncremental()` for details.

`GtkFilterListModel` passes through sections from the underlying model.

```tsx
import { GtkFilterListModel } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkFilterListModel**

Implements `GListModel`, `GtkSectionModel`.

## Props

`ref` receives the `Gtk.FilterListModel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `filter`

`Gtk.Filter | ReactElement`

The filter for this model.

### `incremental`

`boolean` · default `false`

If the model should filter items incrementally.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items. See `Gio.ListModel.getItemType()`.

_Available since 4.8._

### `model`

`Gio.ListModel | ReactElement`

The model being filtered.

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.8._

### `pending`

`number` · default `0` · read-only, observe with `onNotifyPending`

Number of items not yet filtered.

### `watchItems`

`boolean` · default `false`

Monitor the list items for changes. It may impact performance.

_Available since 4.20._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.FilterListModel) => void
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
(position: number, nItems: number, self: Gtk.FilterListModel) => void
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

Methods are called on the `Gtk.FilterListModel` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getFilter`

```ts
getFilter(): Gtk.Filter | null
```

Gets the `GtkFilter` currently set on `self`.

**Returns** The filter currently in use

### `getIncremental`

```ts
getIncremental(): boolean
```

Returns whether incremental filtering is enabled.

See `Gtk.FilterListModel.setIncremental()`.

**Returns** `true` if incremental filtering is enabled

### `getModel`

```ts
getModel(): Gio.ListModel | null
```

Gets the model currently filtered or `null` if none.

**Returns** The model that gets filtered

### `getPending`

```ts
getPending(): number
```

Returns the number of items that have not been filtered yet.

You can use this value to check if `self` is busy filtering by
comparing the return value to 0 or you can compute the percentage
of the filter remaining by dividing the return value by the total
number of items in the underlying model:

```c
pending = gtk_filter_list_model_get_pending (self);
model = gtk_filter_list_model_get_model (self);
percentage = pending / (double) g_list_model_get_n_items (model);
```

If no filter operation is ongoing - in particular when
`Gtk.FilterListModel.incremental` is `false` - this
function returns 0.

**Returns** The number of items not yet filtered

### `getWatchItems`

```ts
getWatchItems(): boolean
```

Returns whether watching items is enabled.

See `Gtk.FilterListModel.setWatchItems()`.

**Returns** `true` if watching items is enabled

_Available since 4.20._

### `setFilter`

```ts
setFilter(filter: Gtk.Filter | null): void
```

Sets the filter used to filter items.

**Parameters**

- `filter`: filter to use

### `setIncremental`

```ts
setIncremental(incremental: boolean): void
```

Sets the filter model to do an incremental sort.

When incremental filtering is enabled, the `GtkFilterListModel` will not
run filters immediately, but will instead queue an idle handler that
incrementally filters the items and adds them to the list. This of course
means that items are not instantly added to the list, but only appear
incrementally.

When your filter blocks the UI while filtering, you might consider
turning this on. Depending on your model and filters, this may become
interesting around 10,000 to 100,000 items.

By default, incremental filtering is disabled.

See `Gtk.FilterListModel.getPending()` for progress information
about an ongoing incremental filtering operation.

**Parameters**

- `incremental`: `true` to enable incremental filtering

### `setModel`

```ts
setModel(model: Gio.ListModel | null): void
```

Sets the model to be filtered.

Note that GTK makes no effort to ensure that `model` conforms to
the item type of `self`. It assumes that the caller knows what they
are doing and have set up an appropriate filter to ensure that item
types match.

**Parameters**

- `model`: The model to be filtered

### `setWatchItems`

```ts
setWatchItems(watchItems: boolean): void
```

Sets the filter model to monitor properties of its items.

This allows implementations of `Gtk.Filter` that support expression
watching to react to property changes. This property has no effect if the
current filter doesn't support watching items.

By default, watching items is disabled.

**Parameters**

- `watchItems`: `true` to watch items for property changes

_Available since 4.20._
