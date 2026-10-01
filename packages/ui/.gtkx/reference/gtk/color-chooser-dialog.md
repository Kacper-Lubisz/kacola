---
description: "A dialog for choosing a color."
---

# GtkColorChooserDialog

A dialog for choosing a color.



`GtkColorChooserDialog` implements the `Gtk.ColorChooser` interface
and does not provide much API of its own.

To create a `GtkColorChooserDialog`, use `Gtk.ColorChooserDialog.new()`.

To change the initially selected color, use
`Gtk.ColorChooser.setRgba()`. To get the selected color use
`Gtk.ColorChooser.getRgba()`.

`GtkColorChooserDialog` has been deprecated in favor of `Gtk.ColorDialog`.

### CSS nodes

`GtkColorChooserDialog` has a single CSS node with the name `window` and style
class `.colorchooser`.

> **Deprecated since 4.10.** Use `Gtk.ColorDialog` instead

```tsx
import { GtkColorChooserDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → [GtkDialog](.gtkx/reference/gtk/dialog.md) → **GtkColorChooserDialog**

Implements `GtkAccessible`, `GtkBuildable`, `GtkColorChooser`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.ColorChooserDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `rgba`

`Gdk.RGBA` · deprecated since 4.10 · from `GtkColorChooser`

The currently selected color, as a `GdkRGBA` struct.

The property can be set to change the current selection
programmatically.

> **Deprecated since 4.10.** Use `Gtk.ColorDialog` and `Gtk.ColorDialogButton` instead of widgets implementing `GtkColorChooser`

### `showEditor`

`boolean` · default `false`

Whether the color chooser dialog is showing the single-color editor.

It can be set to switch the color chooser into single-color editing mode.

### `useAlpha`

`boolean` · default `true` · deprecated since 4.10 · from `GtkColorChooser`

Whether colors may have alpha (translucency).

When ::use-alpha is `false`, the `GdkRGBA` struct obtained
via the `Gtk.ColorChooser.rgba` property will be
forced to have alpha == 1.

Implementations are expected to show alpha by rendering the color
over a non-uniform background (like a checkerboard pattern).

> **Deprecated since 4.10.** Use `Gtk.ColorDialog` and `Gtk.ColorDialogButton` instead of widgets implementing `GtkColorChooser`

## Signals

### `onColorActivated`

```ts
(color: Gdk.RGBA, self: Gtk.ColorChooserDialog) => void
```

From `GtkColorChooser`.

Emitted when a color is activated from the color chooser.

This usually happens when the user clicks a color swatch,
or a color is selected and the user presses one of the keys
Space, Shift+Space, Return or Enter.

**Parameters**

- `color`: the color
- `self`: The instance the signal was emitted on.

> **Deprecated since 4.10.** Use `Gtk.ColorDialog` and `Gtk.ColorDialogButton` instead of widgets implementing `GtkColorChooser`
