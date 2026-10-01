---
description: "The GtkFontButton allows to open a font chooser dialog to change the font."
---

# GtkFontButton

The `GtkFontButton` allows to open a font chooser dialog to change
the font.



It is suitable widget for selecting a font in a preference dialog.

## CSS nodes

```
fontbutton
╰── button.font
    ╰── [content]
```

`GtkFontButton` has a single CSS node with name fontbutton which
contains a button node with the .font style class.

> **Deprecated since 4.10.** Use `Gtk.FontDialogButton` instead

```tsx
import { GtkFontButton } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkFontButton**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkFontChooser`.

## Props

`ref` receives the `Gtk.FontButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

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

### `modal`

`boolean` · default `true`

Whether the font chooser dialog should be modal.

### `previewText`

`string` · default `The quick brown fox jumps over the lazy dog.` · deprecated since 4.10 · from `GtkFontChooser`

The string with which to preview the font.

> **Deprecated since 4.10.** Use `Gtk.FontDialog` and `Gtk.FontDialogButton` instead

### `showPreviewEntry`

`boolean` · default `true` · deprecated since 4.10 · from `GtkFontChooser`

Whether to show an entry to change the preview text.

> **Deprecated since 4.10.** Use `Gtk.FontDialog` and `Gtk.FontDialogButton` instead

### `title`

`string` · default `Pick a Font`

The title of the font chooser dialog.

### `useFont`

`boolean` · default `false`

Whether the buttons label will be drawn in the selected font.

### `useSize`

`boolean` · default `false`

Whether the buttons label will use the selected font size.

## Signals

### `onActivate`

```ts
(self: Gtk.FontButton) => void
```

Emitted to when the font button is activated.

The `::activate` signal on `GtkFontButton` is an action signal and
emitting it causes the button to present its dialog.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 4.4._

### `onFontActivated`

```ts
(fontname: string, self: Gtk.FontButton) => void
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

### `onFontSet`

```ts
(self: Gtk.FontButton) => void
```

Emitted when the user selects a font.

When handling this signal, use `Gtk.FontChooser.getFont()`
to find out which font was just selected.

Note that this signal is only emitted when the user changes the font.
If you need to react to programmatic font changes as well, use
the notify::font signal.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.FontButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getModal`

```ts
getModal(): boolean
```

Gets whether the dialog is modal.

**Returns** `true` if the dialog is modal

> **Deprecated since 4.10.** Use `Gtk.FontDialogButton` instead

### `getTitle`

```ts
getTitle(): string
```

Retrieves the title of the font chooser dialog.

**Returns** an internal copy of the title string
  which must not be freed.

> **Deprecated since 4.10.** Use `Gtk.FontDialogButton` instead

### `getUseFont`

```ts
getUseFont(): boolean
```

Returns whether the selected font is used in the label.

**Returns** whether the selected font is used in the label.

> **Deprecated since 4.10.** Use `Gtk.FontDialogButton` instead

### `getUseSize`

```ts
getUseSize(): boolean
```

Returns whether the selected size is used in the label.

**Returns** whether the selected size is used in the label.

> **Deprecated since 4.10.** Use `Gtk.FontDialogButton` instead

### `setModal`

```ts
setModal(modal: boolean): void
```

Sets whether the dialog should be modal.

**Parameters**

- `modal`: `true` to make the dialog modal

> **Deprecated since 4.10.** Use `Gtk.FontDialogButton` instead

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title for the font chooser dialog.

**Parameters**

- `title`: a string containing the font chooser dialog title

> **Deprecated since 4.10.** Use `Gtk.FontDialogButton` instead

### `setUseFont`

```ts
setUseFont(useFont: boolean): void
```

If `use_font` is `true`, the font name will be written
using the selected font.

**Parameters**

- `useFont`: If `true`, font name will be written using font chosen.

> **Deprecated since 4.10.** Use `Gtk.FontDialogButton` instead

### `setUseSize`

```ts
setUseSize(useSize: boolean): void
```

If `use_size` is `true`, the font name will be written using
the selected size.

**Parameters**

- `useSize`: If `true`, font name will be written using the selected size.

> **Deprecated since 4.10.** Use `Gtk.FontDialogButton` instead
