---
description: "A type for objects that have an initially floating reference."
---

# GInitiallyUnowned

A type for objects that have an initially floating reference.

All the fields in the `GInitiallyUnowned` structure are private to the
implementation and should never be accessed directly.

```tsx
import { GInitiallyUnowned } from "@gtkx/jsx/gobject";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GInitiallyUnowned**

## Props

`ref` receives the `GObject.InitiallyUnowned` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
