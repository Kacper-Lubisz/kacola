---
description: "Represents the platform-specific draw context."
---

# GdkCairoContext

Represents the platform-specific draw context.

`GdkCairoContext`s are created for a surface using
`Gdk.Surface.createCairoContext()`, and the context
can then be used to draw on that surface.

```tsx
import { GdkCairoContext } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GdkDrawContext](.gtkx/reference/gdk/draw-context.md) → **GdkCairoContext**

## Props

`ref` receives the `Gdk.CairoContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gdk.CairoContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `cairoCreate`

```ts
cairoCreate(): cairo.Context | null
```

Retrieves a Cairo context to be used to draw on the `GdkSurface`
of `context`.

A call to `Gdk.DrawContext.beginFrame()` with this
`context` must have been done or this function will return `null`.

The returned context is guaranteed to be valid until
`Gdk.DrawContext.endFrame()` is called.

**Returns** a Cairo context
  to draw on `GdkSurface

> **Deprecated since 4.18.** Drawing content with Cairo should be done via Cairo rendernodes, not by using renderers.
