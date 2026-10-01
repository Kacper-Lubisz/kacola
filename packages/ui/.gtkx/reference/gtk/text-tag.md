---
description: "Can be applied to text contained in a GtkTextBuffer."
---

# GtkTextTag

Can be applied to text contained in a `GtkTextBuffer`.

You may wish to begin by reading the
[text widget conceptual overview](section-text-widget.html),
which gives an overview of all the objects and data types
related to the text widget and how they work together.

Tags should be in the `Gtk.TextTagTable` for a given
`GtkTextBuffer` before using them with that buffer.

`Gtk.TextBuffer.createTag()` is the best way to create tags.
See “gtk4-demo” for numerous examples.

For each property of `GtkTextTag`, there is a “set” property, e.g.
“font-set” corresponds to “font”. These “set” properties reflect
whether a property has been set or not.

They are maintained by GTK and you should not set them independently.

```tsx
import { GtkTextTag } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkTextTag**

## Props

`ref` receives the `Gtk.TextTag` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accumulativeMargin`

`boolean` · default `false`

Whether the margins accumulate or override each other.

When set to `true` the margins of this tag are added to the margins
of any other non-accumulative margins present. When set to `false`
the margins override one another (the default).

### `allowBreaks`

`boolean` · default `true`

Whether breaks are allowed.

### `allowBreaksSet`

`boolean` · default `false`

Whether the `allow-breaks` property is set.

### `background`

`string` · default `null`

Background color as a string.

### `backgroundFullHeight`

`boolean` · default `false`

Whether the background color fills the entire line height
or only the height of the tagged characters.

### `backgroundFullHeightSet`

`boolean` · default `false`

Whether the `background-full-height` property is set.

### `backgroundRgba`

`Gdk.RGBA`

Background color as a `GdkRGBA`.

### `backgroundSet`

`boolean` · default `false`

Whether the `background` property is set.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `direction`

`Gtk.TextDirection` · default `GTK_TEXT_DIR_NONE`

Text direction, e.g. right-to-left or left-to-right.

### `editable`

`boolean` · default `true`

Whether the text can be modified by the user.

### `editableSet`

`boolean` · default `false`

Whether the `editable` property is set.

### `fallback`

`boolean` · default `true`

Whether font fallback is enabled.

When set to `true`, other fonts will be substituted
where the current font is missing glyphs.

### `fallbackSet`

`boolean` · default `false`

Whether the `fallback` property is set.

### `family`

`string` · default `null`

Name of the font family, e.g. Sans, Helvetica, Times, Monospace.

### `familySet`

`boolean` · default `false`

Whether the `family` property is set.

### `font`

`string` · default `null`

Font description as string, e.g. \"Sans Italic 12\".

Note that the initial value of this property depends on
the internals of `PangoFontDescription`.

### `fontDesc`

`Pango.FontDescription`

Font description as a `PangoFontDescription`.

### `fontFeatures`

`string` · default `null`

OpenType font features, as a string.

### `fontFeaturesSet`

`boolean` · default `false`

Whether the `font-features` property is set.

### `foreground`

`string` · default `null`

Foreground color as a string.

### `foregroundRgba`

`Gdk.RGBA`

Foreground color as a `GdkRGBA`.

### `foregroundSet`

`boolean` · default `false`

Whether the `foreground` property is set.

### `indent`

`number` · default `0`

Amount to indent the paragraph, in pixels.

A negative value of indent will produce a hanging indentation.
That is, the first line will have the full width, and subsequent
lines will be indented by the absolute value of indent.

### `indentSet`

`boolean` · default `false`

Whether the `indent` property is set.

### `insertHyphens`

`boolean` · default `true`

Whether to insert hyphens at breaks.

### `insertHyphensSet`

`boolean` · default `false`

Whether the `insert-hyphens` property is set.

### `invisible`

`boolean` · default `false`

Whether this text is hidden.

Note that there may still be problems with the support for invisible
text, in particular when navigating programmatically inside a buffer
containing invisible segments.

### `invisibleSet`

`boolean` · default `false`

