---
description: "Displays a GdkPaintable."
---

# GtkPicture

Displays a `GdkPaintable`.



Many convenience functions are provided to make pictures simple to use.
For example, if you want to load an image from a file, and then display
it, there’s a convenience function to do this:

```c
GtkWidget *widget = gtk_picture_new_for_filename ("myfile.png");
```

If the file isn’t loaded successfully, the picture will contain a
“broken image” icon similar to that used in many web browsers.
If you want to handle errors in loading the file yourself,
for example by displaying an error message, then load the image with
and image loading framework such as libglycin, then create the `GtkPicture`
with `Gtk.Picture.newForPaintable()`.

Sometimes an application will want to avoid depending on external data
files, such as image files. See the documentation of `GResource` for details.
In this case, `Gtk.Picture.newForResource()` and
`Gtk.Picture.setResource()` should be used.

`GtkPicture` displays an image at its natural size. See `Gtk.Image`
if you want to display a fixed-size image, such as an icon.

### Sizing the paintable

You can influence how the paintable is displayed inside the `GtkPicture`
by changing `Gtk.Picture.contentFit`. See `Gtk.ContentFit`
for details. `Gtk.Picture.canShrink` can be unset to make sure
that paintables are never made smaller than their ideal size - but
be careful if you do not know the size of the paintable in use (like
when displaying user-loaded images). This can easily cause the picture to
grow larger than the screen. And `Gtk.Widget.halign` and
`Gtk.Widget.valign` can be used to make sure the paintable doesn't
fill all available space but is instead displayed at its original size.

### CSS nodes

`GtkPicture` has a single CSS node with the name `picture`.

### Accessibility

`GtkPicture` uses the `Gtk.AccessibleRole.img` role.

```tsx
import { GtkPicture } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkPicture**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Picture` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `alternativeText`

`string` · default `null`

The alternative textual description for the picture.

### `canShrink`

`boolean` · default `true`

If the `GtkPicture` can be made smaller than the natural size of its contents.

### `contentFit`

`Gtk.ContentFit` · default `GTK_CONTENT_FIT_CONTAIN`

How the content should be resized to fit inside the `GtkPicture`.

_Available since 4.8._

### `file`

`Gio.File | ReactElement`

The `GFile` that is displayed or `null` if none.

### `isolateContents`

`boolean` · default `true`

If the rendering of the contents is isolated from the rest of the widget tree.

_Available since 4.22._

### `keepAspectRatio`

`boolean` · default `true` · deprecated since 4.8

Whether the GtkPicture will render its contents trying to preserve the aspect
ratio.

> **Deprecated since 4.8.** Use `Gtk.Picture.contentFit` instead.

### `paintable`

`Gdk.Paintable | ReactElement`

The `GdkPaintable` to be displayed by this `GtkPicture`.

## Methods

