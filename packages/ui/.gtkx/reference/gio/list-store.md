---
description: "GListStore is a simple implementation of Gio.ListModel that stores all items in memory."
---

# GListStore

`GListStore` is a simple implementation of `Gio.ListModel` that stores
all items in memory.

It provides insertions, deletions, and lookups in logarithmic time
with a fast path for the common case of iterating the list linearly.

```tsx
import { GListStore } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GListStore**

Implements `GListModel`.

## Props

`ref` receives the `Gio.ListStore` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `itemType`

`GObject.Type` · construct-only

The type of items contained in this list store. Items must be
subclasses of `GObject`.

_Available since 2.44._

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items contained in this list store.

_Available since 2.74._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gio.ListStore) => void
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

Methods are called on the `Gio.ListStore` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(item: GObject.Object): void
```

Appends `item` to `store`. `item` must be of type `GListStore.itemType`.

This function takes a ref on `item`.

Use `g_list_store_splice()` to append multiple items at the same time
efficiently.

**Parameters**

- `item`: the new item

_Available since 2.44._

### `find`

```ts
find(item: GObject.Object): [boolean, number]
```

Looks up the given `item` in the list store by looping over the items until
the first occurrence of `item`. If `item` was not found, then `position` will
not be set, and this method will return `false`.

If you need to compare the two items with a custom comparison function, use
`g_list_store_find_with_equal_func()` with a custom `GEqualFunc` instead.

**Parameters**

- `item`: an item

**Returns** Tuple of:

- `result`: Whether `store` contains `item`. If it was found, `position` will be set to the position where `item` occurred for the first time.
- `position`: the first position of `item`, if it was found.

_Available since 2.64._

### `findWithEqualFunc`

```ts
findWithEqualFunc(item: GObject.Object | null, equalFunc: (a: GObject.Object | null, b: GObject.Object | null) => boolean): [boolean, number]
```

Looks up the given `item` in the list store by looping over the items and
comparing them with `equal_func` until the first occurrence of `item` which
matches. If `item` was not found, then `position` will not be set, and this
method will return `false`.

`item` is always passed as second parameter to `equal_func`.

Since GLib 2.76 it is possible to pass `NULL` for `item`.

**Parameters**

- `item`: an item
- `equalFunc`: A custom equality check function

**Returns** Tuple of:

- `result`: Whether `store` contains `item`. If it was found, `position` will be set to the position where `item` occurred for the first time.
- `position`: the first position of `item`, if it was found.

_Available since 2.64._

### `findWithEqualFuncFull`

```ts
findWithEqualFuncFull(item: GObject.Object | null, equalFunc: (a: GObject.Object | null, b: GObject.Object | null) => boolean): [boolean, number]
```

Like `g_list_store_find_with_equal_func()` but with an additional `user_data`
that is passed to `equal_func`.

`item` is always passed as second parameter to `equal_func`.

Since GLib 2.76 it is possible to pass `NULL` for `item`.

**Parameters**

- `item`: an item
- `equalFunc`: A custom equality check function

**Returns** Tuple of:

- `result`: Whether `store` contains `item`. If it was found, `position` will be set to the position where `item` occurred for the first time.
- `position`: the first position of `item`, if it was found.

_Available since 2.74._

### `insert`

```ts
insert(position: number, item: GObject.Object): void
```

Inserts `item` into `store` at `position`. `item` must be of type
`GListStore.itemType` or derived from it. `position` must be smaller
than the length of the list, or equal to it to append.

This function takes a ref on `item`.

Use `g_list_store_splice()` to insert multiple items at the same time
efficiently.

**Parameters**

- `position`: the position at which to insert the new item
- `item`: the new item

_Available since 2.44._

### `insertSorted`

```ts
insertSorted(item: GObject.Object, compareFunc: (a: GObject.Object | null, b: GObject.Object | null) => number): number
```

Inserts `item` into `store` at a position to be determined by the
`compare_func`.

The list must already be sorted before calling this function or the
result is undefined.  Usually you would approach this by only ever
inserting items by way of this function.

This function takes a ref on `item`.

**Parameters**

- `item`: the new item
- `compareFunc`: pairwise comparison function for sorting

**Returns** the position at which `item` was inserted

_Available since 2.44._

### `remove`

```ts
remove(position: number): void
```

Removes the item from `store` that is at `position`. `position` must be
smaller than the current length of the list.

Use `g_list_store_splice()` to remove multiple items at the same time
efficiently.

**Parameters**

- `position`: the position of the item that is to be removed

_Available since 2.44._

### `removeAll`

```ts
removeAll(): void
```

Removes all items from `store`.

_Available since 2.44._

### `sort`

```ts
sort(compareFunc: (a: GObject.Object | null, b: GObject.Object | null) => number): void
```

Sort the items in `store` according to `compare_func`.

**Parameters**

- `compareFunc`: pairwise comparison function for sorting

_Available since 2.46._

### `splice`

```ts
splice(position: number, nRemovals: number, additions: GObject.Object[]): void
```

Changes `store` by removing `n_removals` items and adding `n_additions`
items to it. `additions` must contain `n_additions` items of type
`GListStore.itemType`.  `null` is not permitted.

This function is more efficient than `g_list_store_insert()` and
`g_list_store_remove()`, because it only emits
`GListModel.items-changed` once for the change.

This function takes a ref on each item in `additions`.

The parameters `position` and `n_removals` must be correct (ie:
`position` + `n_removals` must be less than or equal to the length of
the list at the time this function is called).

**Parameters**

- `position`: the position at which to make the change
- `nRemovals`: the number of items to remove
- `additions`: the items to add

_Available since 2.44._
