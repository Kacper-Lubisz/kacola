---
description: "A single-line text entry."
---

# GtkText

A single-line text entry.

`GtkText` is the common implementation of single-line text editing
that is shared between `Gtk.Entry`, `Gtk.PasswordEntry`,
`Gtk.SpinButton`, and other widgets. In all of these, a `GtkText`
instance is used as the delegate for the `Gtk.Editable` implementation.

A large number of key bindings s supported by default. If the entered
text is longer than the allocation of the widget, the widget will scroll
so that the cursor position is visible.

When using an entry for passwords and other sensitive information,
it can be put into “password mode” using `Gtk.Text.setVisibility()`.
In this mode, entered text is displayed using an “invisible” character.
By default, GTK picks the best invisible character that is available
in the current font, but it can be changed with
`Gtk.Text.setInvisibleChar()`.

If you want to add icons or progress display in an entry, look at
`Gtk.Entry`. There are other alternatives for more specialized
use cases, such as `Gtk.SearchEntry`.

If you need multi-line editable text, use `Gtk.TextView`.

## Shortcuts and Gestures

`GtkText` supports the following keyboard shortcuts:

- <kbd>Shift</kbd>+<kbd>F10</kbd> or <kbd>Menu</kbd> opens the context menu.
- <kbd>Ctrl</kbd>+<kbd>A</kbd> or <kbd>Ctrl</kbd>+<kbd>&sol;</kbd>
  selects all the text.
- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> or
  <kbd>Ctrl</kbd>+<kbd>&bsol;</kbd> unselects all.
- <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes the last modification.
- <kbd>Ctrl</kbd>+<kbd>Y</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>
  redoes the last undone modification.
- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> toggles the text direction.
- <kbd>Clear</kbd> clears the content.

Additionally, the following signals have default keybindings:

- `Gtk.Text.activate`
- `Gtk.Text.backspace`
- `Gtk.Text.copy-clipboard`
- `Gtk.Text.cut-clipboard`
- `Gtk.Text.delete-from-cursor`
- `Gtk.Text.insert-emoji`
- `Gtk.Text.move-cursor`
- `Gtk.Text.paste-clipboard`
- `Gtk.Text.toggle-overwrite`

## Actions

`GtkText` defines a set of built-in actions:

- `clipboard.copy` copies the contents to the clipboard.
- `clipboard.cut` copies the contents to the clipboard and deletes it from
  the widget.
- `clipboard.paste` inserts the contents of the clipboard into the widget.
- `menu.popup` opens the context menu.
- `misc.insert-emoji` opens the Emoji chooser.
- `misc.toggle-visibility` toggles the `GtkText`:visibility property.
- `misc.toggle-direction` toggles the text direction.
- `selection.delete` deletes the current selection.
- `selection.select-all` selects all of the widgets content.
- `text.redo` redoes the last change to the contents.
- `text.undo` undoes the last change to the contents.
- `text.clear` removes all content.

## CSS nodes

```
text[.read-only]
├── placeholder
├── undershoot.left
├── undershoot.right
├── [selection]
├── [cursor-handle[.top]
├── [cursor-handle.bottom]
├── [block-cursor]
├── [cursor-handle[.top/.bottom][.insertion-cursor]]
╰── [window.popup]
```

`GtkText` has a main node with the name `text`. Depending on the properties
of the widget, the `.read-only` style class may appear.

When the entry has a selection, it adds a subnode with the name `selection`.

When the entry is in overwrite mode, it adds a subnode with the name
`block-cursor` that determines how the block cursor is drawn.

The CSS node for a context menu is added as a subnode with the name `popup`.

The `undershoot` nodes are used to draw the underflow indication when content
is scrolled out of view. These nodes get the `.left` or `.right` style class
added depending on where the indication is drawn.

When touch is used and touch selection handles are shown, they are using
CSS nodes with name `cursor-handle`. They get the `.top` or `.bottom` style
class depending on where they are shown in relation to the selection. If
there is just a single handle for the text cursor, it gets the style class
`.insertion-cursor`.

## Accessibility

`GtkText` uses the `Gtk.AccessibleRole.none` role, which causes it to be
skipped for accessibility. This is because `GtkText` is expected to be used
as a delegate for a `GtkEditable` implementation that will be represented
to accessibility.

