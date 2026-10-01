---
description: "A list model that sorts the elements of another model."
---

# GtkSortListModel

A list model that sorts the elements of another model.

The elements are sorted according to a `GtkSorter`.

The model is a stable sort. If two items compare equal according
to the sorter, the one that appears first in the original model will
also appear first after sorting.

Note that if you change the sorter, the previous order will have no
influence on the new order. If you want that, consider using a
`GtkMultiSorter` and appending the previous sorter to it.

The model can be set up to do incremental sorting, so that
sorting long lists doesn't block the UI. See
`Gtk.SortListModel.setIncremental()` for details.

`GtkSortListModel` is a generic model and because of that it
cannot take advantage of any external knowledge when sorting.
If you run into performance issues with `GtkSortListModel`,
it is strongly recommended that you write your own sorting list
model.

`GtkSortListModel` allows sorting the items into sections. It
implements `GtkSectionModel` and when `Gtk.SortListModel.sectionSorter`
is set, it will sort all items with that sorter and items comparing
equal with it will be put into the same section.
The `Gtk.SortListModel.sorter` will then be used to sort items
inside their sections.

```tsx
import { GtkSortListModel } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSortListModel**

Implements `GListModel`, `GtkSectionModel`.

## Props

`ref` receives the `Gtk.SortListModel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `incremental`

`boolean` · default `false`

If the model should sort items incrementally.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items. See `Gio.ListModel.getItemType()`.

_Available since 4.8._

### `model`

`Gio.ListModel | ReactElement`

The model being sorted.

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.8._

### `pending`

`number` · default `0` · read-only, observe with `onNotifyPending`

Estimate of unsorted items remaining.

### `sectionSorter`

`Gtk.Sorter | ReactElement`

The section sorter for this model, if one is set.

_Available since 4.12._

### `sorter`

`Gtk.Sorter | ReactElement`

The sorter for this model.

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.SortListModel) => void
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
(position: number, nItems: number, self: Gtk.SortListModel) => void
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

Methods are called on the `Gtk.SortListModel` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getIncremental`

```ts
getIncremental(): boolean
```

Returns whether incremental sorting is enabled.

See `Gtk.SortListModel.setIncremental()`.

**Returns** `true` if incremental sorting is enabled

### `getModel`

```ts
getModel(): Gio.ListModel | null
```

Gets the model currently sorted or `null` if none.

**Returns** The model that gets sorted

### `getPending`

```ts
getPending(): number
```

Estimates progress of an ongoing sorting operation.

The estimate is the number of items that would still need to be
sorted to finish the sorting operation if this was a linear
algorithm. So this number is not related to how many items are
already correctly sorted.

If you want to estimate the progress, you can use code like this:
```c
pending = gtk_sort_list_model_get_pending (self);
model = gtk_sort_list_model_get_model (self);
progress = 1.0 - pending / (double) MAX (1, g_list_model_get_n_items (model));
```

If no sort operation is ongoing - in particular when
`Gtk.SortListModel.incremental` is `false` - this
function returns 0.

**Returns** a progress estimate of remaining items to sort

### `getSectionSorter`

```ts
getSectionSorter(): Gtk.Sorter | null
```

Gets the section sorter that is used to sort items of `self` into
sections.

**Returns** the sorter of `self`

_Available since 4.12._

### `getSorter`

```ts
getSorter(): Gtk.Sorter | null
```

Gets the sorter that is used to sort `self`.

**Returns** the sorter of `self`

### `setIncremental`

```ts
setIncremental(incremental: boolean): void
```

Sets the sort model to do an incremental sort.

When incremental sorting is enabled, the `GtkSortListModel` will not do
a complete sort immediately, but will instead queue an idle handler that
incrementally sorts the items towards their correct position. This of
course means that items do not instantly appear in the right place. It
also means that the total sorting time is a lot slower.

When your filter blocks the UI while sorting, you might consider
turning this on. Depending on your model and sorters, this may become
interesting around 10,000 to 100,000 items.

By default, incremental sorting is disabled.

See `Gtk.SortListModel.getPending()` for progress information
about an ongoing incremental sorting operation.

**Parameters**

- `incremental`: `true` to sort incrementally

### `setModel`

```ts
setModel(model: Gio.ListModel | null): void
```

Sets the model to be sorted.

The `model`'s item type must conform to the item type of `self`.

**Parameters**

- `model`: The model to be sorted

### `setSectionSorter`

```ts
setSectionSorter(sorter: Gtk.Sorter | null): void
```

Sets a new section sorter on `self`.

**Parameters**

- `sorter`: the `GtkSorter` to sort `model` with

_Available since 4.12._

### `setSorter`

```ts
setSorter(sorter: Gtk.Sorter | null): void
```

Sets a new sorter on `self`.

**Parameters**

- `sorter`: the `GtkSorter` to sort `model` with
