---
description: "Stores information about a file system object referenced by a Gio.File."
---

# GFileInfo

Stores information about a file system object referenced by a `Gio.File`.

Functionality for manipulating basic metadata for files. `GFileInfo`
implements methods for getting information that all files should
contain, and allows for manipulation of extended attributes.

See the [file attributes](file-attributes.html) document for more
information on how GIO handles file attributes.

To obtain a `GFileInfo` for a `Gio.File`, use
`Gio.File.queryInfo()` (or its async variant). To obtain a `GFileInfo`
for a file input or output stream, use `Gio.FileInputStream.queryInfo()`
or `Gio.FileOutputStream.queryInfo()` (or their async variants).

To change the actual attributes of a file, you should then set the
attribute in the `GFileInfo` and call `Gio.File.setAttributesFromInfo()`
or `Gio.File.setAttributesAsync()` on a `GFile`.

However, not all attributes can be changed in the file. For instance,
the actual size of a file cannot be changed via `Gio.FileInfo.setSize()`.
You may call `Gio.File.querySettableAttributes()` and
`Gio.File.queryWritableNamespaces()` to discover the settable attributes
of a particular file at runtime.

The direct accessors, such as `Gio.FileInfo.getName()`, are slightly more
optimized than the generic attribute accessors, such as
`Gio.FileInfo.getAttributeByteString()`.This optimization will matter
only if calling the API in a tight loop.

It is an error to call these accessors without specifying their required file
attributes when creating the `GFileInfo`. Use
`Gio.FileInfo.hasAttribute()` or `Gio.FileInfo.listAttributes()`
to check what attributes are specified for a `GFileInfo`.

`Gio.FileAttributeMatcher` allows for searching through a `GFileInfo`
for attributes.

```tsx
import { GFileInfo } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GFileInfo**

## Props

`ref` receives the `Gio.FileInfo` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.FileInfo` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `clearStatus`

```ts
clearStatus(): void
```

Clears the status information from `info`.

### `copyInto`

```ts
copyInto(destInfo: Gio.FileInfo): void
```

