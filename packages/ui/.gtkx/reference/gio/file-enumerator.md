---
description: "GFileEnumerator allows you to operate on a set of Gio.File objects, returning a Gio.FileInfo structure for each file enumerated (e.g."
---

# GFileEnumerator

`GFileEnumerator` allows you to operate on a set of `Gio.File` objects,
returning a `Gio.FileInfo` structure for each file enumerated (e.g.
`Gio.File.enumerateChildren()` will return a `GFileEnumerator` for each
of the children within a directory).

To get the next file's information from a `GFileEnumerator`, use
`Gio.FileEnumerator.nextFile()` or its asynchronous version,
`Gio.FileEnumerator.nextFilesAsync()`. Note that the asynchronous
version will return a list of `Gio.FileInfo` objects, whereas the
synchronous will only return the next file in the enumerator.

The ordering of returned files is unspecified for non-Unix
platforms; for more information, see `GLib.Dir.readName()`.  On Unix,
when operating on local files, returned files will be sorted by
inode number.  Effectively you can assume that the ordering of
returned files will be stable between successive calls (and
applications) assuming the directory is unchanged.

If your application needs a specific ordering, such as by name or
modification time, you will have to implement that in your
application code.

To close a `GFileEnumerator`, use `Gio.FileEnumerator.close()`, or
its asynchronous version, `Gio.FileEnumerator.closeAsync()`. Once
a `GFileEnumerator` is closed, no further actions may be performed
on it, and it should be freed with `GObject.Object.unref()`.

