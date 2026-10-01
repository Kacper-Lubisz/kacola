---
description: "Represents a rectangular region on the screen."
---

# GdkSurface

Represents a rectangular region on the screen.

It’s a low-level object, used to implement high-level objects
such as [GtkWindow](../gtk4/class.Window.html).

The surfaces you see in practice are either `Gdk.Toplevel` or
`Gdk.Popup`, and those interfaces provide much of the required
API to interact with these surfaces. Other, more specialized surface
types exist, but you will rarely interact with them directly.

```tsx
import { GdkSurface } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkSurface**

## Props

`ref` receives the `Gdk.Surface` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `cursor`

`Gdk.Cursor | ReactElement`

The mouse pointer for the `GdkSurface`.

### `display`

`Gdk.Display` · construct-only

The `GdkDisplay` connection of the surface.

### `frameClock`

`Gdk.FrameClock` · construct-only

The `GdkFrameClock` of the surface.

### `height`

`number` · default `0` · read-only, observe with `onNotifyHeight`

The height of the surface, in pixels.

### `mapped`

`boolean` · default `false` · read-only, observe with `onNotifyMapped`

Whether the surface is mapped.

### `scale`

`number` · default `1.000000` · read-only, observe with `onNotifyScale`

The scale of the surface.

_Available since 4.12._

### `scaleFactor`

`number` · default `1` · read-only, observe with `onNotifyScaleFactor`

The scale factor of the surface.

The scale factor is the next larger integer,
compared to `Gdk.Surface.scale`.

### `width`

`number` · default `0` · read-only, observe with `onNotifyWidth`

The width of the surface in pixels.

## Signals

### `onEnterMonitor`

```ts
(monitor: Gdk.Monitor, self: Gdk.Surface) => void
```

Emitted when `surface` starts being present on the monitor.

**Parameters**

- `monitor`: the monitor
- `self`: The instance the signal was emitted on.

### `onEvent`

```ts
(event: Gdk.Event, self: Gdk.Surface) => boolean | undefined
```

Emitted when GDK receives an input event for `surface`.

**Parameters**

- `event`: an input event
- `self`: The instance the signal was emitted on.

**Returns** `true` to indicate that the event has been handled

### `onLayout`

```ts
(width: number, height: number, self: Gdk.Surface) => void
```

Emitted when the size of `surface` is changed, or when relayout should
be performed.

Surface size is reported in ”application pixels”, not
”device pixels” (see `gdk_surface_get_scale_factor()`).

**Parameters**

- `width`: the current width
- `height`: the current height
- `self`: The instance the signal was emitted on.

### `onLeaveMonitor`

```ts
(monitor: Gdk.Monitor, self: Gdk.Surface) => void
```

Emitted when `surface` stops being present on the monitor.

**Parameters**

- `monitor`: the monitor
- `self`: The instance the signal was emitted on.

### `onRender`

```ts
(region: cairo.Region, self: Gdk.Surface) => boolean | undefined
```

Emitted when part of the surface needs to be redrawn.

**Parameters**

- `region`: the region that needs to be redrawn
- `self`: The instance the signal was emitted on.

**Returns** `true` to indicate that the signal has been handled

## Methods

Methods are called on the `Gdk.Surface` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `beep`

```ts
beep(): void
```

Emits a short beep associated to `surface`.

If the display of `surface` does not support per-surface beeps,
emits a short beep on the display just as `Gdk.Display.beep()`.

### `createCairoContext`

```ts
createCairoContext(): Gdk.CairoContext
```

Creates a new `GdkCairoContext` for rendering on `surface`.

**Returns** the newly created `GdkCairoContext`

> **Deprecated since 4.18.** Drawing content with Cairo should be done via Cairo rendernodes, not by using the Cairo renderer.

### `createGlContext`

```ts
createGlContext(): Gdk.GLContext
```

Creates a new `GdkGLContext` for the `GdkSurface`.

The context is disconnected from any particular surface or surface.
If the creation of the `GdkGLContext` failed, `error` will be set.
Before using the returned `GdkGLContext`, you will need to
call `Gdk.GLContext.makeCurrent()` or `Gdk.GLContext.realize()`.

**Returns** the newly created `GdkGLContext`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `createSimilarSurface`

```ts
createSimilarSurface(content: cairo.Content, width: number, height: number): cairo.Surface
```

Create a new Cairo surface that is as compatible as possible with the
given `surface`.

For example the new surface will have the same fallback resolution
and font options as `surface`. Generally, the new surface will also
use the same backend as `surface`, unless that is not possible for
some reason. The type of the returned surface may be examined with
`cairo_surface_get_type()`.

Initially the surface contents are all 0 (transparent if contents
have transparency, black otherwise.)

This function always returns a valid pointer, but it will return a
pointer to a “nil” surface if `other` is already in an error state
or any other error occurs.

**Parameters**

- `content`: the content for the new surface
- `width`: width of the new surface
- `height`: height of the new surface

**Returns** a pointer to the newly allocated surface. The caller
  owns the surface and should call `cairo_surface_destroy()` when done
  with it.

> **Deprecated since 4.12.** Create a suitable cairo image surface yourself

### `createVulkanContext`

```ts
createVulkanContext(): Gdk.VulkanContext
```

Sets an error and returns `null`.

**Returns** `null`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

> **Deprecated since 4.14.** GTK does not expose any Vulkan internals. This function is a leftover that was accidentally exposed.

### `destroy`

```ts
destroy(): void
```

Destroys the window system resources associated with `surface` and
decrements `surface`'s reference count.

The window system resources for all children of `surface` are also
destroyed, but the children’s reference counts are not decremented.

Note that a surface will not be destroyed automatically when its
reference count reaches zero. You must call this function yourself
before that happens.

### `getCursor`

```ts
getCursor(): Gdk.Cursor | null
```

Retrieves a `GdkCursor` pointer for the cursor currently set on the
`GdkSurface`.

If the return value is `null` then there is no custom cursor set on
the surface, and it is using the cursor for its parent surface.

Use `Gdk.Surface.setCursor()` to unset the cursor of the surface.

**Returns** a `GdkCursor`

### `getDeviceCursor`

```ts
getDeviceCursor(device: Gdk.Device): Gdk.Cursor | null
```

Retrieves a `GdkCursor` pointer for the `device` currently set on the
specified `GdkSurface`.

If the return value is `null` then there is no custom cursor set on the
specified surface, and it is using the cursor for its parent surface.

Use `Gdk.Surface.setCursor()` to unset the cursor of the surface.

**Parameters**

- `device`: a pointer `GdkDevice`

**Returns** a `GdkCursor`

### `getDevicePosition`

```ts
getDevicePosition(device: Gdk.Device): [boolean, number, number, Gdk.ModifierType]
```

Obtains the current device position and modifier state.

The position is given in coordinates relative to the upper
left corner of `surface`.

**Parameters**

- `device`: pointer `GdkDevice` to query to

**Returns** Tuple of:

- `result`: `true` if the device is over the surface
- `x`: return location for the X coordinate of `device`
- `y`: return location for the Y coordinate of `device`
- `mask`: return location for the modifier mask

### `getDisplay`

```ts
getDisplay(): Gdk.Display
```

Gets the `GdkDisplay` associated with a `GdkSurface`.

**Returns** the `GdkDisplay` associated with `surface`

### `getFrameClock`

```ts
getFrameClock(): Gdk.FrameClock
```

Gets the frame clock for the surface.

The frame clock for a surface never changes unless the surface is
reparented to a new toplevel surface.

**Returns** the frame clock

### `getHeight`

```ts
getHeight(): number
```

Returns the height of the given `surface`.

Surface size is reported in ”application pixels”, not
”device pixels” (see `Gdk.Surface.getScaleFactor()`).

**Returns** The height of `surface`

### `getMapped`

```ts
getMapped(): boolean
```

Checks whether the surface has been mapped.

A surface is mapped with `Gdk.Toplevel.present()`
or `Gdk.Popup.present()`.

**Returns** `true` if the surface is mapped

### `getScale`

```ts
getScale(): number
```

Returns the internal scale that maps from surface coordinates
to the actual device pixels.

When the scale is bigger than 1, the windowing system prefers to get
buffers with a resolution that is bigger than the surface size (e.g.
to show the surface on a high-resolution display, or in a magnifier).

Compare with `Gdk.Surface.getScaleFactor()`, which returns the
next larger integer.

The scale may change during the lifetime of the surface.

**Returns** the scale

_Available since 4.12._

### `getScaleFactor`

```ts
getScaleFactor(): number
```

Returns the internal scale factor that maps from surface coordinates
to the actual device pixels.

On traditional systems this is 1, but on very high density outputs
this can be a higher value (often 2). A higher value means that drawing
is automatically scaled up to a higher resolution, so any code doing
drawing will automatically look nicer. However, if you are supplying
pixel-based data the scale value can be used to determine whether to
use a pixel resource with higher resolution data.

The scale factor may change during the lifetime of the surface.

**Returns** the scale factor

### `getWidth`

```ts
getWidth(): number
```

Returns the width of the given `surface`.

Surface size is reported in ”application pixels”, not
”device pixels” (see `Gdk.Surface.getScaleFactor()`).

**Returns** The width of `surface`

### `hide`

```ts
hide(): void
```

Hide the surface.

For toplevel surfaces, withdraws them, so they will no longer be
known to the window manager; for all surfaces, unmaps them, so
they won’t be displayed. Normally done automatically as
part of [`gtk_widget_hide()`](../gtk4/method.Widget.hide.html).

### `isDestroyed`

```ts
isDestroyed(): boolean
```

Check to see if a surface is destroyed.

**Returns** `true` if the surface is destroyed

### `queueRender`

```ts
queueRender(): void
```

Forces a `Gdk.Surface.render` signal emission for `surface`
to be scheduled.

This function is useful for implementations that track invalid
regions on their own.

### `requestLayout`

```ts
requestLayout(): void
```

Request a layout phase from the surface's frame clock.

See `Gdk.FrameClock.requestPhase()`.

### `setCursor`

```ts
setCursor(cursor: Gdk.Cursor | null): void
```

Sets the default mouse pointer for a `GdkSurface`.

Passing `null` for the `cursor` argument means that `surface` will use
the cursor of its parent surface. Most surfaces should use this default.
Note that `cursor` must be for the same display as `surface`.

Use `Gdk.Cursor.newFromName()` or `Gdk.Cursor.newFromTexture()`
to create the cursor. To make the cursor invisible, use `GDK_BLANK_CURSOR`.

**Parameters**

- `cursor`: a `GdkCursor`

### `setDeviceCursor`

```ts
setDeviceCursor(device: Gdk.Device, cursor: Gdk.Cursor): void
```

Sets a specific `GdkCursor` for a given device when it gets inside `surface`.

Passing `null` for the `cursor` argument means that `surface` will use the
cursor of its parent surface. Most surfaces should use this default.

Use `Gdk.Cursor.newFromName()` or `Gdk.Cursor.newFromTexture()`
to create the cursor. To make the cursor invisible, use `GDK_BLANK_CURSOR`.

**Parameters**

- `device`: a pointer `GdkDevice`
- `cursor`: a `GdkCursor`

### `setInputRegion`

```ts
setInputRegion(region: cairo.Region | null): void
```

Apply the region to the surface for the purpose of event
handling.

Mouse events which happen while the pointer position corresponds
to an unset bit in the mask will be passed on the surface below
`surface`.

An input region is typically used with RGBA surfaces. The alpha
channel of the surface defines which pixels are invisible and
allows for nicely antialiased borders, and the input region
controls where the surface is “clickable”.

Use `Gdk.Display.supportsInputShapes()` to find out if
a particular backend supports input regions.

**Parameters**

- `region`: region of surface to be reactive, or `null` to make the entire surface reactive

### `setOpaqueRegion`

```ts
setOpaqueRegion(region: cairo.Region | null): void
```

Marks a region of the `GdkSurface` as opaque.

For optimisation purposes, compositing window managers may
like to not draw obscured regions of surfaces, or turn off blending
during for these regions. With RGB windows with no transparency,
this is just the shape of the window, but with ARGB32 windows, the
compositor does not know what regions of the window are transparent
or not.

This function only works for toplevel surfaces.

GTK will update this property automatically if the `surface` background
is opaque, as we know where the opaque regions are. If your surface
background is not opaque, please update this property in your
[GtkWidgetClass.css_changed](../gtk4/vfunc.Widget.css_changed.html) handler.

**Parameters**

- `region`: a region, or `null` to make the entire surface opaque

> **Deprecated since 4.16.** GDK can figure out the opaque parts of a window itself by inspecting the contents that are drawn.

### `translateCoordinates`

```ts
translateCoordinates(to: Gdk.Surface, x: number, y: number): [boolean, number, number]
```

Translates coordinates between two surfaces.

Note that this only works if `to` and `from` are popups or
transient-for to the same toplevel (directly or indirectly).

**Parameters**

- `to`: the target surface
- `x`: coordinates to translate
- `y`: coordinates to translate

**Returns** Tuple of:

- `result`: `true` if the coordinates were successfully translated
- `x`: coordinates to translate
- `y`: coordinates to translate
