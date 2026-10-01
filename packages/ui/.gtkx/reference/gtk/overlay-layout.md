---
description: "The layout manager used by Gtk.Overlay."
---

# GtkOverlayLayout

The layout manager used by `Gtk.Overlay`.

It places widgets as overlays on top of the main child.

This is not a reusable layout manager, since it expects its widget
to be a `GtkOverlay`. It is only listed here so that its layout
properties get documented.

```tsx
import { GtkOverlayLayout } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkLayoutManager](.gtkx/reference/gtk/layout-manager.md) → **GtkOverlayLayout**

## Props

`ref` receives the `Gtk.OverlayLayout` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
