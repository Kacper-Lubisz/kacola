---
description: "Allows drawing with OpenGL."
---

# GtkGLArea

Allows drawing with OpenGL.



`GtkGLArea` sets up its own `Gdk.GLContext`, and creates a custom
GL framebuffer that the widget will do GL rendering onto. It also ensures
that this framebuffer is the default GL rendering target when rendering.
The completed rendering is integrated into the larger GTK scene graph as
a texture.

In order to draw, you have to connect to the `Gtk.GLArea.render`
signal, or subclass `GtkGLArea` and override the GtkGLAreaClass.render
virtual function.

The `GtkGLArea` widget ensures that the `GdkGLContext` is associated with
the widget's drawing area, and it is kept updated when the size and
position of the drawing area changes.

### Drawing with GtkGLArea

The simplest way to draw using OpenGL commands in a `GtkGLArea` is to
create a widget instance and connect to the `Gtk.GLArea.render` signal:

The `render()` function will be called when the `GtkGLArea` is ready
for you to draw its content:

The initial contents of the framebuffer are transparent.

```c
static gboolean
render (GtkGLArea *area, GdkGLContext *context)
{
  // inside this function it's safe to use GL; the given
  // GdkGLContext has been made current to the drawable
  // surface used by the `GtkGLArea` and the viewport has
  // already been set to be the size of the allocation

  // we can start by clearing the buffer
  glClearColor (0, 0, 0, 0);
  glClear (GL_COLOR_BUFFER_BIT);

  // record the active framebuffer ID, so we can return to it
  // with `glBindFramebuffer (GL_FRAMEBUFFER, screen_fb)` should
  // we, for instance, intend on utilizing the results of an
  // intermediate render texture pass
  GLuint screen_fb = 0;
  glGetIntegerv (GL_FRAMEBUFFER_BINDING, &screen_fb);

  // draw your object
  // draw_an_object ();

  // we completed our drawing; the draw commands will be
  // flushed at the end of the signal emission chain, and
  // the buffers will be drawn on the window
  return TRUE;
}

void setup_glarea (void)
{
  // create a GtkGLArea instance
  GtkWidget *gl_area = gtk_gl_area_new ();

  // connect to the "render" signal
  g_signal_connect (gl_area, "render", G_CALLBACK (render), NULL);
}
```

If you need to initialize OpenGL state, e.g. buffer objects or
shaders, you should use the `Gtk.Widget.realize` signal;
you can use the `Gtk.Widget.unrealize` signal to clean up.
Since the `GdkGLContext` creation and initialization may fail, you
will need to check for errors, using `Gtk.GLArea.getError()`.

An example of how to safely initialize the GL state is:

```c
static void
on_realize (GtkGLArea *area)
{
  // We need to make the context current if we want to
  // call GL API
  gtk_gl_area_make_current (area);

  // If there were errors during the initialization or
  // when trying to make the context current, this
  // function will return a GError for you to catch
  if (gtk_gl_area_get_error (area) != NULL)
    return;

  // You can also use gtk_gl_area_set_error() in order
  // to show eventual initialization errors on the
  // GtkGLArea widget itself
  GError *internal_error = NULL;
  init_buffer_objects (&error);
  if (error != NULL)
    {
      gtk_gl_area_set_error (area, error);
      g_error_free (error);
      return;
    }

  init_shaders (&error);
  if (error != NULL)
    {
      gtk_gl_area_set_error (area, error);
      g_error_free (error);
      return;
    }
}
```

If you need to change the options for creating the `GdkGLContext`
you should use the `Gtk.GLArea.create-context` signal.

```tsx
import { GtkGLArea } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkGLArea**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.GLArea` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `allowedApis`

`Gdk.GLAPI` · default `GDK_GL_API_GL | GDK_GL_API_GLES`

The allowed APIs.

_Available since 4.12._

### `api`

`Gdk.GLAPI` · default `0` · read-only, observe with `onNotifyApi`

The API currently in use.

_Available since 4.12._

### `autoRender`

`boolean` · default `true`

If set to `true` the ::render signal will be emitted every time
the widget draws.

This is the default and is useful if drawing the widget is faster.

