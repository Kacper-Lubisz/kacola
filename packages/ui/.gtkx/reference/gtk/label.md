---
description: "Displays a small amount of text."
---

# GtkLabel

Displays a small amount of text.

Most labels are used to label another widget (such as an `Entry`).



### Shortcuts and Gestures

`GtkLabel` supports the following keyboard shortcuts, when the cursor is
visible:

- <kbd>Shift</kbd>+<kbd>F10</kbd> or <kbd>Menu</kbd> opens the context menu.
- <kbd>Ctrl</kbd>+<kbd>A</kbd> or <kbd>Ctrl</kbd>+<kbd>&sol;</kbd>
  selects all.
- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> or
  <kbd>Ctrl</kbd>+<kbd>&bsol;</kbd> unselects all.

Additionally, the following signals have default keybindings:

- `Gtk.Label.activate-current-link`
- `Gtk.Label.copy-clipboard`
- `Gtk.Label.move-cursor`

### Actions

`GtkLabel` defines a set of built-in actions:

- `clipboard.copy` copies the text to the clipboard.
- `clipboard.cut` doesn't do anything, since text in labels can't be deleted.
- `clipboard.paste` doesn't do anything, since text in labels can't be
  edited.
- `link.open` opens the link, when activated on a link inside the label.
- `link.copy` copies the link to the clipboard, when activated on a link
  inside the label.
- `menu.popup` opens the context menu.
- `selection.delete` doesn't do anything, since text in labels can't be
  deleted.
- `selection.select-all` selects all of the text, if the label allows
  selection.

### CSS nodes

```
label
├── [selection]
├── [link]
┊
╰── [link]
```

`GtkLabel` has a single CSS node with the name label. A wide variety
of style classes may be applied to labels, such as .title, .subtitle,
.dim-label, etc. In the `GtkShortcutsWindow`, labels are used with the
.keycap style class.

If the label has a selection, it gets a subnode with name selection.

If the label has links, there is one subnode per link. These subnodes
carry the link or visited state depending on whether they have been
visited. In this case, label node also gets a .link style class.

### GtkLabel as GtkBuildable

The GtkLabel implementation of the GtkBuildable interface supports a
custom `<attributes>` element, which supports any number of `<attribute>`
elements. The `<attribute>` element has attributes named “name“, “value“,
“start“ and “end“ and allows you to specify `Pango.Attribute`
values for this label.

An example of a UI definition fragment specifying Pango attributes:

```xml
<object class="GtkLabel">
  <attributes>
    <attribute name="weight" value="PANGO_WEIGHT_BOLD"/>
    <attribute name="background" value="red" start="5" end="10"/>
  </attributes>
</object>
```

The start and end attributes specify the range of characters to which the
Pango attribute applies. If start and end are not specified, the attribute is
applied to the whole text. Note that specifying ranges does not make much
sense with translatable attributes. Use markup embedded in the translatable
content instead.

### Accessibility

`GtkLabel` uses the `Gtk.AccessibleRole.label` role.

### Mnemonics

Labels may contain “mnemonics”. Mnemonics are underlined characters in the
label, used for keyboard navigation. Mnemonics are created by providing a
string with an underscore before the mnemonic character, such as `"_File"`,
to the functions `Gtk.Label.newWithMnemonic()` or
`Gtk.Label.setTextWithMnemonic()`.

Mnemonics automatically activate any activatable widget the label is
inside, such as a `Gtk.Button`; if the label is not inside the
mnemonic’s target widget, you have to tell the label about the target
using `Gtk.Label.setMnemonicWidget()`.

Here’s a simple example where the label is inside a button:

```c
// Pressing Alt+H will activate this button
GtkWidget *button = gtk_button_new ();
GtkWidget *label = gtk_label_new_with_mnemonic ("_Hello");
gtk_button_set_child (GTK_BUTTON (button), label);
```