Whether the `invisible` property is set.

### `justification`

`Gtk.Justification` · default `GTK_JUSTIFY_LEFT`

Left, right, or center justification.

### `justificationSet`

`boolean` · default `false`

Whether the `justification` property is set.

### `language`

`string` · default `null`

The language this text is in, as an ISO code.

Pango can use this as a hint when rendering the text.
If not set, an appropriate default will be used.

Note that the initial value of this property depends
on the current locale, see also `Gtk.getDefaultLanguage()`.

### `languageSet`

`boolean` · default `false`

Whether the `language` property is set.

### `leftMargin`

`number` · default `0`

Width of the left margin in pixels.

### `leftMarginSet`

`boolean` · default `false`

Whether the `left-margin` property is set.

### `letterSpacing`

`number` · default `0`

Extra spacing between graphemes, in Pango units.

### `letterSpacingSet`

`boolean` · default `false`

Whether the `letter-spacing` property is set.

### `lineHeight`

`number` · default `0.000000`

Factor to scale line height by.

_Available since 4.6._

### `lineHeightSet`

`boolean` · default `false`

Whether the `line-height` property is set.

### `name`

`string` · default `null` · construct-only

The name used to refer to the tag.

`null` for anonymous tags.

### `overline`

`Pango.Overline` · default `PANGO_OVERLINE_NONE`

Style of overline for this text.

### `overlineRgba`

`Gdk.RGBA`

This property modifies the color of overlines.

If not set, overlines will use the foreground color.

### `overlineRgbaSet`

`boolean` · default `false`

Whether the `overline-rgba` property is set.

### `overlineSet`

`boolean` · default `false`

Whether the `overline` property is set.

### `paragraphBackground`

`string` · default `null`

The paragraph background color as a string.

### `paragraphBackgroundRgba`

`Gdk.RGBA`

The paragraph background color as a `GdkRGBA`.

### `paragraphBackgroundSet`

`boolean` · default `false`

Whether the `paragraph-background` property is set.

### `pixelsAboveLines`

`number` · default `0`

Pixels of blank space above paragraphs.

### `pixelsAboveLinesSet`

`boolean` · default `false`

Whether the `pixels-above-lines` property is set.

### `pixelsBelowLines`

`number` · default `0`

Pixels of blank space below paragraphs.

### `pixelsBelowLinesSet`

`boolean` · default `false`

Whether the `pixels-below-lines` property is set.

### `pixelsInsideWrap`

`number` · default `0`

Pixels of blank space between wrapped lines in a paragraph.

### `pixelsInsideWrapSet`

`boolean` · default `false`

Whether the `pixels-inside-wrap` property is set.

### `rightMargin`

`number` · default `0`

Width of the right margin, in pixels.

### `rightMarginSet`

`boolean` · default `false`

Whether the `right-margin` property is set.

### `rise`

`number` · default `0`

Offset of text above the baseline, in Pango units.

Negative values go below the baseline.

### `riseSet`

`boolean` · default `false`

Whether the `rise` property is set.

### `scale`

`number` · default `1.000000`

Font size as a scale factor relative to the default font size.

This properly adapts to theme changes, etc. so is recommended.
Pango predefines some scales such as `PANGO_SCALE_X_LARGE`.

### `scaleSet`

`boolean` · default `false`

Whether the `scale` property is set.

### `sentence`

`boolean` · default `false`

Whether this tag represents a single sentence.

This affects cursor movement.

_Available since 4.6._

### `sentenceSet`

`boolean` · default `false`

Whether the `sentence` property is set.

### `showSpaces`

`Pango.ShowFlags` · default `PANGO_SHOW_NONE`

How to render invisible characters.

### `showSpacesSet`

`boolean` · default `false`

Whether the `show-spaces` property is set.

### `size`

`number` · default `0`

Font size in Pango units.

### `sizePoints`

`number` · default `0.000000`

Font size in points.

### `sizeSet`

`boolean` · default `false`

Whether the `size` property is set.

### `stretch`

`Pango.Stretch` · default `PANGO_STRETCH_NORMAL`

