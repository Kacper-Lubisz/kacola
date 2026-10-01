---
description: "A PangoLayout structure represents an entire paragraph of text."
---

# PangoLayout

A `PangoLayout` structure represents an entire paragraph of text.

While complete access to the layout capabilities of Pango is provided
using the detailed interfaces for itemization and shaping, using
that functionality directly involves writing a fairly large amount
of code. `PangoLayout` provides a high-level driver for formatting
entire paragraphs of text at once. This includes paragraph-level
functionality such as line breaking, justification, alignment and
ellipsization.

A `PangoLayout` is initialized with a `PangoContext`, UTF-8 string
and set of attributes for that string. Once that is done, the set of
formatted lines can be extracted from the object, the layout can be
rendered, and conversion between logical character positions within
the layout's text, and the physical position of the resulting glyphs
can be made.

There are a number of parameters to adjust the formatting of a
`PangoLayout`. The following image shows adjustable parameters
(on the left) and font metrics (on the right):



The following images demonstrate the effect of alignment and
justification on the layout of text:

| | |
| --- | --- |
| ![align=left](align-left.png) | ![align=left, justify](align-left-justify.png) |
| ![align=center](align-center.png) | ![align=center, justify](align-center-justify.png) |
| ![align=right](align-right.png) | ![align=right, justify](align-right-justify.png) |


It is possible, as well, to ignore the 2-D setup,
and simply treat the results of a `PangoLayout` as a list of lines.

```tsx
import { PangoLayout } from "@gtkx/jsx/pango";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **PangoLayout**

## Props

`ref` receives the `Pango.Layout` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Pango.Layout` instance, obtained with the `ref` prop or imported from `@gtkx/gi/pango`. Methods inherited from ancestors are documented on their own pages.

### `contextChanged`

```ts
contextChanged(): void
```

Forces recomputation of any state in the `PangoLayout` that
might depend on the layout's context.

This function should be called if you make changes to the context
subsequent to creating the layout.

### `copy`

```ts
copy(): Pango.Layout
```

Creates a deep copy-by-value of the layout.

The attribute list, tab array, and text from the original layout
are all copied by value.

**Returns** the newly allocated `PangoLayout`

### `getAlignment`

```ts
getAlignment(): Pango.Alignment
```

Gets the alignment for the layout: how partial lines are
positioned within the horizontal space available.

**Returns** the alignment

### `getAttributes`

```ts
getAttributes(): Pango.AttrList | null
```

Gets the attribute list for the layout, if any.

**Returns** a `PangoAttrList`

### `getAutoDir`

```ts
getAutoDir(): boolean
```

Gets whether to calculate the base direction for the layout
according to its contents.

See `Pango.Layout.setAutoDir()`.

**Returns** `true` if the bidirectional base direction
  is computed from the layout's contents, `false` otherwise

_Available since 1.4._

### `getBaseline`

```ts
getBaseline(): number
```

Gets the Y position of baseline of the first line in `layout`.

**Returns** baseline of first line, from top of `layout`

_Available since 1.22._

### `getCaretPos`

```ts
getCaretPos(index: number): [Pango.Rectangle, Pango.Rectangle]
```

Given an index within a layout, determines the positions that of the
strong and weak cursors if the insertion point is at that index.

This is a variant of `Pango.Layout.getCursorPos()` that applies
font metric information about caret slope and offset to the positions
it returns.

**Parameters**

- `index`: the byte index of the cursor

**Returns** Tuple of:

- `strongPos`: location to store the strong cursor position
- `weakPos`: location to store the weak cursor position

_Available since 1.50._

### `getCharacterCount`

```ts
getCharacterCount(): number
```

Returns the number of Unicode characters in the
the text of `layout`.

**Returns** the number of Unicode characters
  in the text of `layout`

_Available since 1.30._

### `getContext`

```ts
getContext(): Pango.Context
```

Retrieves the `PangoContext` used for this layout.

**Returns** the `PangoContext` for the layout

### `getCursorPos`

```ts
getCursorPos(index: number): [Pango.Rectangle, Pango.Rectangle]
```

Given an index within a layout, determines the positions that of the
strong and weak cursors if the insertion point is at that index.

The position of each cursor is stored as a zero-width rectangle
with the height of the run extents.



The strong cursor location is the location where characters of the
directionality equal to the base direction of the layout are inserted.
The weak cursor location is the location where characters of the
directionality opposite to the base direction of the layout are inserted.