There’s a convenience function to create buttons with a mnemonic label
already inside:

```c
// Pressing Alt+H will activate this button
GtkWidget *button = gtk_button_new_with_mnemonic ("_Hello");
```

To create a mnemonic for a widget alongside the label, such as a
`Gtk.Entry`, you have to point the label at the entry with
`Gtk.Label.setMnemonicWidget()`:

```c
// Pressing Alt+H will focus the entry
GtkWidget *entry = gtk_entry_new ();
GtkWidget *label = gtk_label_new_with_mnemonic ("_Hello");
gtk_label_set_mnemonic_widget (GTK_LABEL (label), entry);
```

### Markup (styled text)

To make it easy to format text in a label (changing colors, fonts, etc.),
label text can be provided in a simple markup format:

Here’s how to create a label with a small font:
```c
GtkWidget *label = gtk_label_new (NULL);
gtk_label_set_markup (GTK_LABEL (label), "<small>Small text</small>");
```

(See the Pango manual for complete documentation] of available
tags, `Pango.parseMarkup()`)

The markup passed to `Gtk.Label.setMarkup()` must be valid XML; for example,
literal `<`, `>` and `&` characters must be escaped as `&lt;`, `&gt;`, and `&amp;`.
If you pass text obtained from the user, file, or a network to
`Gtk.Label.setMarkup()`, you’ll want to escape it with
`GLib.markupEscapeText()` or `GLib.markupPrintfEscaped()`.

Markup strings are just a convenient way to set the `Pango.AttrList`
on a label; `Gtk.Label.setAttributes()` may be a simpler way to set
attributes in some cases. Be careful though; `Pango.AttrList` tends
to cause internationalization problems, unless you’re applying attributes
to the entire string (i.e. unless you set the range of each attribute
to [0, `G_MAXINT`)). The reason is that specifying the `start_index` and
`end_index` for a `Pango.Attribute` requires knowledge of the exact
string being displayed, so translations will cause problems.

### Selectable labels

Labels can be made selectable with `Gtk.Label.setSelectable()`.
Selectable labels allow the user to copy the label contents to the
clipboard. Only labels that contain useful-to-copy information — such
as error messages — should be made selectable.

### Text layout

A label can contain any number of paragraphs, but will have
performance problems if it contains more than a small number.
Paragraphs are separated by newlines or other paragraph separators
understood by Pango.

Labels can automatically wrap text if you call `Gtk.Label.setWrap()`.

`Gtk.Label.setJustify()` sets how the lines in a label align
with one another. If you want to set how the label as a whole aligns
in its available space, see the `Gtk.Widget.halign` and
`Gtk.Widget.valign` properties.

The `Gtk.Label.widthChars` and `Gtk.Label.maxWidthChars`
properties can be used to control the size allocation of ellipsized or
wrapped labels. For ellipsizing labels, if either is specified (and less
than the actual text size), it is used as the minimum width, and the actual
text size is used as the natural width of the label. For wrapping labels,
width-chars is used as the minimum width, if specified, and max-width-chars
is used as the natural width. Even if max-width-chars specified, wrapping
labels will be rewrapped to use all of the available width.

### Links

GTK supports markup for clickable hyperlinks in addition to regular Pango
markup. The markup for links is borrowed from HTML, using the `<a>` tag
with “href“, “title“ and “class“ attributes. GTK renders links similar to
the way they appear in web browsers, with colored, underlined text. The
“title“ attribute is displayed as a tooltip on the link. The “class“
attribute is used as style class on the CSS node for the link.

An example of inline links looks like this:

```c
const char *text =
"Go to the "
"<a href=\"https://www.gtk.org\" title=\"&lt;i&gt;Our&lt;/i&gt; website\">"
"GTK website</a> for more...";
GtkWidget *label = gtk_label_new (NULL);
gtk_label_set_markup (GTK_LABEL (label), text);
```

