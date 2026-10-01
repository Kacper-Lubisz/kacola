---
description: "Represents a platform-specific OpenGL draw context."
---

# GdkGLContext

Represents a platform-specific OpenGL draw context.

`GdkGLContext`s are created for a surface using
`Gdk.Surface.createGlContext()`, and the context will match
the characteristics of the surface.

A `GdkGLContext` is not tied to any particular normal framebuffer.
For instance, it cannot draw to the surface back buffer. The GDK
repaint system is in full control of the painting to that. Instead,
you can create render buffers or textures and use `cairoDrawFromGl()`
in the draw function of your widget to draw them. Then GDK will handle
the integration of your rendering with that of other widgets.

Support for `GdkGLContext` is platform-specific and context creation
can fail, returning `null` context.

A `GdkGLContext` has to be made "current" in order to start using
it, otherwise any OpenGL call will be ignored.

### Creating a new OpenGL context

In order to create a new `GdkGLContext` instance you need a `GdkSurface`,
which you typically get during the realize call of a widget.

A `GdkGLContext` is not realized until either `Gdk.GLContext.makeCurrent()`
or `Gdk.GLContext.realize()` is called. It is possible to specify
details of the GL context like the OpenGL version to be used, or whether
the GL context should have extra state validation enabled after calling
`Gdk.Surface.createGlContext()` by calling `Gdk.GLContext.realize()`.
If the realization fails you have the option to change the settings of
the `GdkGLContext` and try again.

### Using a GdkGLContext

You will need to make the `GdkGLContext` the current context before issuing
OpenGL calls; the system sends OpenGL commands to whichever context is current.
It is possible to have multiple contexts, so you always need to ensure that
the one which you want to draw with is the current one before issuing commands:

```c
gdk_gl_context_make_current (context);
```

You can now perform your drawing using OpenGL commands.

You can check which `GdkGLContext` is the current one by using
`Gdk.GLContext.getCurrent()`; you can also unset any `GdkGLContext`
that is currently set by calling `Gdk.GLContext.clearCurrent()`.

```tsx
import { GdkGLContext } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GdkDrawContext](.gtkx/reference/gdk/draw-context.md) → **GdkGLContext**

## Props

`ref` receives the `Gdk.GLContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `allowedApis`

`Gdk.GLAPI` · default `GDK_GL_API_GL | GDK_GL_API_GLES`

The allowed APIs.

_Available since 4.6._

### `api`

`Gdk.GLAPI` · default `0` · read-only, observe with `onNotifyApi`

The API currently in use.

_Available since 4.6._

### `sharedContext`

`Gdk.GLContext` · construct-only · deprecated since 4.4

Always `null`

As many contexts can share data now and no single shared context exists
anymore, this function has been deprecated and now always returns `null`.

> **Deprecated since 4.4.** Use `Gdk.GLContext.isShared()` to check if contexts can be shared.

## Methods

