---
description: "A GtkEntryBuffer that locks the underlying memory to prevent it from being swapped to disk."
---

# GtkPasswordEntryBuffer

A `GtkEntryBuffer` that locks the underlying memory to prevent it
from being swapped to disk.

`GtkPasswordEntry` uses a `GtkPasswordEntryBuffer`.

_Available since 4.4._

```tsx
import { GtkPasswordEntryBuffer } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEntryBuffer](.gtkx/reference/gtk/entry-buffer.md) → **GtkPasswordEntryBuffer**

## Props

`ref` receives the `Gtk.PasswordEntryBuffer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
