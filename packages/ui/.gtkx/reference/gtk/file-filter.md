---
description: "Filters files by name or mime type."
---

# GtkFileFilter

Filters files by name or mime type.

`GtkFileFilter` can be used to restrict the files being shown in a
file chooser. Files can be filtered based on their name (with
`Gtk.FileFilter.addPattern()` or `Gtk.FileFilter.addSuffix()`)
or on their mime type (with `Gtk.FileFilter.addMimeType()`).

Filtering by mime types handles aliasing and subclassing of mime
types; e.g. a filter for text/plain also matches a file with mime
type application/rtf, since application/rtf is a subclass of
text/plain. Note that `GtkFileFilter` allows wildcards for the
subtype of a mime type, so you can e.g. filter for image/\*.

Normally, file filters are used by adding them to a file chooser
(see `Gtk.FileDialog.setFilters()`), but it is also possible to
manually use a file filter on any `Gtk.FilterListModel` containing
`GFileInfo` objects.

## GtkFileFilter as GtkBuildable

The `GtkFileFilter` implementation of the `GtkBuildable` interface
supports adding rules using the `<mime-types>` and `<patterns>` and
`<suffixes>` elements and listing the rules within. Specifying a
`<mime-type>` or `<pattern>` or `<suffix>` has the same effect as
as calling
`Gtk.FileFilter.addMimeType()` or
`Gtk.FileFilter.addPattern()` or
`Gtk.FileFilter.addSuffix()`.

An example of a UI definition fragment specifying `GtkFileFilter`
rules:
```xml
<object class="GtkFileFilter">
  <property name="name" translatable="yes">Text and Images</property>
  <mime-types>
    <mime-type>text/plain</mime-type>
    <mime-type>image/ *</mime-type>
  </mime-types>
  <patterns>
    <pattern>*.txt</pattern>
  </patterns>
  <suffixes>
    <suffix>png</suffix>
  </suffixes>
</object>
```

```tsx
import { GtkFileFilter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkFilter](.gtkx/reference/gtk/filter.md) → **GtkFileFilter**

Implements `GtkBuildable`.

## Props

`ref` receives the `Gtk.FileFilter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `mimeTypes`

`string[]` · construct-only

The MIME types that this filter matches.

_Available since 4.10._

### `name`

`string` · default `null`

The human-readable name of the filter.

This is the string that will be displayed in the user interface
if there is a selectable list of filters.

### `patterns`

`string[]` · construct-only

The patterns that this filter matches.

_Available since 4.10._

### `suffixes`

`string[]` · construct-only

The suffixes that this filter matches.

_Available since 4.10._

## Methods

Methods are called on the `Gtk.FileFilter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addMimeType`

```ts
addMimeType(mimeType: string): void
```

Adds a rule allowing a given mime type.

**Parameters**

- `mimeType`: name of a MIME type

### `addMimeTypes`

```ts
addMimeTypes(mimeTypes: string[]): void
```

Adds a rule allowing a given array of mime types.
It can for example be used with
[Gly.Loader.get_mime_types](https://gnome.pages.gitlab.gnome.org/glycin/libglycin/type_func.Loader.get_mime_types.html).

This is equivalent to calling `Gtk.FileFilter.addMimeType()`
for all the supported mime types.

**Parameters**

- `mimeTypes`: a `null`-terminated array of mime types

_Available since 4.22._

### `addPattern`

```ts
addPattern(pattern: string): void
```

Adds a rule allowing a shell style glob pattern.

Note that it depends on the platform whether pattern
matching ignores case or not. On Windows, it does, on
other platforms, it doesn't.

**Parameters**

- `pattern`: a shell style glob pattern

### `addPixbufFormats`

```ts
addPixbufFormats(): void
```

Adds a rule allowing image files in the formats supported by `GdkPixbuf`.

This is equivalent to calling `Gtk.FileFilter.addMimeType()`
for all the supported mime types.

> **Deprecated since 4.20.** Use the api of your image loading framework (e.g. glycin) to enumerate supported formats

### `addSuffix`

```ts
addSuffix(suffix: string): void
```

Adds a suffix match rule to a filter.

This is similar to adding a match for the pattern "*.`suffix`"

An exaple to filter files with the suffix ".sub":
```c
gtk_file_filter_add_suffix (filter, "sub");
```

Filters with multiple dots are allowed.

In contrast to pattern matches, suffix matches
are *always* case-insensitive.

**Parameters**

- `suffix`: filename suffix to match

_Available since 4.4._

### `getAttributes`

```ts
getAttributes(): string[]
```

Gets the attributes that need to be filled in for the `GFileInfo`
passed to this filter.

This function will not typically be used by applications;
it is intended for use in file chooser implementation.

**Returns** the attributes

### `getName`

```ts
getName(): string | null
```

Gets the human-readable name for the filter.

See `Gtk.FileFilter.setName()`.

**Returns** the human-readable name of the filter

### `setName`

```ts
setName(name: string | null): void
```

Sets a human-readable name of the filter.

This is the string that will be displayed in the user interface
if there is a selectable list of filters.

**Parameters**

- `name`: the human-readable name for the filter

### `toGvariant`

```ts
toGvariant(): GLib.Variant
```

Serialize a file filter to an `a{sv}` variant.

**Returns** a new, floating, `GVariant`
