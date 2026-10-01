---
description: "Manages and looks up recently used files."
---

# GtkRecentManager

Manages and looks up recently used files.

Each recently used file is identified by its URI, and has meta-data
associated to it, like the names and command lines of the applications
that have registered it, the number of time each application has
registered the same file, the mime type of the file and whether
the file should be displayed only by the applications that have
registered it.

The recently used files list is per user.

`GtkRecentManager` acts like a database of all the recently
used files. You can create new `GtkRecentManager` objects, but
it is more efficient to use the default manager created by GTK.

Adding a new recently used file is as simple as:

```c
GtkRecentManager *manager;

manager = gtk_recent_manager_get_default ();
gtk_recent_manager_add_item (manager, file_uri);
```

The `GtkRecentManager` will try to gather all the needed information
from the file itself through GIO.

Looking up the meta-data associated with a recently used file
given its URI requires calling `Gtk.RecentManager.lookupItem()`:

```c
GtkRecentManager *manager;
GtkRecentInfo *info;
GError *error = NULL;

manager = gtk_recent_manager_get_default ();
info = gtk_recent_manager_lookup_item (manager, file_uri, &error);
if (error)
  {
    g_warning ("Could not find the file: %s", error->message);
    g_error_free (error);
  }
else
 {
   // Use the info object
   gtk_recent_info_unref (info);
 }
```

In order to retrieve the list of recently used files, you can use
`Gtk.RecentManager.getItems()`, which returns a list of
`Gtk.RecentInfo`.

Note that the maximum age of the recently used files list is
controllable through the `Gtk.Settings.gtkRecentFilesMaxAge`
property.

```tsx
import { GtkRecentManager } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkRecentManager**

## Props

`ref` receives the `Gtk.RecentManager` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `filename`

`string` · default `null` · construct-only

The full path to the file to be used to store and read the
recently used resources list

### `size`

`number` · default `0` · read-only, observe with `onNotifySize`

The size of the recently used resources list.

## Signals

### `onChanged`

```ts
(self: Gtk.RecentManager) => void
```

Emitted when the current recently used resources manager changes
its contents.

This can happen either by calling `Gtk.RecentManager.addItem()`
or by another application.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.RecentManager` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addFull`

```ts
addFull(uri: string, recentData: Gtk.RecentData): boolean
```

Adds a new resource, pointed by `uri`, into the recently used
resources list, using the metadata specified inside the
`GtkRecentData` passed in `recent_data`.

The passed URI will be used to identify this resource inside the
list.

In order to register the new recently used resource, metadata about
the resource must be passed as well as the URI; the metadata is
stored in a `GtkRecentData`, which must contain the MIME
type of the resource pointed by the URI; the name of the application
that is registering the item, and a command line to be used when
launching the item.

Optionally, a `GtkRecentData` might contain a UTF-8 string
to be used when viewing the item instead of the last component of
the URI; a short description of the item; whether the item should
be considered private - that is, should be displayed only by the
applications that have registered it.

**Parameters**

- `uri`: a valid URI
- `recentData`: metadata of the resource

**Returns** `true` if the new item was successfully added to the
  recently used resources list, `false` otherwise

### `addItem`

```ts
addItem(uri: string): boolean
```

Adds a new resource, pointed by `uri`, into the recently used
resources list.

This function automatically retrieves some of the needed
metadata and setting other metadata to common default values;
it then feeds the data to `Gtk.RecentManager.addFull()`.

See `Gtk.RecentManager.addFull()` if you want to explicitly
define the metadata for the resource pointed by `uri`.

**Parameters**

- `uri`: a valid URI

**Returns** `true` if the new item was successfully added
  to the recently used resources list

### `getItems`

```ts
getItems(): Gtk.RecentInfo[]
```

Gets the list of recently used resources.

**Returns** a list of
  newly allocated `GtkRecentInfo objects`. Use
  `Gtk.RecentInfo.unref()` on each item inside the list, and then
  free the list itself using `g_list_free()`.

### `hasItem`

```ts
hasItem(uri: string): boolean
```

Checks whether there is a recently used resource registered
with `uri` inside the recent manager.

**Parameters**

- `uri`: a URI

**Returns** `true` if the resource was found, `false` otherwise

### `lookupItem`

```ts
lookupItem(uri: string): Gtk.RecentInfo | null
```

Searches for a URI inside the recently used resources list, and
returns a `GtkRecentInfo` containing information about the resource
like its MIME type, or its display name.

**Parameters**

- `uri`: a URI

**Returns** a `GtkRecentInfo` containing information
  about the resource pointed by `uri`, or `null` if the URI was
  not registered in the recently used resources list. Free with
  `Gtk.RecentInfo.unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `moveItem`

```ts
moveItem(uri: string, newUri: string | null): boolean
```

Changes the location of a recently used resource from `uri` to `new_uri`.

Please note that this function will not affect the resource pointed
by the URIs, but only the URI used in the recently used resources list.

**Parameters**

- `uri`: the URI of a recently used resource
- `newUri`: the new URI of the recently used resource, or `null` to remove the item pointed by `uri` in the list

**Returns** `true` on success

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `purgeItems`

```ts
purgeItems(): number
```

Purges every item from the recently used resources list.

**Returns** the number of items that have been removed from the
  recently used resources list

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `removeItem`

```ts
removeItem(uri: string): boolean
```

Removes a resource pointed by `uri` from the recently used resources
list handled by a recent manager.

**Parameters**

- `uri`: the URI of the item you wish to remove

**Returns** `true` if the item pointed by `uri` has been successfully
  removed by the recently used resources list, and `false` otherwise

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.
