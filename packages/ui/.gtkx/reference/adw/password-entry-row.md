---
description: "A EntryRow tailored for entering secrets."
---

# AdwPasswordEntryRow

A `EntryRow` tailored for entering secrets.



It does not show its contents in clear text, does not allow to copy it to the
clipboard, and shows a warning when Caps Lock is engaged. If the underlying
platform allows it, `AdwPasswordEntryRow` will also place the text in a
non-pageable memory area, to avoid it being written out to disk by the
operating system.

It offer a way to reveal the contents in clear text.

### CSS Nodes

`AdwPasswordEntryRow` has a single CSS node with name `row` that carries
`.entry` and `.password` style classes.

_Available since 1.2._

```tsx
import { AdwPasswordEntryRow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkListBoxRow](.gtkx/reference/gtk/list-box-row.md) → [AdwPreferencesRow](.gtkx/reference/adw/preferences-row.md) → [AdwEntryRow](.gtkx/reference/adw/entry-row.md) → **AdwPasswordEntryRow**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`, `GtkEditable`.

## Props

`ref` receives the `Adw.PasswordEntryRow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