Methods are called on the `Gdk.GLContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `getAllowedApis`

```ts
getAllowedApis(): Gdk.GLAPI
```

Gets the allowed APIs set via `gdk_gl_context_set_allowed_apis()`.

**Returns** the allowed APIs

_Available since 4.6._

### `getApi`

```ts
getApi(): Gdk.GLAPI
```

Gets the API currently in use.

If the renderer has not been realized yet, 0 is returned.

**Returns** the currently used API

_Available since 4.6._

### `getDebugEnabled`

```ts
getDebugEnabled(): boolean
```

Retrieves whether the context is doing extra validations and runtime checking.

See `Gdk.GLContext.setDebugEnabled()`.

**Returns** `true` if debugging is enabled

### `getDisplay`

```ts
getDisplay(): Gdk.Display | null
```

Retrieves the display the `context` is created for

**Returns** a `GdkDisplay`

### `getForwardCompatible`

```ts
getForwardCompatible(): boolean
```

Retrieves whether the context is forward-compatible.

See `Gdk.GLContext.setForwardCompatible()`.

**Returns** `true` if the context should be forward-compatible

### `getRequiredVersion`

```ts
getRequiredVersion(): [number | null, number | null]
```

Retrieves required OpenGL version set as a requirement for the `context`
realization. It will not change even if a greater OpenGL version is supported
and used after the `context` is realized. See
`Gdk.GLContext.getVersion()` for the real version in use.

See `Gdk.GLContext.setRequiredVersion()`.

**Returns** Tuple of:

- `major`: return location for the major version to request
- `minor`: return location for the minor version to request

### `getSharedContext`

```ts
getSharedContext(): Gdk.GLContext | null
```

Used to retrieves the `GdkGLContext` that this `context` share data with.

As many contexts can share data now and no single shared context exists
anymore, this function has been deprecated and now always returns `null`.

**Returns** `null`

> **Deprecated since 4.4.** Use `Gdk.GLContext.isShared()` to check if contexts can be shared.

### `getSurface`

```ts
getSurface(): Gdk.Surface | null
```

Retrieves the surface used by the `context`.

**Returns** a `GdkSurface`

### `getUseEs`

```ts
getUseEs(): boolean
```

Checks whether the `context` is using an OpenGL or OpenGL ES profile.

**Returns** `true` if the `GdkGLContext` is using an OpenGL ES profile;
`false` if other profile is in use of if the `context` has not yet
been realized.

### `getVersion`

```ts
getVersion(): [number, number]
```

Retrieves the OpenGL version of the `context`.

The `context` must be realized prior to calling this function.

**Returns** Tuple of:

- `major`: return location for the major version
- `minor`: return location for the minor version

### `isLegacy`

```ts
isLegacy(): boolean
```

Whether the `GdkGLContext` is in legacy mode or not.

The `GdkGLContext` must be realized before calling this function.

When realizing a GL context, GDK will try to use the OpenGL 3.2 core
profile; this profile removes all the OpenGL API that was deprecated
prior to the 3.2 version of the specification. If the realization is
successful, this function will return `false`.

If the underlying OpenGL implementation does not support core profiles,
GDK will fall back to a pre-3.2 compatibility profile, and this function
will return `true`.

You can use the value returned by this function to decide which kind
of OpenGL API to use, or whether to do extension discovery, or what
kind of shader programs to load.

**Returns** `true` if the GL context is in legacy mode

### `isShared`

```ts
isShared(other: Gdk.GLContext): boolean
```

Checks if the two GL contexts can share resources.

When they can, the texture IDs from `other` can be used in `self`. This
is particularly useful when passing `GdkGLTexture` objects between
different contexts.

Contexts created for the same display with the same properties will
always be compatible, even if they are created for different surfaces.
For other contexts it depends on the GL backend.

Both contexts must be realized for this check to succeed. If either one
is not, this function will return `false`.

**Parameters**

- `other`: the `GdkGLContext` that should be compatible with `self`

**Returns** `true` if the two GL contexts are compatible.

_Available since 4.4._

### `makeCurrent`

```ts
makeCurrent(): void
```

Makes the `context` the current one.

### `realize`

```ts
realize(): boolean
```

Realizes the given `GdkGLContext`.

It is safe to call this function on a realized `GdkGLContext`.

**Returns** `true` if the context is realized

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `setAllowedApis`

```ts
setAllowedApis(apis: Gdk.GLAPI): void
```

Sets the allowed APIs. When `gdk_gl_context_realize()` is called, only the
allowed APIs will be tried. If you set this to 0, realizing will always fail.

If you set it on a realized context, the property will not have any effect.
It is only relevant during `gdk_gl_context_realize()`.

By default, all APIs are allowed.

**Parameters**

- `apis`: the allowed APIs

_Available since 4.6._

### `setDebugEnabled`

```ts
setDebugEnabled(enabled: boolean): void
```

Sets whether the `GdkGLContext` should perform extra validations and
runtime checking.

This is useful during development, but has additional overhead.

The `GdkGLContext` must not be realized or made current prior to
calling this function.

**Parameters**

- `enabled`: whether to enable debugging in the context

### `setForwardCompatible`

```ts
setForwardCompatible(compatible: boolean): void
```

Sets whether the `GdkGLContext` should be forward-compatible.

Forward-compatible contexts must not support OpenGL functionality that
has been marked as deprecated in the requested version; non-forward
compatible contexts, on the other hand, must support both deprecated and
non deprecated functionality.

The `GdkGLContext` must not be realized or made current prior to calling
this function.

**Parameters**

- `compatible`: whether the context should be forward-compatible

### `setRequiredVersion`

```ts
setRequiredVersion(major: number, minor: number): void
```

Sets the major and minor version of OpenGL to request.

Setting `major` and `minor` to zero will use the default values.

Setting `major` and `minor` lower than the minimum versions required
by GTK will result in the context choosing the minimum version.

The `context` must not be realized or made current prior to calling
this function.

**Parameters**

- `major`: the major version to request
- `minor`: the minor version to request

### `setUseEs`

```ts
setUseEs(useEs: number): void
```

Requests that GDK create an OpenGL ES context instead of an OpenGL one.

Not all platforms support OpenGL ES.

The `context` must not have been realized.

By default, GDK will attempt to automatically detect whether the
underlying GL implementation is OpenGL or OpenGL ES once the `context`
is realized.

You should check the return value of `Gdk.GLContext.getUseEs()`
after calling `Gdk.GLContext.realize()` to decide whether to use
the OpenGL or OpenGL ES API, extensions, or shaders.

**Parameters**

- `useEs`: whether the context should use OpenGL ES instead of OpenGL, or -1 to allow auto-detection