The following example shows text with both a strong and a weak cursor.



The strong cursor has a little arrow pointing to the right, the weak
cursor to the left. Typing a 'c' in this situation will insert the
character after the 'b', and typing another Hebrew character, like 'ג',
will insert it at the end.

**Parameters**

- `index`: the byte index of the cursor

**Returns** Tuple of:

- `strongPos`: location to store the strong cursor position
- `weakPos`: location to store the weak cursor position

### `getDirection`

```ts
getDirection(index: number): Pango.Direction
```

Gets the text direction at the given character position in `layout`.

**Parameters**

- `index`: the byte index of the char

**Returns** the text direction at `index`

_Available since 1.46._

### `getEllipsize`

```ts
getEllipsize(): Pango.EllipsizeMode
```

Gets the type of ellipsization being performed for `layout`.

See `Pango.Layout.setEllipsize()`.

Use `Pango.Layout.isEllipsized()` to query whether any
paragraphs were actually ellipsized.

**Returns** the current ellipsization mode for `layout`

_Available since 1.6._

### `getExtents`

```ts
getExtents(): [Pango.Rectangle, Pango.Rectangle]
```

Computes the logical and ink extents of `layout`.

Logical extents are usually what you want for positioning things. Note
that both extents may have non-zero x and y. You may want to use those
to offset where you render the layout. Not doing that is a very typical
bug that shows up as right-to-left layouts not being correctly positioned
in a layout with a set width.

The extents are given in layout coordinates and in Pango units; layout
coordinates begin at the top left corner of the layout.

**Returns** Tuple of:

- `inkRect`: rectangle used to store the extents of the layout as drawn
- `logicalRect`: rectangle used to store the logical extents of the layout

### `getFontDescription`

```ts
getFontDescription(): Pango.FontDescription | null
```

Gets the font description for the layout, if any.

**Returns** a pointer to the
  layout's font description, or `null` if the font description
  from the layout's context is inherited.

_Available since 1.8._

### `getHeight`

```ts
getHeight(): number
```

Gets the height of layout used for ellipsization.

See `Pango.Layout.setHeight()` for details.

**Returns** the height, in Pango units if positive,
  or number of lines if negative.

_Available since 1.20._

### `getIndent`

```ts
getIndent(): number
```

Gets the paragraph indent width in Pango units.

A negative value indicates a hanging indentation.

**Returns** the indent in Pango units

### `getIter`

```ts
getIter(): Pango.LayoutIter
```

Returns an iterator to iterate over the visual extents of the layout.

**Returns** the new `PangoLayoutIter`

### `getJustify`

```ts
getJustify(): boolean
```

Gets whether each complete line should be stretched to fill the entire
width of the layout.

**Returns** the justify value

### `getJustifyLastLine`

```ts
getJustifyLastLine(): boolean
```

Gets whether the last line should be stretched
to fill the entire width of the layout.

**Returns** the justify value

_Available since 1.50._

### `getLine`

```ts
getLine(line: number): Pango.LayoutLine | null
```

Retrieves a particular line from a `PangoLayout`.

Use the faster `Pango.Layout.getLineReadonly()` if you do not
plan to modify the contents of the line (glyphs, glyph widths, etc.).

**Parameters**

- `line`: the index of a line, which must be between 0 and `pango_layout_get_line_count(layout) - 1`, inclusive.

**Returns** the requested `PangoLayoutLine`,
  or `null` if the index is out of range. This layout line can be ref'ed
  and retained, but will become invalid if changes are made to the
  `PangoLayout`.

### `getLineCount`

```ts
getLineCount(): number
```

Retrieves the count of lines for the `layout`.

**Returns** the line count

### `getLineReadonly`

```ts
getLineReadonly(line: number): Pango.LayoutLine | null
```

Retrieves a particular line from a `PangoLayout`.

This is a faster alternative to `Pango.Layout.getLine()`,
but the user is not expected to modify the contents of the line
(glyphs, glyph widths, etc.).

**Parameters**

- `line`: the index of a line, which must be between 0 and `pango_layout_get_line_count(layout) - 1`, inclusive.

**Returns** the requested `PangoLayoutLine`,
  or `null` if the index is out of range. This layout line can be ref'ed
  and retained, but will become invalid if changes are made to the
  `PangoLayout`. No changes should be made to the line.