It is possible to implement custom handling for links and their tooltips
with the `Gtk.Label.activate-link` signal and the
`Gtk.Label.getCurrentUri()` function.

```tsx
import { GtkLabel } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkLabel**

Implements `GtkAccessible`, `GtkAccessibleHypertext`, `GtkAccessibleText`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Label` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `attributes`

`Pango.AttrList`

A list of style attributes to apply to the text of the label.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `ellipsize`

`Pango.EllipsizeMode` · default `PANGO_ELLIPSIZE_NONE`

The preferred place to ellipsize the string, if the label does
not have enough room to display the entire string.

Note that setting this property to a value other than
[enum.Pango.EllipsizeMode.none] has the side-effect that the label requests
only enough space to display the ellipsis "...". In particular, this
means that ellipsizing labels do not work well in notebook tabs, unless
the `Gtk.NotebookPage.tabExpand` child property is set to true.

Other ways to set a label's width are `Gtk.Widget.setSizeRequest()`
and `Gtk.Label.setWidthChars()`.

### `extraMenu`

`Gio.MenuModel | ReactElement`

A menu model whose contents will be appended to the context menu.

### `justify`

`Gtk.Justification` · default `GTK_JUSTIFY_LEFT`

The alignment of the lines in the text of the label, relative to each other.

This does *not* affect the alignment of the label within its allocation.
See `Gtk.Label.xalign` for that.

### `label`

`string`

The contents of the label.

If the string contains Pango markup (see `Pango.parseMarkup()`),
you will have to set the `Gtk.Label.useMarkup` property to
true in order for the label to display the markup attributes. See also
`Gtk.Label.setMarkup()` for a convenience function that sets both
this property and the `Gtk.Label.useMarkup` property at the
same time.

If the string contains underlines acting as mnemonics, you will have to
set the `Gtk.Label.useUnderline` property to true in order
for the label to display them.

### `lines`

`number` · default `-1`

The number of lines to which an ellipsized, wrapping label
should display before it gets ellipsized. This both prevents the label
from ellipsizing before this many lines are displayed, and limits the
height request of the label to this many lines.

::: warning
    Setting this property has unintuitive and unfortunate consequences
    for the minimum _width_ of the label. Specifically, if the height
    of the label is such that it fits a smaller number of lines than
    the value of this property, the label can not be ellipsized at all,
    which means it must be wide enough to fit all the text fully.

This property has no effect if the label is not wrapping or ellipsized.

Set this property to -1 if you don't want to limit the number of lines.

### `maxWidthChars`

`number` · default `-1`

The desired maximum width of the label, in characters.

If this property is set to -1, the width will be calculated automatically.

