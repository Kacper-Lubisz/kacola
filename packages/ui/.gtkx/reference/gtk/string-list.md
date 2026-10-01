---
description: "A list model that wraps an array of strings."
---

# GtkStringList

A list model that wraps an array of strings.

The objects in the model are of type `Gtk.StringObject` and have
a "string" property that can be used inside expressions.

`GtkStringList` is well-suited for any place where you would
typically use a `char*[]`, but need a list model.

### GtkStringList as GtkBuildable

The `GtkStringList` implementation of the `GtkBuildable` interface
supports adding items directly using the `<items>` element and
specifying `<item>` elements for each item. Each `<item>` element
supports the regular translation attributes “translatable”,
“context” and “comments”.

Here is a UI definition fragment specifying a `GtkStringList`

```xml
<object class="GtkStringList">
  <items>
    <item translatable="yes">Factory</item>
    <item translatable="yes">Home</item>
    <item translatable="yes">Subway</item>
  </items>
</object>
```

```tsx
import { GtkStringList } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkStringList**

Implements `GListModel`, `GtkBuildable`.

## Props

`ref` receives the `Gtk.StringList` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items. See `Gio.ListModel.getItemType()`.

_Available since 4.14._

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.14._

### `strings`

`string[]` · construct-only

The strings in the model.

_Available since 4.10._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.StringList) => void
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

Methods are called on the `Gtk.StringList` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(string: string): void
```

Appends `string` to `self`.

The `string` will be copied. See
`Gtk.StringList.take()` for a way to avoid that.

**Parameters**

- `string`: the string to insert

### `find`

```ts
find(string: string): number
```

Gets the position of the `string` in `self`.

If `self` does not contain `string` item, `G_MAXUINT` is returned.

**Parameters**

- `string`: the string to find

**Returns** the position of the string

_Available since 4.18._

### `getString`

```ts
getString(position: number): string | null
```

Gets the string that is at `position` in `self`.

If `self` does not contain `position` items, `null` is returned.

This function returns the const char *. To get the
object wrapping it, use `g_list_model_get_item()`.

**Parameters**

- `position`: the position to get the string for

**Returns** the string at the given position

### `remove`

```ts
remove(position: number): void
```

Removes the string at `position` from `self`.

`position` must be smaller than the current
length of the list.

**Parameters**

- `position`: the position of the string that is to be removed

### `splice`

```ts
splice(position: number, nRemovals: number, additions: string[] | null): void
```

Changes `self` by removing `n_removals` strings and adding `additions`
to it.

This function is more efficient than `Gtk.StringList.append()`
and `Gtk.StringList.remove()`, because it only emits the
::items-changed signal once for the change.

This function copies the strings in `additions`.

The parameters `position` and `n_removals` must be correct (ie:
`position` + `n_removals` must be less than or equal to the length
of the list at the time this function is called).

**Parameters**

- `position`: the position at which to make the change
- `nRemovals`: the number of strings to remove
- `additions`: The strings to add

### `take`

```ts
take(string: string): void
```

Adds `string` to self at the end, and takes
ownership of it.

This variant of `Gtk.StringList.append()`
is convenient for formatting strings:

```c
gtk_string_list_take (self, g_strdup_print ("%d dollars", lots));
```

**Parameters**

- `string`: the string to insert
