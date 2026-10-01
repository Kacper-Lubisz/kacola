---
description: "Provides an interface and default functions for loading and unloading modules."
---

# GIOModule

Provides an interface and default functions for loading and unloading
modules. This is used internally to make GIO extensible, but can also
be used by others to implement module loading.

```tsx
import { GIOModule } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GTypeModule](.gtkx/reference/gobject/type-module.md) → **GIOModule**

Implements `GTypePlugin`.

## Props

`ref` receives the `Gio.IOModule` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
