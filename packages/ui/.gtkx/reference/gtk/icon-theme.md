---
description: "Loads themed icons."
---

# GtkIconTheme

Loads themed icons.

The main reason for using a name rather than simply providing a filename
is to allow different icons to be used depending on what “icon theme” is
selected by the user. The operation of icon themes on Linux and Unix
follows the [Icon Theme Specification](http://www.freedesktop.org/Standards/icon-theme-spec)
There is a fallback icon theme, named `hicolor`, where applications
should install their icons, but additional icon themes can be installed
as operating system vendors and users choose.

In many cases, named themes are used indirectly, via `Gtk.Image`
rather than directly, but looking up icons directly is also simple. The
`GtkIconTheme` object acts as a database of all the icons in the current
theme. You can create new `GtkIconTheme` objects, but it’s much more
efficient to use the standard icon theme of the `GtkWidget` so that the
icon information is shared with other people looking up icons.

```c
GtkIconTheme *icon_theme;
GtkIconPaintable *icon;
GdkPaintable *paintable;

icon_theme = gtk_icon_theme_get_for_display (gtk_widget_get_display (my_widget));
icon = gtk_icon_theme_lookup_icon (icon_theme,
                                   "my-icon-name", // icon name
                                   48, // icon size
                                   1,  // scale
                                   0,  // flags);
paintable = GDK_PAINTABLE (icon);
// Use the paintable
g_object_unref (icon);
```

```tsx
import { GtkIconTheme } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkIconTheme**

## Props

`ref` receives the `Gtk.IconTheme` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `display`

`Gdk.Display | ReactElement`

The display that this icon theme object is attached to.

### `iconNames`

`string[]` · read-only, observe with `onNotifyIconNames`

The icon names that are supported by the icon theme.

### `resourcePath`

`string[]`

Resource paths that will be looked at when looking for icons,
similar to search paths.

The resources are considered as part of the hicolor icon theme
and must be located in subdirectories that are defined in the
hicolor icon theme, such as `@path/16x16/actions/run.png`.
Icons that are directly placed in the resource path instead
of a subdirectory are also considered as ultimate fallback.

### `searchPath`

`string[]`

The search path for this icon theme.

When looking for icons, GTK will search for a subdirectory of
one or more of the directories in the search path with the same
name as the icon theme containing an index.theme file. (Themes
from multiple of the path elements are combined to allow themes
to be extended by adding icons in the user’s home directory.)

### `themeName`

`string` · default `null`

The name of the icon theme that is being used.

Unless set to a different value, this will be the value of
the `GtkSettings:gtk-icon-theme-name` property of the `GtkSettings`
object associated to the display of the icontheme object.

## Signals

### `onChanged`

```ts
(self: Gtk.IconTheme) => void
```

Emitted when the icon theme changes.

This can happen because current icon theme is switched or
because GTK detects that a change has occurred in the
contents of the current icon theme.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.IconTheme` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addResourcePath`

```ts
addResourcePath(path: string): void
```

Adds a resource path that will be looked at when looking
for icons, similar to search paths.

See `Gtk.IconTheme.setResourcePath()`.

This function should be used to make application-specific icons
available as part of the icon theme.

**Parameters**

- `path`: a resource path

### `addSearchPath`

```ts
addSearchPath(path: string): void
```

Appends a directory to the search path.

See `Gtk.IconTheme.setSearchPath()`.

**Parameters**

- `path`: directory name to append to the icon path

### `getDisplay`

```ts
getDisplay(): Gdk.Display | null
```

Returns the display that the `GtkIconTheme` object was
created for.

**Returns** the display of `icon_theme`

### `getIconNames`

```ts
getIconNames(): string[]
```

Lists the names of icons in the current icon theme.

**Returns** a string array
  holding the names of all the icons in the theme. You must
  free the array using `g_strfreev()`.

### `getIconSizes`

```ts
getIconSizes(iconName: string): number[]
```

Returns an array of integers describing the sizes at which
the icon is available without scaling.

A size of -1 means that the icon is available in a scalable
format. The array is zero-terminated.

**Parameters**

- `iconName`: the name of an icon

**Returns** A newly
  allocated array describing the sizes at which the icon is
  available. The array should be freed with `g_free()` when it is no
  longer needed.

### `getResourcePath`

```ts
getResourcePath(): string[] | null
```

Gets the current resource path.

See `Gtk.IconTheme.setResourcePath()`.

**Returns** A list of resource paths

### `getSearchPath`

```ts
getSearchPath(): string[] | null
```

Gets the current search path.

See `Gtk.IconTheme.setSearchPath()`.

**Returns** a list of icon theme path directories

### `getThemeName`

```ts
getThemeName(): string
```

Gets the current icon theme name.

**Returns** the current icon theme name,

### `hasGicon`

```ts
hasGicon(gicon: Gio.Icon): boolean
```

Checks whether an icon theme includes an icon
for a particular `GIcon`.

**Parameters**

- `gicon`: a `GIcon`

**Returns** `true` if `self` includes an icon for `gicon`

_Available since 4.2._

### `hasIcon`

```ts
hasIcon(iconName: string): boolean
```

Checks whether an icon theme includes an icon
for a particular name.

**Parameters**

- `iconName`: the name of an icon

**Returns** `true` if `self` includes an
 icon for `icon_name`.

### `lookupByGicon`

```ts
lookupByGicon(icon: Gio.Icon, size: number, scale: number, direction: Gtk.TextDirection, flags: Gtk.IconLookupFlags): Gtk.IconPaintable
```

Looks up a icon for a desired size and window scale.

The icon can then be rendered by using it as a `GdkPaintable`,
or you can get information such as the filename and size.

**Parameters**

- `icon`: the `GIcon` to look up
- `size`: desired icon size, in application pixels
- `scale`: the desired scale
- `direction`: text direction the icon will be displayed in
- `flags`: flags modifying the behavior of the icon lookup

**Returns** a `GtkIconPaintable` containing
  information about the icon. Unref with `g_object_unref()`

### `lookupIcon`

```ts
lookupIcon(iconName: string, fallbacks: string[] | null, size: number, scale: number, direction: Gtk.TextDirection, flags: Gtk.IconLookupFlags): Gtk.IconPaintable
```

Looks up a named icon for a desired size and window scale,
returning a `GtkIconPaintable`.

The icon can then be rendered by using it as a `GdkPaintable`,
or you can get information such as the filename and size.

If the available `icon_name` is not available and `fallbacks` are
provided, they will be tried in order.

If no matching icon is found, then a paintable that renders the
"missing icon" icon is returned. If you need to do something else
for missing icons you need to use `Gtk.IconTheme.hasIcon()`.

Note that you probably want to listen for icon theme changes and
update the icon. This is usually done by overriding the
GtkWidgetClass.css-`changed()` function.

**Parameters**

- `iconName`: the name of the icon to lookup
- `fallbacks`: fallback names
- `size`: desired icon size, in application pixels
- `scale`: the window scale this will be displayed on
- `direction`: text direction the icon will be displayed in
- `flags`: flags modifying the behavior of the icon lookup

**Returns** a `GtkIconPaintable` object
  containing the icon.

### `setResourcePath`

```ts
setResourcePath(path: string[] | null): void
```

Sets the resource paths that will be looked at when
looking for icons, similar to search paths.

The resources are considered as part of the hicolor icon theme
and must be located in subdirectories that are defined in the
hicolor icon theme, such as `@path/16x16/actions/run.png`
or `@path/scalable/actions/run.svg`.

Icons that are directly placed in the resource path instead
of a subdirectory are also considered as ultimate fallback,
but they are treated like unthemed icons.

**Parameters**

- `path`: NULL-terminated array of resource paths that are searched for icons

### `setSearchPath`

```ts
setSearchPath(path: string[] | null): void
```

Sets the search path for the icon theme object.

When looking for an icon theme, GTK will search for a subdirectory
of one or more of the directories in `path` with the same name
as the icon theme containing an index.theme file. (Themes from
multiple of the path elements are combined to allow themes to be
extended by adding icons in the user’s home directory.)

In addition if an icon found isn’t found either in the current
icon theme or the default icon theme, and an image file with
the right name is found directly in one of the elements of
`path`, then that image will be used for the icon name.
(This is legacy feature, and new icons should be put
into the fallback icon theme, which is called hicolor,
rather than directly on the icon path.)

**Parameters**

- `path`: NULL-terminated array of directories that are searched for icon themes

### `setThemeName`

```ts
setThemeName(themeName: string | null): void
```

Sets the name of the icon theme that the `GtkIconTheme` object uses
overriding system configuration.

This function cannot be called on the icon theme objects returned
from `Gtk.IconTheme.getForDisplay()`.

**Parameters**

- `themeName`: name of icon theme to use instead of configured theme, or `null` to unset a previously set custom theme
