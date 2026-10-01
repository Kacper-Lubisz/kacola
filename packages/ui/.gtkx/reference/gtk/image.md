---
description: "Displays an image."
---

# GtkImage

Displays an image.



Various kinds of object can be displayed as an image; most typically,
you would load a `GdkTexture` from a file, using the convenience function
`Gtk.Image.newFromFile()`, for instance:

```c
GtkWidget *image = gtk_image_new_from_file ("myfile.png");
```

If the file isn’t loaded successfully, the image will contain a
“broken image” icon similar to that used in many web browsers.

If you want to handle errors in loading the file yourself, for example
by displaying an error message, then load the image with an image
loading framework such as libglycin, then create the `GtkImage` with
`Gtk.Image.newFromPaintable()`.

Sometimes an application will want to avoid depending on external data
files, such as image files. See the documentation of `GResource` inside
GIO, for details. In this case, `Gtk.Image.resource`,
`Gtk.Image.newFromResource()`, and `Gtk.Image.setFromResource()`
should be used.

`GtkImage` displays its image as an icon, with a size that is determined
by the application. See `Gtk.Picture` if you want to show an image
at is actual size.

### CSS nodes

`GtkImage` has a single CSS node with the name `image`. The style classes
`.normal-icons` or `.large-icons` may appear, depending on the
`Gtk.Image.iconSize` property.

### Accessibility

`GtkImage` uses the `Gtk.AccessibleRole.img` role.

```tsx
import { GtkImage } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkImage**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Image` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `file`

`string` · default `null`

A path to the file to display.

### `gicon`

`Gio.Icon | ReactElement`

The `GIcon` displayed in the GtkImage.

For themed icons, If the icon theme is changed, the image will be updated
automatically.

### `iconName`

`string` · default `null`

The name of the icon in the icon theme.

If the icon theme is changed, the image will be updated automatically.

### `iconSize`

`Gtk.IconSize` · default `GTK_ICON_SIZE_INHERIT`

The symbolic size to display icons at.

### `paintable`

`Gdk.Paintable | ReactElement`

The `GdkPaintable` to display.

### `pixelSize`

`number` · default `-1`

The size in pixels to display icons at.

If set to a value != -1, this property overrides the
`Gtk.Image.iconSize` property for images of type
`GTK_IMAGE_ICON_NAME`.

### `resource`

`string` · default `null`

A path to a resource file to display.

### `storageType`

`Gtk.ImageType` · default `GTK_IMAGE_EMPTY` · read-only, observe with `onNotifyStorageType`

The representation being used for image data.

### `useFallback`

`boolean` · default `false`

Whether the icon displayed in the `GtkImage` will use
standard icon names fallback.

The value of this property is only relevant for images of type
`GTK_IMAGE_ICON_NAME` and `GTK_IMAGE_GICON`.

## Methods

Methods are called on the `Gtk.Image` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `clear`

```ts
clear(): void
```

Resets the image to be empty.

### `getGicon`

```ts
getGicon(): Gio.Icon | null
```

Gets the `GIcon` being displayed by the `GtkImage`.

The storage type of the image must be `GTK_IMAGE_EMPTY` or
`GTK_IMAGE_GICON` (see `Gtk.Image.getStorageType()`).
The caller of this function does not own a reference to the
returned `GIcon`.

**Returns** a `GIcon`

### `getIconName`

```ts
getIconName(): string | null
```

Gets the icon name and size being displayed by the `GtkImage`.

The storage type of the image must be `GTK_IMAGE_EMPTY` or
`GTK_IMAGE_ICON_NAME` (see `Gtk.Image.getStorageType()`).
The returned string is owned by the `GtkImage` and should not
be freed.

**Returns** the icon name

### `getIconSize`

```ts
getIconSize(): Gtk.IconSize
```

Gets the icon size used by the `image` when rendering icons.

**Returns** the image size used by icons

### `getPaintable`

```ts
getPaintable(): Gdk.Paintable | null
```

Gets the image `GdkPaintable` being displayed by the `GtkImage`.

The storage type of the image must be `GTK_IMAGE_EMPTY` or
`GTK_IMAGE_PAINTABLE` (see `Gtk.Image.getStorageType()`).
The caller of this function does not own a reference to the
returned paintable.

**Returns** the displayed paintable

### `getPixelSize`

```ts
getPixelSize(): number
```

Gets the pixel size used for named icons.

**Returns** the pixel size used for named icons.

### `getStorageType`

```ts
getStorageType(): Gtk.ImageType
```

Gets the type of representation being used by the `GtkImage`
to store image data.

If the `GtkImage` has no image data, the return value will
be `GTK_IMAGE_EMPTY`.

**Returns** image representation being used

### `setFromFile`

```ts
setFromFile(filename: string | null): void
```

Sets a `GtkImage` to show a file.

See `Gtk.Image.newFromFile()` for details.

::: warning
    Note that this function should not be used with untrusted data.
    Use a proper image loading framework such as libglycin, which can
    load many image formats into a `GdkTexture`, and then use
    `Gtk.Image.setFromPaintable()`.

**Parameters**

- `filename`: a filename

### `setFromGicon`

```ts
setFromGicon(icon: Gio.Icon): void
```

Sets a `GtkImage` to show a `GIcon`.

See `Gtk.Image.newFromGicon()` for details.

**Parameters**

- `icon`: an icon

### `setFromIconName`

```ts
setFromIconName(iconName: string | null): void
```

Sets a `GtkImage` to show a named icon.

See `Gtk.Image.newFromIconName()` for details.

**Parameters**

- `iconName`: an icon name

### `setFromPaintable`

```ts
setFromPaintable(paintable: Gdk.Paintable | null): void
```

Sets a `GtkImage` to show a `GdkPaintable`.

See `Gtk.Image.newFromPaintable()` for details.

**Parameters**

- `paintable`: a `GdkPaintable`

### `setFromPixbuf`

```ts
setFromPixbuf(pixbuf: GdkPixbuf.Pixbuf | null): void
```

Sets a `GtkImage` to show a `GdkPixbuf`.

See `Gtk.Image.newFromPixbuf()` for details.

Note: This is a helper for `Gtk.Image.setFromPaintable()`,
and you can't get back the exact pixbuf once this is called,
only a paintable.

**Parameters**

- `pixbuf`: a `GdkPixbuf` or `NULL`

> **Deprecated since 4.12.** Use `Gtk.Image.setFromPaintable()` instead

### `setFromResource`

```ts
setFromResource(resourcePath: string | null): void
```

Sets a `GtkImage` to show a resource.

See `Gtk.Image.newFromResource()` for details.

**Parameters**

- `resourcePath`: a resource path

### `setIconSize`

```ts
setIconSize(iconSize: Gtk.IconSize): void
```

Suggests an icon size to the theme for named icons.

**Parameters**

- `iconSize`: the new icon size

### `setPixelSize`

```ts
setPixelSize(pixelSize: number): void
```

Sets the pixel size to use for named icons.

If the pixel size is set to a value != -1, it is used instead
of the icon size set by `Gtk.Image.setIconSize()`.

**Parameters**

- `pixelSize`: the new pixel size