```tsx
import { GtkText } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkText**

Implements `GtkAccessible`, `GtkAccessibleText`, `GtkBuildable`, `GtkConstraintTarget`, `GtkEditable`.

## Props

`ref` receives the `Gtk.Text` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `activatesDefault`

`boolean` · default `false`

Whether to activate the default widget when <kbd>Enter</kbd> is pressed.

### `attributes`

`Pango.AttrList`

A list of Pango attributes to apply to the text.

This is mainly useful to change the size or weight of the text.

The `PangoAttribute`'s `start_index` and `end_index` must refer to the
`GtkEntryBuffer` text, i.e. without the preedit string.

### `buffer`

`Gtk.EntryBuffer | ReactElement`

The `GtkEntryBuffer` object which stores the text.

### `cursorPosition`

`number` · default `0` · read-only, observe with `onNotifyCursorPosition` · from `GtkEditable`

The current position of the insertion cursor in chars.

### `editable`

`boolean` · default `true` · from `GtkEditable`

Whether the entry contents can be edited.

### `enableEmojiCompletion`

`boolean` · default `false`

Whether to suggest Emoji replacements.

### `enableUndo`

`boolean` · default `true` · from `GtkEditable`

If undo/redo should be enabled for the editable.

### `extraMenu`

`Gio.MenuModel | ReactElement`

A menu model whose contents will be appended to the context menu.

### `imModule`

`string` · default `null`

Which input method module should be used.

See `Gtk.IMMulticontext`.

Setting this to a non-`NULL` value overrides the system-wide
input method. See the `Gtk.Settings.gtkImModule`
setting.

### `inputHints`

`Gtk.InputHints` · default `GTK_INPUT_HINT_NONE`

Additional hints that allow input methods to fine-tune
their behaviour.

### `inputPurpose`

`Gtk.InputPurpose` · default `GTK_INPUT_PURPOSE_FREE_FORM`

The purpose of this text field.

This information can be used by on-screen keyboards and other input
methods to adjust their behaviour.

Note that setting the purpose to `Gtk.InputPurpose.password`
or `Gtk.InputPurpose.pin` is independent from setting
`Gtk.Text.visibility`.

### `invisibleChar`

`number` · default `42`

The character to used when masking contents (in “password mode”).

### `invisibleCharSet`

`boolean` · default `false`

Whether the invisible char has been set.

### `maxLength`

`number` · default `0`

Maximum number of characters that are allowed.

Zero indicates no limit.

### `maxWidthChars`

`number` · default `-1` · from `GtkEditable`

The desired maximum width of the entry, in characters.

### `overwriteMode`

`boolean` · default `false`

If text is overwritten when typing.

### `placeholderText`

`string` · default `null`

The text that will be displayed in the `GtkText` when it is empty
and unfocused.

### `propagateTextWidth`

`boolean` · default `false`

Whether the widget should grow and shrink with the content.

### `scrollOffset`

`number` · default `0` · read-only, observe with `onNotifyScrollOffset`

Number of pixels scrolled of the screen to the left.

### `selectionBound`

`number` · default `0` · read-only, observe with `onNotifySelectionBound` · from `GtkEditable`

The position of the opposite end of the selection from the cursor in chars.

### `tabs`

`Pango.TabArray`

Custom tabs for this text widget.

### `text`

`string` · from `GtkEditable`

The contents of the entry.

### `truncateMultiline`

`boolean` · default `false`

When true, pasted multi-line text is truncated to the first line.

### `visibility`

`boolean` · default `true`

If false, the text is masked with the “invisible char”.

### `widthChars`

`number` · default `-1` · from `GtkEditable`

Number of characters to leave space for in the entry.

### `xalign`

`number` · default `0.000000` · from `GtkEditable`

The horizontal alignment, from 0 (left) to 1 (right).

Reversed for RTL layouts.

## Signals

### `onActivate`

```ts
(self: Gtk.Text) => void
```

Emitted when the user hits the <kbd>Enter</kbd> key.

The default bindings for this signal are all forms
of the <kbd>Enter</kbd> key.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onBackspace`

```ts
(self: Gtk.Text) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Backspace</kbd> and <kbd>Shift</kbd>+<kbd>Backspace</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onChanged`

```ts
(self: Gtk.Text) => void
```

From `GtkEditable`.

Emitted at the end of a single user-visible operation on the
contents.

E.g., a paste operation that replaces the contents of the
selection will cause only one signal emission (even though it
is implemented by first deleting the selection, then inserting
the new content, and may cause multiple ::notify::text signals
to be emitted).

**Parameters**

- `self`: The instance the signal was emitted on.

### `onCopyClipboard`

```ts
(self: Gtk.Text) => void
```

Emitted to copy the selection to the clipboard.

