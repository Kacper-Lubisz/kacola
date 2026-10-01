---
description: "Entry point for using GIO functionality."
---

# GVfs

Entry point for using GIO functionality.

```tsx
import { GVfs } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GVfs**

## Props

`ref` receives the `Gio.Vfs` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.Vfs` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getFileForPath`

```ts
getFileForPath(path: string): Gio.File
```

Gets a `GFile` for `path`.

**Parameters**

- `path`: a string containing a VFS path.

**Returns** a `GFile`.
    Free the returned object with `g_object_unref()`.

### `getFileForUri`

```ts
getFileForUri(uri: string): Gio.File
```

Gets a `GFile` for `uri`.

This operation never fails, but the returned object
might not support any I/O operation if the URI
is malformed or if the URI scheme is not supported.

**Parameters**

- `uri`: a string containing a URI

**Returns** a `GFile`.
    Free the returned object with `g_object_unref()`.

### `getSupportedUriSchemes`

```ts
getSupportedUriSchemes(): string[]
```

Gets a list of URI schemes supported by `vfs`.

**Returns** a `null`-terminated array of strings.
    The returned array belongs to GIO and must
    not be freed or modified.

### `isActive`

```ts
isActive(): boolean
```

Checks if the VFS is active.

**Returns** `true` if construction of the `vfs` was successful
    and it is now active.

### `parseName`

```ts
parseName(parseName: string): Gio.File
```

This operation never fails, but the returned object might
not support any I/O operations if the `parse_name` cannot
be parsed by the `GVfs` module.

**Parameters**

- `parseName`: a string to be parsed by the VFS module.

**Returns** a `GFile` for the given `parse_name`.
    Free the returned object with `g_object_unref()`.

### `registerUriScheme`

```ts
registerUriScheme(scheme: string, uriFunc: Gio.VfsFileLookupFunc | null, parseNameFunc: Gio.VfsFileLookupFunc | null): boolean
```

Registers `uri_func` and `parse_name_func` as the `GFile` URI and parse name
lookup functions for URIs with a scheme matching `scheme`.
Note that `scheme` is registered only within the running application, as
opposed to desktop-wide as it happens with GVfs backends.

When a `GFile` is requested with an URI containing `scheme` (e.g. through
`g_file_new_for_uri()`), `uri_func` will be called to allow a custom
constructor. The implementation of `uri_func` should not be blocking, and
must not call `g_vfs_register_uri_scheme()` or `g_vfs_unregister_uri_scheme()`.

When `g_file_parse_name()` is called with a parse name obtained from such file,
`parse_name_func` will be called to allow the `GFile` to be created again. In
that case, it's responsibility of `parse_name_func` to make sure the parse
name matches what the custom `GFile` implementation returned when
`g_file_get_parse_name()` was previously called. The implementation of
`parse_name_func` should not be blocking, and must not call
`g_vfs_register_uri_scheme()` or `g_vfs_unregister_uri_scheme()`.

It's an error to call this function twice with the same scheme. To unregister
a custom URI scheme, use `g_vfs_unregister_uri_scheme()`.

**Parameters**

- `scheme`: an URI scheme, e.g. "http"
- `uriFunc`: a `GVfsFileLookupFunc`
- `parseNameFunc`: a `GVfsFileLookupFunc`

**Returns** `true` if `scheme` was successfully registered, or `false` if a handler
    for `scheme` already exists.

_Available since 2.50._

### `unregisterUriScheme`

```ts
unregisterUriScheme(scheme: string): boolean
```

Unregisters the URI handler for `scheme` previously registered with
`g_vfs_register_uri_scheme()`.

**Parameters**

- `scheme`: an URI scheme, e.g. "http"

**Returns** `true` if `scheme` was successfully unregistered, or `false` if a
    handler for `scheme` does not exist.

_Available since 2.50._