If set to `false` the data from previous rendering is kept around and will
be used for drawing the widget the next time, unless the window is resized.
In order to force a rendering `Gtk.GLArea.queueRender()` must be called.
This mode is useful when the scene changes seldom, but takes a long time
to redraw.

### `context`

`Gdk.GLContext` · read-only, observe with `onNotifyContext`

The `GdkGLContext` used by the `GtkGLArea` widget.

The `GtkGLArea` widget is responsible for creating the `GdkGLContext`
instance. If you need to render with other kinds of buffers (stencil,
depth, etc), use render buffers.

### `hasDepthBuffer`

`boolean` · default `false`

If set to `true` the widget will allocate and enable a depth buffer for the
target framebuffer.

Setting this property will enable GL's depth testing as a side effect. If
you don't need depth testing, you should call `glDisable(GL_DEPTH_TEST)`
in your `GtkGLArea::render` handler.

### `hasStencilBuffer`

`boolean` · default `false`

If set to `true` the widget will allocate and enable a stencil buffer for the
target framebuffer.

### `useEs`

`boolean` · default `false` · deprecated since 4.12

If set to `true` the widget will try to create a `GdkGLContext` using
OpenGL ES instead of OpenGL.

> **Deprecated since 4.12.** Use `Gtk.GLArea.allowedApis`

## Signals

### `onCreateContext`

```ts
(self: Gtk.GLArea) => Gdk.GLContext | undefined
```

Emitted when the widget is being realized.

This allows you to override how the GL context is created.
This is useful when you want to reuse an existing GL context,
or if you want to try creating different kinds of GL options.

If context creation fails then the signal handler can use
`Gtk.GLArea.setError()` to register a more detailed error
of how the construction failed.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** a newly created `GdkGLContext`;
    the `GtkGLArea` widget will take ownership of the returned value.

### `onRender`

```ts
(context: Gdk.GLContext, self: Gtk.GLArea) => boolean | undefined
```

Emitted every time the contents of the `GtkGLArea` should be redrawn.

The `context` is bound to the `area` prior to emitting this function,
and the buffers are painted to the window once the emission terminates.

**Parameters**

- `context`: the `GdkGLContext` used by `area`
- `self`: The instance the signal was emitted on.

**Returns** `true` to stop other handlers from being invoked for the event.
  `false` to propagate the event further.

### `onResize`

```ts
(width: number, height: number, self: Gtk.GLArea) => void
```

Emitted once when the widget is realized, and then each time the widget
is changed while realized.

This is useful in order to keep GL state up to date with the widget size,
like for instance camera properties which may depend on the width/height
ratio.

The GL context for the area is guaranteed to be current when this signal
is emitted.

The default handler sets up the GL viewport.

**Parameters**

