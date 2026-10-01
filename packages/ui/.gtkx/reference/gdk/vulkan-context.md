---
description: "Represents the platform-specific Vulkan draw context."
---

# GdkVulkanContext

Represents the platform-specific Vulkan draw context.

`GdkVulkanContext`s are created for a surface using
`Gdk.Surface.createVulkanContext()`, and the context will match
the characteristics of the surface.

Support for `GdkVulkanContext` is platform-specific and context creation
can fail, returning `null` context.

> **Deprecated since 4.14.** GTK does not expose any Vulkan internals. This struct is a leftover that was accidentally exposed.

```tsx
import { GdkVulkanContext } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GdkDrawContext](.gtkx/reference/gdk/draw-context.md) → **GdkVulkanContext**

## Props

`ref` receives the `Gdk.VulkanContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onImagesUpdated`

```ts
(self: Gdk.VulkanContext) => void
```

Emitted when the images managed by this context have changed.

Usually this means that the swapchain had to be recreated,
for example in response to a change of the surface size.

**Parameters**

- `self`: The instance the signal was emitted on.