This is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>c</kbd> and
<kbd>Ctrl</kbd>+<kbd>Insert</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onCutClipboard`

```ts
(self: Gtk.Text) => void
```

Emitted to cut the selection to the clipboard.

This is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>x</kbd> and
<kbd>Shift</kbd>+<kbd>Delete</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onDeleteFromCursor`

```ts
(type: Gtk.DeleteType, count: number, self: Gtk.Text) => void
```

Emitted when the user initiates a text deletion.

This is a [keybinding signal](class.SignalAction.html).

If the `type` is `Gtk.DeleteType.chars`, GTK deletes the
selection if there is one, otherwise it deletes the requested
number of characters.

The default bindings for this signal are <kbd>Delete</kbd>
for deleting a character and <kbd>Ctrl</kbd>+<kbd>Delete</kbd>
for deleting a word.

**Parameters**

- `type`: the granularity of the deletion
- `count`: the number of `type` units to delete
- `self`: The instance the signal was emitted on.

### `onDeleteText`

```ts
(startPos: number, endPos: number, self: Gtk.Text) => void
```

From `GtkEditable`.

Emitted when text is deleted from the widget by the user.

The default handler for this signal will normally be responsible for
deleting the text, so by connecting to this signal and then stopping
the signal with `g_signal_stop_emission()`, it is possible to modify the
range of deleted text, or prevent it from being deleted entirely.

The `start_pos` and `end_pos` parameters are interpreted as for
`Gtk.Editable.deleteText()`.

**Parameters**

- `startPos`: the starting position
- `endPos`: the end position
- `self`: The instance the signal was emitted on.

### `onInsertAtCursor`

```ts
(string: string, self: Gtk.Text) => void
```

Emitted when the user initiates the insertion of a
fixed string at the cursor.

This is a [keybinding signal](class.SignalAction.html).

This signal has no default bindings.

**Parameters**

- `string`: the string to insert
- `self`: The instance the signal was emitted on.

### `onInsertEmoji`

```ts
(self: Gtk.Text) => void
```

Emitted to present the Emoji chooser.

This is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>.</kbd> and
<kbd>Ctrl</kbd>+<kbd>;</kbd>

**Parameters**

- `self`: The instance the signal was emitted on.

### `onInsertText`

```ts
(text: string, length: number, position: number, self: Gtk.Text) => number
```

From `GtkEditable`.

Emitted when text is inserted into the widget by the user.

The default handler for this signal will normally be responsible
for inserting the text, so by connecting to this signal and then
stopping the signal with `g_signal_stop_emission()`, it is possible
to modify the inserted text, or prevent it from being inserted entirely.

**Parameters**

- `text`: the new text to insert
- `length`: the length of the new text, in bytes, or -1 if new_text is nul-terminated
- `position`: the position, in characters, at which to insert the new text. this is an in-out parameter. After the signal emission is finished, it should point after the newly inserted text.
- `self`: The instance the signal was emitted on.

### `onMoveCursor`

```ts
(step: Gtk.MovementStep, count: number, extend: boolean, self: Gtk.Text) => void
```

Emitted when the user initiates a cursor movement.

If the cursor is not visible in `self`, this signal causes
the viewport to be moved instead.

This is a [keybinding signal](class.SignalAction.html).

Applications should not connect to it, but may emit it with
`GObject.signalEmitByName()` if they need to control
the cursor programmatically.

The default bindings for this signal come in two variants,
the variant with the <kbd>Shift</kbd> modifier extends the
selection, the variant without it does not.
There are too many key combinations to list them all here.

- <kbd>←</kbd>, <kbd>→</kbd>, <kbd>↑</kbd>, <kbd>↓</kbd>
  move by individual characters/lines
- <kbd>Ctrl</kbd>+<kbd>←</kbd>, etc. move by words/paragraphs
- <kbd>Home</kbd> and <kbd>End</kbd> move to the ends of the buffer

**Parameters**

- `step`: the granularity of the move
- `count`: the number of `step` units to move
- `extend`: true if the move should extend the selection
- `self`: The instance the signal was emitted on.

### `onPasteClipboard`

```ts
(self: Gtk.Text) => void
```

Emitted to paste the contents of the clipboard.

This is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>v</kbd> and <kbd>Shift</kbd>+<kbd>Insert</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onPreeditChanged`

```ts
(preedit: string, self: Gtk.Text) => void
```

Emitted when the preedit text changes.

If an input method is used, the typed text will not immediately
be committed to the buffer. So if you are interested in the text,
connect to this signal.

**Parameters**

- `preedit`: the current preedit string
- `self`: The instance the signal was emitted on.

### `onToggleOverwrite`

```ts
(self: Gtk.Text) => void
```

Emitted to toggle the overwrite mode.

This is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal is <kbd>Insert</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Text` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `computeCursorExtents`