_Available since 1.16._

### `getLines`

```ts
getLines(): Pango.LayoutLine[]
```

Returns the lines of the `layout` as a list.

Use the faster `Pango.Layout.getLinesReadonly()` if you do not
plan to modify the contents of the lines (glyphs, glyph widths, etc.).

**Returns** a `GSList`
  containing the lines in the layout. This points to internal data of the
  `PangoLayout` and must be used with care. It will become invalid on any
  change to the layout's text or properties.

### `getLineSpacing`

```ts
getLineSpacing(): number
```

Gets the line spacing factor of `layout`.

See `Pango.Layout.setLineSpacing()`.

_Available since 1.44._

### `getLinesReadonly`

```ts
getLinesReadonly(): Pango.LayoutLine[]
```

Returns the lines of the `layout` as a list.

This is a faster alternative to `Pango.Layout.getLines()`,
but the user is not expected to modify the contents of the lines
(glyphs, glyph widths, etc.).

**Returns** a `GSList`
  containing the lines in the layout. This points to internal data of the
  `PangoLayout` and must be used with care. It will become invalid on any
  change to the layout's text or properties. No changes should be made to
  the lines.

_Available since 1.16._

### `getLogAttrs`

```ts
getLogAttrs(): Pango.LogAttr[]
```

Retrieves an array of logical attributes for each character in
the `layout`.

**Returns** location to store a pointer to an array of logical attributes.
  This value must be freed with `g_free()`.

### `getLogAttrsReadonly`

```ts
getLogAttrsReadonly(): Pango.LogAttr[]
```

Retrieves an array of logical attributes for each character in
the `layout`.

This is a faster alternative to `Pango.Layout.getLogAttrs()`.
The returned array is part of `layout` and must not be modified.
Modifying the layout will invalidate the returned array.

The number of attributes returned in `n_attrs` will be one more
than the total number of characters in the layout, since there
need to be attributes corresponding to both the position before
the first character and the position after the last character.

**Returns** an array of logical attributes

_Available since 1.30._

### `getPixelExtents`

```ts
getPixelExtents(): [Pango.Rectangle, Pango.Rectangle]
```

Computes the logical and ink extents of `layout` in device units.

This function just calls `Pango.Layout.getExtents()` followed by
two `extentsToPixels()` calls, rounding `ink_rect` and `logical_rect`
such that the rounded rectangles fully contain the unrounded one (that is,
passes them as first argument to `Pango.extentsToPixels()`).

**Returns** Tuple of:

- `inkRect`: rectangle used to store the extents of the layout as drawn
- `logicalRect`: rectangle used to store the logical extents of the layout

### `getPixelSize`

```ts
getPixelSize(): [number, number]
```

Determines the logical width and height of a `PangoLayout` in device
units.

`Pango.Layout.getSize()` returns the width and height
scaled by `PANGO_SCALE`. This is simply a convenience function
around `Pango.Layout.getPixelExtents()`.

**Returns** Tuple of:

- `width`: location to store the logical width
- `height`: location to store the logical height

### `getSerial`

```ts
getSerial(): number
```

Returns the current serial number of `layout`.

The serial number is initialized to an small number larger than zero
when a new layout is created and is increased whenever the layout is
changed using any of the setter functions, or the `PangoContext` it
uses has changed. The serial may wrap, but will never have the value 0.
Since it can wrap, never compare it with "less than", always use "not equals".

This can be used to automatically detect changes to a `PangoLayout`,
and is useful for example to decide whether a layout needs redrawing.
To force the serial to be increased, use
`Pango.Layout.contextChanged()`.

**Returns** The current serial number of `layout`.

_Available since 1.32.4._

### `getSingleParagraphMode`

```ts
getSingleParagraphMode(): boolean
```

Obtains whether `layout` is in single paragraph mode.

See `Pango.Layout.setSingleParagraphMode()`.

**Returns** `true` if the layout does not break paragraphs
  at paragraph separator characters, `false` otherwise

### `getSize`

```ts
getSize(): [number, number]
```

Determines the logical width and height of a `PangoLayout` in Pango
units.

This is simply a convenience function around `Pango.Layout.getExtents()`.

**Returns** Tuple of:

- `width`: location to store the logical width
- `height`: location to store the logical height

### `getSpacing`

