---
description: "A GdkTexture representing a DMA buffer."
---

# GdkDmabufTexture

A `GdkTexture` representing a DMA buffer.

To create a `GdkDmabufTexture`, use the auxiliary
`Gdk.DmabufTextureBuilder` object.

Dma-buf textures can only be created on Linux.

_Available since 4.14._

```tsx
import { GdkDmabufTexture } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GdkTexture](.gtkx/reference/gdk/texture.md) → **GdkDmabufTexture**

Implements `GdkPaintable`, `GIcon`, `GLoadableIcon`.

## Props

`ref` receives the `Gdk.DmabufTexture` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