First clears all of the [GFileAttribute](file-attributes.html#file-attributes) of
`dest_info`, and then copies all of the file attributes from `src_info` to `dest_info`.

**Parameters**

- `destInfo`: destination to copy attributes to.

### `dup`

```ts
dup(): Gio.FileInfo
```

Duplicates a file info structure.

**Returns** a duplicate `GFileInfo` of `other`.

### `getAccessDateTime`

```ts
getAccessDateTime(): GLib.DateTime | null
```

Gets the access time of the current `info` and returns it as a
`GDateTime`.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_TIME_ACCESS`. If `G_FILE_ATTRIBUTE_TIME_ACCESS_USEC` is
provided, the resulting `GDateTime` will additionally have microsecond
precision.

If nanosecond precision is needed, `G_FILE_ATTRIBUTE_TIME_ACCESS_NSEC` must
be queried separately using `g_file_info_get_attribute_uint32()`.

**Returns** access time, or `null` if unknown

_Available since 2.70._

### `getAttributeAsString`

```ts
getAttributeAsString(attribute: string): string | null
```

Gets the value of an attribute, formatted as a human readable string.

This escapes things as needed to make the string valid UTF-8 and readable by
humans. It’s not meant to be a machine readable or reversible escaping
format.

To format file name attributes of type
`Gio.FileAttributeType.BYTE_STRING` for output as UTF-8, use
`GLib.filenameToUtf8()` instead:
```c
const char *trash_orig_path_byte_string;
g_autofree char *trash_orig_path_utf8 = NULL;

trash_orig_path_byte_string = g_file_info_get_attribute_byte_string (info, G_FILE_ATTRIBUTE_TRASH_ORIG_PATH);
trash_orig_path_utf8 = g_filename_to_utf8 (trash_orig_path_byte_string, -1, NULL, NULL, NULL);
if (trash_orig_path_utf8 != NULL)
  g_message ("Some larger UTF-8 string with filename embedded as %s", trash_orig_path_utf8);
```

**Parameters**

- `attribute`: a file attribute key.

**Returns** a UTF-8 string associated with the given `attribute`, or
   `null` if the attribute wasn’t set.
   When you're done with the string it must be freed with `g_free()`.

### `getAttributeBoolean`

```ts
getAttributeBoolean(attribute: string): boolean
```

Gets the value of a boolean attribute. If the attribute does not
contain a boolean value, `false` will be returned.

**Parameters**

- `attribute`: a file attribute key.

**Returns** the boolean value contained within the attribute.

### `getAttributeByteString`

```ts
getAttributeByteString(attribute: string): string | null
```

Gets the value of a byte string attribute. If the attribute does
not contain a byte string, `null` will be returned.

**Parameters**

- `attribute`: a file attribute key.

**Returns** the contents of the `attribute` value as a byte string, or
`null` otherwise.

### `getAttributeData`

```ts
getAttributeData(attribute: string): [boolean, Gio.FileAttributeType, bigint, Gio.FileAttributeStatus]
```

Gets the attribute type, value and status for an attribute key.

**Parameters**

- `attribute`: a file attribute key

**Returns** Tuple of:

- `result`: `true` if `info` has an attribute named `attribute`, `false` otherwise.
- `type`: return location for the attribute type, or `null`
- `valuePp`: return location for the attribute value, or `null`; the attribute value will not be `null`
- `status`: return location for the attribute status, or `null`

### `getAttributeFilePath`

```ts
getAttributeFilePath(attribute: string): string | null
```

Gets the value of a byte string attribute as a file path.

If the attribute does not contain a byte string, `NULL` will be returned.

This function is meant to be used by language bindings that have specific
handling for Unix paths.

**Parameters**

- `attribute`: a file attribute key.

**Returns** the contents of the `attribute` value as
a file path, or `null` otherwise.

_Available since 2.78._

### `getAttributeInt32`

```ts
getAttributeInt32(attribute: string): number
```

Gets a signed 32-bit integer contained within the attribute. If the
attribute does not contain a signed 32-bit integer, or is invalid,
0 will be returned.

**Parameters**

- `attribute`: a file attribute key.

**Returns** a signed 32-bit integer from the attribute.

### `getAttributeInt64`

```ts
getAttributeInt64(attribute: string): bigint
```

Gets a signed 64-bit integer contained within the attribute. If the
attribute does not contain a signed 64-bit integer, or is invalid,
0 will be returned.

**Parameters**

- `attribute`: a file attribute key.

**Returns** a signed 64-bit integer from the attribute.

### `getAttributeObject`

```ts
getAttributeObject(attribute: string): GObject.Object | null
```

Gets the value of a `GObject` attribute. If the attribute does
not contain a `GObject`, `null` will be returned.

**Parameters**

- `attribute`: a file attribute key.

**Returns** a `GObject` associated with the given `attribute`,
or `null` otherwise.

### `getAttributeStatus`

```ts
getAttributeStatus(attribute: string): Gio.FileAttributeStatus
```

Gets the attribute status for an attribute key.

**Parameters**

- `attribute`: a file attribute key

**Returns** a `GFileAttributeStatus` for the given `attribute`, or
   `G_FILE_ATTRIBUTE_STATUS_UNSET` if the key is invalid.

### `getAttributeString`

```ts
getAttributeString(attribute: string): string | null
```

Gets the value of a string attribute. If the attribute does
not contain a string, `null` will be returned.

**Parameters**

- `attribute`: a file attribute key.

**Returns** the contents of the `attribute` value as a UTF-8 string,
or `null` otherwise.

### `getAttributeStringv`

```ts
getAttributeStringv(attribute: string): string[] | null
```

Gets the value of a stringv attribute. If the attribute does
not contain a stringv, `null` will be returned.

**Parameters**

- `attribute`: a file attribute key.

**Returns** the contents of the `attribute` value as a stringv,
or `null` otherwise. Do not free. These returned strings are UTF-8.

_Available since 2.22._

### `getAttributeType`

```ts
getAttributeType(attribute: string): Gio.FileAttributeType
```

Gets the attribute type for an attribute key.

**Parameters**

- `attribute`: a file attribute key.

**Returns** a `GFileAttributeType` for the given `attribute`, or
`G_FILE_ATTRIBUTE_TYPE_INVALID` if the key is not set.

### `getAttributeUint32`

```ts
getAttributeUint32(attribute: string): number
```

Gets an unsigned 32-bit integer contained within the attribute. If the
attribute does not contain an unsigned 32-bit integer, or is invalid,
0 will be returned.

**Parameters**

- `attribute`: a file attribute key.

**Returns** an unsigned 32-bit integer from the attribute.

### `getAttributeUint64`

```ts
getAttributeUint64(attribute: string): bigint
```

Gets a unsigned 64-bit integer contained within the attribute. If the
attribute does not contain an unsigned 64-bit integer, or is invalid,
0 will be returned.

**Parameters**

- `attribute`: a file attribute key.

**Returns** a unsigned 64-bit integer from the attribute.

### `getContentType`

```ts
getContentType(): string | null
```

Gets the file's content type.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE`.

**Returns** a string containing the file's content type,
or `null` if unknown.

### `getCreationDateTime`

```ts
getCreationDateTime(): GLib.DateTime | null
```

Gets the creation time of the current `info` and returns it as a
`GDateTime`.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_TIME_CREATED`. If `G_FILE_ATTRIBUTE_TIME_CREATED_USEC` is
provided, the resulting `GDateTime` will additionally have microsecond
precision.

If nanosecond precision is needed, `G_FILE_ATTRIBUTE_TIME_CREATED_NSEC` must
be queried separately using `g_file_info_get_attribute_uint32()`.

**Returns** creation time, or `null` if unknown

_Available since 2.70._

### `getDeletionDate`

```ts
getDeletionDate(): GLib.DateTime | null
```

Returns the `GDateTime` representing the deletion date of the file, as
available in `G_FILE_ATTRIBUTE_TRASH_DELETION_DATE`. If the
`G_FILE_ATTRIBUTE_TRASH_DELETION_DATE` attribute is unset, `null` is returned.

**Returns** a `GDateTime`, or `null`.

_Available since 2.36._

### `getDisplayName`

```ts
getDisplayName(): string
```

Gets a display name for a file. This is guaranteed to always be set.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME`.

**Returns** a string containing the display name.

### `getEditName`

```ts
getEditName(): string
```

Gets the edit name for a file.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_EDIT_NAME`.

**Returns** a string containing the edit name.

### `getEtag`

```ts
getEtag(): string | null
```

Gets the [entity tag]`Gio.File#entity-tags` for a given
`GFileInfo`. See `G_FILE_ATTRIBUTE_ETAG_VALUE`.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_ETAG_VALUE`.

**Returns** a string containing the value of the "etag:value" attribute.

### `getFileType`

```ts
getFileType(): Gio.FileType
```

Gets a file's type (whether it is a regular file, symlink, etc).
This is different from the file's content type, see `g_file_info_get_content_type()`.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_TYPE`.

**Returns** a `GFileType` for the given file.

### `getIcon`

```ts
getIcon(): Gio.Icon | null
```

Gets the icon for a file.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_ICON`.

**Returns** `GIcon` for the given `info`.

### `getIsBackup`

```ts
getIsBackup(): boolean
```

Checks if a file is a backup file.

The exact semantics of what constitutes a backup file are
backend-specific. For local files, a file is considered a backup
if its name ends with `~` and it is a regular file. This follows
the POSIX convention used by text editors such as Emacs.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_IS_BACKUP`.

**Returns** `true` if file is a backup file, `false` otherwise.

### `getIsHidden`

```ts
getIsHidden(): boolean
```

Checks if a file is hidden.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_IS_HIDDEN`.

**Returns** `true` if the file is a hidden file, `false` otherwise.

### `getIsSymlink`

```ts
getIsSymlink(): boolean
```

Checks if a file is a symlink.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_IS_SYMLINK`.

**Returns** `true` if the given `info` is a symlink.

### `getModificationDateTime`

```ts
getModificationDateTime(): GLib.DateTime | null
```

Gets the modification time of the current `info` and returns it as a
`GDateTime`.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_TIME_MODIFIED`. If `G_FILE_ATTRIBUTE_TIME_MODIFIED_USEC` is
provided, the resulting `GDateTime` will additionally have microsecond
precision.

If nanosecond precision is needed, `G_FILE_ATTRIBUTE_TIME_MODIFIED_NSEC` must
be queried separately using `g_file_info_get_attribute_uint32()`.

**Returns** modification time, or `null` if unknown

_Available since 2.62._

### `getModificationTime`

```ts
getModificationTime(): GLib.TimeVal
```

Gets the modification time of the current `info` and sets it
in `result`.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_TIME_MODIFIED`. If `G_FILE_ATTRIBUTE_TIME_MODIFIED_USEC` is
provided it will be used too.

**Returns** a `GTimeVal`.

> **Deprecated since 2.62.** Use `g_file_info_get_modification_date_time()` instead, as `GTimeVal` is deprecated due to the year 2038 problem.

### `getName`

```ts
getName(): string
```

Gets the name for a file. This is guaranteed to always be set.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_NAME`.

**Returns** a string containing the file name.

### `getSize`

```ts
getSize(): bigint
```

Gets the file's size (in bytes). The size is retrieved through the value of
the `G_FILE_ATTRIBUTE_STANDARD_SIZE` attribute and is converted
from `guint64` to `goffset` before returning the result.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_SIZE`.

**Returns** a `goffset` containing the file's size (in bytes).

### `getSortOrder`

```ts
getSortOrder(): number
```

Gets the value of the sort_order attribute from the `GFileInfo`.
See `G_FILE_ATTRIBUTE_STANDARD_SORT_ORDER`.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_SORT_ORDER`.

**Returns** a `gint32` containing the value of the "standard::sort_order" attribute.

### `getSymbolicIcon`

```ts
getSymbolicIcon(): Gio.Icon | null
```

Gets the symbolic icon for a file.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_SYMBOLIC_ICON`.

**Returns** `GIcon` for the given `info`.

_Available since 2.34._

### `getSymlinkTarget`

```ts
getSymlinkTarget(): string | null
```

Gets the symlink target for a given `GFileInfo`.

It is an error to call this if the `GFileInfo` does not contain
`G_FILE_ATTRIBUTE_STANDARD_SYMLINK_TARGET`.

**Returns** a string containing the symlink target.

### `hasAttribute`

```ts
hasAttribute(attribute: string): boolean
```

Checks if a file info structure has an attribute named `attribute`.

**Parameters**

- `attribute`: a file attribute key.

**Returns** `true` if `info` has an attribute named `attribute`,
    `false` otherwise.

### `hasNamespace`

```ts
hasNamespace(nameSpace: string): boolean
```

Checks if a file info structure has an attribute in the
specified `name_space`.

**Parameters**

- `nameSpace`: a file attribute namespace.

**Returns** `true` if `info` has an attribute in `name_space`,
    `false` otherwise.

_Available since 2.22._

### `listAttributes`

```ts
listAttributes(nameSpace: string | null): string[] | null
```

Lists the file info structure's attributes.

**Parameters**

- `nameSpace`: a file attribute key's namespace, or `null` to list all attributes.

**Returns** a
null-terminated array of strings of all of the possible attribute
types for the given `name_space`, or `null` on error.

### `removeAttribute`

```ts
removeAttribute(attribute: string): void
```

Removes all cases of `attribute` from `info` if it exists.

**Parameters**

- `attribute`: a file attribute key.

### `setAccessDateTime`

```ts
setAccessDateTime(atime: GLib.DateTime): void
```

Sets the `G_FILE_ATTRIBUTE_TIME_ACCESS` and
`G_FILE_ATTRIBUTE_TIME_ACCESS_USEC` attributes in the file info to the
given date/time value.

`G_FILE_ATTRIBUTE_TIME_ACCESS_NSEC` will be cleared.

**Parameters**

- `atime`: a `GDateTime`.

_Available since 2.70._

### `setAttributeBoolean`

```ts
setAttributeBoolean(attribute: string, attrValue: boolean): void
```

Sets the `attribute` to contain the given `attr_value`,
if possible.

**Parameters**

- `attribute`: a file attribute key.
- `attrValue`: a boolean value.

### `setAttributeByteString`

```ts
setAttributeByteString(attribute: string, attrValue: string): void
```

Sets the `attribute` to contain the given `attr_value`,
if possible.

**Parameters**

- `attribute`: a file attribute key.
- `attrValue`: a byte string.

### `setAttributeFilePath`

```ts
setAttributeFilePath(attribute: string, attrValue: string): void
```

Sets the `attribute` to contain the given `attr_value`,
if possible.

This function is meant to be used by language bindings that have specific
handling for Unix paths.

**Parameters**

- `attribute`: a file attribute key.
- `attrValue`: a file path.

_Available since 2.78._

### `setAttributeInt32`

```ts
setAttributeInt32(attribute: string, attrValue: number): void
```

Sets the `attribute` to contain the given `attr_value`,
if possible.

**Parameters**

- `attribute`: a file attribute key.
- `attrValue`: a signed 32-bit integer

### `setAttributeInt64`

```ts
setAttributeInt64(attribute: string, attrValue: bigint): void
```

Sets the `attribute` to contain the given `attr_value`,
if possible.

**Parameters**

- `attribute`: attribute name to set.
- `attrValue`: int64 value to set attribute to.

### `setAttributeMask`

```ts
setAttributeMask(mask: Gio.FileAttributeMatcher): void
```

Sets `mask` on `info` to match specific attribute types.

**Parameters**

- `mask`: a `GFileAttributeMatcher`.

### `setAttributeObject`

```ts
setAttributeObject(attribute: string, attrValue: GObject.Object): void
```

Sets the `attribute` to contain the given `attr_value`,
if possible.

**Parameters**

- `attribute`: a file attribute key.
- `attrValue`: a `GObject`.

### `setAttributeStatus`

```ts
setAttributeStatus(attribute: string, status: Gio.FileAttributeStatus): boolean
```

Sets the attribute status for an attribute key. This is only
needed by external code that implement `g_file_set_attributes_from_info()`
or similar functions.

The attribute must exist in `info` for this to work. Otherwise `false`
is returned and `info` is unchanged.

**Parameters**

- `attribute`: a file attribute key
- `status`: a `GFileAttributeStatus`

**Returns** `true` if the status was changed, `false` if the key was not set.

_Available since 2.22._

### `setAttributeString`

```ts
setAttributeString(attribute: string, attrValue: string): void
```

Sets the `attribute` to contain the given `attr_value`,
if possible.

**Parameters**

- `attribute`: a file attribute key.
- `attrValue`: a UTF-8 string.

### `setAttributeStringv`

```ts
setAttributeStringv(attribute: string, attrValue: string[]): void
```

Sets the `attribute` to contain the given `attr_value`,
if possible.

Sinze: 2.22

**Parameters**

- `attribute`: a file attribute key
- `attrValue`: a `null` terminated array of UTF-8 strings.

### `setAttributeUint32`

```ts
setAttributeUint32(attribute: string, attrValue: number): void
```

Sets the `attribute` to contain the given `attr_value`,
if possible.

**Parameters**

- `attribute`: a file attribute key.
- `attrValue`: an unsigned 32-bit integer.

### `setAttributeUint64`

```ts
setAttributeUint64(attribute: string, attrValue: bigint): void
```

Sets the `attribute` to contain the given `attr_value`,
if possible.

**Parameters**

- `attribute`: a file attribute key.
- `attrValue`: an unsigned 64-bit integer.

### `setContentType`

```ts
setContentType(contentType: string): void
```

Sets the content type attribute for a given `GFileInfo`.
See `G_FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE`.

**Parameters**

- `contentType`: a [content type](content-types.html#content-types).

### `setCreationDateTime`

```ts
setCreationDateTime(creationTime: GLib.DateTime): void
```

Sets the `G_FILE_ATTRIBUTE_TIME_CREATED` and
`G_FILE_ATTRIBUTE_TIME_CREATED_USEC` attributes in the file info to the
given date/time value.

`G_FILE_ATTRIBUTE_TIME_CREATED_NSEC` will be cleared.

**Parameters**

- `creationTime`: a `GDateTime`.

_Available since 2.70._

### `setDisplayName`

```ts
setDisplayName(displayName: string): void
```

Sets the display name for the current `GFileInfo`.
See `G_FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME`.

**Parameters**

- `displayName`: a string containing a display name.

### `setEditName`

```ts
setEditName(editName: string): void
```

Sets the edit name for the current file.
See `G_FILE_ATTRIBUTE_STANDARD_EDIT_NAME`.

**Parameters**

- `editName`: a string containing an edit name.

### `setFileType`

```ts
setFileType(type: Gio.FileType): void
```

Sets the file type in a `GFileInfo` to `type`.
See `G_FILE_ATTRIBUTE_STANDARD_TYPE`.

**Parameters**

- `type`: a `GFileType`.

### `setIcon`

```ts
setIcon(icon: Gio.Icon): void
```

Sets the icon for a given `GFileInfo`.
See `G_FILE_ATTRIBUTE_STANDARD_ICON`.

**Parameters**

- `icon`: a `GIcon`.

### `setIsHidden`

```ts
setIsHidden(isHidden: boolean): void
```

Sets the "is_hidden" attribute in a `GFileInfo` according to `is_hidden`.
See `G_FILE_ATTRIBUTE_STANDARD_IS_HIDDEN`.

**Parameters**

- `isHidden`: a `gboolean`.

### `setIsSymlink`

```ts
setIsSymlink(isSymlink: boolean): void
```

Sets the "is_symlink" attribute in a `GFileInfo` according to `is_symlink`.
See `G_FILE_ATTRIBUTE_STANDARD_IS_SYMLINK`.

**Parameters**

- `isSymlink`: a `gboolean`.

### `setModificationDateTime`

```ts
setModificationDateTime(mtime: GLib.DateTime): void
```

Sets the `G_FILE_ATTRIBUTE_TIME_MODIFIED` and
`G_FILE_ATTRIBUTE_TIME_MODIFIED_USEC` attributes in the file info to the
given date/time value.

`G_FILE_ATTRIBUTE_TIME_MODIFIED_NSEC` will be cleared.

**Parameters**

- `mtime`: a `GDateTime`.

_Available since 2.62._

### `setModificationTime`

```ts
setModificationTime(mtime: GLib.TimeVal): void
```

Sets the `G_FILE_ATTRIBUTE_TIME_MODIFIED` and
`G_FILE_ATTRIBUTE_TIME_MODIFIED_USEC` attributes in the file info to the
given time value.

`G_FILE_ATTRIBUTE_TIME_MODIFIED_NSEC` will be cleared.

**Parameters**

- `mtime`: a `GTimeVal`.

> **Deprecated since 2.62.** Use `g_file_info_set_modification_date_time()` instead, as `GTimeVal` is deprecated due to the year 2038 problem.

### `setName`

```ts
setName(name: string): void
```

Sets the name attribute for the current `GFileInfo`.
See `G_FILE_ATTRIBUTE_STANDARD_NAME`.

**Parameters**

- `name`: a string containing a name.

### `setSize`

```ts
setSize(size: bigint): void
```

Sets the `G_FILE_ATTRIBUTE_STANDARD_SIZE` attribute in the file info
to the given size.

**Parameters**

- `size`: a `goffset` containing the file's size.

### `setSortOrder`

```ts
setSortOrder(sortOrder: number): void
```

Sets the sort order attribute in the file info structure. See
`G_FILE_ATTRIBUTE_STANDARD_SORT_ORDER`.

**Parameters**

- `sortOrder`: a sort order integer.

### `setSymbolicIcon`

```ts
setSymbolicIcon(icon: Gio.Icon): void
```

Sets the symbolic icon for a given `GFileInfo`.
See `G_FILE_ATTRIBUTE_STANDARD_SYMBOLIC_ICON`.

**Parameters**

- `icon`: a `GIcon`.

_Available since 2.34._

### `setSymlinkTarget`

```ts
setSymlinkTarget(symlinkTarget: string): void
```

Sets the `G_FILE_ATTRIBUTE_STANDARD_SYMLINK_TARGET` attribute in the file info
to the given symlink target.

**Parameters**

- `symlinkTarget`: a static string containing a path to a symlink target.

### `unsetAttributeMask`

```ts
unsetAttributeMask(): void
```

Unsets a mask set by `g_file_info_set_attribute_mask()`, if one
is set.
