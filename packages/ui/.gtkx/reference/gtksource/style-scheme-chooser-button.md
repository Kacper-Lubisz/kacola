---
description: "A button to launch a style scheme selection dialog."
---

# GtkSourceStyleSchemeChooserButton

A button to launch a style scheme selection dialog.

The `GtkSourceStyleSchemeChooserButton` is a button which displays
the currently selected style scheme and allows to open a style scheme
selection dialog to change the style scheme.
It is suitable widget for selecting a style scheme in a preference dialog.

In `GtkSourceStyleSchemeChooserButton`, a `StyleSchemeChooserWidget`
is used to provide a dialog for selecting style schemes.

```tsx
import { GtkSourceStyleSchemeChooserButton } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkButton](.gtkx/reference/gtk/button.md) → **GtkSourceStyleSchemeChooserButton**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`, `GtkSourceStyleSchemeChooser`.

## Props

`ref` receives the `GtkSource.StyleSchemeChooserButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `styleScheme`

`GtkSource.StyleScheme | ReactElement` · from `GtkSourceStyleSchemeChooser`

Contains the currently selected style scheme.

The property can be set to change the current selection programmatically.
