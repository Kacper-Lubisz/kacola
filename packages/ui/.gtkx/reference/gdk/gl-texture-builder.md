---
description: "Constructs Gdk.Texture objects from GL textures."
---

# GdkGLTextureBuilder

Constructs `Gdk.Texture` objects from GL textures.

The operation is quite simple: Create a texture builder, set all the necessary
properties - keep in mind that the properties `Gdk.GLTextureBuilder.context`,
`Gdk.GLTextureBuilder.id`, `Gdk.GLTextureBuilder.width`, and
`Gdk.GLTextureBuilder.height` are mandatory - and then call
`Gdk.GLTextureBuilder.build()` to create the new texture.

`GdkGLTextureBuilder` can be used for quick one-shot construction of
textures as well as kept around and reused to construct multiple textures.

_Available since 4.12._

```tsx
import { GdkGLTextureBuilder } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkGLTextureBuilder**

## Props

`ref` receives the `Gdk.GLTextureBuilder` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `colorState`

`Gdk.ColorState`

The color state of the texture.

_Available since 4.16._

### `context`

`Gdk.GLContext | ReactElement`

The context owning the texture.

_Available since 4.12._

### `format`

`Gdk.MemoryFormat` · default `GDK_MEMORY_R8G8B8A8_PREMULTIPLIED`

The format when downloading the texture.

_Available since 4.12._

### `hasMipmap`

`boolean` · default `false`

If the texture has a mipmap.

_Available since 4.12._

### `height`

`number` · default `0`

The height of the texture.

_Available since 4.12._

### `id`

`number` · default `0`

The texture ID to use.

_Available since 4.12._

### `sync`

`bigint`

An optional `GLSync` object.

If this is set, GTK will wait on it before using the texture.

_Available since 4.12._

### `updateRegion`

`cairo.Region`

The update region for `Gdk.GLTextureBuilder.updateTexture`.

_Available since 4.12._

### `updateTexture`

`Gdk.Texture | ReactElement`

The texture `Gdk.GLTextureBuilder.updateRegion` is an update for.

_Available since 4.12._

### `width`

`number` · default `0`

The width of the texture.

_Available since 4.12._

## Methods

Methods are called on the `Gdk.GLTextureBuilder` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `build`

```ts
build(destroy: GLib.DestroyNotify | null, data: bigint | null): Gdk.Texture
```

Builds a new `GdkTexture` with the values set up in the builder.

The `destroy` function gets called when the returned texture gets released;
either when the texture is finalized or by an explicit call to
`Gdk.GLTexture.release()`. It should release all GL resources associated
with the texture, such as the `Gdk.GLTextureBuilder.id` and the
`Gdk.GLTextureBuilder.sync`.

Note that it is a programming error to call this function if any mandatory
property has not been set.

It is possible to call this function multiple times to create multiple textures,
possibly with changing properties in between.

**Parameters**

- `destroy`: destroy function to be called when the texture is released
- `data`: user data to pass to the destroy function

**Returns** a newly built `GdkTexture`

_Available since 4.12._

### `getColorState`

```ts
getColorState(): Gdk.ColorState
```

Gets the color state previously set via `gdk_gl_texture_builder_set_color_state()`.

**Returns** the color state

_Available since 4.16._

### `getContext`

```ts
getContext(): Gdk.GLContext | null
```

Gets the context previously set via `gdk_gl_texture_builder_set_context()` or
`null` if none was set.

**Returns** The context

_Available since 4.12._

### `getFormat`

```ts
getFormat(): Gdk.MemoryFormat
```

Gets the format previously set via `gdk_gl_texture_builder_set_format()`.

**Returns** The format

_Available since 4.12._

### `getHasMipmap`

```ts
getHasMipmap(): boolean
```

Gets whether the texture has a mipmap.

**Returns** Whether the texture has a mipmap

_Available since 4.12._

### `getHeight`

```ts
getHeight(): number
```

Gets the height previously set via `gdk_gl_texture_builder_set_height()` or
0 if the height wasn't set.

**Returns** The height

_Available since 4.12._

### `getId`

```ts
getId(): number
```

Gets the texture id previously set via `gdk_gl_texture_builder_set_id()` or
0 if the id wasn't set.

**Returns** The id

_Available since 4.12._

### `getSync`

```ts
getSync(): bigint | null
```

Gets the `GLsync` previously set via `gdk_gl_texture_builder_set_sync()`.

**Returns** the `GLSync`

_Available since 4.12._

### `getUpdateRegion`

```ts
getUpdateRegion(): cairo.Region | null
```

Gets the region previously set via `gdk_gl_texture_builder_set_update_region()` or
`null` if none was set.

**Returns** The region

_Available since 4.12._

### `getUpdateTexture`

```ts
getUpdateTexture(): Gdk.Texture | null
```

Gets the texture previously set via `gdk_gl_texture_builder_set_update_texture()` or
`null` if none was set.

**Returns** The texture

_Available since 4.12._

### `getWidth`

```ts
getWidth(): number
```

Gets the width previously set via `gdk_gl_texture_builder_set_width()` or
0 if the width wasn't set.

**Returns** The width

_Available since 4.12._

### `setColorState`

```ts
setColorState(colorState: Gdk.ColorState): void
```

Sets the color state for the texture.

By default, the sRGB colorstate is used. If you don't know what
colorstates are, this is probably the right thing.

**Parameters**

- `colorState`: a `GdkColorState`

_Available since 4.16._

### `setContext`

```ts
setContext(context: Gdk.GLContext | null): void
```

Sets the context to be used for the texture. This is the context that owns
the texture.

The context must be set before calling `Gdk.GLTextureBuilder.build()`.

**Parameters**

- `context`: The context the texture belongs to or `null` to unset

_Available since 4.12._

### `setFormat`

```ts
setFormat(format: Gdk.MemoryFormat): void
```

Sets the format of the texture. The default is `GDK_MEMORY_R8G8B8A8_PREMULTIPLIED`.

The format is the preferred format the texture data should be downloaded to. The
format must be supported by the GL version of `Gdk.GLTextureBuilder.context`.

GDK's texture download code assumes that the format corresponds to the storage
parameters of the GL texture in an obvious way. For example, a format of
`GDK_MEMORY_R16G16B16A16_PREMULTIPLIED` is expected to be stored as `GL_RGBA16`
texture, and `GDK_MEMORY_G8A8` is expected to be stored as `GL_RG8` texture.

Setting the right format is particularly useful when using high bit depth textures
to preserve the bit depth, to set the correct value for unpremultiplied textures
and to make sure opaque textures are treated as such.

Non-RGBA textures need to have swizzling parameters set up properly to be usable
in GSK's shaders.

**Parameters**

- `format`: The texture's format

_Available since 4.12._

### `setHasMipmap`

```ts
setHasMipmap(hasMipmap: boolean): void
```

Sets whether the texture has a mipmap. This allows the renderer and other users of the
generated texture to use a higher quality downscaling.

Typically, the `glGenerateMipmap` function is used to generate a mimap.

**Parameters**

- `hasMipmap`: Whether the texture has a mipmap

_Available since 4.12._

### `setHeight`

```ts
setHeight(height: number): void
```

Sets the height of the texture.

The height must be set before calling `Gdk.GLTextureBuilder.build()`.

**Parameters**

- `height`: The texture's height or 0 to unset

_Available since 4.12._

### `setId`

```ts
setId(id: number): void
```

Sets the texture id of the texture. The texture id must remain unmodified
until the texture was finalized. See `Gdk.GLTextureBuilder.build()`
for a longer discussion.

The id must be set before calling `Gdk.GLTextureBuilder.build()`.

**Parameters**

- `id`: The texture id to be used for creating the texture

_Available since 4.12._

### `setSync`

```ts
setSync(sync: bigint | null): void
```

Sets the GLSync object to use for the texture.

GTK will wait on this object before using the created `GdkTexture`.

The `destroy` function that is passed to `Gdk.GLTextureBuilder.build()`
is responsible for freeing the sync object when it is no longer needed.
The texture builder does not destroy it and it is the callers
responsibility to make sure it doesn't leak.

**Parameters**

- `sync`: the GLSync object

_Available since 4.12._

### `setUpdateRegion`

```ts
setUpdateRegion(region: cairo.Region | null): void
```

Sets the region to be updated by this texture. Together with
`Gdk.GLTextureBuilder.updateTexture` this describes an
update of a previous texture.

When rendering animations of large textures, it is possible that
consecutive textures are only updating contents in parts of the texture.
It is then possible to describe this update via these two properties,
so that GTK can avoid rerendering parts that did not change.

An example would be a screen recording where only the mouse pointer moves.

**Parameters**

- `region`: the region to update

_Available since 4.12._

### `setUpdateTexture`

```ts
setUpdateTexture(texture: Gdk.Texture | null): void
```

Sets the texture to be updated by this texture. See
`Gdk.GLTextureBuilder.setUpdateRegion()` for an explanation.

**Parameters**

- `texture`: the texture to update

_Available since 4.12._

### `setWidth`

```ts
setWidth(width: number): void
```

Sets the width of the texture.

The width must be set before calling `Gdk.GLTextureBuilder.build()`.

**Parameters**

- `width`: The texture's width or 0 to unset

_Available since 4.12._
