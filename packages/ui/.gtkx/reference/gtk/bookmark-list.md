---
description: "A list model that wraps GBookmarkFile."
---

# GtkBookmarkList

A list model that wraps `GBookmarkFile`.

It presents a `GListModel` and fills it asynchronously with the
`GFileInfo`s returned from that function.

The `GFileInfo`s in the list have some attributes in the recent
namespace added: `recent::private` (boolean) and `recent:applications`
(stringv).

```tsx
import { GtkBookmarkList } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkBookmarkList**

Implements `GListModel`.

## Props

`ref` receives the `Gtk.BookmarkList` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `attributes`

`string` · default `null`

The attributes to query.

### `filename`

`string` · default `null` · construct-only

The bookmark file to load.

### `ioPriority`

`number` · default `0`

Priority used when loading.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items. See `Gio.ListModel.getItemType()`.

_Available since 4.8._

### `loading`

`boolean` · default `false` · read-only, observe with `onNotifyLoading`

`true` if files are being loaded.

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.8._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.BookmarkList) => void
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

Methods are called on the `Gtk.BookmarkList` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAttributes`

```ts
getAttributes(): string | null
```

Gets the attributes queried on the children.

**Returns** The queried attributes

### `getFilename`

```ts
getFilename(): string
```

Returns the filename of the bookmark file that
this list is loading.

**Returns** the filename of the .xbel file

### `getIoPriority`

```ts
getIoPriority(): number
```

Gets the IO priority to use while loading file.

**Returns** The IO priority.

### `isLoading`

```ts
isLoading(): boolean
```

Returns `true` if the files are currently being loaded.

Files will be added to `self` from time to time while loading is
going on. The order in which are added is undefined and may change
in between runs.

**Returns** `true` if `self` is loading

### `setAttributes`

```ts
setAttributes(attributes: string | null): void
```

Sets the `attributes` to be enumerated and starts the enumeration.

If `attributes` is `null`, no attributes will be queried, but a list
of `GFileInfo`s will still be created.

**Parameters**

- `attributes`: the attributes to enumerate

### `setIoPriority`

```ts
setIoPriority(ioPriority: number): void
```

Sets the IO priority to use while loading files.

The default IO priority is `G_PRIORITY_DEFAULT`.

**Parameters**

- `ioPriority`: IO priority to use
