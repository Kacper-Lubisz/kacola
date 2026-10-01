---
description: "Constructs Gdk.Texture objects from DMA buffers."
---

# GdkDmabufTextureBuilder

Constructs `Gdk.Texture` objects from DMA buffers.

DMA buffers are commonly called **_dma-bufs_**.

DMA buffers are a feature of the Linux kernel to enable efficient buffer and
memory sharing between hardware such as codecs, GPUs, displays, cameras and the
kernel drivers controlling them. For example, a decoder may want its output to
be directly shared with the display server for rendering without a copy.

Any device driver which participates in DMA buffer sharing, can do so as either
the exporter or importer of buffers (or both).

The memory that is shared via DMA buffers is usually stored in non-system memory
(maybe in device's local memory or something else not directly accessible by the
CPU), and accessing this memory from the CPU may have higher-than-usual overhead.

In particular for graphics data, it is not uncommon that data consists of multiple
separate blocks of memory, for example one block for each of the red, green and
blue channels. These blocks are called **_planes_**. DMA buffers can have up to
four planes. Even if the memory is a single block, the data can be organized in
multiple planes, by specifying offsets from the beginning of the data.

DMA buffers are exposed to user-space as file descriptors allowing to pass them
between processes. If a DMA buffer has multiple planes, more than one file
descriptor may be present, up to the number of planes. If the number of file
descriptors is less than the number of planes, the remaining ones should be set to
-1.

The format of the data (for graphics data, essentially its colorspace) is described
by a 32-bit integer. These format identifiers are defined in the header file `drm_fourcc.h`
and commonly referred to as **_fourcc_** values, since they are identified by 4 ASCII
characters. Additionally, each DMA buffer has a **_modifier_**, which is a 64-bit integer
that describes driver-specific details of the memory layout, such as tiling or compression.

For historical reasons, some producers of dma-bufs don't provide an explicit modifier, but
instead return `DMA_FORMAT_MOD_INVALID` to indicate that their modifier is **_implicit_**.
GTK tries to accommodate this situation by accepting `DMA_FORMAT_MOD_INVALID` as modifier.

The operation of `GdkDmabufTextureBuilder` is quite simple: Create a texture builder,
set all the necessary properties, and then call `Gdk.DmabufTextureBuilder.build()`
to create the new texture.

The required properties for a dma-buf texture are

 * The width and height in pixels

 * The `fourcc` code and `modifier` which identify the format and memory layout of the dma-buf

 * The file descriptor, offset and stride for each of the planes

`GdkDmabufTextureBuilder` can be used for quick one-shot construction of
textures as well as kept around and reused to construct multiple textures.

For further information, see

