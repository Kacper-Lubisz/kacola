---
description: "An opaque object representing an iterator which points to a certain position in an animation."
---

# GdkPixbufAnimationIter

An opaque object representing an iterator which points to a
certain position in an animation.

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

```tsx
import { GdkPixbufAnimationIter } from "@gtkx/jsx/gdkpixbuf";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkPixbufAnimationIter**

## Props

`ref` receives the `GdkPixbuf.PixbufAnimationIter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `GdkPixbuf.PixbufAnimationIter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdkpixbuf`. Methods inherited from ancestors are documented on their own pages.

### `advance`

```ts
advance(currentTime: GLib.TimeVal | null): boolean
```

Possibly advances an animation to a new frame.

Chooses the frame based on the start time passed to
`gdk_pixbuf_animation_get_iter()`.

`current_time` would normally come from `g_get_current_time()`, and
must be greater than or equal to the time passed to
`gdk_pixbuf_animation_get_iter()`, and must increase or remain
unchanged each time `gdk_pixbuf_animation_iter_get_pixbuf()` is
called. That is, you can't go backward in time; animations only
play forward.

As a shortcut, pass `NULL` for the current time and `g_get_current_time()`
will be invoked on your behalf. So you only need to explicitly pass
`current_time` if you're doing something odd like playing the animation
at double speed.

If this function returns `FALSE`, there's no need to update the animation
display, assuming the display had been rendered prior to advancing;
if `TRUE`, you need to call `gdk_pixbuf_animation_iter_get_pixbuf()`
and update the display with the new pixbuf.

**Parameters**

- `currentTime`: current time

**Returns** `TRUE` if the image may need updating

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

### `getDelayTime`

```ts
getDelayTime(): number
```

Gets the number of milliseconds the current pixbuf should be displayed,
or -1 if the current pixbuf should be displayed forever.

The `g_timeout_add()` function conveniently takes a timeout in milliseconds,
so you can use a timeout to schedule the next update.

Note that some formats, like GIF, might clamp the timeout values in the
image file to avoid updates that are just too quick. The minimum timeout
for GIF images is currently 20 milliseconds.

**Returns** delay time in milliseconds (thousandths of a second)

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

### `getPixbuf`

```ts
getPixbuf(): GdkPixbuf.Pixbuf
```

Gets the current pixbuf which should be displayed.

The pixbuf might not be the same size as the animation itself
(`gdk_pixbuf_animation_get_width()`, `gdk_pixbuf_animation_get_height()`).

This pixbuf should be displayed for `gdk_pixbuf_animation_iter_get_delay_time()`
milliseconds.

The caller of this function does not own a reference to the returned
pixbuf; the returned pixbuf will become invalid when the iterator
advances to the next frame, which may happen anytime you call
`gdk_pixbuf_animation_iter_advance()`.

Copy the pixbuf to keep it (don't just add a reference), as it may get
recycled as you advance the iterator.

**Returns** the pixbuf to be displayed

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

### `onCurrentlyLoadingFrame`

```ts
onCurrentlyLoadingFrame(): boolean
```

Used to determine how to respond to the area_updated signal on
`GdkPixbufLoader` when loading an animation.

The `::area_updated` signal is emitted for an area of the frame currently
streaming in to the loader. So if you're on the currently loading frame,
you will need to redraw the screen for the updated area.

**Returns** `TRUE` if the frame we're on is partially loaded, or the last frame

> **Deprecated since 2.44.** Use a different image loading library for animatable assets