```ts
getSpacing(): number
```

Gets the amount of spacing between the lines of the layout.

**Returns** the spacing in Pango units

### `getTabs`

```ts
getTabs(): Pango.TabArray | null
```

Gets the current `PangoTabArray` used by this layout.

If no `PangoTabArray` has been set, then the default tabs are
in use and `null` is returned. Default tabs are every 8 spaces.

The return value should be freed with `Pango.TabArray.free()`.

**Returns** a copy of the tabs for this layout

### `getText`

```ts
getText(): string
```

Gets the text in the layout.

The returned text should not be freed or modified.

**Returns** the text in the `layout`

### `getUnknownGlyphsCount`

```ts
getUnknownGlyphsCount(): number
```

Counts the number of unknown glyphs in `layout`.

This function can be used to determine if there are any fonts
available to render all characters in a certain string, or when
used in combination with `PANGO_ATTR_FALLBACK`, to check if a
certain font supports all the characters in the string.

**Returns** The number of unknown glyphs in `layout`

_Available since 1.16._

### `getWidth`

```ts
getWidth(): number
```

Gets the width to which the lines of the `PangoLayout` should wrap.

**Returns** the width in Pango units, or -1 if no width set.

### `getWrap`

```ts
getWrap(): Pango.WrapMode
```

Gets the wrap mode for the layout.

Use `Pango.Layout.isWrapped()` to query whether
any paragraphs were actually wrapped.

**Returns** active wrap mode.

### `indexToLineX`

```ts
indexToLineX(index: number, trailing: boolean): [number, number]
```

Converts from byte `index_` within the `layout` to line and X position.

The X position is measured from the left edge of the line.

**Parameters**

- `index`: the byte index of a grapheme within the layout
- `trailing`: an integer indicating the edge of the grapheme to retrieve the position of. If > 0, the trailing edge of the grapheme, if 0, the leading of the grapheme

**Returns** Tuple of:

- `line`: location to store resulting line index. (which will between 0 and pango_layout_get_line_count(layout) - 1)
- `xPos`: location to store resulting position within line (`PANGO_SCALE` units per device unit)

### `indexToPos`

```ts
indexToPos(index: number): Pango.Rectangle
```

Converts from an index within a `PangoLayout` to the onscreen position
corresponding to the grapheme at that index.

The returns is represented as rectangle. Note that `pos->x` is
always the leading edge of the grapheme and `pos->x + pos->width` the
trailing edge of the grapheme. If the directionality of the grapheme
is right-to-left, then `pos->width` will be negative.

**Parameters**

- `index`: byte index within `layout`

**Returns** rectangle in which to store the position of the grapheme

### `isEllipsized`

```ts
isEllipsized(): boolean
```

Queries whether the layout had to ellipsize any paragraphs.

This returns `true` if the ellipsization mode for `layout`
is not `PANGO_ELLIPSIZE_NONE`, a positive width is set on `layout`,
and there are paragraphs exceeding that width that have to be
ellipsized.

**Returns** `true` if any paragraphs had to be ellipsized,
  `false` otherwise

_Available since 1.16._

### `isWrapped`

```ts
isWrapped(): boolean
```

Queries whether the layout had to wrap any paragraphs.

This returns `true` if a positive width is set on `layout`,
and there are paragraphs exceeding the layout width that have
to be wrapped.

**Returns** `true` if any paragraphs had to be wrapped, `false`
  otherwise

_Available since 1.16._

### `moveCursorVisually`

```ts
moveCursorVisually(strong: boolean, oldIndex: number, oldTrailing: number, direction: number): [number, number]
```

Computes a new cursor position from an old position and a direction.

If `direction` is positive, then the new position will cause the strong
or weak cursor to be displayed one position to right of where it was
with the old cursor position. If `direction` is negative, it will be
moved to the left.

In the presence of bidirectional text, the correspondence between
logical and visual order will depend on the direction of the current
run, and there may be jumps when the cursor is moved off of the end
of a run.

Motion here is in cursor positions, not in characters, so a single
call to this function may move the cursor over multiple characters
when multiple characters combine to form a single grapheme.

**Parameters**

- `strong`: whether the moving cursor is the strong cursor or the weak cursor. The strong cursor is the cursor corresponding to text insertion in the base direction for the layout.
- `oldIndex`: the byte index of the current cursor position
- `oldTrailing`: if 0, the cursor was at the leading edge of the grapheme indicated by `old_index`, if > 0, the cursor was at the trailing edge.
- `direction`: direction to move cursor. A negative value indicates motion to the left

