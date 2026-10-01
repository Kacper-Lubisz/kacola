---
description: "The GtkFontChooserWidget widget lets the user select a font."
---

# GtkFontChooserWidget

The `GtkFontChooserWidget` widget lets the user select a font.

It is used in the `GtkFontChooserDialog` widget to provide a
dialog for selecting fonts.

To set the font which is initially selected, use
`Gtk.FontChooser.setFont()` or `Gtk.FontChooser.setFontDesc()`.

To get the selected font use `Gtk.FontChooser.getFont()` or
`Gtk.FontChooser.getFontDesc()`.

To change the text which is shown in the preview area, use
`Gtk.FontChooser.setPreviewText()`.

## CSS nodes

`GtkFontChooserWidget` has a single CSS node with name fontchooser.

> **Deprecated since 4.10.** Direct use of `GtkFontChooserWidget` is deprecated.

```tsx
import { GtkFontChooserWidget } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkFontChooserWidget**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkFontChooser`.

## Props

`ref` receives the `Gtk.FontChooserWidget` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `font`

`string` · default `Sans 10` · deprecated since 4.10 · from `GtkFontChooser`

The font description as a string, e.g. "Sans Italic 12".

> **Deprecated since 4.10.** Use `Gtk.FontDialog` and `Gtk.FontDialogButton` instead

### `fontDesc`

`Pango.FontDescription` · deprecated since 4.10 · from `GtkFontChooser`

The font description as a `PangoFontDescription`.

> **Deprecated since 4.10.** Use `Gtk.FontDialog` and `Gtk.FontDialogButton` instead

### `fontFeatures`

`string` · read-only, observe with `onNotifyFontFeatures` · deprecated since 4.10 · from `GtkFontChooser`

The selected font features.

The format of the string is compatible with
CSS and with Pango attributes.

> **Deprecated since 4.10.** Use `Gtk.FontDialog` and `Gtk.FontDialogButton` instead

### `language`

`string` · deprecated since 4.10 · from `GtkFontChooser`

The language for which the font features were selected.

> **Deprecated since 4.10.** Use `Gtk.FontDialog` and `Gtk.FontDialogButton` instead

### `level`

`Gtk.FontChooserLevel` · default `GTK_FONT_CHOOSER_LEVEL_STYLE | GTK_FONT_CHOOSER_LEVEL_SIZE` · deprecated since 4.10 · from `GtkFontChooser`

The level of granularity to offer for selecting fonts.

> **Deprecated since 4.10.** Use `Gtk.FontDialog` and `Gtk.FontDialogButton` instead

### `previewText`

`string` · default `The quick brown fox jumps over the lazy dog.` · deprecated since 4.10 · from `GtkFontChooser`

The string with which to preview the font.

> **Deprecated since 4.10.** Use `Gtk.FontDialog` and `Gtk.FontDialogButton` instead

### `showPreviewEntry`

`boolean` · default `true` · deprecated since 4.10 · from `GtkFontChooser`

Whether to show an entry to change the preview text.

> **Deprecated since 4.10.** Use `Gtk.FontDialog` and `Gtk.FontDialogButton` instead

### `tweakAction`

`Gio.Action` · read-only, observe with `onNotifyTweakAction`

A toggle action that can be used to switch to the tweak page
of the font chooser widget, which lets the user tweak the
OpenType features and variation axes of the selected font.

The action will be enabled or disabled depending on whether
the selected font has any features or axes.

## Signals

### `onFontActivated`

```ts
(fontname: string, self: Gtk.FontChooserWidget) => void
```

From `GtkFontChooser`.

Emitted when a font is activated.

This usually happens when the user double clicks an item,
or an item is selected and the user presses one of the keys
Space, Shift+Space, Return or Enter.

**Parameters**

- `fontname`: the font name
- `self`: The instance the signal was emitted on.

> **Deprecated since 4.10.** Use `Gtk.FontDialog` and `Gtk.FontDialogButton` instead
