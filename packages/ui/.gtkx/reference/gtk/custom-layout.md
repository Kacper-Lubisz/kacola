---
description: "Uses closures for size negotiation."
---

# GtkCustomLayout

Uses closures for size negotiation.

A `GtkCustomLayout` uses closures matching to the old `GtkWidget`
virtual functions for size negotiation, as a convenience API to
ease the porting towards the corresponding `GtkLayoutManager`
virtual functions.

```tsx
import { GtkCustomLayout } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkLayoutManager](.gtkx/reference/gtk/layout-manager.md) → **GtkCustomLayout**

## Props

`ref` receives the `Gtk.CustomLayout` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