**Returns** Tuple of:

- `newIndex`: location to store the new cursor byte index. A value of -1 indicates that the cursor has been moved off the beginning of the layout. A value of `G_MAXINT` indicates that the cursor has been moved off the end of the layout.
- `newTrailing`: number of characters to move forward from the location returned for `new_index` to get the position where the cursor should be displayed. This allows distinguishing the position at the beginning of one line from the position at the end of the preceding line. `new_index` is always on the line where the cursor should be displayed.

### `serialize`

```ts
serialize(flags: Pango.LayoutSerializeFlags): GLib.Bytes
```

Serializes the `layout` for later deserialization via `Pango.Layout.deserialize()`.

There are no guarantees about the format of the output across different
versions of Pango and `Pango.Layout.deserialize()` will reject data
that it cannot parse.

The intended use of this function is testing, benchmarking and debugging.
The format is not meant as a permanent storage format.

**Parameters**

- `flags`: `PangoLayoutSerializeFlags`

**Returns** a `GBytes` containing the serialized form of `layout`

_Available since 1.50._

### `setAlignment`

```ts
setAlignment(alignment: Pango.Alignment): void
```

Sets the alignment for the layout: how partial lines are
positioned within the horizontal space available.

The default alignment is `PANGO_ALIGN_LEFT`.

**Parameters**

- `alignment`: the alignment

### `setAttributes`

```ts
setAttributes(attrs: Pango.AttrList | null): void
```

Sets the text attributes for a layout object.

References `attrs`, so the caller can unref its reference.

**Parameters**

- `attrs`: a `PangoAttrList`

### `setAutoDir`

```ts
setAutoDir(autoDir: boolean): void
```

Sets whether to calculate the base direction
for the layout according to its contents.

When this flag is on (the default), then paragraphs in `layout` that
begin with strong right-to-left characters (Arabic and Hebrew principally),
will have right-to-left layout, paragraphs with letters from other scripts
will have left-to-right layout. Paragraphs with only neutral characters
get their direction from the surrounding paragraphs.

When `false`, the choice between left-to-right and right-to-left
layout is done according to the base direction of the layout's
`PangoContext`. (See `Pango.Context.setBaseDir()`).

When the auto-computed direction of a paragraph differs from the
base direction of the context, the interpretation of
`PANGO_ALIGN_LEFT` and `PANGO_ALIGN_RIGHT` are swapped.

**Parameters**

- `autoDir`: if `true`, compute the bidirectional base direction from the layout's contents

_Available since 1.4._

### `setEllipsize`

```ts
setEllipsize(ellipsize: Pango.EllipsizeMode): void
```

Sets the type of ellipsization being performed for `layout`.

Depending on the ellipsization mode `ellipsize` text is
removed from the start, middle, or end of text so they
fit within the width and height of layout set with
`Pango.Layout.setWidth()` and `Pango.Layout.setHeight()`.

If the layout contains characters such as newlines that
force it to be layed out in multiple paragraphs, then whether
each paragraph is ellipsized separately or the entire layout
is ellipsized as a whole depends on the set height of the layout.

The default value is `PANGO_ELLIPSIZE_NONE`.

See `Pango.Layout.setHeight()` for details.

**Parameters**

- `ellipsize`: the new ellipsization mode for `layout`

_Available since 1.6._

### `setFontDescription`

```ts
setFontDescription(desc: Pango.FontDescription | null): void
```

Sets the default font description for the layout.

If no font description is set on the layout, the
font description from the layout's context is used.

**Parameters**

- `desc`: the new `PangoFontDescription` to unset the current font description

### `setHeight`

```ts
setHeight(height: number): void
```

Sets the height to which the `PangoLayout` should be ellipsized at.

There are two different behaviors, based on whether `height` is positive
or negative.

If `height` is positive, it will be the maximum height of the layout. Only
lines would be shown that would fit, and if there is any text omitted,
an ellipsis added. At least one line is included in each paragraph regardless
of how small the height value is. A value of zero will render exactly one
line for the entire layout.

