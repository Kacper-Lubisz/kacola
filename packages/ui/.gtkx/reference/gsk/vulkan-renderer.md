---
description: "Renders a GSK rendernode tree with Vulkan."
---

# GskVulkanRenderer

Renders a GSK rendernode tree with Vulkan.

This renderer will fail to realize if Vulkan is not supported.

```tsx
import { GskVulkanRenderer } from "@gtkx/jsx/gsk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GskRenderer](.gtkx/reference/gsk/renderer.md) → **GskVulkanRenderer**

## Props

`ref` receives the `Gsk.VulkanRenderer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
