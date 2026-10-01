---
description: "Matches an item when at least one of its filters matches."
---

# GtkAnyFilter

Matches an item when at least one of its filters matches.

To add filters to a `GtkAnyFilter`, use `Gtk.MultiFilter.append()`.

```tsx
import { GtkAnyFilter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkFilter](.gtkx/reference/gtk/filter.md) → [GtkMultiFilter](.gtkx/reference/gtk/multi-filter.md) → **GtkAnyFilter**

Implements `GListModel`, `GtkBuildable`.

## Props

`ref` receives the `Gtk.AnyFilter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