If `height` is negative, it will be the (negative of) maximum number of lines
per paragraph. That is, the total number of lines shown may well be more than
this value if the layout contains multiple paragraphs of text.
The default value of -1 means that the first line of each paragraph is ellipsized.
This behavior may be changed in the future to act per layout instead of per
paragraph. File a bug against pango at
[https://gitlab.gnome.org/gnome/pango](https://gitlab.gnome.org/gnome/pango)
if your code relies on this behavior.

Height setting only has effect if a positive width is set on
`layout` and ellipsization mode of `layout` is not `PANGO_ELLIPSIZE_NONE`.
The behavior is undefined if a height other than -1 is set and
ellipsization mode is set to `PANGO_ELLIPSIZE_NONE`, and may change in the
future.

**Parameters**

- `height`: the desired height of the layout in Pango units if positive, or desired number of lines if negative.

_Available since 1.20._

### `setIndent`

```ts
setIndent(indent: number): void
```

Sets the width in Pango units to indent each paragraph.

A negative value of `indent` will produce a hanging indentation.
That is, the first line will have the full width, and subsequent
lines will be indented by the absolute value of `indent`.

The indent setting is ignored if layout alignment is set to
`PANGO_ALIGN_CENTER`.

The default value is 0.

**Parameters**

- `indent`: the amount by which to indent

### `setJustify`

```ts
setJustify(justify: boolean): void
```

Sets whether each complete line should be stretched to fill the
entire width of the layout.

Stretching is typically done by adding whitespace, but for some scripts
(such as Arabic), the justification may be done in more complex ways,
like extending the characters.

Note that this setting is not implemented and so is ignored in
Pango older than 1.18.

Note that tabs and justification conflict with each other:
Justification will move content away from its tab-aligned
positions.

The default value is `false`.

Also see `Pango.Layout.setJustifyLastLine()`.

**Parameters**

- `justify`: whether the lines in the layout should be justified

### `setJustifyLastLine`

```ts
setJustifyLastLine(justify: boolean): void
```

Sets whether the last line should be stretched to fill the
entire width of the layout.

This only has an effect if `Pango.Layout.setJustify()` has
been called as well.

The default value is `false`.

**Parameters**

- `justify`: whether the last line in the layout should be justified

_Available since 1.50._

### `setLineSpacing`

```ts
setLineSpacing(factor: number): void
```

Sets a factor for line spacing.

Typical values are: 0, 1, 1.5, 2. The default values is 0.

If `factor` is non-zero, lines are placed so that

    baseline2 = baseline1 + factor * height2

where height2 is the line height of the second line
(as determined by the font(s)). In this case, the spacing
set with `Pango.Layout.setSpacing()` is ignored.

If `factor` is zero (the default), spacing is applied as before.

Note: for semantics that are closer to the CSS line-height
property, see `Pango.attrLineHeightNew()`.

**Parameters**

- `factor`: the new line spacing factor

_Available since 1.44._

### `setMarkup`

```ts
setMarkup(markup: string, length: number): void
```

Sets the layout text and attribute list from marked-up text.

See [Pango Markup](pango_markup.html)).

Replaces the current text and attribute list.

This is the same as `Pango.Layout.setMarkupWithAccel()`,
but the markup text isn't scanned for accelerators.

**Parameters**

- `markup`: marked-up text
- `length`: length of marked-up text in bytes, or -1 if `markup` is `NUL`-terminated

### `setMarkupWithAccel`

```ts
setMarkupWithAccel(markup: string, length: number, accelMarker: string): string
```

Sets the layout text and attribute list from marked-up text.

See [Pango Markup](pango_markup.html)).

Replaces the current text and attribute list.

If `accel_marker` is nonzero, the given character will mark the
character following it as an accelerator. For example, `accel_marker`
might be an ampersand or underscore. All characters marked
as an accelerator will receive a `PANGO_UNDERLINE_LOW` attribute,
and the first character so marked will be returned in `accel_char`.
Two `accel_marker` characters following each other produce a single
literal `accel_marker` character.

**Parameters**

- `markup`: marked-up text (see [Pango Markup](pango_markup.html))
- `length`: length of marked-up text in bytes, or -1 if `markup` is `NUL`-terminated
- `accelMarker`: marker for accelerators in the text

**Returns** return location
  for first located accelerator

### `setSingleParagraphMode`

```ts
setSingleParagraphMode(setting: boolean): void
```

Sets the single paragraph mode of `layout`.

