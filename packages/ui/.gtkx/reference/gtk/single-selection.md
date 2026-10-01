---
description: "A selection model that allows selecting a single item."
---

# GtkSingleSelection

A selection model that allows selecting a single item.

Note that the selection is *persistent* -- if the selected item is removed
and re-added in the same `Gio.ListModel.items-changed` emission, it
stays selected. In particular, this means that changing the sort order of an
underlying sort model will preserve the selection.

```tsx
import { GtkSingleSelection } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSingleSelection**

Implements `GListModel`, `GtkSectionModel`, `GtkSelectionModel`.

## Props

`ref` receives the `Gtk.SingleSelection` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `autoselect`

`boolean` · default `true`

If the selection will always select an item.

### `canUnselect`

`boolean` · default `false`

If unselecting the selected item is allowed.

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

### `selected`

`number` · default `4294967295`

Position of the selected item.

### `selectedItem`

`GObject.Object` · read-only, observe with `onNotifySelectedItem`

The selected item.

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.SingleSelection) => void
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
(position: number, nItems: number, self: Gtk.SingleSelection) => void
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
(position: number, nItems: number, self: Gtk.SingleSelection) => void
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

Methods are called on the `Gtk.SingleSelection` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAutoselect`

```ts
getAutoselect(): boolean
```

Checks if autoselect has been enabled or disabled via
`gtk_single_selection_set_autoselect()`.

**Returns** `true` if autoselect is enabled

### `getCanUnselect`

```ts
getCanUnselect(): boolean
```

If `true`, `gtk_selection_model_unselect_item()` is supported and allows
unselecting the selected item.

**Returns** `true` to support unselecting

### `getModel`

```ts
getModel(): Gio.ListModel | null
```

Gets the model that `self` is wrapping.

**Returns** The model being wrapped

### `getSelected`

```ts
getSelected(): number
```

Gets the position of the selected item.

If no item is selected, `GTK_INVALID_LIST_POSITION` is returned.

**Returns** The position of the selected item

### `getSelectedItem`

```ts
getSelectedItem(): GObject.Object | null
```

Gets the selected item.

If no item is selected, `null` is returned.

**Returns** The selected item

### `setAutoselect`

```ts
setAutoselect(autoselect: boolean): void
```

Enables or disables autoselect.

If `autoselect` is `true`, `self` will enforce that an item is always
selected. It will select a new item when the currently selected
item is deleted and it will disallow unselecting the current item.

**Parameters**

- `autoselect`: `true` to always select an item

### `setCanUnselect`

```ts
setCanUnselect(canUnselect: boolean): void
```

If `true`, unselecting the current item via
`gtk_selection_model_unselect_item()` is supported.

Note that setting `Gtk.SingleSelection.autoselect` will
cause unselecting to not work, so it practically makes no sense
to set both at the same time.

**Parameters**

- `canUnselect`: `true` to allow unselecting

### `setModel`

```ts
setModel(model: Gio.ListModel | null): void
```

Sets the model that `self` should wrap.

If `model` is `null`, `self` will be empty.

**Parameters**

- `model`: A `GListModel` to wrap

### `setSelected`

```ts
setSelected(position: number): void
```

Selects the item at the given position.

If the list does not have an item at `position` or
`GTK_INVALID_LIST_POSITION` is given, the behavior depends on the
value of the `Gtk.SingleSelection.autoselect` property:
If it is set, no change will occur and the old item will stay
selected. If it is unset, the selection will be unset and no item
will be selected. This also applies if `Gtk.SingleSelection.canUnselect`
is set to `false`.

**Parameters**

- `position`: the item to select or `GTK_INVALID_LIST_POSITION`
