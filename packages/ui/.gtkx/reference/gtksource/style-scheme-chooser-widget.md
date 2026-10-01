---
description: "A widget for choosing style schemes."
---

# GtkSourceStyleSchemeChooserWidget

A widget for choosing style schemes.

The `GtkSourceStyleSchemeChooserWidget` widget lets the user select a
style scheme. By default, the chooser presents a predefined list
of style schemes.

To change the initially selected style scheme,
use `StyleSchemeChooser.setStyleScheme()`.
To get the selected style scheme
use `StyleSchemeChooser.getStyleScheme()`.

```tsx
import { GtkSourceStyleSchemeChooserWidget } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkSourceStyleSchemeChooserWidget**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkSourceStyleSchemeChooser`.

## Props

`ref` receives the `GtkSource.StyleSchemeChooserWidget` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `styleScheme`

`GtkSource.StyleScheme | ReactElement` · from `GtkSourceStyleSchemeChooser`

Contains the currently selected style scheme.

The property can be set to change the current selection programmatically.
