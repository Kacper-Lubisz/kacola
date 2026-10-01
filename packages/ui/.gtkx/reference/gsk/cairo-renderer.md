---
description: "Renders a GSK rendernode tree with cairo."
---

# GskCairoRenderer

Renders a GSK rendernode tree with cairo.

Since it is using cairo, this renderer cannot support
3D transformations.

```tsx
import { GskCairoRenderer } from "@gtkx/jsx/gsk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GskRenderer](.gtkx/reference/gsk/renderer.md) → **GskCairoRenderer**

## Props

`ref` receives the `Gsk.CairoRenderer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
