---
description: "Incremental image loader."
---

# GdkPixbufLoader

Incremental image loader.

`GdkPixbufLoader` provides a way for applications to drive the
process of loading an image, by letting them send the image data
directly to the loader instead of having the loader read the data
from a file. Applications can use this functionality instead of
`gdk_pixbuf_new_from_file()` or `gdk_pixbuf_animation_new_from_file()`
when they need to parse image data in small chunks. For example,
it should be used when reading an image from a (potentially) slow
network connection, or when loading an extremely large file.

To use `GdkPixbufLoader` to load an image, create a new instance,
and call `GdkPixbuf.PixbufLoader.write()` to send the data
to it. When done, `GdkPixbuf.PixbufLoader.close()` should be
called to end the stream and finalize everything.

The loader will emit three important signals throughout the process:

 - `GdkPixbuf.PixbufLoader.size-prepared` will be emitted as
   soon as the image has enough information to determine the size of
   the image to be used. If you want to scale the image while loading
   it, you can call `GdkPixbuf.PixbufLoader.setSize()` in
   response to this signal.
 - `GdkPixbuf.PixbufLoader.area-prepared` will be emitted as
   soon as the pixbuf of the desired has been allocated. You can obtain
   the `GdkPixbuf` instance by calling `GdkPixbuf.PixbufLoader.getPixbuf()`.
   If you want to use it, simply acquire a reference to it. You can
   also call `gdk_pixbuf_loader_get_pixbuf()` later to get the same
   pixbuf.
 - `GdkPixbuf.PixbufLoader.area-updated` will be emitted every
   time a region is updated. This way you can update a partially
   completed image. Note that you do not know anything about the
   completeness of an image from the updated area. For example, in an
   interlaced image you will need to make several passes before the
   image is done loading.

### Loading an animation

Loading an animation is almost as easy as loading an image. Once the
first `GdkPixbuf.PixbufLoader.area-prepared` signal has been
emitted, you can call `GdkPixbuf.PixbufLoader.getAnimation()` to
get the `GdkPixbuf.PixbufAnimation` instance, and then call
and `GdkPixbuf.PixbufAnimation.getIter()` to get a
`GdkPixbuf.PixbufAnimationIter` to retrieve the pixbuf for the
desired time stamp.

```tsx
import { GdkPixbufLoader } from "@gtkx/jsx/gdkpixbuf";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkPixbufLoader**

## Props

`ref` receives the `GdkPixbuf.PixbufLoader` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onAreaPrepared`

```ts
(self: GdkPixbuf.PixbufLoader) => void
```

This signal is emitted when the pixbuf loader has allocated the
pixbuf in the desired size.

After this signal is emitted, applications can call
`gdk_pixbuf_loader_get_pixbuf()` to fetch the partially-loaded
pixbuf.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onAreaUpdated`

```ts
(x: number, y: number, width: number, height: number, self: GdkPixbuf.PixbufLoader) => void
```

This signal is emitted when a significant area of the image being
loaded has been updated.

Normally it means that a complete scanline has been read in, but
it could be a different area as well.

Applications can use this signal to know when to repaint
areas of an image that is being loaded.

**Parameters**

- `x`: X offset of upper-left corner of the updated area.
- `y`: Y offset of upper-left corner of the updated area.
- `width`: Width of updated area.
- `height`: Height of updated area.
- `self`: The instance the signal was emitted on.

### `onClosed`

```ts
(self: GdkPixbuf.PixbufLoader) => void
```

This signal is emitted when `gdk_pixbuf_loader_close()` is called.

It can be used by different parts of an application to receive
notification when an image loader is closed by the code that
drives it.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onSizePrepared`

```ts
(width: number, height: number, self: GdkPixbuf.PixbufLoader) => void
```

This signal is emitted when the pixbuf loader has been fed the
initial amount of data that is required to figure out the size
of the image that it will create.

Applications can call `gdk_pixbuf_loader_set_size()` in response
to this signal to set the desired size to which the image
should be scaled.

**Parameters**

- `width`: the original width of the image
- `height`: the original height of the image
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `GdkPixbuf.PixbufLoader` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdkpixbuf`. Methods inherited from ancestors are documented on their own pages.

### `close`

```ts
close(): boolean
```

Informs a pixbuf loader that no further writes with
`gdk_pixbuf_loader_write()` will occur, so that it can free its
internal loading structures.

This function also tries to parse any data that hasn't yet been parsed;
if the remaining data is partial or corrupt, an error will be returned.

If `FALSE` is returned, `error` will be set to an error from the
`GDK_PIXBUF_ERROR` or `G_FILE_ERROR` domains.

If you're just cancelling a load rather than expecting it to be finished,
passing `NULL` for `error` to ignore it is reasonable.

Remember that this function does not release a reference on the loader, so
you will need to explicitly release any reference you hold.

**Returns** `TRUE` if all image data written so far was successfully
  passed out via the update_area signal

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `getAnimation`

```ts
getAnimation(): GdkPixbuf.PixbufAnimation | null
```

Queries the `GdkPixbufAnimation` that a pixbuf loader is currently creating.

In general it only makes sense to call this function after the
`GdkPixbuf.PixbufLoader.area-prepared` signal has been emitted by
the loader.

If the loader doesn't have enough bytes yet, and hasn't emitted the `area-prepared`
signal, this function will return `NULL`.

**Returns** The animation that the loader is
  currently loading

### `getFormat`

```ts
getFormat(): GdkPixbuf.PixbufFormat | null
```

Obtains the available information about the format of the
currently loading image file.

**Returns** A `GdkPixbufFormat`

_Available since 2.2._

### `getPixbuf`

```ts
getPixbuf(): GdkPixbuf.Pixbuf | null
```

Queries the `GdkPixbuf` that a pixbuf loader is currently creating.

In general it only makes sense to call this function after the
`GdkPixbuf.PixbufLoader.area-prepared` signal has been
emitted by the loader; this means that enough data has been read
to know the size of the image that will be allocated.

If the loader has not received enough data via `gdk_pixbuf_loader_write()`,
then this function returns `NULL`.

The returned pixbuf will be the same in all future calls to the loader,
so if you want to keep using it, you should acquire a reference to it.

Additionally, if the loader is an animation, it will return the "static
image" of the animation (see `gdk_pixbuf_animation_get_static_image()`).

**Returns** The pixbuf that the loader is
  creating

### `setSize`

```ts
setSize(width: number, height: number): void
```

Causes the image to be scaled while it is loaded.

The desired image size can be determined relative to the original
size of the image by calling `gdk_pixbuf_loader_set_size()` from a
signal handler for the ::size-prepared signal.

Attempts to set the desired image size  are ignored after the
emission of the ::size-prepared signal.

**Parameters**

- `width`: The desired width of the image being loaded.
- `height`: The desired height of the image being loaded.

_Available since 2.2._

### `write`

```ts
write(buf: Uint8Array | number[]): boolean
```

Parses the next `count` bytes in the given image buffer.

**Parameters**

- `buf`: Pointer to image data.

**Returns** `TRUE` if the write was successful, or
  `FALSE` if the loader cannot parse the buffer

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `writeBytes`

```ts
writeBytes(buffer: GLib.Bytes): boolean
```

Parses the next contents of the given image buffer.

**Parameters**

- `buffer`: The image data as a `GBytes` buffer.

**Returns** `TRUE` if the write was successful, or `FALSE` if
  the loader cannot parse the buffer

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._
