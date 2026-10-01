---
description: "Renders text in a cell A GtkCellRendererText renders a given text in its cell, using the font, color and style information provided by its properties."
---

# GtkCellRendererText

Renders text in a cell

A `GtkCellRendererText` renders a given text in its cell, using the font, color and
style information provided by its properties. The text will be ellipsized if it is
too long and the `GtkCellRendererText:ellipsize` property allows it.

If the `GtkCellRenderer:mode` is `GTK_CELL_RENDERER_MODE_EDITABLE`,
the `GtkCellRendererText` allows to edit its text using an entry.

> **Deprecated since 4.10.** List views use widgets to display their contents. You should use `Gtk.Inscription` or `Gtk.Label` instead

```tsx
import { GtkCellRendererText } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkCellRenderer](.gtkx/reference/gtk/cell-renderer.md) → **GtkCellRendererText**

## Props

`ref` receives the `Gtk.CellRendererText` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `alignment`

`Pango.Alignment` · default `PANGO_ALIGN_LEFT`

Specifies how to align the lines of text with respect to each other.

Note that this property describes how to align the lines of text in
case there are several of them. The "xalign" property of `GtkCellRenderer`,
on the other hand, sets the horizontal alignment of the whole text.

### `alignSet`

`boolean` · default `false`

### `attributes`

`Pango.AttrList`

### `background`

`string` · default `null`

### `backgroundRgba`

`Gdk.RGBA`

Background color as a `GdkRGBA`

### `backgroundSet`

`boolean` · default `false`

### `editable`

`boolean` · default `false`

### `editableSet`

`boolean` · default `false`

### `ellipsize`

`Pango.EllipsizeMode` · default `PANGO_ELLIPSIZE_NONE`

Specifies the preferred place to ellipsize the string, if the cell renderer
does not have enough room to display the entire string. Setting it to
`PANGO_ELLIPSIZE_NONE` turns off ellipsizing. See the wrap-width property
for another way of making the text fit into a given width.

### `ellipsizeSet`

`boolean` · default `false`

### `family`

`string` · default `null`

### `familySet`

`boolean` · default `false`

### `font`

`string` · default `null`

### `fontDesc`

`Pango.FontDescription`

### `foreground`

`string` · default `null`

### `foregroundRgba`

`Gdk.RGBA`

Foreground color as a `GdkRGBA`

### `foregroundSet`

`boolean` · default `false`

### `language`

`string` · default `null`

### `languageSet`

`boolean` · default `false`

### `markup`

`string` · default `null`

### `maxWidthChars`

`number` · default `-1`

The desired maximum width of the cell, in characters. If this property
is set to -1, the width will be calculated automatically.

For cell renderers that ellipsize or wrap text; this property
controls the maximum reported width of the cell. The
cell should not receive any greater allocation unless it is
set to expand in its `GtkCellLayout` and all of the cell's siblings
have received their natural width.

### `placeholderText`

`string` · default `null`

The text that will be displayed in the `GtkCellRenderer` if
`GtkCellRendererText:editable` is `true` and the cell is empty.

### `rise`

`number` · default `0`

### `riseSet`

`boolean` · default `false`

### `scale`

`number` · default `1.000000`

### `scaleSet`

`boolean` · default `false`

### `singleParagraphMode`

`boolean` · default `false`

### `size`

`number` · default `0`

### `sizePoints`

`number` · default `0.000000`

### `sizeSet`

`boolean` · default `false`

### `stretch`

`Pango.Stretch` · default `PANGO_STRETCH_NORMAL`

### `stretchSet`

`boolean` · default `false`

### `strikethrough`

`boolean` · default `false`

### `strikethroughSet`

`boolean` · default `false`

### `style`

`Pango.Style` · default `PANGO_STYLE_NORMAL`

### `styleSet`

`boolean` · default `false`

### `text`

`string` · default `null`

### `underline`

`Pango.Underline` · default `PANGO_UNDERLINE_NONE`

### `underlineSet`

`boolean` · default `false`

### `variant`

`Pango.Variant` · default `PANGO_VARIANT_NORMAL`

### `variantSet`

`boolean` · default `false`

### `weight`

`number` · default `400`

### `weightSet`

`boolean` · default `false`

### `widthChars`

`number` · default `-1`

The desired width of the cell, in characters. If this property is set to
-1, the width will be calculated automatically, otherwise the cell will
request either 3 characters or the property value, whichever is greater.

### `wrapMode`

`Pango.WrapMode` · default `PANGO_WRAP_CHAR`

Specifies how to break the string into multiple lines, if the cell
renderer does not have enough room to display the entire string.
This property has no effect unless the wrap-width property is set.

### `wrapWidth`

`number` · default `-1`

Specifies the minimum width at which the text is wrapped. The wrap-mode property can
be used to influence at what character positions the line breaks can be placed.
Setting wrap-width to -1 turns wrapping off.

## Signals

### `onEdited`

```ts
(path: string, newText: string, self: Gtk.CellRendererText) => void
```

This signal is emitted after `renderer` has been edited.

It is the responsibility of the application to update the model
and store `new_text` at the position indicated by `path`.

**Parameters**

- `path`: the path identifying the edited cell
- `newText`: the new text
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.CellRendererText` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `setFixedHeightFromFont`

```ts
setFixedHeightFromFont(numberOfRows: number): void
```

Sets the height of a renderer to explicitly be determined by the “font” and
“y_pad” property set on it.  Further changes in these properties do not
affect the height, so they must be accompanied by a subsequent call to this
function.  Using this function is inflexible, and should really only be used
if calculating the size of a cell is too slow (ie, a massive number of cells
displayed).  If `number_of_rows` is -1, then the fixed height is unset, and
the height is determined by the properties again.

**Parameters**

- `numberOfRows`: Number of rows of text each cell renderer is allocated, or -1

> **Deprecated since 4.10.**