- `width`: the width of the viewport
- `height`: the height of the viewport
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.GLArea` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `attachBuffers`

```ts
attachBuffers(): void
```

Binds buffers to the framebuffer.

Ensures that the `area` framebuffer object is made the current draw
and read target, and that all the required buffers for the `area`
are created and bound to the framebuffer.

This function is automatically called before emitting the
`Gtk.GLArea.render` signal, and doesn't normally need to be
called by application code.

### `getAllowedApis`

```ts
getAllowedApis(): Gdk.GLAPI
```

Gets the allowed APIs.

See `Gtk.GLArea.setAllowedApis()`.

**Returns** the allowed APIs

_Available since 4.12._

### `getApi`

```ts
getApi(): Gdk.GLAPI
```

Gets the API that is currently in use.

If the GL area has not been realized yet, 0 is returned.

**Returns** the currently used API

_Available since 4.12._

### `getAutoRender`

```ts
getAutoRender(): boolean
```

Returns whether the area is in auto render mode or not.

**Returns** `true` if the `area` is auto rendering, `false` otherwise

### `getContext`

```ts
getContext(): Gdk.GLContext | null
```

Retrieves the `GdkGLContext` used by `area`.

**Returns** the `GdkGLContext`

### `getError`

```ts
getError(): GLib.Error | null
```

Gets the current error set on the `area`.

**Returns** the `GError`

### `getHasDepthBuffer`

```ts
getHasDepthBuffer(): boolean
```

Returns whether the area has a depth buffer.

**Returns** `true` if the `area` has a depth buffer, `false` otherwise

### `getHasStencilBuffer`

```ts
getHasStencilBuffer(): boolean
```

Returns whether the area has a stencil buffer.

**Returns** `true` if the `area` has a stencil buffer, `false` otherwise

### `getRequiredVersion`

```ts
getRequiredVersion(): [number, number]
```

Retrieves the required version of OpenGL.

See `Gtk.GLArea.setRequiredVersion()`.

**Returns** Tuple of:

- `major`: return location for the required major version
- `minor`: return location for the required minor version

### `getUseEs`

```ts
getUseEs(): boolean
```

Returns whether the `GtkGLArea` should use OpenGL ES.

See `Gtk.GLArea.setUseEs()`.

**Returns** `true` if the `GtkGLArea` should create an OpenGL ES context
  and `false` otherwise

> **Deprecated since 4.12.** Use `Gtk.GLArea.getApi()`

### `makeCurrent`

```ts
makeCurrent(): void
```

Ensures that the `GdkGLContext` used by `area` is associated with
the `GtkGLArea`.

This function is automatically called before emitting the
`Gtk.GLArea.render` signal, and doesn't normally need
to be called by application code.

### `queueRender`

```ts
queueRender(): void
```

Marks the currently rendered data (if any) as invalid, and queues
a redraw of the widget.

This ensures that the `Gtk.GLArea.render` signal
is emitted during the draw.

This is only needed when `Gtk.GLArea.setAutoRender()` has
been called with a `false` value. The default behaviour is to
emit `Gtk.GLArea.render` on each draw.

### `setAllowedApis`

```ts
setAllowedApis(apis: Gdk.GLAPI): void
```

Sets the allowed APIs to create a context with.

You should check `Gtk.GLArea.api` before drawing
with either API.

By default, all APIs are allowed.

**Parameters**

- `apis`: the allowed APIs

_Available since 4.12._

### `setAutoRender`

```ts
setAutoRender(autoRender: boolean): void
```

Sets whether the `GtkGLArea` is in auto render mode.

If `auto_render` is `true` the `Gtk.GLArea.render` signal will
be emitted every time the widget draws. This is the default and is
useful if drawing the widget is faster.

If `auto_render` is `false` the data from previous rendering is kept
around and will be used for drawing the widget the next time,
unless the window is resized. In order to force a rendering
`Gtk.GLArea.queueRender()` must be called. This mode is
useful when the scene changes seldom, but takes a long time to redraw.

**Parameters**

- `autoRender`: a boolean

### `setError`

```ts
setError(error: GLib.Error | null): void
```

Sets an error on the area which will be shown instead of the
GL rendering.

This is useful in the `Gtk.GLArea.create-context`
signal if GL context creation fails.

**Parameters**

- `error`: a new `GError`, or `null` to unset the error

### `setHasDepthBuffer`

```ts
setHasDepthBuffer(hasDepthBuffer: boolean): void
```

Sets whether the `GtkGLArea` should use a depth buffer.

If `has_depth_buffer` is `true` the widget will allocate and
enable a depth buffer for the target framebuffer. Otherwise
there will be none.

**Parameters**

- `hasDepthBuffer`: `true` to add a depth buffer

### `setHasStencilBuffer`

```ts
setHasStencilBuffer(hasStencilBuffer: boolean): void
```

Sets whether the `GtkGLArea` should use a stencil buffer.

If `has_stencil_buffer` is `true` the widget will allocate and
enable a stencil buffer for the target framebuffer. Otherwise
there will be none.

**Parameters**

- `hasStencilBuffer`: `true` to add a stencil buffer

### `setRequiredVersion`

```ts
setRequiredVersion(major: number, minor: number): void
```

Sets the required version of OpenGL to be used when creating
the context for the widget.

This function must be called before the area has been realized.

**Parameters**

- `major`: the major version
- `minor`: the minor version

### `setUseEs`

```ts
setUseEs(useEs: boolean): void
```

Sets whether the `area` should create an OpenGL or an OpenGL ES context.

You should check the capabilities of the `GdkGLContext` before drawing
with either API.

**Parameters**

- `useEs`: whether to use OpenGL or OpenGL ES

> **Deprecated since 4.12.** Use `Gtk.GLArea.setAllowedApis()`
