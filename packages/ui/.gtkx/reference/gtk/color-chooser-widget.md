---
description: "The GtkColorChooserWidget widget lets the user select a color."
---

# GtkColorChooserWidget

The `GtkColorChooserWidget` widget lets the user select a color.

By default, the chooser presents a predefined palette of colors,
plus a small number of settable custom colors. It is also possible
to select a different color with the single-color editor.

To enter the single-color editing mode, use the context menu of any
color of the palette, or use the '+' button to add a new custom color.

The chooser automatically remembers the last selection, as well
as custom colors.

To create a `GtkColorChooserWidget`, use `Gtk.ColorChooserWidget.new()`.

To change the initially selected color, use
`Gtk.ColorChooser.setRgba()`. To get the selected color use
`Gtk.ColorChooser.getRgba()`.

The `GtkColorChooserWidget` is used in the `Gtk.ColorChooserDialog`
to provide a dialog for selecting colors.

## Actions

`GtkColorChooserWidget` defines a set of built-in actions:

- `color.customize` activates the color editor for the given color.
- `color.select` emits the `Gtk.ColorChooser.color-activated` signal
  for the given color.

## CSS names

`GtkColorChooserWidget` has a single CSS node with name colorchooser.

> **Deprecated since 4.10.** Direct use of `GtkColorChooserWidget` is deprecated.

```tsx
import { GtkColorChooserWidget } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkColorChooserWidget**

Implements `GtkAccessible`, `GtkBuildable`, `GtkColorChooser`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ColorChooserWidget` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `rgba`

`Gdk.RGBA` · deprecated since 4.10 · from `GtkColorChooser`

The currently selected color, as a `GdkRGBA` struct.

The property can be set to change the current selection
programmatically.

> **Deprecated since 4.10.** Use `Gtk.ColorDialog` and `Gtk.ColorDialogButton` instead of widgets implementing `GtkColorChooser`

### `showEditor`

`boolean` · default `false`

`true` when the color chooser is showing the single-color editor.

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
(color: Gdk.RGBA, self: Gtk.ColorChooserWidget) => void
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