Methods are called on the `Gtk.Picture` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAlternativeText`

```ts
getAlternativeText(): string | null
```

Gets the alternative textual description of the picture.

The returned string will be `null` if the picture cannot be described textually.

**Returns** the alternative textual description of `self`.

### `getCanShrink`

```ts
getCanShrink(): boolean
```

Returns whether the `GtkPicture` respects its contents size.

**Returns** `true` if the picture can be made smaller than its contents

### `getContentFit`

```ts
getContentFit(): Gtk.ContentFit
```

Returns the fit mode for the content of the `GtkPicture`.

See `Gtk.ContentFit` for details.

**Returns** the content fit mode

_Available since 4.8._

### `getFile`

```ts
getFile(): Gio.File | null
```

Gets the `GFile` currently displayed if `self` is displaying a file.

If `self` is not displaying a file, for example when
`Gtk.Picture.setPaintable()` was used, then `null` is returned.

**Returns** The `GFile` displayed by `self`.

### `getIsolateContents`

```ts
getIsolateContents(): boolean
```

Returns whether the contents are isolated.

**Returns** True if contents are isolated

_Available since 4.22._

### `getKeepAspectRatio`

```ts
getKeepAspectRatio(): boolean
```

Returns whether the `GtkPicture` preserves its contents aspect ratio.

**Returns** `true` if the self tries to keep the contents' aspect ratio

> **Deprecated since 4.8.** Use `Gtk.Picture.getContentFit()` instead. This will now return `FALSE` only if `Gtk.Picture.contentFit` is `GTK_CONTENT_FIT_FILL`. Returns `TRUE` otherwise.

### `getPaintable`

```ts
getPaintable(): Gdk.Paintable | null
```

Gets the `GdkPaintable` being displayed by the `GtkPicture`.

**Returns** the displayed paintable

### `setAlternativeText`

```ts
setAlternativeText(alternativeText: string | null): void
```

Sets an alternative textual description for the picture contents.

It is equivalent to the "alt" attribute for images on websites.

This text will be made available to accessibility tools.

If the picture cannot be described textually, set this property to `null`.

**Parameters**

- `alternativeText`: a textual description of the contents

### `setCanShrink`

```ts
setCanShrink(canShrink: boolean): void
```

If set to `true`, then `self` can be made smaller than its contents.

The contents will then be scaled down when rendering.

If you want to still force a minimum size manually, consider using
`Gtk.Widget.setSizeRequest()`.

Also of note is that a similar function for growing does not exist
because the grow behavior can be controlled via
`Gtk.Widget.setHalign()` and `Gtk.Widget.setValign()`.

**Parameters**

- `canShrink`: if `self` can be made smaller than its contents

### `setContentFit`

```ts
setContentFit(contentFit: Gtk.ContentFit): void
```

Sets how the content should be resized to fit the `GtkPicture`.

See `Gtk.ContentFit` for details.

**Parameters**

- `contentFit`: the content fit mode

_Available since 4.8._

### `setFile`

```ts
setFile(file: Gio.File | null): void
```

Makes `self` load and display `file`.

See `Gtk.Picture.newForFile()` for details.

::: warning
    Note that this function should not be used with untrusted data.
    Use a proper image loading framework such as libglycin, which can
    load many image formats into a `GdkTexture`, and then use
    `Gtk.Image.setFromPaintable()`.

**Parameters**

- `file`: a `GFile`

### `setFilename`

```ts
setFilename(filename: string | null): void
```

Makes `self` load and display the given `filename`.

This is a utility function that calls `Gtk.Picture.setFile()`.

::: warning
    Note that this function should not be used with untrusted data.
    Use a proper image loading framework such as libglycin, which can
    load many image formats into a `GdkTexture`, and then use
    `Gtk.Image.setFromPaintable()`.

**Parameters**

- `filename`: the filename to play

### `setIsolateContents`

```ts
setIsolateContents(isolateContents: boolean): void
```

If set to true, then the contents will be rendered individually.

If set to false they will be able to erase or otherwise mix with
the background.

GTK supports finer grained isolation, in rare cases where you need
this, you can use `Gtk.Snapshot.pushIsolation()` yourself to
achieve this.

By default contents are isolated.

**Parameters**

- `isolateContents`: if contents are rendered separately

_Available since 4.22._

### `setKeepAspectRatio`

```ts
setKeepAspectRatio(keepAspectRatio: boolean): void
```

If set to `true`, the `self` will render its contents according to
their aspect ratio.

That means that empty space may show up at the top/bottom or
left/right of `self`.

If set to `false` or if the contents provide no aspect ratio,
the contents will be stretched over the picture's whole area.

**Parameters**

- `keepAspectRatio`: whether to keep aspect ratio

> **Deprecated since 4.8.** Use `Gtk.Picture.setContentFit()` instead. If still used, this method will always set the `Gtk.Picture.contentFit` property to `GTK_CONTENT_FIT_CONTAIN` if `keep_aspect_ratio` is true, otherwise it will set it to `GTK_CONTENT_FIT_FILL`.

### `setPaintable`

```ts
setPaintable(paintable: Gdk.Paintable | null): void
```

Makes `self` display the given `paintable`.

If `paintable` is `NULL`, nothing will be displayed.

See `Gtk.Picture.newForPaintable()` for details.

**Parameters**

- `paintable`: a `GdkPaintable`

### `setPixbuf`

```ts
setPixbuf(pixbuf: GdkPixbuf.Pixbuf | null): void
```

Sets a `GtkPicture` to show a `GdkPixbuf`.

See `Gtk.Picture.newForPixbuf()` for details.

This is a utility function that calls `Gtk.Picture.setPaintable()`.

**Parameters**

- `pixbuf`: a `GdkPixbuf`

> **Deprecated since 4.12.** Use `Gtk.Picture.setPaintable()` instead

### `setResource`

```ts
setResource(resourcePath: string | null): void
```

Makes `self` load and display the resource at the given
`resource_path`.

This is a utility function that calls `Gtk.Picture.setFile()`.

**Parameters**

- `resourcePath`: the resource to set