```ts
computeCursorExtents(position: number): [Graphene.Rect, Graphene.Rect]
```

Determines the positions of the strong and weak cursors for a
given character position.

The position of each cursor is stored as a zero-width rectangle.
The strong cursor location is the location where characters of
the directionality equal to the base direction are inserted.
The weak cursor location is the location where characters of
the directionality opposite to the base direction are inserted.

The rectangle positions are in widget coordinates.

**Parameters**

- `position`: the character position

**Returns** Tuple of:

- `strong`: location to store the strong cursor position
- `weak`: location to store the weak cursor position

_Available since 4.4._

### `getActivatesDefault`

```ts
getActivatesDefault(): boolean
```

Returns whether pressing <kbd>Enter</kbd> will activate
the default widget for the window containing the widget.

See `Gtk.Text.setActivatesDefault()`.

**Returns** true if `self` will activate the default widget

### `getAttributes`

```ts
getAttributes(): Pango.AttrList | null
```

Gets the attribute list that was set on the text widget.

See `Gtk.Text.setAttributes()`.

**Returns** the attribute list

### `getBuffer`

```ts
getBuffer(): Gtk.EntryBuffer
```

Get the entry buffer object which holds the text for
this widget.

**Returns** the entry buffer object

### `getEnableEmojiCompletion`

```ts
getEnableEmojiCompletion(): boolean
```

Returns whether Emoji completion is enabled.

**Returns** true if Emoji completion is enabled

### `getExtraMenu`

```ts
getExtraMenu(): Gio.MenuModel | null
```

Gets the extra menu model of the text widget.

See `Gtk.Text.setExtraMenu()`.

**Returns** the menu model

### `getInputHints`

```ts
getInputHints(): Gtk.InputHints
```

Gets the input hints of the text widget.

**Returns** the input hints

### `getInputPurpose`

```ts
getInputPurpose(): Gtk.InputPurpose
```

Gets the input purpose of the text widget.

**Returns** the input purpose

### `getInvisibleChar`

```ts
getInvisibleChar(): string
```

Retrieves the character displayed when visibility is set to false.

Note that GTK does not compute this value unless it needs it,
so the value returned by this function is not very useful unless
it has been explicitly set with `Gtk.Text.setInvisibleChar()`.

**Returns** the current invisible char, or 0, if `text` does not
  show invisible text at all

### `getMaxLength`

```ts
getMaxLength(): number
```

Retrieves the maximum allowed length of the contents.

See `Gtk.Text.setMaxLength()`.

This is equivalent to getting `self`'s `GtkEntryBuffer` and
calling `Gtk.EntryBuffer.getMaxLength()` on it.

**Returns** the maximum allowed number of characters, or 0 if
  there is no limit

### `getOverwriteMode`

```ts
getOverwriteMode(): boolean
```

Gets whether text is overwritten when typing.

See `Gtk.Text.setOverwriteMode()`.

**Returns** whether text is overwritten when typing

### `getPlaceholderText`

```ts
getPlaceholderText(): string | null
```

Retrieves the text that will be displayed when the text widget
is empty and unfocused

See `Gtk.Text.setPlaceholderText()`.

**Returns** the placeholder text

### `getPropagateTextWidth`

```ts
getPropagateTextWidth(): boolean
```

Returns whether the text widget will grow and shrink
with the content.

**Returns** true if `self` will propagate the text width

### `getTabs`

```ts
getTabs(): Pango.TabArray | null
```

Gets the tab stops for the text widget.

See `Gtk.Text.setTabs()`.

**Returns** the tab stops

### `getTextLength`

```ts
getTextLength(): number
```

Retrieves the length of the contents.

This is equivalent to getting `self`'s `GtkEntryBuffer`
and calling `Gtk.EntryBuffer.getLength()` on it.

**Returns** the length of the contents, in characters

### `getTruncateMultiline`

```ts
getTruncateMultiline(): boolean
```

Returns whether pasted text will be truncated to the first line.

**Returns** true if `self` will truncate pasted multi-line text

### `getVisibility`

```ts
getVisibility(): boolean
```

Retrieves whether the text is visible.

**Returns** true if the text is visible

### `grabFocusWithoutSelecting`

```ts
grabFocusWithoutSelecting(): boolean
```

Causes the text widget to have the keyboard focus.

It behaves like `Gtk.Widget.grabFocus()`,
except that it does not select the contents of `self`.

You only want to call this on some special entries
which the user usually doesn't want to replace all
text in, such as search-as-you-type entries.

**Returns** true if focus is now inside `self`