If `setting` is `true`, do not treat newlines and similar characters
as paragraph separators; instead, keep all text in a single paragraph,
and display a glyph for paragraph separator characters. Used when
you want to allow editing of newlines on a single text line.

The default value is `false`.

**Parameters**

- `setting`: new setting

### `setSpacing`

```ts
setSpacing(spacing: number): void
```

Sets the amount of spacing in Pango units between
the lines of the layout.

When placing lines with spacing, Pango arranges things so that

    line2.top = line1.bottom + spacing

The default value is 0.

Note: Since 1.44, Pango is using the line height (as determined
by the font) for placing lines when the line spacing factor is set
to a non-zero value with `Pango.Layout.setLineSpacing()`.
In that case, the `spacing` set with this function is ignored.

Note: for semantics that are closer to the CSS line-height
property, see `Pango.attrLineHeightNew()`.

**Parameters**

- `spacing`: the amount of spacing

### `setTabs`

```ts
setTabs(tabs: Pango.TabArray | null): void
```

Sets the tabs to use for `layout`, overriding the default tabs.

`PangoLayout` will place content at the next tab position
whenever it meets a Tab character (U+0009).

By default, tabs are every 8 spaces. If `tabs` is `null`, the
default tabs are reinstated. `tabs` is copied into the layout;
you must free your copy of `tabs` yourself.

Note that tabs and justification conflict with each other:
Justification will move content away from its tab-aligned
positions. The same is true for alignments other than
`PANGO_ALIGN_LEFT`.

**Parameters**

- `tabs`: a `PangoTabArray`

### `setText`

```ts
setText(text: string, length: number): void
```

Sets the text of the layout.

This function validates `text` and renders invalid UTF-8
with a placeholder glyph.

Note that if you have used `Pango.Layout.setMarkup()` or
`Pango.Layout.setMarkupWithAccel()` on `layout` before, you
may want to call `Pango.Layout.setAttributes()` to clear the
attributes set on the layout from the markup as this function does
not clear attributes.

**Parameters**

- `text`: the text
- `length`: maximum length of `text`, in bytes. -1 indicates that the string is nul-terminated and the length should be calculated. The text will also be truncated on encountering a nul-termination even when `length` is positive.

### `setWidth`

```ts
setWidth(width: number): void
```

Sets the width to which the lines of the `PangoLayout` should wrap or
get ellipsized.

The default value is -1: no width set.

**Parameters**

- `width`: the desired width in Pango units, or -1 to indicate that no wrapping or ellipsization should be performed.

### `setWrap`

```ts
setWrap(wrap: Pango.WrapMode): void
```

Sets the wrap mode.

The wrap mode only has effect if a width is set on the layout
with `Pango.Layout.setWidth()`. To turn off wrapping,
set the width to -1.

The default value is `PANGO_WRAP_WORD`.

**Parameters**

- `wrap`: the wrap mode

### `writeToFile`

```ts
writeToFile(flags: Pango.LayoutSerializeFlags, filename: string): boolean
```

A convenience method to serialize a layout to a file.

It is equivalent to calling `Pango.Layout.serialize()`
followed by `GLib.fileSetContents()`.

See those two functions for details on the arguments.

It is mostly intended for use inside a debugger to quickly dump
a layout to a file for later inspection.

**Parameters**

- `flags`: `PangoLayoutSerializeFlags`
- `filename`: the file to save it to

**Returns** `true` if saving was successful

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 1.50._

### `xyToIndex`

```ts
xyToIndex(x: number, y: number): [boolean, number, number]
```

Converts from X and Y position within a layout to the byte index to the
character at that logical position.

If the Y position is not inside the layout, the closest position is
chosen (the position will be clamped inside the layout). If the X position
is not within the layout, then the start or the end of the line is
chosen as described for `Pango.LayoutLine.xToIndex()`. If either
the X or Y positions were not inside the layout, then the function returns
`false`; on an exact hit, it returns `true`.

**Parameters**

- `x`: the X offset (in Pango units) from the left edge of the layout
- `y`: the Y offset (in Pango units) from the top edge of the layout

**Returns** Tuple of:

- `result`: `true` if the coordinates were inside text, `false` otherwise
- `index`: location to store calculated byte index
- `trailing`: location to store a integer indicating where in the grapheme the user clicked. It will either be zero, or the number of characters in the grapheme. 0 represents the leading edge of the grapheme.
