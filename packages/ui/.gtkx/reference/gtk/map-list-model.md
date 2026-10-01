---
description: "A list model that maps the items in another model to different items."
---

# GtkMapListModel

A list model that maps the items in another model to different items.

`GtkMapListModel` uses a `Gtk.MapListModelMapFunc`.

Example: Create a list of `GtkEventControllers`
```c
static gpointer
map_to_controllers (gpointer widget,
                    gpointer data)
{
  gpointer result = gtk_widget_observe_controllers (widget);
  g_object_unref (widget);
  return result;
}

widgets = gtk_widget_observe_children (widget);

controllers = gtk_map_list_model_new (widgets,
                                      map_to_controllers,
                                      NULL, NULL);

model = gtk_flatten_list_model_new (GTK_TYPE_EVENT_CONTROLLER,
                                    controllers);
```

`GtkMapListModel` will attempt to discard the mapped objects as soon as
they are no longer needed and recreate them if necessary.

`GtkMapListModel` passes through sections from the underlying model.

```tsx
import { GtkMapListModel } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkMapListModel**

Implements `GListModel`, `GtkSectionModel`.

## Props

`ref` receives the `Gtk.MapListModel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `hasMap`

`boolean` · default `false` · read-only, observe with `onNotifyHasMap`

If a map is set for this model

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items. See `Gio.ListModel.getItemType()`.

_Available since 4.8._

### `model`

`Gio.ListModel | ReactElement`

The model being mapped.

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.8._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.MapListModel) => void
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
(position: number, nItems: number, self: Gtk.MapListModel) => void
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

Methods are called on the `Gtk.MapListModel` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getModel`

```ts
getModel(): Gio.ListModel | null
```

Gets the model that is currently being mapped or `null` if none.

**Returns** The model that gets mapped

### `hasMap`

```ts
hasMap(): boolean
```

Checks if a map function is currently set on `self`.

**Returns** `true` if a map function is set

### `setMapFunc`

```ts
setMapFunc(mapFunc: Gtk.MapListModelMapFunc | null): void
```

Sets the function used to map items.

The function will be called whenever an item needs to be mapped
and must return the item to use for the given input item.

Note that `GtkMapListModel` may call this function multiple times
on the same item, because it may delete items it doesn't need anymore.

GTK makes no effort to ensure that `map_func` conforms to the item type
of `self`. It assumes that the caller knows what they are doing and the map
function returns items of the appropriate type.

**Parameters**

- `mapFunc`: map function

### `setModel`

```ts
setModel(model: Gio.ListModel | null): void
```

Sets the model to be mapped.

GTK makes no effort to ensure that `model` conforms to the item type
expected by the map function. It assumes that the caller knows what
they are doing and have set up an appropriate map function.

**Parameters**

- `model`: The model to be mapped
