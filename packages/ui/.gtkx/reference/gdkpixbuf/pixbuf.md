---
description: "A pixel buffer."
---

# GdkPixbuf

A pixel buffer.

`GdkPixbuf` contains information about an image's pixel data,
its color space, bits per sample, width and height, and the
rowstride (the number of bytes between the start of one row
and the start of the next).

### Creating new `GdkPixbuf`

The most basic way to create a pixbuf is to wrap an existing pixel
buffer with a `GdkPixbuf.Pixbuf` instance. You can use the
[`ctor@GdkPixbuf.Pixbuf.new_from_data`] function to do this.

Every time you create a new `GdkPixbuf` instance for some data, you
will need to specify the destroy notification function that will be
called when the data buffer needs to be freed; this will happen when
a `GdkPixbuf` is finalized by the reference counting functions. If
you have a chunk of static data compiled into your application, you
can pass in `NULL` as the destroy notification function so that the
data will not be freed.

The [`ctor@GdkPixbuf.Pixbuf.new`] constructor function can be used
as a convenience to create a pixbuf with an empty buffer; this is
equivalent to allocating a data buffer using `malloc()` and then
wrapping it with `gdk_pixbuf_new_from_data()`. The `gdk_pixbuf_new()`
function will compute an optimal rowstride so that rendering can be
performed with an efficient algorithm.

You can also copy an existing pixbuf with the `Pixbuf.copy()`
function. This is not the same as just acquiring a reference to
the old pixbuf instance: the copy function will actually duplicate
the pixel data in memory and create a new `Pixbuf` instance
for it.

### Reference counting

`GdkPixbuf` structures are reference counted. This means that an
application can share a single pixbuf among many parts of the
code. When a piece of the program needs to use a pixbuf, it should
acquire a reference to it by calling `g_object_ref()`; when it no
longer needs the pixbuf, it should release the reference it acquired
by calling `g_object_unref()`. The resources associated with a
`GdkPixbuf` will be freed when its reference count drops to zero.
Newly-created `GdkPixbuf` instances start with a reference count
of one.

### Image Data

Image data in a pixbuf is stored in memory in an uncompressed,
packed format. Rows in the image are stored top to bottom, and
in each row pixels are stored from left to right.

There may be padding at the end of a row.

The "rowstride" value of a pixbuf, as returned by [`method@GdkPixbuf.Pixbuf.get_rowstride`],
indicates the number of bytes between rows.

**NOTE**: If you are copying raw pixbuf data with `memcpy()` note that the
last row in the pixbuf may not be as wide as the full rowstride, but rather
just as wide as the pixel data needs to be; that is: it is unsafe to do
`memcpy (dest, pixels, rowstride * height)` to copy a whole pixbuf. Use
`GdkPixbuf.Pixbuf.copy()` instead, or compute the width in bytes of the
last row as:

```c
last_row = width * ((n_channels * bits_per_sample + 7) / 8);
```

The same rule applies when iterating over each row of a `GdkPixbuf` pixels
array.

The following code illustrates a simple `put_pixel()`
function for RGB pixbufs with 8 bits per channel with an alpha
channel.

```c
static void
put_pixel (GdkPixbuf *pixbuf,
           int x,
	   int y,
	   guchar red,
	   guchar green,
	   guchar blue,
	   guchar alpha)
{
  int n_channels = gdk_pixbuf_get_n_channels (pixbuf);

  // Ensure that the pixbuf is valid
  g_assert (gdk_pixbuf_get_colorspace (pixbuf) == GDK_COLORSPACE_RGB);
  g_assert (gdk_pixbuf_get_bits_per_sample (pixbuf) == 8);
  g_assert (gdk_pixbuf_get_has_alpha (pixbuf));
  g_assert (n_channels == 4);

  int width = gdk_pixbuf_get_width (pixbuf);
  int height = gdk_pixbuf_get_height (pixbuf);

  // Ensure that the coordinates are in a valid range
  g_assert (x >= 0 && x < width);
  g_assert (y >= 0 && y < height);

  int rowstride = gdk_pixbuf_get_rowstride (pixbuf);

  // The pixel buffer in the GdkPixbuf instance
  guchar *pixels = gdk_pixbuf_get_pixels (pixbuf);

  // The pixel we wish to modify
  guchar *p = pixels + y * rowstride + x * n_channels;
  p[0] = red;
  p[1] = green;
  p[2] = blue;
  p[3] = alpha;
}
```

