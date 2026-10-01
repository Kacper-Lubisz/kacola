---
description: "Asynchronous API to present a font chooser dialog."
---

# GtkFontDialog

Asynchronous API to present a font chooser dialog.

`GtkFontDialog` collects the arguments that are needed to present
the dialog to the user, such as a title for the dialog and whether
it should be modal.

The dialog is shown with the `Gtk.FontDialog.chooseFont()`
function or its variants.

See `Gtk.FontDialogButton` for a convenient control
that uses `GtkFontDialog` and presents the results.

_Available since 4.10._

```tsx
import { GtkFontDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkFontDialog**

## Props

`ref` receives the `Gtk.FontDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `filter`

`Gtk.Filter | ReactElement`

A filter to restrict what fonts are shown in the font chooser dialog.

_Available since 4.10._

### `fontMap`

`Pango.FontMap | ReactElement`

A custom font map to select fonts from.

A custom font map can be used to present application-specific
fonts instead of or in addition to the normal system fonts.

_Available since 4.10._

### `language`

`Pango.Language`

The language for which the font features are selected.

_Available since 4.10._

### `modal`

`boolean` · default `true`

Whether the font chooser dialog is modal.

_Available since 4.10._

### `title`

`string` · default `null`

A title that may be shown on the font chooser
dialog that is presented by `Gtk.FontDialog.chooseFont()`.

_Available since 4.10._

## Methods

Methods are called on the `Gtk.FontDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `chooseFace`

```ts
chooseFace(parent: Gtk.Window | null, initialValue: Pango.FontFace | null, cancellable?: Gio.Cancellable | null): Promise<Pango.FontFace>
```

Presents a font chooser dialog to the user.

The font chooser dialog will be set up for selecting a font face.

A font face represents a font family and style, but no specific font size.

**Parameters**

- `parent`: the parent window
- `initialValue`: the initial value
- `cancellable`: a cancellable to cancel the operation

**Returns** the selected `Pango.FontFace`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `chooseFaceFinish`

```ts
chooseFaceFinish(result: Gio.AsyncResult): Pango.FontFace
```

Finishes the `Gtk.FontDialog.chooseFace()` call.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: the result

**Returns** the selected `Pango.FontFace`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `chooseFamily`

```ts
chooseFamily(parent: Gtk.Window | null, initialValue: Pango.FontFamily | null, cancellable?: Gio.Cancellable | null): Promise<Pango.FontFamily>
```

Presents a font chooser dialog to the user.

The font chooser dialog will be set up for selecting a font family.

**Parameters**

- `parent`: the parent window
- `initialValue`: the initial value
- `cancellable`: a cancellable to cancel the operation

**Returns** the selected `Pango.FontFamily`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `chooseFamilyFinish`

```ts
chooseFamilyFinish(result: Gio.AsyncResult): Pango.FontFamily
```

Finishes the `Gtk.FontDialog.chooseFamily()` call.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: the result

**Returns** the selected `Pango.FontFamily`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `chooseFont`

```ts
chooseFont(parent: Gtk.Window | null, initialValue: Pango.FontDescription | null, cancellable?: Gio.Cancellable | null): Promise<Pango.FontDescription>
```

Presents a font chooser dialog to the user.

The font chooser dialog will be set up for selecting a font.

If you want to let the user select font features as well,
use `Gtk.FontDialog.chooseFontAndFeatures()` instead.

**Parameters**

- `parent`: the parent window
- `initialValue`: the font to select initially
- `cancellable`: a cancellable to cancel the operation

**Returns** a `Pango.FontDescription` describing
  the selected font

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `chooseFontAndFeatures`

```ts
chooseFontAndFeatures(parent: Gtk.Window | null, initialValue: Pango.FontDescription | null, cancellable?: Gio.Cancellable | null): Promise<[Pango.FontDescription, string, Pango.Language]>
```

Presents a font chooser dialog to the user.

The font chooser dialog will be set up for selecting a font
and specify features for the selected font.

Font features affect how the font is rendered, for example
enabling glyph variants or ligatures.

**Parameters**

- `parent`: the parent window
- `initialValue`: the font to select initially
- `cancellable`: a cancellable to cancel the operation

**Returns** Tuple of:

- `fontDesc`: return location for font description
- `fontFeatures`: return location for font features
- `language`: return location for the language

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `chooseFontAndFeaturesFinish`

```ts
chooseFontAndFeaturesFinish(result: Gio.AsyncResult): [boolean, Pango.FontDescription, string, Pango.Language]
```

Finishes the `Gtk.FontDialog.chooseFontAndFeatures()` call.

The selected font and features are returned in `font_desc` and
`font_features`.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: the result

**Returns** Tuple of:

- `result`: true if a font was selected
- `fontDesc`: return location for font description
- `fontFeatures`: return location for font features
- `language`: return location for the language

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `chooseFontFinish`

```ts
chooseFontFinish(result: Gio.AsyncResult): Pango.FontDescription
```

Finishes the `Gtk.FontDialog.chooseFont()` call.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: the result

**Returns** a `Pango.FontDescription` describing
  the selected font

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `getFilter`

```ts
getFilter(): Gtk.Filter | null
```

Returns the filter that decides which fonts to display
in the font chooser dialog.

**Returns** the filter

_Available since 4.10._

### `getFontMap`

```ts
getFontMap(): Pango.FontMap | null
```

Returns the fontmap from which fonts are selected,
or `NULL` for the default fontmap.

**Returns** the fontmap

_Available since 4.10._

### `getLanguage`

```ts
getLanguage(): Pango.Language | null
```

Returns the language for which font features are applied.

**Returns** the language for font features

_Available since 4.10._

### `getModal`

```ts
getModal(): boolean
```

Returns whether the font chooser dialog blocks interaction
with the parent window while it is presented.

**Returns** true if the font chooser dialog is modal

_Available since 4.10._

### `getTitle`

```ts
getTitle(): string
```

Returns the title that will be shown on the font chooser dialog.

**Returns** the title

_Available since 4.10._

### `setFilter`

```ts
setFilter(filter: Gtk.Filter | null): void
```

Adds a filter that decides which fonts to display
in the font chooser dialog.

The filter must be able to handle both `PangoFontFamily`
and `PangoFontFace` objects.

**Parameters**

- `filter`: the filter

_Available since 4.10._

### `setFontMap`

```ts
setFontMap(fontmap: Pango.FontMap | null): void
```

Sets the fontmap from which fonts are selected.

If `fontmap` is `NULL`, the default fontmap is used.

**Parameters**

- `fontmap`: the fontmap

_Available since 4.10._

### `setLanguage`

```ts
setLanguage(language: Pango.Language): void
```

Sets the language for which font features are applied.

**Parameters**

- `language`: the language for font features

_Available since 4.10._

### `setModal`

```ts
setModal(modal: boolean): void
```

Sets whether the font chooser dialog blocks interaction
with the parent window while it is presented.

**Parameters**

- `modal`: the new value

_Available since 4.10._

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title that will be shown on the font chooser dialog.

**Parameters**

- `title`: the new title

_Available since 4.10._
