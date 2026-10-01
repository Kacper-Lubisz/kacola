---
description: "An opaque object representing an animation."
---

# GdkPixbufAnimation

An opaque object representing an animation.

The GdkPixBuf library provides a simple mechanism to load and
represent animations. An animation is conceptually a series of
frames to be displayed over time.

The animation may not be represented as a series of frames
internally; for example, it may be stored as a sprite and
instructions for moving the sprite around a background.

To display an animation you don't need to understand its
representation, however; you just ask `GdkPixbuf` what should
be displayed at a given point in time.

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

```tsx
import { GdkPixbufAnimation } from "@gtkx/jsx/gdkpixbuf";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkPixbufAnimation**

## Props

`ref` receives the `GdkPixbuf.PixbufAnimation` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `GdkPixbuf.PixbufAnimation` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdkpixbuf`. Methods inherited from ancestors are documented on their own pages.

### `getHeight`

```ts
getHeight(): number
```

Queries the height of the bounding box of a pixbuf animation.

**Returns** Height of the bounding box of the animation.

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

### `getIter`

```ts
getIter(startTime: GLib.TimeVal | null): GdkPixbuf.PixbufAnimationIter
```

Get an iterator for displaying an animation.

The iterator provides the frames that should be displayed at a
given time.

`start_time` would normally come from `g_get_current_time()`, and marks
the beginning of animation playback. After creating an iterator, you
should immediately display the pixbuf returned by
`gdk_pixbuf_animation_iter_get_pixbuf()`. Then, you should install
a timeout (with `g_timeout_add()`) or by some other mechanism ensure
that you'll update the image after
`gdk_pixbuf_animation_iter_get_delay_time()` milliseconds. Each time
the image is updated, you should reinstall the timeout with the new,
possibly-changed delay time.

As a shortcut, if `start_time` is `NULL`, the result of
`g_get_current_time()` will be used automatically.

To update the image (i.e. possibly change the result of
`gdk_pixbuf_animation_iter_get_pixbuf()` to a new frame of the animation),
call `gdk_pixbuf_animation_iter_advance()`.

If you're using `GdkPixbufLoader`, in addition to updating the image
after the delay time, you should also update it whenever you
receive the area_updated signal and
`gdk_pixbuf_animation_iter_on_currently_loading_frame()` returns
`TRUE`. In this case, the frame currently being fed into the loader
has received new data, so needs to be refreshed. The delay time for
a frame may also be modified after an area_updated signal, for
example if the delay time for a frame is encoded in the data after
the frame itself. So your timeout should be reinstalled after any
area_updated signal.

A delay time of -1 is possible, indicating "infinite".

**Parameters**

- `startTime`: time when the animation starts playing

**Returns** an iterator to move over the animation

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

### `getStaticImage`

```ts
getStaticImage(): GdkPixbuf.Pixbuf
```

Retrieves a static image for the animation.

If an animation is really just a plain image (has only one frame),
this function returns that image.

If the animation is an animation, this function returns a reasonable
image to use as a static unanimated image, which might be the first
frame, or something more sophisticated depending on the file format.

If an animation hasn't loaded any frames yet, this function will
return `NULL`.

**Returns** unanimated image representing the animation

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

### `getWidth`

```ts
getWidth(): number
```

Queries the width of the bounding box of a pixbuf animation.

**Returns** Width of the bounding box of the animation.

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

### `isStaticImage`

```ts
isStaticImage(): boolean
```

Checks whether the animation is a static image.

If you load a file with `gdk_pixbuf_animation_new_from_file()` and it
turns out to be a plain, unanimated image, then this function will
return `TRUE`. Use `gdk_pixbuf_animation_get_static_image()` to retrieve
the image.

**Returns** `TRUE` if the "animation" was really just an image

> **Deprecated since 2.44.** Use a different image loading library for animatable assets