### `setActivatesDefault`

```ts
setActivatesDefault(activates: boolean): void
```

Sets whether pressing <kbd>Enter</kbd> will activate
the default widget.

This usually means that the dialog containing `self` will
be closed, since the default widget is usually one of
the dialog buttons.

**Parameters**

- `activates`: true to activate window’s default widget on <kbd>Enter</kbd> keypress

### `setAttributes`

```ts
setAttributes(attrs: Pango.AttrList | null): void
```

Apply attributes to the contents of the text widget.

**Parameters**

- `attrs`: a list of style attributes

### `setBuffer`

```ts
setBuffer(buffer: Gtk.EntryBuffer): void
```

Set the entry buffer object which holds the text for
this widget.

**Parameters**

- `buffer`: an entry buffer object

### `setEnableEmojiCompletion`

```ts
setEnableEmojiCompletion(enableEmojiCompletion: boolean): void
```

Sets whether Emoji completion is enabled.

If it is, typing ':', followed by a recognized keyword,
will pop up a window with suggested Emojis matching the
keyword.

**Parameters**

- `enableEmojiCompletion`: true to enable Emoji completion

### `setExtraMenu`

```ts
setExtraMenu(model: Gio.MenuModel | null): void
```

Sets a menu model to add to the context menu of the text widget.

**Parameters**

- `model`: a menu model

### `setInputHints`

```ts
setInputHints(hints: Gtk.InputHints): void
```

Sets hints that allow input methods to fine-tune their behaviour.

**Parameters**

- `hints`: input hints

### `setInputPurpose`

```ts
setInputPurpose(purpose: Gtk.InputPurpose): void
```

Sets the input purpose of the text widget.

The input purpose can be used by on-screen keyboards
and other input methods to adjust their behaviour.

**Parameters**

- `purpose`: the input purpose

### `setInvisibleChar`

```ts
setInvisibleChar(ch: string): void
```

Sets the character to use when in “password mode”.

By default, GTK picks the best invisible char available in the
current font. If you set the invisible char to 0, then the user
will get no feedback at all; there will be no text on the screen
as they type.

**Parameters**

- `ch`: a Unicode character

### `setMaxLength`

```ts
setMaxLength(length: number): void
```

Sets the maximum allowed length of the contents.

If the current contents are longer than the given length,
they will be truncated to fit.

This is equivalent to getting `self`'s `GtkEntryBuffer` and
calling `Gtk.EntryBuffer.setMaxLength()` on it.

**Parameters**

- `length`: the maximum length of the text, or 0 for no maximum. (other than the maximum length of entries.) The value passed in will be clamped to the range 0-65536

### `setOverwriteMode`

```ts
setOverwriteMode(overwrite: boolean): void
```

Sets whether the text is overwritten when typing.

**Parameters**

- `overwrite`: new value

### `setPlaceholderText`

```ts
setPlaceholderText(text: string | null): void
```

Sets the text to be displayed when the text widget is
empty and unfocused.

This can be used to give a visual hint of the expected
contents of the text widget.

**Parameters**

- `text`: a string to be displayed when `self` is empty and unfocused

### `setPropagateTextWidth`

```ts
setPropagateTextWidth(propagateTextWidth: boolean): void
```

Sets whether the text widget should grow and shrink with the content.

**Parameters**

- `propagateTextWidth`: true to propagate the text width

### `setTabs`

```ts
setTabs(tabs: Pango.TabArray | null): void
```

Sets tab stops for the text widget.

**Parameters**

- `tabs`: tab stops

### `setTruncateMultiline`

```ts
setTruncateMultiline(truncateMultiline: boolean): void
```

Sets whether pasted text should be truncated to the first line.

**Parameters**

- `truncateMultiline`: true to truncate multi-line text

### `setVisibility`

```ts
setVisibility(visible: boolean): void
```

Sets whether the contents of the text widget are visible or not.

When visibility is set to false, characters are displayed
as the invisible char, and it will also appear that way when
the text in the widget is copied to the clipboard.

By default, GTK picks the best invisible character available
in the current font, but it can be changed with
`Gtk.Text.setInvisibleChar()`.

Note that you probably want to set `Gtk.Text.inputPurpose`
to `Gtk.InputPurpose.password` or `Gtk.InputPurpose.pin`
to inform input methods about the purpose of this widget, in addition
to setting visibility to false.

**Parameters**

- `visible`: true if the contents of the text widget are displayed as plain text

### `unsetInvisibleChar`

```ts
unsetInvisibleChar(): void
```

Unsets the invisible char.

After calling this, the default invisible char is used again.
