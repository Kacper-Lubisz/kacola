---
description: "Constructs Gdk.Texture objects from system memory provided via GLib.Bytes."
---

# GdkMemoryTextureBuilder

Constructs `Gdk.Texture` objects from system memory provided
via `GLib.Bytes`.

The operation is quite simple: Create a texture builder, set all the necessary
properties - keep in mind that the properties `Gdk.MemoryTextureBuilder.bytes`,
`Gdk.MemoryTextureBuilder.stride`, `Gdk.MemoryTextureBuilder.width`,
and `Gdk.MemoryTextureBuilder.height` are mandatory - and then call
`Gdk.MemoryTextureBuilder.build()` to create the new texture.

`GdkMemoryTextureBuilder` can be used for quick one-shot construction of
textures as well as kept around and reused to construct multiple textures.

_Available since 4.16._

```tsx
import { GdkMemoryTextureBuilder } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkMemoryTextureBuilder**

## Props

`ref` receives the `Gdk.MemoryTextureBuilder` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `bytes`

`GLib.Bytes`

The bytes holding the data.

_Available since 4.16._

### `colorState`

`Gdk.ColorState`

The colorstate describing the data.

_Available since 4.16._

### `format`

`Gdk.MemoryFormat` · default `GDK_MEMORY_R8G8B8A8_PREMULTIPLIED`

The format of the data.

_Available since 4.16._

### `height`

`number` · default `0`

The height of the texture.

_Available since 4.16._

### `stride`

`bigint` · default `0`

The rowstride of the texture.

The rowstride is the number of bytes between the first pixel
in a row of image data, and the first pixel in the next row.

_Available since 4.16._

### `updateRegion`

`cairo.Region`

The update region for `Gdk.MemoryTextureBuilder.updateTexture`.

_Available since 4.16._

### `updateTexture`

`Gdk.Texture | ReactElement`

The texture `Gdk.MemoryTextureBuilder.updateRegion` is an update for.

_Available since 4.16._

### `width`

`number` · default `0`

The width of the texture.

_Available since 4.16._

## Methods

Methods are called on the `Gdk.MemoryTextureBuilder` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `build`

```ts
build(): Gdk.Texture
```

Builds a new `GdkTexture` with the values set up in the builder.

Note that it is a programming error to call this function if any mandatory
property has not been set.

It is possible to call this function multiple times to create multiple textures,
possibly with changing properties in between.

**Returns** a newly built `GdkTexture`

_Available since 4.16._

### `getBytes`

```ts
getBytes(): GLib.Bytes | null
```

Gets the bytes previously set via `gdk_memory_texture_builder_set_bytes()`
or `null` if none was set.

**Returns** The bytes

_Available since 4.16._

### `getColorState`

```ts
getColorState(): Gdk.ColorState
```

Gets the colorstate previously set via `gdk_memory_texture_builder_set_color_state()`.

**Returns** The colorstate

_Available since 4.16._

### `getFormat`

```ts
getFormat(): Gdk.MemoryFormat
```

Gets the format previously set via `gdk_memory_texture_builder_set_format()`.

**Returns** The format

_Available since 4.16._

### `getHeight`

```ts
getHeight(): number
```

Gets the height previously set via `gdk_memory_texture_builder_set_height()`
or 0 if the height wasn't set.

**Returns** The height

_Available since 4.16._

### `getOffset`

```ts
getOffset(plane: number): number
```

Gets the offset previously set via `gdk_memory_texture_builder_set_offset()`.

**Parameters**

- `plane`: a plane

**Returns** The offset associated to a `plane`

_Available since 4.20._

### `getStride`

```ts
getStride(): number
```

Gets the stride previously set via `gdk_memory_texture_builder_set_stride()`.

**Returns** the stride

_Available since 4.16._

### `getStrideForPlane`

```ts
getStrideForPlane(plane: number): number
```

Gets the stride previously set via `gdk_memory_texture_builder_set_stride_for_plane()`.

**Parameters**

- `plane`: a plane

**Returns** The stride associated to a `plane`

_Available since 4.20._

### `getUpdateRegion`

```ts
getUpdateRegion(): cairo.Region | null
```

Gets the region previously set via `gdk_memory_texture_builder_set_update_region()`
or `null` if none was set.

**Returns** The update region

_Available since 4.16._

### `getUpdateTexture`

```ts
getUpdateTexture(): Gdk.Texture | null
```

Gets the texture previously set via `gdk_memory_texture_builder_set_update_texture()`
or `null` if none was set.

**Returns** The update texture

_Available since 4.16._

### `getWidth`

```ts
getWidth(): number
```

Gets the width previously set via `gdk_memory_texture_builder_set_width()`
or 0 if the width wasn't set.

**Returns** The width

_Available since 4.16._

### `setBytes`

```ts
setBytes(bytes: GLib.Bytes | null): void
```

Sets the data to be shown but the texture.

The bytes must be set before calling `Gdk.MemoryTextureBuilder.build()`.

**Parameters**

- `bytes`: The bytes the texture shows or `null` to unset

_Available since 4.16._

### `setColorState`

```ts
setColorState(colorState: Gdk.ColorState): void
```

Sets the colorstate describing the data.

By default, the sRGB colorstate is used. If you don't know
what colorstates are, this is probably the right thing.

**Parameters**

- `colorState`: The colorstate describing the data

_Available since 4.16._

### `setFormat`

```ts
setFormat(format: Gdk.MemoryFormat): void
```

Sets the format of the bytes.

The default is `GDK_MEMORY_R8G8B8A8_PREMULTIPLIED`.

**Parameters**

- `format`: The texture's format

_Available since 4.16._

### `setHeight`

```ts
setHeight(height: number): void
```

Sets the height of the texture.

The height must be set before calling `Gdk.MemoryTextureBuilder.build()`
and conform to size requirements of the provided format.

**Parameters**

- `height`: The texture's height or 0 to unset

_Available since 4.16._

### `setOffset`

```ts
setOffset(plane: number, offset: number): void
```

Sets the offset of the texture for `plane`.

**Parameters**

- `plane`: a plane
- `offset`: the texture's offset for `plane`

_Available since 4.20._

### `setStride`

```ts
setStride(stride: number): void
```

Sets the rowstride of the bytes used.

The rowstride must be set before calling `Gdk.MemoryTextureBuilder.build()`.

**Parameters**

- `stride`: the stride or 0 to unset

_Available since 4.16._

### `setStrideForPlane`

```ts
setStrideForPlane(plane: number, stride: number): void
```

Sets the stride of the texture for `plane`.

**Parameters**

- `plane`: a plane
- `stride`: the texture's stride for `plane`

_Available since 4.20._

### `setUpdateRegion`

```ts
setUpdateRegion(region: cairo.Region | null): void
```

Sets the region to be updated by this texture.

Together with `Gdk.MemoryTextureBuilder.updateTexture`,
this describes an update of a previous texture.

When rendering animations of large textures, it is possible that
consecutive textures are only updating contents in parts of the texture.
It is then possible to describe this update via these two properties,
so that GTK can avoid rerendering parts that did not change.

An example would be a screen recording where only the mouse pointer moves.

**Parameters**

- `region`: the region to update

_Available since 4.16._

### `setUpdateTexture`

```ts
setUpdateTexture(texture: Gdk.Texture | null): void
```

Sets the texture to be updated by this texture.

See `Gdk.MemoryTextureBuilder.setUpdateRegion()` for an explanation.

**Parameters**

- `texture`: the texture to update

_Available since 4.16._

### `setWidth`

```ts
setWidth(width: number): void
```

Sets the width of the texture.

The width must be set before calling `Gdk.MemoryTextureBuilder.build()`
and conform to size requirements of the provided format.

**Parameters**

- `width`: The texture's width or 0 to unset

_Available since 4.16._
