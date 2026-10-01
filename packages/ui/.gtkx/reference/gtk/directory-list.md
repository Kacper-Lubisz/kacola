---
description: "A list model that wraps Gio.File.enumerateChildrenAsync()."
---

# GtkDirectoryList

A list model that wraps `Gio.File.enumerateChildrenAsync()`.

It presents a `GListModel` and fills it asynchronously with the `GFileInfo`s
returned from that function.

Enumeration will start automatically when the
`Gtk.DirectoryList.file` property is set.

While the `GtkDirectoryList` is being filled, the
`Gtk.DirectoryList.loading` property will be set to `true`. You can
listen to that property if you want to show information like a `GtkSpinner`
or a "Loading..." text.

If loading fails at any point, the `Gtk.DirectoryList.error`
property will be set to give more indication about the failure.

The `GFileInfo`s returned from a `GtkDirectoryList` have the "standard::file"
attribute set to the `GFile` they refer to. This way you can get at the file
that is referred to in the same way you would via `g_file_enumerator_get_child()`.
This means you do not need access to the `GtkDirectoryList`, but can access
the `GFile` directly from the `GFileInfo` when operating with a `GtkListView`
or similar.

```tsx
import { GtkDirectoryList } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkDirectoryList**

Implements `GListModel`.

## Props

`ref` receives the `Gtk.DirectoryList` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `attributes`

`string` · default `null`

The attributes to query.

### `error`

`GLib.Error` · read-only, observe with `onNotifyError`

Error encountered while loading files.

### `file`

`Gio.File | ReactElement`

File to query.

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

### `monitored`

`boolean` · default `true`

`true` if the directory is monitored for changed.

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.8._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.DirectoryList) => void
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

Methods are called on the `Gtk.DirectoryList` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAttributes`

```ts
getAttributes(): string | null
```

Gets the attributes queried on the children.

**Returns** The queried attributes

### `getError`

```ts
getError(): GLib.Error | null
```

Gets the loading error, if any.

If an error occurs during the loading process, the loading process
will finish and this property allows querying the error that happened.
This error will persist until a file is loaded again.

An error being set does not mean that no files were loaded, and all
successfully queried files will remain in the list.

**Returns** The loading error or `null` if
  loading finished successfully

### `getFile`

```ts
getFile(): Gio.File | null
```

Gets the file whose children are currently enumerated.

**Returns** The file whose children are enumerated

### `getIoPriority`

```ts
getIoPriority(): number
```

Gets the IO priority set via `gtk_directory_list_set_io_priority()`.

**Returns** The IO priority.

### `getMonitored`

```ts
getMonitored(): boolean
```

Returns whether the directory list is monitoring
the directory for changes.

**Returns** `true` if the directory is monitored

### `isLoading`

```ts
isLoading(): boolean
```

Returns `true` if the children enumeration is currently in
progress.

Files will be added to `self` from time to time while loading is
going on. The order in which are added is undefined and may change
in between runs.

**Returns** `true` if `self` is loading

### `setAttributes`

```ts
setAttributes(attributes: string | null): void
```

Sets the `attributes` to be enumerated and starts the enumeration.

If `attributes` is `null`, the list of file infos will still be created, it will just
not contain any extra attributes.

**Parameters**

- `attributes`: the attributes to enumerate

### `setFile`

```ts
setFile(file: Gio.File | null): void
```

Sets the `file` to be enumerated and starts the enumeration.

If `file` is `null`, the result will be an empty list.

**Parameters**

- `file`: the `GFile` to be enumerated

### `setIoPriority`

```ts
setIoPriority(ioPriority: number): void
```

Sets the IO priority to use while loading directories.

Setting the priority while `self` is loading will reprioritize the
ongoing load as soon as possible.

The default IO priority is `G_PRIORITY_DEFAULT`, which is higher than
the GTK redraw priority. If you are loading a lot of directories in
parallel, lowering it to something like `G_PRIORITY_DEFAULT_IDLE`
may increase responsiveness.

**Parameters**

- `ioPriority`: IO priority to use

### `setMonitored`

```ts
setMonitored(monitored: boolean): void
```

Sets whether the directory list will monitor the directory
for changes.

If monitoring is enabled, the ::items-changed signal will
be emitted when the directory contents change.


When monitoring is turned on after the initial creation
of the directory list, the directory is reloaded to avoid
missing files that appeared between the initial loading
and when monitoring was turned on.

**Parameters**

- `monitored`: `true` to monitor the directory for changes