Font stretch as a `PangoStretch`, e.g. `PANGO_STRETCH_CONDENSED`.

### `stretchSet`

`boolean` · default `false`

Whether the `stretch` property is set.

### `strikethrough`

`boolean` · default `false`

Whether to strike through the text.

### `strikethroughRgba`

`Gdk.RGBA`

This property modifies the color of strikeouts.

If not set, strikeouts will use the foreground color.

### `strikethroughRgbaSet`

`boolean` · default `false`

If the `strikethrough-rgba` property has been set.

### `strikethroughSet`

`boolean` · default `false`

Whether the `strikethrough` property is set.

### `style`

`Pango.Style` · default `PANGO_STYLE_NORMAL`

Font style as a `PangoStyle`, e.g. `PANGO_STYLE_ITALIC`.

### `styleSet`

`boolean` · default `false`

Whether the `style` property is set.

### `tabs`

`Pango.TabArray`

Custom tabs for this text.

### `tabsSet`

`boolean` · default `false`

Whether the `tabs` property is set.

### `textTransform`

`Pango.TextTransform` · default `PANGO_TEXT_TRANSFORM_NONE`

How to transform the text for display.

_Available since 4.6._

### `textTransformSet`

`boolean` · default `false`

Whether the `text-transform` property is set.

### `underline`

`Pango.Underline` · default `PANGO_UNDERLINE_NONE`

Style of underline for this text.

### `underlineRgba`

`Gdk.RGBA`

This property modifies the color of underlines.

If not set, underlines will use the foreground color.

If `Gtk.TextTag.underline` is set to `PANGO_UNDERLINE_ERROR`,
an alternate color may be applied instead of the foreground. Setting
this property will always override those defaults.

### `underlineRgbaSet`

`boolean` · default `false`

If the `underline-rgba` property has been set.

### `underlineSet`

`boolean` · default `false`

Whether the `underline` property is set.

### `variant`

`Pango.Variant` · default `PANGO_VARIANT_NORMAL`

Font variant as a `PangoVariant`, e.g. `PANGO_VARIANT_SMALL_CAPS`.

### `variantSet`

`boolean` · default `false`

Whether the `variant` property is set.

### `weight`

`number` · default `400`

Font weight as an integer.

### `weightSet`

`boolean` · default `false`

Whether the `weight` property is set.

### `word`

`boolean` · default `false`

Whether this tag represents a single word.

This affects line breaks and cursor movement.

_Available since 4.6._

### `wordSet`

`boolean` · default `false`

Whether the `word` property is set.

### `wrapMode`

`Gtk.WrapMode` · default `GTK_WRAP_NONE`

Whether to wrap lines never, at word boundaries, or
at character boundaries.

### `wrapModeSet`

`boolean` · default `false`

Whether the `wrap-mode` property is set.

## Methods

Methods are called on the `Gtk.TextTag` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `changed`

```ts
changed(sizeChanged: boolean): void
```

Emits the `Gtk.TextTagTable.tag-changed` signal on the
`GtkTextTagTable` where the tag is included.

The signal is already emitted when setting a `GtkTextTag` property.
This function is useful for a `GtkTextTag` subclass.

**Parameters**

- `sizeChanged`: whether the change affects the `GtkTextView` layout

### `getPriority`

```ts
getPriority(): number
```

Get the tag priority.

**Returns** The tag’s priority.

### `setPriority`

```ts
setPriority(priority: number): void
```

Sets the priority of a `GtkTextTag`.

Valid priorities start at 0 and go to one less than
`Gtk.TextTagTable.getSize()`. Each tag in a table
has a unique priority; setting the priority of one tag shifts
the priorities of all the other tags in the table to maintain
a unique priority for each tag.

Higher priority tags “win” if two tags both set the same text
attribute. When adding a tag to a tag table, it will be assigned
the highest priority in the table by default; so normally the
precedence of a set of tags is the order in which they were added
to the table, or created with `Gtk.TextBuffer.createTag()`,
which adds the tag to the buffer’s table automatically.

**Parameters**

- `priority`: the new priority
