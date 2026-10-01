---
description: "Refers to pixel data in various forms."
---

# GdkTexture

Refers to pixel data in various forms.

It is primarily meant for pixel data that will not change over
multiple frames, and will be used for a long time.

There are various ways to create `GdkTexture` objects from a
`GdkPixbuf.Pixbuf`, or from bytes stored in memory, a file, or a
`Gio.Resource`.

The ownership of the pixel data is transferred to the `GdkTexture`
instance; you can only make a copy of it, via `Gdk.Texture.download()`.

`GdkTexture` is an immutable object: That means you cannot change
anything about it other than increasing the reference count via
`GObject.Object.ref()`, and consequently, it is a threadsafe object.

GDK provides a number of threadsafe texture loading functions:
`Gdk.Texture.newFromResource()`,
`Gdk.Texture.newFromBytes()`,
`Gdk.Texture.newFromFile()`,
`Gdk.Texture.newFromFilename()`,
`Gdk.Texture.newForPixbuf()`. Note that these are meant for loading
icons and resources that are shipped with the toolkit or application. It
is recommended that you use a dedicated image loading framework such as
[glycin](https://lib.rs/crates/glycin), if you need to load untrusted image
data.

```tsx
import { GdkTexture } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkTexture**

Implements `GdkPaintable`, `GIcon`, `GLoadableIcon`.

## Props

`ref` receives the `Gdk.Texture` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `colorState`

`Gdk.ColorState` · construct-only

The color state of the texture.

_Available since 4.16._

### `height`

`number` · default `1` · construct-only

The height of the texture, in pixels.

### `width`

`number` · default `1` · construct-only

The width of the texture, in pixels.

## Signals

### `onInvalidateContents`

```ts
(self: Gdk.Texture) => void
```

From `GdkPaintable`.

Emitted when the contents of the `paintable` change.

Examples for such an event would be videos changing to the next frame or
the icon theme for an icon changing.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onInvalidateSize`

```ts
(self: Gdk.Texture) => void
```

From `GdkPaintable`.

Emitted when the intrinsic size of the `paintable` changes.

This means the values reported by at least one of
`Gdk.Paintable.getIntrinsicWidth()`,
`Gdk.Paintable.getIntrinsicHeight()` or
`Gdk.Paintable.getIntrinsicAspectRatio()`
has changed.

Examples for such an event would be a paintable displaying
the contents of a toplevel surface being resized.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gdk.Texture` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `download`

```ts
download(data: number, stride: number): void
```

Downloads the `texture` into local memory.

This may be an expensive operation, as the actual texture data
may reside on a GPU or on a remote display server.

The data format of the downloaded data is equivalent to
`CAIRO_FORMAT_ARGB32`, so every downloaded pixel requires
4 bytes of memory.

Downloading a texture into a Cairo image surface:
```c
surface = cairo_image_surface_create (CAIRO_FORMAT_ARGB32,
                                      gdk_texture_get_width (texture),
                                      gdk_texture_get_height (texture));
gdk_texture_download (texture,
                      cairo_image_surface_get_data (surface),
                      cairo_image_surface_get_stride (surface));
cairo_surface_mark_dirty (surface);
```

For more flexible download capabilities, see
`Gdk.TextureDownloader`.

**Parameters**

- `data`: pointer to enough memory to be filled with the downloaded data of `texture`
- `stride`: rowstride in bytes

### `getColorState`

```ts
getColorState(): Gdk.ColorState
```

Returns the color state associated with the texture.

**Returns** the color state of the `GdkTexture`

_Available since 4.16._

### `getFormat`

```ts
getFormat(): Gdk.MemoryFormat
```

Gets the memory format most closely associated with the data of
the texture.

Note that it may not be an exact match for texture data
stored on the GPU or with compression.

The format can give an indication about the bit depth and opacity
of the texture and is useful to determine the best format for
downloading the texture.

**Returns** the preferred format for the texture's data

_Available since 4.10._

### `getHeight`

```ts
getHeight(): number
```

Returns the height of the `texture`, in pixels.

**Returns** the height of the `GdkTexture`

### `getWidth`

```ts
getWidth(): number
```

Returns the width of `texture`, in pixels.

**Returns** the width of the `GdkTexture`

### `saveToPng`

```ts
saveToPng(filename: string): boolean
```

Store the given `texture` to the `filename` as a PNG file.

This is a utility function intended for debugging and testing.
If you want more control over formats, proper error handling or
want to store to a `Gio.File` or other location, you might
want to use `Gdk.Texture.saveToPngBytes()` or look into
the libglycin library.

**Parameters**

- `filename`: the filename to store to

**Returns** `true` if saving succeeded, `false` on failure.

### `saveToPngBytes`

```ts
saveToPngBytes(): GLib.Bytes
```

Store the given `texture` in memory as a PNG file.

Use `Gdk.Texture.newFromBytes()` to read it back.

If you want to serialize a texture, this is a convenient and
portable way to do that.

If you need more control over the generated image, such as
attaching metadata, you should look into an image handling
library such as the libglycin library.

If you are dealing with high dynamic range float data, you
might also want to consider `Gdk.Texture.saveToTiffBytes()`
instead.

**Returns** a newly allocated `GBytes` containing PNG data

_Available since 4.6._

### `saveToTiff`

```ts
saveToTiff(filename: string): boolean
```

Store the given `texture` to the `filename` as a TIFF file.

GTK will attempt to store data without loss.

**Parameters**

- `filename`: the filename to store to

**Returns** `true` if saving succeeded, `false` on failure.

_Available since 4.6._

### `saveToTiffBytes`

```ts
saveToTiffBytes(): GLib.Bytes
```

Store the given `texture` in memory as a TIFF file.

Use `Gdk.Texture.newFromBytes()` to read it back.

This function is intended to store a representation of the
texture's data that is as accurate as possible. This is
particularly relevant when working with high dynamic range
images and floating-point texture data.

If that is not your concern and you are interested in a
smaller size and a more portable format, you might want to
use `Gdk.Texture.saveToPngBytes()`.

**Returns** a newly allocated `GBytes` containing TIFF data

_Available since 4.6._