See the section on [text layout](class.Label.html#text-layout) for details
of how `Gtk.Label.widthChars` and `Gtk.Label.maxWidthChars`
determine the width of ellipsized and wrapped labels.

### `mnemonicKeyval`

`number` · default `16777215` · read-only, observe with `onNotifyMnemonicKeyval`

The mnemonic accelerator key for the label.

### `mnemonicWidget`

`Gtk.Widget | ReactElement`

The widget to be activated when the labels mnemonic key is pressed.

### `naturalWrapMode`

`Gtk.NaturalWrapMode` · default `GTK_NATURAL_WRAP_INHERIT`

Select the line wrapping for the natural size request.

This only affects the natural size requested. For the actual wrapping
used, see the `Gtk.Label.wrapMode` property.

The default is `Gtk.NaturalWrapMode.inherit`, which inherits
the behavior of the `Gtk.Label.wrapMode` property.

_Available since 4.6._

### `selectable`

`boolean` · default `false`

Whether the label text can be selected with the mouse.

### `singleLineMode`

`boolean` · default `false`

Whether the label is in single line mode.

In single line mode, the height of the label does not depend on the
actual text, it is always set to ascent + descent of the font. This
can be an advantage in situations where resizing the label because
of text changes would be distracting, e.g. in a statusbar.

### `tabs`

`Pango.TabArray`

Custom tabs for this label.

_Available since 4.8._

### `useMarkup`

`boolean` · default `false`

True if the text of the label includes Pango markup.

See `Pango.parseMarkup()`.

### `useUnderline`

`boolean` · default `false`

True if the text of the label indicates a mnemonic with an `_`
before the mnemonic character.

### `widthChars`

`number` · default `-1`

The desired width of the label, in characters.

If this property is set to -1, the width will be calculated automatically.

See the section on [text layout](class.Label.html#text-layout) for details
of how `Gtk.Label.widthChars` and `Gtk.Label.maxWidthChars`
determine the width of ellipsized and wrapped labels.

### `wrap`

`boolean` · default `false`

True if the label text will wrap if it gets too wide.

### `wrapMode`

`Pango.WrapMode` · default `PANGO_WRAP_WORD`

Controls how the line wrapping is done.

This only affects the formatting if line wrapping is on (see the
`Gtk.Label.wrap` property). The default is `Pango.WrapMode.word`,
which means wrap on word boundaries.

For sizing behavior, also consider the `Gtk.Label.naturalWrapMode`
property.

### `xalign`

`number` · default `0.500000`

The horizontal alignment of the label text inside its size allocation.

Compare this to `Gtk.Widget.halign`, which determines how the
labels size allocation is positioned in the space available for the label.

### `yalign`

`number` · default `0.500000`

The vertical alignment of the label text inside its size allocation.

Compare this to `Gtk.Widget.valign`, which determines how the
labels size allocation is positioned in the space available for the label.

## Signals

### `onActivateCurrentLink`

```ts
(self: Gtk.Label) => void
```

Gets emitted when the user activates a link in the label.

The `::activate-current-link` is a [keybinding signal](class.SignalAction.html).

Applications may also emit the signal with `g_signal_emit_by_name()`
if they need to control activation of URIs programmatically.

The default bindings for this signal are all forms of the <kbd>Enter</kbd> key.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onActivateLink`

```ts
(uri: string, self: Gtk.Label) => boolean | undefined
```

Gets emitted to activate a URI.

Applications may connect to it to override the default behaviour,
which is to call `Gtk.FileLauncher.launch()`.

**Parameters**

- `uri`: the URI that is activated
- `self`: The instance the signal was emitted on.

**Returns** true if the link has been activated

### `onCopyClipboard`

```ts
(self: Gtk.Label) => void
```

Gets emitted to copy the selection to the clipboard.

The `::copy-clipboard` signal is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is <kbd>Ctrl</kbd>+<kbd>c</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onMoveCursor`

```ts
(step: Gtk.MovementStep, count: number, extendSelection: boolean, self: Gtk.Label) => void
```

Gets emitted when the user initiates a cursor movement.

The `::move-cursor` signal is a [keybinding signal](class.SignalAction.html).
If the cursor is not visible in `entry`, this signal causes the viewport to
be moved instead.

Applications should not connect to it, but may emit it with
`GObject.signalEmitByName()` if they need to control
the cursor programmatically.

The default bindings for this signal come in two variants, the
variant with the <kbd>Shift</kbd> modifier extends the selection,
the variant without the <kbd>Shift</kbd> modifier does not.
There are too many key combinations to list them all here.

- <kbd>←</kbd>, <kbd>→</kbd>, <kbd>↑</kbd>, <kbd>↓</kbd>
  move by individual characters/lines
- <kbd>Ctrl</kbd>+<kbd>←</kbd>, etc. move by words/paragraphs
- <kbd>Home</kbd> and <kbd>End</kbd> move to the ends of the buffer

**Parameters**

- `step`: the granularity of the move, as a `GtkMovementStep`
- `count`: the number of `step` units to move
- `extendSelection`: true if the move should extend the selection
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Label` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAttributes`

```ts
getAttributes(): Pango.AttrList | null
```

Gets the label's attribute list.

This is the `Pango.AttrList` that was set on the label using
`Gtk.Label.setAttributes()`, if any. This function does not
reflect attributes that come from the label's markup (see
`Gtk.Label.setMarkup()`). If you want to get the effective
attributes for the label, use
`pango_layout_get_attributes (gtk_label_get_layout (self))`.

**Returns** the attribute list

### `getCurrentUri`

```ts
getCurrentUri(): string | null
```

Returns the URI for the active link in the label.

The active link is the one under the mouse pointer or, in a
selectable label, the link in which the text cursor is currently
positioned.

This function is intended for use in a `Gtk.Label.activate-link`
handler or for use in a `Gtk.Widget.query-tooltip` handler.

**Returns** the active URI

### `getEllipsize`

```ts
getEllipsize(): Pango.EllipsizeMode
```

Returns the ellipsization mode of the label.

See `Gtk.Label.setEllipsize()`.

**Returns** the ellipsization mode

### `getExtraMenu`

```ts
getExtraMenu(): Gio.MenuModel | null
```

Gets the extra menu model of the label.

See `Gtk.Label.setExtraMenu()`.

**Returns** the menu model

### `getJustify`

```ts
getJustify(): Gtk.Justification
```

Returns the justification of the label.

See `Gtk.Label.setJustify()`.

**Returns** the justification value

### `getLabel`

```ts
getLabel(): string
```

Fetches the text from a label.

The returned text includes any embedded underlines indicating
mnemonics and Pango markup. (See `Gtk.Label.getText()`).

**Returns** the text of the label widget

### `getLayout`

```ts
getLayout(): Pango.Layout
```

Gets the Pango layout used to display the label.

The layout is useful to e.g. convert text positions to pixel
positions, in combination with `Gtk.Label.getLayoutOffsets()`.
The returned layout is owned by the `label` so need not be
freed by the caller. The `label` is free to recreate its layout
at any time, so it should be considered read-only.

**Returns** the `Pango.Layout` for this label

### `getLayoutOffsets`

```ts
getLayoutOffsets(): [number, number]
```

Obtains the coordinates where the label will draw its Pango layout.

The coordinates are useful to convert mouse events into coordinates
inside the `Pango.Layout`, e.g. to take some action if some part
of the label is clicked. Remember when using the `Pango.Layout`
functions you need to convert to and from pixels using `PANGO_PIXELS()`
or `Pango.SCALE`.

**Returns** Tuple of:

- `x`: location to store X offset of layout
- `y`: location to store Y offset of layout

### `getLines`

```ts
getLines(): number
```

Gets the number of lines to which an ellipsized, wrapping
label should be limited.

See `Gtk.Label.setLines()`.

**Returns** the number of lines

### `getMaxWidthChars`

```ts
getMaxWidthChars(): number
```

Retrieves the maximum width of the label in characters.

See `Gtk.Label.setWidthChars()`.

**Returns** the maximum width of the label, in characters

### `getMnemonicKeyval`

```ts
getMnemonicKeyval(): number
```

Return the mnemonic accelerator.

If the label has been set so that it has a mnemonic key this function
returns the keyval used for the mnemonic accelerator. If there is no
mnemonic set up it returns `GDK_KEY_VoidSymbol`.

**Returns** GDK keyval usable for accelerators, or `GDK_KEY_VoidSymbol`

### `getMnemonicWidget`

```ts
getMnemonicWidget(): Gtk.Widget | null
```

Retrieves the mnemonic target of this label.

See `Gtk.Label.setMnemonicWidget()`.

**Returns** the target of the label’s mnemonic,
  or `NULL` if none has been set and the default algorithm will be used.

### `getNaturalWrapMode`

```ts
getNaturalWrapMode(): Gtk.NaturalWrapMode
```

Returns natural line wrap mode used by the label.

See `Gtk.Label.setNaturalWrapMode()`.

**Returns** the natural line wrap mode

_Available since 4.6._

### `getSelectable`

```ts
getSelectable(): boolean
```

Returns whether the label is selectable.

**Returns** true if the user can copy text from the label

### `getSelectionBounds`

```ts
getSelectionBounds(): [boolean, number, number]
```

Gets the selected range of characters in the label.

The returned `start` and `end` positions are in characters.

**Returns** Tuple of:

- `result`: true if selection is non-empty
- `start`: return location for start of selection
- `end`: return location for end of selection

### `getSingleLineMode`

```ts
getSingleLineMode(): boolean
```

Returns whether the label is in single line mode.

**Returns** true if the label is in single line mode

### `getTabs`

```ts
getTabs(): Pango.TabArray | null
```

Gets the tab stops for the label.

The returned array will be `NULL` if “standard” (8-space) tabs are used.

**Returns** copy of default tab array,
  or `NULL` if standard tabs are used

_Available since 4.8._

### `getText`

```ts
getText(): string
```

Gets the text of the label.

The returned text is as it appears on screen. This does not include
any embedded underlines indicating mnemonics or Pango markup. (See
`Gtk.Label.getLabel()`)

**Returns** the text in the label widget

### `getUseMarkup`

```ts
getUseMarkup(): boolean
```

Returns whether the label’s text is interpreted as Pango markup.

See `Gtk.Label.setUseMarkup()`.

**Returns** true if the label’s text will be parsed for markup

### `getUseUnderline`

```ts
getUseUnderline(): boolean
```

Returns whether underlines in the label indicate mnemonics.

See `Gtk.Label.setUseUnderline()`.

**Returns** true if underlines in the label indicate mnemonics

### `getWidthChars`

```ts
getWidthChars(): number
```

Retrieves the desired width of the label in characters.

See `Gtk.Label.setWidthChars()`.

**Returns** the desired width of the label, in characters

### `getWrap`

```ts
getWrap(): boolean
```

Returns whether lines in the label are automatically wrapped.

See `Gtk.Label.setWrap()`.

**Returns** true if the lines of the label are automatically wrapped

### `getWrapMode`

```ts
getWrapMode(): Pango.WrapMode
```

Returns line wrap mode used by the label.

See `Gtk.Label.setWrapMode()`.

**Returns** the line wrap mode

### `getXalign`

```ts
getXalign(): number
```

Gets the `xalign` of the label.

See the `Gtk.Label.xalign` property.

**Returns** the xalign value

### `getYalign`

```ts
getYalign(): number
```

Gets the `yalign` of the label.

See the `Gtk.Label.yalign` property.

**Returns** the yalign value

### `selectRegion`

```ts
selectRegion(startOffset: number, endOffset: number): void
```

Selects a range of characters in the label, if the label is selectable.

See `Gtk.Label.setSelectable()`. If the label is not selectable,
this function has no effect. If `start_offset` or
`end_offset` are -1, then the end of the label will be substituted.

**Parameters**

- `startOffset`: start offset, in characters
- `endOffset`: end offset, in characters

### `setAttributes`

```ts
setAttributes(attrs: Pango.AttrList | null): void
```

Apply attributes to the label text.

The attributes set with this function will be applied and merged with
any other attributes previously effected by way of the
`Gtk.Label.useUnderline` or `Gtk.Label.useMarkup`
properties

While it is not recommended to mix markup strings with manually set
attributes, if you must; know that the attributes will be applied
to the label after the markup string is parsed.

**Parameters**

- `attrs`: a list of style attributes

### `setEllipsize`

```ts
setEllipsize(mode: Pango.EllipsizeMode): void
```

Sets the mode used to ellipsize the text.

The text will be ellipsized if there is not
enough space to render the entire string.

**Parameters**

- `mode`: the ellipsization mode

### `setExtraMenu`

```ts
setExtraMenu(model: Gio.MenuModel | null): void
```

Sets a menu model to add to the context menu of the label.

**Parameters**

- `model`: a menu model

### `setJustify`

```ts
setJustify(jtype: Gtk.Justification): void
```

Sets the alignment of lines in the label relative to each other.

This function has no effect on labels containing only a single line.

`Gtk.Justification.left` is the default value when the widget
is first created with `Gtk.Label.new()`.

If you instead want to set the alignment of the label as a whole,
use `Gtk.Widget.setHalign()` instead.

**Parameters**

- `jtype`: the new justification

### `setLabel`

```ts
setLabel(str: string): void
```

Sets the text of the label.

The label is interpreted as including embedded underlines and/or Pango
markup depending on the values of the `Gtk.Label.useUnderline`
and `Gtk.Label.useMarkup` properties.

**Parameters**

- `str`: the new text to set for the label

### `setLines`

```ts
setLines(lines: number): void
```

Sets the number of lines to which an ellipsized, wrapping label
should be limited.

This has no effect if the label is not wrapping or ellipsized.
Set this to -1 if you don’t want to limit the number of lines.

**Parameters**

- `lines`: the desired number of lines, or -1

### `setMarkup`

```ts
setMarkup(str: string): void
```

Sets the labels text and attributes from markup.

The string must be marked up with Pango markup
(see `Pango.parseMarkup()`).

If `str` is external data, you may need to escape it
with `GLib.markupEscapeText()` or `GLib.markupPrintfEscaped()`:

```c
GtkWidget *self = gtk_label_new (NULL);
const char *str = "...";
const char *format = "<span style=\"italic\">\%s</span>";
char *markup;

markup = g_markup_printf_escaped (format, str);
gtk_label_set_markup (GTK_LABEL (self), markup);
g_free (markup);
```

This function sets the `Gtk.Label.useMarkup` property
to true.

Also see `Gtk.Label.setText()`.

**Parameters**

- `str`: the markup string

### `setMarkupWithMnemonic`

```ts
setMarkupWithMnemonic(str: string): void
```

Sets the labels text, attributes and mnemonic from markup.

Parses `str` which is marked up with Pango markup (see `Pango.parseMarkup()`),
setting the label’s text and attribute list based on the parse results.
If characters in `str` are preceded by an underscore, they are underlined
indicating that they represent a keyboard accelerator called a mnemonic.

The mnemonic key can be used to activate another widget, chosen
automatically, or explicitly using `Gtk.Label.setMnemonicWidget()`.

**Parameters**

- `str`: the markup string

### `setMaxWidthChars`

```ts
setMaxWidthChars(nChars: number): void
```

Sets the maximum width of the label in characters.

**Parameters**

- `nChars`: the new maximum width, in characters.

### `setMnemonicWidget`

```ts
setMnemonicWidget(widget: Gtk.Widget | null): void
```

Associate the label with its mnemonic target.

If the label has been set so that it has a mnemonic key (using
i.e. `Gtk.Label.setMarkupWithMnemonic()`,
`Gtk.Label.setTextWithMnemonic()`,
`Gtk.Label.newWithMnemonic()`
or the `Gtk.Label.useUnderline` property) the label can
be associated with a widget that is the target of the mnemonic.
When the label is inside a widget (like a `Gtk.Button` or a
`Gtk.Notebook` tab) it is automatically associated with the
correct widget, but sometimes (i.e. when the target is a `Gtk.Entry`
next to the label) you need to set it explicitly using this function.

The target widget will be accelerated by emitting the
`Gtk.Widget.mnemonic-activate` signal on it. The default handler
for this signal will activate the widget if there are no mnemonic
collisions and toggle focus between the colliding widgets otherwise.

**Parameters**

- `widget`: the target widget

### `setNaturalWrapMode`

```ts
setNaturalWrapMode(wrapMode: Gtk.NaturalWrapMode): void
```

Selects the line wrapping for the natural size request.

This only affects the natural size requested, for the actual wrapping used,
see the `Gtk.Label.wrapMode` property.

**Parameters**

- `wrapMode`: the line wrapping mode

_Available since 4.6._

### `setSelectable`

```ts
setSelectable(setting: boolean): void
```

Makes text in the label selectable.

Selectable labels allow the user to select text from the label,
for copy-and-paste.

**Parameters**

- `setting`: true to allow selecting text in the label

### `setSingleLineMode`

```ts
setSingleLineMode(singleLineMode: boolean): void
```

Sets whether the label is in single line mode.

**Parameters**

- `singleLineMode`: true to enable single line mode

### `setTabs`

```ts
setTabs(tabs: Pango.TabArray | null): void
```

Sets tab stops for the label.

**Parameters**

- `tabs`: tab stops

_Available since 4.8._

### `setText`

```ts
setText(str: string): void
```

Sets the text for the label.

It overwrites any text that was there before and clears any
previously set mnemonic accelerators, and sets the
`Gtk.Label.useUnderline` and
`Gtk.Label.useMarkup` properties to false.

Also see `Gtk.Label.setMarkup()`.

**Parameters**

- `str`: the text to show in `self`

### `setTextWithMnemonic`

```ts
setTextWithMnemonic(str: string): void
```

Sets the text for the label, with mnemonics.

If characters in `str` are preceded by an underscore, they are underlined
indicating that they represent a keyboard accelerator called a mnemonic.
The mnemonic key can be used to activate another widget, chosen
automatically, or explicitly using `Gtk.Label.setMnemonicWidget()`.

**Parameters**

- `str`: the text

### `setUseMarkup`

```ts
setUseMarkup(setting: boolean): void
```

Sets whether the text of the label contains markup.

See `Gtk.Label.setMarkup()`.

**Parameters**

- `setting`: true if the label’s text should be parsed for markup.

### `setUseUnderline`

```ts
setUseUnderline(setting: boolean): void
```

Sets whether underlines in the text indicate mnemonics.

**Parameters**

- `setting`: true if underlines in the text indicate mnemonics

### `setWidthChars`

```ts
setWidthChars(nChars: number): void
```

Sets the desired width in characters of the label.

**Parameters**

- `nChars`: the new desired width, in characters.

### `setWrap`

```ts
setWrap(wrap: boolean): void
```

Toggles line wrapping within the label.

True makes it break lines if text exceeds the widget’s size.
false lets the text get cut off by the edge of the widget if
it exceeds the widget size.

Note that setting line wrapping to true does not make the label
wrap at its parent widget’s width, because GTK widgets conceptually
can’t make their requisition depend on the parent  widget’s size.
For a label that wraps at a specific position, set the label’s width
using `Gtk.Widget.setSizeRequest()`.

**Parameters**

- `wrap`: whether to wrap lines

### `setWrapMode`

```ts
setWrapMode(wrapMode: Pango.WrapMode): void
```

Controls how line wrapping is done.

This only affects the label if line wrapping is on. (See
`Gtk.Label.setWrap()`)

The default is `Pango.WrapMode.word`, which means
wrap on word boundaries.

For sizing behavior, also consider the
`Gtk.Label.naturalWrapMode` property.

**Parameters**

- `wrapMode`: the line wrapping mode

### `setXalign`

```ts
setXalign(xalign: number): void
```

Sets the `xalign` of the label.

See the `Gtk.Label.xalign` property.

**Parameters**

- `xalign`: the new xalign value, between 0 and 1

### `setYalign`

```ts
setYalign(yalign: number): void
```

Sets the `yalign` of the label.

See the `Gtk.Label.yalign` property.

**Parameters**

- `yalign`: the new yalign value, between 0 and 1
