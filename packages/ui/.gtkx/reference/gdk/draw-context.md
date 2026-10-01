---
description: "Base class for objects implementing different rendering methods."
---

# GdkDrawContext

Base class for objects implementing different rendering methods.

`GdkDrawContext` is the base object used by contexts implementing different
rendering methods, such as `Gdk.CairoContext` or `Gdk.GLContext`.
It provides shared functionality between those contexts.

You will always interact with one of those subclasses.

A `GdkDrawContext` is always associated with a single toplevel surface.

```tsx
import { GdkDrawContext } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkDrawContext**

## Props

`ref` receives the `Gdk.DrawContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `display`

`Gdk.Display` · construct-only

The `GdkDisplay` used to create the `GdkDrawContext`.

### `surface`

`Gdk.Surface` · construct-only

The `GdkSurface` the context is bound to.

## Methods

Methods are called on the `Gdk.DrawContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `beginFrame`

```ts
beginFrame(region: cairo.Region): void
```

Indicates that you are beginning the process of redrawing `region`
on the `context`'s surface.

Calling this function begins a drawing operation using `context` on the
surface that `context` was created from. The actual requirements and
guarantees for the drawing operation vary for different implementations
of drawing, so a `Gdk.CairoContext` and a `Gdk.GLContext`
need to be treated differently.

A call to this function is a requirement for drawing and must be
followed by a call to `Gdk.DrawContext.endFrame()`, which will
complete the drawing operation and ensure the contents become visible
on screen.

Note that the `region` passed to this function is the minimum region that
needs to be drawn and depending on implementation, windowing system and
hardware in use, it might be necessary to draw a larger region. Drawing
implementation must use `Gdk.DrawContext.getFrameRegion()` to
query the region that must be drawn.

When using GTK, the widget system automatically places calls to
`gdk_draw_context_begin_frame()` and `gdk_draw_context_end_frame()` via the
use of [GskRenderer](../gsk4/class.Renderer.html)s, so application code
does not need to call these functions explicitly.

**Parameters**

- `region`: minimum region that should be drawn

> **Deprecated since 4.16.** Drawing directly to the surface is no longer recommended. Use `GskRenderNode` and `GskRenderer`.

### `endFrame`

```ts
endFrame(): void
```

Ends a drawing operation started with `gdk_draw_context_begin_frame()`.

This makes the drawing available on screen.
See `Gdk.DrawContext.beginFrame()` for more details about drawing.

When using a `Gdk.GLContext`, this function may call `glFlush()`
implicitly before returning; it is not recommended to call `glFlush()`
explicitly before calling this function.

> **Deprecated since 4.16.** Drawing directly to the surface is no longer recommended. Use `GskRenderNode` and `GskRenderer`.

### `getDisplay`

```ts
getDisplay(): Gdk.Display | null
```

Retrieves the `GdkDisplay` the `context` is created for

**Returns** the `GdkDisplay`

### `getFrameRegion`

```ts
getFrameRegion(): cairo.Region | null
```

Retrieves the region that is currently being repainted.

After a call to `Gdk.DrawContext.beginFrame()` this function will
return a union of the region passed to that function and the area of the
surface that the `context` determined needs to be repainted.

If `context` is not in between calls to `Gdk.DrawContext.beginFrame()`
and `Gdk.DrawContext.endFrame()`, `null` will be returned.

**Returns** a Cairo region

> **Deprecated since 4.16.** Drawing directly to the surface is no longer recommended. Use `GskRenderNode` and `GskRenderer`.

### `getSurface`

```ts
getSurface(): Gdk.Surface | null
```

Retrieves the surface that `context` is bound to.

**Returns** a `GdkSurface`

### `isInFrame`

```ts
isInFrame(): boolean
```

Returns `true` if `context` is in the process of drawing to its surface.

This is the case between calls to `Gdk.DrawContext.beginFrame()`
and `Gdk.DrawContext.endFrame()`. In this situation, drawing commands
may be effecting the contents of the `context`'s surface.

**Returns** `true` if the context is between `Gdk.DrawContext.beginFrame()`
  and `Gdk.DrawContext.endFrame()` calls.

> **Deprecated since 4.16.** Drawing directly to the surface is no longer recommended. Use `GskRenderNode` and `GskRenderer`.