### Loading images

The `GdkPixBuf` class provides a simple mechanism for loading
an image from a file in synchronous and asynchronous fashion.

For GUI applications, it is recommended to use the asynchronous
stream API to avoid blocking the control flow of the application.

Additionally, `GdkPixbuf` provides the [class@GdkPixbuf.PixbufLoader`]
API for progressive image loading.

### Saving images

The `GdkPixbuf` class provides methods for saving image data in
a number of file formats. The formatted data can be written to a
file or to a memory buffer. `GdkPixbuf` can also call a user-defined
callback on the data, which allows to e.g. write the image
to a socket or store it in a database.

```tsx
import { GdkPixbuf } from "@gtkx/jsx/gdkpixbuf";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkPixbuf**

Implements `GIcon`, `GLoadableIcon`.

## Props

`ref` receives the `GdkPixbuf.Pixbuf` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `bitsPerSample`

`number` · default `8` · construct-only

The number of bits per sample.

Currently only 8 bit per sample are supported.

### `colorspace`

`GdkPixbuf.Colorspace` · default `GDK_COLORSPACE_RGB` · construct-only

The color space of the pixbuf.

Currently, only `GDK_COLORSPACE_RGB` is supported.

### `hasAlpha`

`boolean` · default `false` · construct-only

Whether the pixbuf has an alpha channel.

### `height`

`number` · default `1` · construct-only

The number of rows of the pixbuf.

### `nChannels`

`number` · default `3` · construct-only

The number of samples per pixel.

Currently, only 3 or 4 samples per pixel are supported.

### `pixelBytes`

`GLib.Bytes` · construct-only

### `pixels`

`bigint` · construct-only

A pointer to the pixel data of the pixbuf.

### `rowstride`

`number` · default `1` · construct-only

The number of bytes between the start of a row and
the start of the next row.

This number must (obviously) be at least as large as the
width of the pixbuf.

### `width`

`number` · default `1` · construct-only

The number of columns of the pixbuf.

## Methods

Methods are called on the `GdkPixbuf.Pixbuf` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdkpixbuf`. Methods inherited from ancestors are documented on their own pages.

### `addAlpha`

```ts
addAlpha(substituteColor: boolean, r: number, g: number, b: number): GdkPixbuf.Pixbuf | null
```

Takes an existing pixbuf and adds an alpha channel to it.

If the existing pixbuf already had an alpha channel, the channel
values are copied from the original; otherwise, the alpha channel
is initialized to 255 (full opacity).

If `substitute_color` is `TRUE`, then the color specified by the
(`r`, `g`, `b`) arguments will be assigned zero opacity. That is,
if you pass `(255, 255, 255)` for the substitute color, all white
pixels will become fully transparent.

If `substitute_color` is `FALSE`, then the (`r`, `g`, `b`) arguments
will be ignored.

**Parameters**

- `substituteColor`: Whether to set a color to zero opacity.
- `r`: Red value to substitute.
- `g`: Green value to substitute.
- `b`: Blue value to substitute.

**Returns** A newly-created pixbuf

### `applyEmbeddedOrientation`

```ts
applyEmbeddedOrientation(): GdkPixbuf.Pixbuf | null
```

Takes an existing pixbuf and checks for the presence of an
associated "orientation" option.

The orientation option may be provided by the JPEG loader (which
reads the exif orientation tag) or the TIFF loader (which reads
the TIFF orientation tag, and compensates it for the partial
transforms performed by libtiff).

If an orientation option/tag is present, the appropriate transform
will be performed so that the pixbuf is oriented correctly.

**Returns** A newly-created pixbuf

_Available since 2.12._

### `composite`

```ts
composite(dest: GdkPixbuf.Pixbuf, destX: number, destY: number, destWidth: number, destHeight: number, offsetX: number, offsetY: number, scaleX: number, scaleY: number, interpType: GdkPixbuf.InterpType, overallAlpha: number): void
```

Creates a transformation of the source image `src` by scaling by
`scale_x` and `scale_y` then translating by `offset_x` and `offset_y`.

This gives an image in the coordinates of the destination pixbuf.
The rectangle (`dest_x`, `dest_y`, `dest_width`, `dest_height`)
is then alpha blended onto the corresponding rectangle of the
original destination image.

When the destination rectangle contains parts not in the source
image, the data at the edges of the source image is replicated
to infinity.

![](composite.png)

**Parameters**

- `dest`: the `GdkPixbuf` into which to render the results
- `destX`: the left coordinate for region to render
- `destY`: the top coordinate for region to render
- `destWidth`: the width of the region to render
- `destHeight`: the height of the region to render
- `offsetX`: the offset in the X direction (currently rounded to an integer)
- `offsetY`: the offset in the Y direction (currently rounded to an integer)
- `scaleX`: the scale factor in the X direction
- `scaleY`: the scale factor in the Y direction
- `interpType`: the interpolation type for the transformation.
- `overallAlpha`: overall alpha for source image (0..255)

### `compositeColor`

```ts
compositeColor(dest: GdkPixbuf.Pixbuf, destX: number, destY: number, destWidth: number, destHeight: number, offsetX: number, offsetY: number, scaleX: number, scaleY: number, interpType: GdkPixbuf.InterpType, overallAlpha: number, checkX: number, checkY: number, checkSize: number, color1: number, color2: number): void
```

Creates a transformation of the source image `src` by scaling by
`scale_x` and `scale_y` then translating by `offset_x` and `offset_y`,
then alpha blends the rectangle (`dest_x` ,`dest_y`, `dest_width`,
`dest_height`) of the resulting image with a checkboard of the
colors `color1` and `color2` and renders it onto the destination
image.

If the source image has no alpha channel, and `overall_alpha` is 255, a fast
path is used which omits the alpha blending and just performs the scaling.

See `gdk_pixbuf_composite_color_simple()` for a simpler variant of this
function suitable for many tasks.

**Parameters**

- `dest`: the `GdkPixbuf` into which to render the results
- `destX`: the left coordinate for region to render
- `destY`: the top coordinate for region to render
- `destWidth`: the width of the region to render
- `destHeight`: the height of the region to render
- `offsetX`: the offset in the X direction (currently rounded to an integer)
- `offsetY`: the offset in the Y direction (currently rounded to an integer)
- `scaleX`: the scale factor in the X direction
- `scaleY`: the scale factor in the Y direction
- `interpType`: the interpolation type for the transformation.
- `overallAlpha`: overall alpha for source image (0..255)
- `checkX`: the X offset for the checkboard (origin of checkboard is at -`check_x`, -`check_y`)
- `checkY`: the Y offset for the checkboard
- `checkSize`: the size of checks in the checkboard (must be a power of two)
- `color1`: the color of check at upper left
- `color2`: the color of the other check

### `compositeColorSimple`

```ts
compositeColorSimple(destWidth: number, destHeight: number, interpType: GdkPixbuf.InterpType, overallAlpha: number, checkSize: number, color1: number, color2: number): GdkPixbuf.Pixbuf | null
```

Creates a new pixbuf by scaling `src` to `dest_width` x `dest_height`
and alpha blending the result with a checkboard of colors `color1`
and `color2`.

**Parameters**

- `destWidth`: the width of destination image
- `destHeight`: the height of destination image
- `interpType`: the interpolation type for the transformation.
- `overallAlpha`: overall alpha for source image (0..255)
- `checkSize`: the size of checks in the checkboard (must be a power of two)
- `color1`: the color of check at upper left
- `color2`: the color of the other check

**Returns** the new pixbuf

### `copy`

```ts
copy(): GdkPixbuf.Pixbuf | null
```

Creates a new `GdkPixbuf` with a copy of the information in the specified
`pixbuf`.

Note that this does not copy the options set on the original `GdkPixbuf`,
use `gdk_pixbuf_copy_options()` for this.

**Returns** A newly-created pixbuf

### `copyArea`

```ts
copyArea(srcX: number, srcY: number, width: number, height: number, destPixbuf: GdkPixbuf.Pixbuf, destX: number, destY: number): void
```

Copies a rectangular area from `src_pixbuf` to `dest_pixbuf`.

Conversion of pixbuf formats is done automatically.

If the source rectangle overlaps the destination rectangle on the
same pixbuf, it will be overwritten during the copy operation.
Therefore, you can not use this function to scroll a pixbuf.

**Parameters**

- `srcX`: Source X coordinate within `src_pixbuf`.
- `srcY`: Source Y coordinate within `src_pixbuf`.
- `width`: Width of the area to copy.
- `height`: Height of the area to copy.
- `destPixbuf`: Destination pixbuf.
- `destX`: X coordinate within `dest_pixbuf`.
- `destY`: Y coordinate within `dest_pixbuf`.

### `copyOptions`

```ts
copyOptions(destPixbuf: GdkPixbuf.Pixbuf): boolean
```

Copies the key/value pair options attached to a `GdkPixbuf` to another
`GdkPixbuf`.

This is useful to keep original metadata after having manipulated
a file. However be careful to remove metadata which you've already
applied, such as the "orientation" option after rotating the image.

**Parameters**

- `destPixbuf`: the destination pixbuf

**Returns** `TRUE` on success.

_Available since 2.36._

### `fill`

```ts
fill(pixel: number): void
```

Clears a pixbuf to the given RGBA value, converting the RGBA value into
the pixbuf's pixel format.

The alpha component will be ignored if the pixbuf doesn't have an alpha
channel.

**Parameters**

- `pixel`: RGBA pixel to used to clear (`0xffffffff` is opaque white, `0x00000000` transparent black)

### `flip`

```ts
flip(horizontal: boolean): GdkPixbuf.Pixbuf | null
```

Flips a pixbuf horizontally or vertically and returns the
result in a new pixbuf.

**Parameters**

- `horizontal`: `TRUE` to flip horizontally, `FALSE` to flip vertically

**Returns** the new pixbuf

_Available since 2.6._

### `getBitsPerSample`

```ts
getBitsPerSample(): number
```

Queries the number of bits per color sample in a pixbuf.

**Returns** Number of bits per color sample.

### `getByteLength`

```ts
getByteLength(): number
```

Returns the length of the pixel data, in bytes.

**Returns** The length of the pixel data.

_Available since 2.26._

### `getColorspace`

```ts
getColorspace(): GdkPixbuf.Colorspace
```

Queries the color space of a pixbuf.

**Returns** Color space.

### `getHasAlpha`

```ts
getHasAlpha(): boolean
```

Queries whether a pixbuf has an alpha channel (opacity information).

**Returns** `TRUE` if it has an alpha channel, `FALSE` otherwise.

### `getHeight`

```ts
getHeight(): number
```

Queries the height of a pixbuf.

**Returns** Height in pixels.

### `getNChannels`

```ts
getNChannels(): number
```

Queries the number of channels of a pixbuf.

**Returns** Number of channels.

### `getOption`

```ts
getOption(key: string): string | null
```

Looks up `key` in the list of options that may have been attached to the
`pixbuf` when it was loaded, or that may have been attached by another
function using `gdk_pixbuf_set_option()`.

For instance, the ANI loader provides "Title" and "Artist" options.
The ICO, XBM, and XPM loaders provide "x_hot" and "y_hot" hot-spot
options for cursor definitions. The PNG loader provides the tEXt ancillary
chunk key/value pairs as options. Since 2.12, the TIFF and JPEG loaders
return an "orientation" option string that corresponds to the embedded
TIFF/Exif orientation tag (if present). Since 2.32, the TIFF loader sets
the "multipage" option string to "yes" when a multi-page TIFF is loaded.
Since 2.32 the JPEG and PNG loaders set "x-dpi" and "y-dpi" if the file
contains image density information in dots per inch.
Since 2.36.6, the JPEG loader sets the "comment" option with the comment
EXIF tag.

**Parameters**

- `key`: a nul-terminated string.

**Returns** the value associated with `key`

### `getOptions`

```ts
getOptions(): Map<string, string>
```

Returns a `GHashTable` with a list of all the options that may have been
attached to the `pixbuf` when it was loaded, or that may have been
attached by another function using `GdkPixbuf.Pixbuf.setOption()`.

**Returns** a `GHashTable`
  of key/values pairs

_Available since 2.32._

### `getPixels`

```ts
getPixels(): Uint8Array
```

Queries a pointer to the pixel data of a pixbuf.

This function will cause an implicit copy of the pixbuf data if the
pixbuf was created from read-only data.

Please see the section on [image data](class.Pixbuf.html#image-data) for information
about how the pixel data is stored in memory.

**Returns** A pointer to the pixbuf's
pixel data.

_Available since 2.26._

### `getRowstride`

```ts
getRowstride(): number
```

Queries the rowstride of a pixbuf, which is the number of bytes between
the start of a row and the start of the next row.

**Returns** Distance between row starts.

### `getWidth`

```ts
getWidth(): number
```

Queries the width of a pixbuf.

**Returns** Width in pixels.

### `newSubpixbuf`

```ts
newSubpixbuf(srcX: number, srcY: number, width: number, height: number): GdkPixbuf.Pixbuf
```

Creates a new pixbuf which represents a sub-region of `src_pixbuf`.

The new pixbuf shares its pixels with the original pixbuf, so
writing to one affects both.  The new pixbuf holds a reference to
`src_pixbuf`, so `src_pixbuf` will not be finalized until the new
pixbuf is finalized.

Note that if `src_pixbuf` is read-only, this function will force it
to be mutable.

**Parameters**

- `srcX`: X coord in `src_pixbuf`
- `srcY`: Y coord in `src_pixbuf`
- `width`: width of region in `src_pixbuf`
- `height`: height of region in `src_pixbuf`

**Returns** a new pixbuf

### `readPixelBytes`

```ts
readPixelBytes(): GLib.Bytes
```

Provides a `GBytes` buffer containing the raw pixel data; the data
must not be modified.

This function allows skipping the implicit copy that must be made
if `gdk_pixbuf_get_pixels()` is called on a read-only pixbuf.

**Returns** A new reference to a read-only copy of
  the pixel data.  Note that for mutable pixbufs, this function will
  incur a one-time copy of the pixel data for conversion into the
  returned `GBytes`.

_Available since 2.32._

### `readPixels`

```ts
readPixels(): number
```

Provides a read-only pointer to the raw pixel data.

This function allows skipping the implicit copy that must be made
if `gdk_pixbuf_get_pixels()` is called on a read-only pixbuf.

**Returns** a read-only pointer to the raw pixel data

_Available since 2.32._

### `removeOption`

```ts
removeOption(key: string): boolean
```

Removes the key/value pair option attached to a `GdkPixbuf`.

**Parameters**

- `key`: a nul-terminated string representing the key to remove.

**Returns** `TRUE` if an option was removed, `FALSE` if not.

_Available since 2.36._

### `rotateSimple`

```ts
rotateSimple(angle: GdkPixbuf.PixbufRotation): GdkPixbuf.Pixbuf | null
```

Rotates a pixbuf by a multiple of 90 degrees, and returns the
result in a new pixbuf.

If `angle` is 0, this function will return a copy of `src`.

**Parameters**

- `angle`: the angle to rotate by

**Returns** the new pixbuf

_Available since 2.6._

### `saturateAndPixelate`

```ts
saturateAndPixelate(dest: GdkPixbuf.Pixbuf, saturation: number, pixelate: boolean): void
```

Modifies saturation and optionally pixelates `src`, placing the result in
`dest`.

The `src` and `dest` pixbufs must have the same image format, size, and
rowstride.

The `src` and `dest` arguments may be the same pixbuf with no ill effects.

If `saturation` is 1.0 then saturation is not changed. If it's less than 1.0,
saturation is reduced (the image turns toward grayscale); if greater than
1.0, saturation is increased (the image gets more vivid colors).

If `pixelate` is `TRUE`, then pixels are faded in a checkerboard pattern to
create a pixelated image.

**Parameters**

- `dest`: place to write modified version of `src`
- `saturation`: saturation factor
- `pixelate`: whether to pixelate

### `saveToBufferv`

```ts
saveToBufferv(type: string, optionKeys: string[] | null, optionValues: string[] | null): [boolean, Uint8Array]
```

Vector version of `gdk_pixbuf_save_to_buffer()`.

Saves pixbuf to a new buffer in format `type`, which is currently "jpeg",
"tiff", "png", "ico" or "bmp".

See `GdkPixbuf.Pixbuf.saveToBuffer()` for more details.

**Parameters**

- `type`: name of file format.
- `optionKeys`: name of options to set
- `optionValues`: values for named options

**Returns** Tuple of:

- `result`: whether an error was set
- `buffer`: location to receive a pointer to the new buffer.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.4._

### `saveToCallbackv`

```ts
saveToCallbackv(saveFunc: GdkPixbuf.PixbufSaveFunc, type: string, optionKeys: string[] | null, optionValues: string[] | null): boolean
```

Vector version of `gdk_pixbuf_save_to_callback()`.

Saves pixbuf to a callback in format `type`, which is currently "jpeg",
"png", "tiff", "ico" or "bmp".

If `error` is set, `FALSE` will be returned.

See `GdkPixbuf.Pixbuf.saveToCallback()` for more details.

**Parameters**

- `saveFunc`: a function that is called to save each block of data that the save routine generates
- `type`: name of file format
- `optionKeys`: name of options to set
- `optionValues`: values for named options

**Returns** whether an error was set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.4._

### `saveToStreamv`

```ts
saveToStreamv(stream: Gio.OutputStream, type: string, optionKeys: string[] | null, optionValues: string[] | null, cancellable: Gio.Cancellable | null): boolean
```

Saves `pixbuf` to an output stream.

Supported file formats are currently "jpeg", "tiff", "png", "ico" or
"bmp".

See `GdkPixbuf.Pixbuf.saveToStream()` for more details.

**Parameters**

- `stream`: a `GOutputStream` to save the pixbuf to
- `type`: name of file format
- `optionKeys`: name of options to set
- `optionValues`: values for named options
- `cancellable`: optional `GCancellable` object, `NULL` to ignore

**Returns** `TRUE` if the pixbuf was saved successfully, `FALSE` if an
  error was set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.36._

### `saveToStreamvAsync`

```ts
saveToStreamvAsync(stream: Gio.OutputStream, type: string, optionKeys: string[] | null, optionValues: string[] | null, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Saves `pixbuf` to an output stream asynchronously.

For more details see `gdk_pixbuf_save_to_streamv()`, which is the synchronous
version of this function.

When the operation is finished, `callback` will be called in the main thread.

You can then call `gdk_pixbuf_save_to_stream_finish()` to get the result of
the operation.

**Parameters**

- `stream`: a `GOutputStream` to which to save the pixbuf
- `type`: name of file format
- `optionKeys`: name of options to set
- `optionValues`: values for named options
- `cancellable`: optional `GCancellable` object, `NULL` to ignore

**Returns** `TRUE` if the pixbuf was saved successfully, `FALSE` if an error was set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.36._

### `savev`

```ts
savev(filename: string, type: string, optionKeys: string[] | null, optionValues: string[] | null): boolean
```

Vector version of `gdk_pixbuf_save()`.

Saves pixbuf to a file in `type`, which is currently "jpeg", "png", "tiff", "ico" or "bmp".

If `error` is set, `FALSE` will be returned.

See `GdkPixbuf.Pixbuf.save()` for more details.

**Parameters**

- `filename`: name of file to save.
- `type`: name of file format.
- `optionKeys`: name of options to set
- `optionValues`: values for named options

**Returns** whether an error was set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `scale`

```ts
scale(dest: GdkPixbuf.Pixbuf, destX: number, destY: number, destWidth: number, destHeight: number, offsetX: number, offsetY: number, scaleX: number, scaleY: number, interpType: GdkPixbuf.InterpType): void
```

Creates a transformation of the source image `src` by scaling by
`scale_x` and `scale_y` then translating by `offset_x` and `offset_y`,
then renders the rectangle (`dest_x`, `dest_y`, `dest_width`,
`dest_height`) of the resulting image onto the destination image
replacing the previous contents.

Try to use `gdk_pixbuf_scale_simple()` first; this function is
the industrial-strength power tool you can fall back to, if
`gdk_pixbuf_scale_simple()` isn't powerful enough.

If the source rectangle overlaps the destination rectangle on the
same pixbuf, it will be overwritten during the scaling which
results in rendering artifacts.

**Parameters**

- `dest`: the `GdkPixbuf` into which to render the results
- `destX`: the left coordinate for region to render
- `destY`: the top coordinate for region to render
- `destWidth`: the width of the region to render
- `destHeight`: the height of the region to render
- `offsetX`: the offset in the X direction (currently rounded to an integer)
- `offsetY`: the offset in the Y direction (currently rounded to an integer)
- `scaleX`: the scale factor in the X direction
- `scaleY`: the scale factor in the Y direction
- `interpType`: the interpolation type for the transformation.

### `scaleSimple`

```ts
scaleSimple(destWidth: number, destHeight: number, interpType: GdkPixbuf.InterpType): GdkPixbuf.Pixbuf | null
```

Create a new pixbuf containing a copy of `src` scaled to
`dest_width` x `dest_height`.

This function leaves `src` unaffected.

The `interp_type` should be `GDK_INTERP_NEAREST` if you want maximum
speed (but when scaling down `GDK_INTERP_NEAREST` is usually unusably
ugly). The default `interp_type` should be `GDK_INTERP_BILINEAR` which
offers reasonable quality and speed.

You can scale a sub-portion of `src` by creating a sub-pixbuf
pointing into `src`; see `GdkPixbuf.Pixbuf.newSubpixbuf()`.

If `dest_width` and `dest_height` are equal to the width and height of
`src`, this function will return an unscaled copy of `src`.

For more complicated scaling/alpha blending see `GdkPixbuf.Pixbuf.scale()`
and `GdkPixbuf.Pixbuf.composite()`.

**Parameters**

- `destWidth`: the width of destination image
- `destHeight`: the height of destination image
- `interpType`: the interpolation type for the transformation.

**Returns** the new pixbuf

### `setOption`

```ts
setOption(key: string, value: string): boolean
```

Attaches a key/value pair as an option to a `GdkPixbuf`.

If `key` already exists in the list of options attached to the `pixbuf`,
the new value is ignored and `FALSE` is returned.

**Parameters**

- `key`: a nul-terminated string.
- `value`: a nul-terminated string.

**Returns** `TRUE` on success

_Available since 2.2._