* The Linux kernel [documentation](https://docs.kernel.org/driver-api/dma-buf.html)

* The header file [drm_fourcc.h](https://gitlab.freedesktop.org/mesa/drm/-/blob/main/include/drm/drm_fourcc.h)

_Available since 4.14._

```tsx
import { GdkDmabufTextureBuilder } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkDmabufTextureBuilder**

## Props

`ref` receives the `Gdk.DmabufTextureBuilder` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `colorState`

`Gdk.ColorState`

The color state of the texture.

_Available since 4.16._

### `display`

`Gdk.Display | ReactElement`

The display that this texture will be used on.

_Available since 4.14._

### `fourcc`

`number` · default `0`

The format of the texture, as a fourcc value.

_Available since 4.14._

### `height`

`number` · default `0`

The height of the texture.

_Available since 4.14._

### `modifier`

`bigint` · default `0`

The modifier.

_Available since 4.14._

### `nPlanes`

`number` · default `1`

The number of planes of the texture.

Note that you can set properties for other planes,
but they will be ignored when constructing the texture.

_Available since 4.14._

### `premultiplied`

`boolean` · default `true`

Whether the alpha channel is premultiplied into the others.

Only relevant if the format has alpha.

_Available since 4.14._

### `updateRegion`

`cairo.Region`

The update region for `Gdk.DmabufTextureBuilder.updateTexture`.

_Available since 4.14._

### `updateTexture`

`Gdk.Texture | ReactElement`

The texture `Gdk.DmabufTextureBuilder.updateRegion` is an update for.

_Available since 4.14._

### `width`

`number` · default `0`

The width of the texture.

_Available since 4.14._

## Methods

Methods are called on the `Gdk.DmabufTextureBuilder` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `build`

```ts
build(destroy: GLib.DestroyNotify | null, data: bigint | null): Gdk.Texture | null
```

Builds a new `GdkTexture` with the values set up in the builder.

It is a programming error to call this function if any mandatory property has not been set.

Not all formats defined in the `drm_fourcc.h` header are supported. You can use
`Gdk.Display.getDmabufFormats()` to get a list of supported formats. If the
format is not supported by GTK, `null` will be returned and `error` will be set.

The `destroy` function gets called when the returned texture gets released.

It is the responsibility of the caller to keep the file descriptors for the planes
open until the created texture is no longer used, and close them afterwards (possibly
using the `destroy` notify).

It is possible to call this function multiple times to create multiple textures,
possibly with changing properties in between.

**Parameters**

- `destroy`: destroy function to be called when the texture is released
- `data`: user data to pass to the destroy function

**Returns** a newly built `GdkTexture` or `NULL`
  if the format is not supported

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.14._

### `getColorState`

```ts
getColorState(): Gdk.ColorState | null
```

Gets the color state previously set via `gdk_dmabuf_texture_builder_set_color_state()`.

**Returns** the color state

_Available since 4.16._

### `getDisplay`

```ts
getDisplay(): Gdk.Display
```

Returns the display that this texture builder is
associated with.

**Returns** the display

_Available since 4.14._

### `getFd`

```ts
getFd(plane: number): number
```

Gets the file descriptor for a plane or -1 if none.

**Parameters**

- `plane`: the plane to get the fd for

**Returns** the file descriptor

_Available since 4.14._

### `getFourcc`

```ts
getFourcc(): number
```

Gets the format previously set via `gdk_dmabuf_texture_builder_set_fourcc()`
or 0 if the format wasn't set.

The format is specified as a fourcc code.

**Returns** The format

_Available since 4.14._

### `getHeight`

```ts
getHeight(): number
```

Gets the height previously set via `gdk_dmabuf_texture_builder_set_height()` or
0 if the height wasn't set.

**Returns** The height

_Available since 4.14._

### `getModifier`

```ts
getModifier(): bigint
```

Gets the modifier value.

**Returns** the modifier

_Available since 4.14._

### `getNPlanes`

```ts
getNPlanes(): number
```

Gets the number of planes.

**Returns** The number of planes

_Available since 4.14._

### `getOffset`

```ts
getOffset(plane: number): number
```

Gets the offset value for a plane.

**Parameters**

- `plane`: the plane to get the offset for

**Returns** the offset

_Available since 4.14._

### `getPremultiplied`

```ts
getPremultiplied(): boolean
```

Whether the data is premultiplied.

**Returns** whether the data is premultiplied

_Available since 4.14._

### `getStride`

```ts
getStride(plane: number): number
```

Gets the stride value for a plane.

**Parameters**

- `plane`: the plane to get the stride for

**Returns** the stride

_Available since 4.14._

### `getUpdateRegion`

```ts
getUpdateRegion(): cairo.Region | null
```

Gets the region previously set via `gdk_dmabuf_texture_builder_set_update_region()` or
`null` if none was set.

**Returns** The region

_Available since 4.14._

### `getUpdateTexture`

```ts
getUpdateTexture(): Gdk.Texture | null
```

Gets the texture previously set via `gdk_dmabuf_texture_builder_set_update_texture()` or
`null` if none was set.

**Returns** The texture

_Available since 4.14._

### `getWidth`

```ts
getWidth(): number
```

Gets the width previously set via `gdk_dmabuf_texture_builder_set_width()` or
0 if the width wasn't set.

**Returns** The width

_Available since 4.14._

### `setColorState`

```ts
setColorState(colorState: Gdk.ColorState | null): void
```

Sets the color state for the texture.

By default, the colorstate is `NULL`. In that case, GTK will choose the
correct colorstate based on the format.
If you don't know what colorstates are, this is probably the right thing.

**Parameters**

- `colorState`: a `GdkColorState` or `NULL` to unset the colorstate.

_Available since 4.16._

### `setDisplay`

```ts
setDisplay(display: Gdk.Display): void
```

Sets the display that this texture builder is
associated with.

The display is used to determine the supported
dma-buf formats.

**Parameters**

- `display`: the display

_Available since 4.14._

### `setFd`

```ts
setFd(plane: number, fd: number): void
```

Sets the file descriptor for a plane or to -1 to unset it.

**Parameters**

- `plane`: the plane to set the fd for
- `fd`: the file descriptor

_Available since 4.14._

### `setFourcc`

```ts
setFourcc(fourcc: number): void
```

Sets the format of the texture.

The format is specified as a fourcc code.

The format must be set before calling `Gdk.DmabufTextureBuilder.build()`.

**Parameters**

- `fourcc`: the texture's format or 0 to unset

_Available since 4.14._

### `setHeight`

```ts
setHeight(height: number): void
```

Sets the height of the texture.

The height must be set before calling `Gdk.DmabufTextureBuilder.build()`.

**Parameters**

- `height`: the texture's height or 0 to unset

_Available since 4.14._

### `setModifier`

```ts
setModifier(modifier: bigint): void
```

Sets the modifier.

**Parameters**

- `modifier`: the modifier value

_Available since 4.14._

### `setNPlanes`

```ts
setNPlanes(nPlanes: number): void
```

Sets the number of planes of the texture.

**Parameters**

- `nPlanes`: the number of planes

_Available since 4.14._

### `setOffset`

```ts
setOffset(plane: number, offset: number): void
```

Sets the offset for a plane.

**Parameters**

- `plane`: the plane to set the offset for
- `offset`: the offset value

_Available since 4.14._

### `setPremultiplied`

```ts
setPremultiplied(premultiplied: boolean): void
```

Sets whether the data is premultiplied.

Unless otherwise specified, all formats including alpha channels are assumed
to be premultiplied.

**Parameters**

- `premultiplied`: whether the data is premultiplied

_Available since 4.14._

### `setStride`

```ts
setStride(plane: number, stride: number): void
```

Sets the stride for a plane.

The stride must be set for all planes before calling `Gdk.DmabufTextureBuilder.build()`.

**Parameters**

- `plane`: the plane to set the stride for
- `stride`: the stride value

_Available since 4.14._

### `setUpdateRegion`

```ts
setUpdateRegion(region: cairo.Region | null): void
```

Sets the region to be updated by this texture. Together with
`Gdk.DmabufTextureBuilder.updateTexture` this describes an
update of a previous texture.

When rendering animations of large textures, it is possible that
consecutive textures are only updating contents in parts of the texture.
It is then possible to describe this update via these two properties,
so that GTK can avoid rerendering parts that did not change.

An example would be a screen recording where only the mouse pointer moves.

**Parameters**

- `region`: the region to update

_Available since 4.14._

### `setUpdateTexture`

```ts
setUpdateTexture(texture: Gdk.Texture | null): void
```

Sets the texture to be updated by this texture. See
`Gdk.DmabufTextureBuilder.setUpdateRegion()` for an explanation.

**Parameters**

- `texture`: the texture to update

_Available since 4.14._

### `setWidth`

```ts
setWidth(width: number): void
```

Sets the width of the texture.

The width must be set before calling `Gdk.DmabufTextureBuilder.build()`.

**Parameters**

- `width`: The texture's width or 0 to unset

_Available since 4.14._
