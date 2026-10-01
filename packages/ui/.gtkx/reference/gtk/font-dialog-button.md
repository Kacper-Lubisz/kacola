---
description: "Opens a font chooser dialog to select a font."
---

# GtkFontDialogButton

Opens a font chooser dialog to select a font.



It is suitable widget for selecting a font in a preference dialog.

## CSS nodes

```
fontbutton
╰── button.font
    ╰── [content]
```

`GtkFontDialogButton` has a single CSS node with name fontbutton which
contains a button node with the .font style class.

_Available since 4.10._

```tsx
import { GtkFontDialogButton } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkFontDialogButton**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.FontDialogButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `dialog`

`Gtk.FontDialog | ReactElement`

The `GtkFontDialog` that contains parameters for
the font chooser dialog.

_Available since 4.10._

### `fontDesc`

`Pango.FontDescription`

The selected font.

This property can be set to give the button its initial
font, and it will be updated to reflect the users choice
in the font chooser dialog.

Listen to `notify::font-desc` to get informed about changes
to the buttons font.

_Available since 4.10._

### `fontFeatures`

`string` · default `null`

The selected font features.

This property will be updated to reflect the users choice
in the font chooser dialog.

Listen to `notify::font-features` to get informed about changes
to the buttons font features.

_Available since 4.10._

### `language`

`Pango.Language`

The selected language for font features.

This property will be updated to reflect the users choice
in the font chooser dialog.

Listen to `notify::language` to get informed about changes
to the buttons language.

_Available since 4.10._

### `level`

`Gtk.FontLevel` · default `GTK_FONT_LEVEL_FONT`

The level of detail for the font chooser dialog.

### `useFont`

`boolean` · default `false`

Whether the buttons label will be drawn in the selected font.

### `useSize`

`boolean` · default `false`

Whether the buttons label will use the selected font size.

## Signals

### `onActivate`

```ts
(self: Gtk.FontDialogButton) => void
```

Emitted when the font dialog button is activated.

The `::activate` signal on `GtkFontDialogButton` is an action signal
and emitting it causes the button to pop up its dialog.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 4.14._

## Methods

Methods are called on the `Gtk.FontDialogButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getDialog`

```ts
getDialog(): Gtk.FontDialog | null
```

Returns the `GtkFontDialog` of `self`.

**Returns** the `GtkFontDialog`

_Available since 4.10._

### `getFontDesc`

```ts
getFontDesc(): Pango.FontDescription | null
```

Returns the font of the button.

This function is what should be used to obtain
the font that was chosen by the user. To get
informed about changes, listen to "notify::font-desc".

**Returns** the font

_Available since 4.10._

### `getFontFeatures`

```ts
getFontFeatures(): string | null
```

Returns the font features of the button.

This function is what should be used to obtain the font features
that were chosen by the user. To get informed about changes, listen
to "notify::font-features".

Note that the button will only let users choose font features
if `Gtk.FontDialogButton.level` is set to
`GTK_FONT_LEVEL_FEATURES`.

**Returns** the font features

_Available since 4.10._

### `getLanguage`

```ts
getLanguage(): Pango.Language | null
```

Returns the language that is used for font features.

**Returns** the language

_Available since 4.10._

### `getLevel`

```ts
getLevel(): Gtk.FontLevel
```

Returns the level of detail at which this dialog
lets the user select fonts.

**Returns** the level of detail

_Available since 4.10._

### `getUseFont`

```ts
getUseFont(): boolean
```

Returns whether the selected font is used in the label.

**Returns** whether the selected font is used in the label

_Available since 4.10._

### `getUseSize`

```ts
getUseSize(): boolean
```

Returns whether the selected font size is used in the label.

**Returns** whether the selected font size is used in the label

_Available since 4.10._

### `setDialog`

```ts
setDialog(dialog: Gtk.FontDialog): void
```

Sets a `GtkFontDialog` object to use for
creating the font chooser dialog that is
presented when the user clicks the button.

**Parameters**

- `dialog`: the new `GtkFontDialog`

_Available since 4.10._

### `setFontDesc`

```ts
setFontDesc(fontDesc: Pango.FontDescription): void
```

Sets the font of the button.

**Parameters**

- `fontDesc`: the new font

_Available since 4.10._

### `setFontFeatures`

```ts
setFontFeatures(fontFeatures: string | null): void
```

Sets the font features of the button.

**Parameters**

- `fontFeatures`: the font features

_Available since 4.10._

### `setLanguage`

```ts
setLanguage(language: Pango.Language | null): void
```

Sets the language to use for font features.

**Parameters**

- `language`: the new language

_Available since 4.10._

### `setLevel`

```ts
setLevel(level: Gtk.FontLevel): void
```

Sets the level of detail at which this dialog
lets the user select fonts.

**Parameters**

- `level`: the level of detail

_Available since 4.10._

### `setUseFont`

```ts
setUseFont(useFont: boolean): void
```

If `use_font` is `TRUE`, the font name will be written
using the selected font.

**Parameters**

- `useFont`: If `TRUE`, font name will be written using the chosen font

_Available since 4.10._

### `setUseSize`

```ts
setUseSize(useSize: boolean): void
```

If `use_size` is `TRUE`, the font name will be written
using the selected font size.

**Parameters**

- `useSize`: If `TRUE`, font name will be written using the chosen font size

_Available since 4.10._