```tsx
import { GFileEnumerator } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GFileEnumerator**

## Props

`ref` receives the `Gio.FileEnumerator` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `container`

`Gio.File` · construct-only

The container that is being enumerated.

## Methods

Methods are called on the `Gio.FileEnumerator` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `close`

```ts
close(cancellable: Gio.Cancellable | null): boolean
```

Releases all resources used by this enumerator, making the
enumerator return `G_IO_ERROR_CLOSED` on all calls.

This will be automatically called when the last reference
is dropped, but you might want to call this function to make
sure resources are released as early as possible.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `TRUE` on success or `FALSE` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `closeAsync`

```ts
closeAsync(ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Asynchronously closes the file enumerator.

If `cancellable` is not `null`, then the operation can be cancelled by
triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be returned in
`g_file_enumerator_close_finish()`.

**Parameters**

- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** `true` if the close operation has finished successfully.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `closeFinish`

```ts
closeFinish(result: Gio.AsyncResult): boolean
```

Finishes closing a file enumerator, started from `g_file_enumerator_close_async()`.

If the file enumerator was already closed when `g_file_enumerator_close_async()`
was called, then this function will report `G_IO_ERROR_CLOSED` in `error`, and
return `false`. If the file enumerator had pending operation when the close
operation was started, then this function will report `G_IO_ERROR_PENDING`, and
return `false`.  If `cancellable` was not `null`, then the operation may have been
cancelled by triggering the cancellable object from another thread. If the operation
was cancelled, the error `G_IO_ERROR_CANCELLED` will be set, and `false` will be
returned.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** `true` if the close operation has finished successfully.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `getChild`

```ts
getChild(info: Gio.FileInfo): Gio.File
```

Return a new `GFile` which refers to the file named by `info` in the source
directory of `enumerator`.  This function is primarily intended to be used
inside loops with `g_file_enumerator_next_file()`.

To use this, `G_FILE_ATTRIBUTE_STANDARD_NAME` must have been listed in the
attributes list used when creating the `GFileEnumerator`.

This is a convenience method that's equivalent to:
```c
gchar *name = g_file_info_get_name (info);
  GFile *child = g_file_get_child (g_file_enumerator_get_container (enumr),
                                   name);
```

**Parameters**

- `info`: a `GFileInfo` gotten from `g_file_enumerator_next_file()` or the async equivalents.

**Returns** a `GFile` for the `GFileInfo` passed it.

_Available since 2.36._

### `getContainer`

```ts
getContainer(): Gio.File
```

Get the `GFile` container which is being enumerated.

**Returns** the `GFile` which is being enumerated.

_Available since 2.18._

### `hasPending`

```ts
hasPending(): boolean
```

Checks if the file enumerator has pending operations.

**Returns** `true` if the `enumerator` has pending operations.

### `isClosed`

```ts
isClosed(): boolean
```

Checks if the file enumerator has been closed.

**Returns** `true` if the `enumerator` is closed.

### `iterate`

```ts
iterate(cancellable: Gio.Cancellable | null): [boolean, Gio.FileInfo, Gio.File]
```

This is a version of `g_file_enumerator_next_file()` that's easier to
use correctly from C programs.  With `g_file_enumerator_next_file()`,
the gboolean return value signifies "end of iteration or error", which
requires allocation of a temporary `GError`.

In contrast, with this function, a `false` return from
`g_file_enumerator_iterate()` *always* means
"error".  End of iteration is signaled by `out_info` or `out_child` being `null`.

Another crucial difference is that the references for `out_info` and
`out_child` are owned by `direnum` (they are cached as hidden
properties).  You must not unref them in your own code.  This makes
memory management significantly easier for C code in combination
with loops.

Finally, this function optionally allows retrieving a `GFile` as
well.

You must specify at least one of `out_info` or `out_child`.

The code pattern for correctly using `g_file_enumerator_iterate()` from C
is:

```
direnum = g_file_enumerate_children (file, ...);
while (TRUE)
  {
    GFileInfo *info;
    if (!g_file_enumerator_iterate (direnum, &info, NULL, cancellable, error))
      goto out;
    if (!info)
      break;
    ... do stuff with "info"; do not unref it! ...
  }

out:
  g_object_unref (direnum); // Note: frees the last @info
```

**Parameters**

- `cancellable`: a `GCancellable`

**Returns** Tuple of:

- `outInfo`: Output location for the next `GFileInfo`, or `null`
- `outChild`: Output location for the next `GFile`, or `null`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.44._

### `nextFile`

```ts
nextFile(cancellable: Gio.Cancellable | null): Gio.FileInfo | null
```

Returns information for the next file in the enumerated object.
Will block until the information is available. The `GFileInfo`
returned from this function will contain attributes that match the
attribute string that was passed when the `GFileEnumerator` was created.

See the documentation of `GFileEnumerator` for information about the
order of returned files.

On error, returns `null` and sets `error` to the error. If the
enumerator is at the end, `null` will be returned and `error` will
be unset.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** A `GFileInfo` or `null` on error
   or end of enumerator.  Free the returned object with
   `g_object_unref()` when no longer needed.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `nextFilesAsync`

```ts
nextFilesAsync(numFiles: number, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<Gio.FileInfo[]>
```

Request information for a number of files from the enumerator asynchronously.
When all I/O for the operation is finished the `callback` will be called with
the requested information.

See the documentation of `GFileEnumerator` for information about the
order of returned files.

Once the end of the enumerator is reached, or if an error occurs, the
`callback` will be called with an empty list. In this case, the previous call
to `g_file_enumerator_next_files_async()` will typically have returned fewer
than `num_files` items.

If a request is cancelled the callback will be called with
`G_IO_ERROR_CANCELLED`.

This leads to the following pseudo-code usage:
```
g_autoptr(GFile) dir = get_directory ();
g_autoptr(GFileEnumerator) enumerator = NULL;
g_autolist(GFileInfo) files = NULL;
g_autoptr(GError) local_error = NULL;

enumerator = yield g_file_enumerate_children_async (dir,
                                                    G_FILE_ATTRIBUTE_STANDARD_NAME ","
                                                    G_FILE_ATTRIBUTE_STANDARD_TYPE,
                                                    G_FILE_QUERY_INFO_NONE,
                                                    G_PRIORITY_DEFAULT,
                                                    cancellable,
                                                    …,
                                                    &local_error);
if (enumerator == NULL)
  g_error ("Error enumerating: %s", local_error->message);

// Loop until no files are returned, either because the end of the enumerator
// has been reached, or an error was returned.
do
  {
    files = yield g_file_enumerator_next_files_async (enumerator,
                                                      5,  // number of files to request
                                                      G_PRIORITY_DEFAULT,
                                                      cancellable,
                                                      …,
                                                      &local_error);

    // Process the returned files, but don’t assume that exactly 5 were returned.
    for (GList *l = files; l != NULL; l = l->next)
      {
        GFileInfo *info = l->data;
        handle_file_info (info);
      }
  }
while (files != NULL);

if (local_error != NULL &&
    !g_error_matches (local_error, G_IO_ERROR, G_IO_ERROR_CANCELLED))
  g_error ("Error while enumerating: %s", local_error->message);
```

During an async request no other sync and async calls are allowed, and will
result in `G_IO_ERROR_PENDING` errors.

Any outstanding I/O request with higher priority (lower numerical value) will
be executed before an outstanding request with lower priority. Default
priority is `G_PRIORITY_DEFAULT`.

**Parameters**

- `numFiles`: the number of file info objects to request
- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `GList` of `GFileInfos`. You must free the list with
    `g_list_free()` and unref the infos with `g_object_unref()` when you're
    done with them.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `nextFilesFinish`

```ts
nextFilesFinish(result: Gio.AsyncResult): Gio.FileInfo[]
```

Finishes the asynchronous operation started with `g_file_enumerator_next_files_async()`.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** a `GList` of `GFileInfos`. You must free the list with
    `g_list_free()` and unref the infos with `g_object_unref()` when you're
    done with them.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `setPending`

```ts
setPending(pending: boolean): void
```

Sets the file enumerator as having pending operations.

**Parameters**

- `pending`: a boolean value.
