---
description: "A GdkTexture representing a GL texture object."
---

# GdkGLTexture

A `GdkTexture` representing a GL texture object.

```tsx
import { GdkGLTexture } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GdkTexture](.gtkx/reference/gdk/texture.md) → **GdkGLTexture**

Implements `GdkPaintable`, `GIcon`, `GLoadableIcon`.

## Props

`ref` receives the `Gdk.GLTexture` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gdk.GLTexture` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `release`

```ts
release(): void
```

Releases the GL resources held by a `GdkGLTexture`.

The texture contents are still available via the
`Gdk.Texture.download()` function, after this
function has been called.
