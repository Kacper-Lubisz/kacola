---
description: "Displays the contents of a Gtk.TextBuffer."
---

# GtkTextView

Displays the contents of a `Gtk.TextBuffer`.



You may wish to begin by reading the [conceptual overview](section-text-widget.html),
which gives an overview of all the objects and data types related to the
text widget and how they work together.

### Shortcuts and Gestures

`GtkTextView` supports the following keyboard shortcuts:

- <kbd>Shift</kbd>+<kbd>F10</kbd> or <kbd>Menu</kbd> opens the context menu.
- <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes the last modification.
- <kbd>Ctrl</kbd>+<kbd>Y</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>
   redoes the last undone modification.
- <kbd>Clear</kbd> clears the content.

Additionally, the following signals have default keybindings:

- `Gtk.TextView.backspace`
- `Gtk.TextView.copy-clipboard`
- `Gtk.TextView.cut-clipboard`
- `Gtk.TextView.delete-from-cursor`
- `Gtk.TextView.insert-emoji`
- `Gtk.TextView.move-cursor`
- `Gtk.TextView.paste-clipboard`
- `Gtk.TextView.select-all`
- `Gtk.TextView.toggle-cursor-visible`
- `Gtk.TextView.toggle-overwrite`

### Actions

`GtkTextView` defines a set of built-in actions:

- `clipboard.copy` copies the contents to the clipboard.
- `clipboard.cut` copies the contents to the clipboard and deletes it from
  the widget.
- `clipboard.paste` inserts the contents of the clipboard into the widget.
- `menu.popup` opens the context menu.
- `misc.insert-emoji` opens the Emoji chooser.
- `selection.delete` deletes the current selection.
- `selection.select-all` selects all of the widgets content.
- `text.redo` redoes the last change to the contents.
- `text.undo` undoes the last change to the contents.
- `text.clear` clears the content.

### CSS nodes

```
textview.view
├── border.top
├── border.left
├── text
│   ╰── [selection]
├── border.right
├── border.bottom
╰── [window.popup]
```

`GtkTextView` has a main css node with name textview and style class .view,
and subnodes for each of the border windows, and the main text area,
with names border and text, respectively. The border nodes each get
one of the style classes .left, .right, .top or .bottom.

A node representing the selection will appear below the text node.

If a context menu is opened, the window node will appear as a subnode
of the main node.

### Accessibility

`GtkTextView` uses the `Gtk.AccessibleRole.text_box` role.

```tsx
import { GtkTextView } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkTextView**

Implements `GtkAccessible`, `GtkAccessibleText`, `GtkBuildable`, `GtkConstraintTarget`, `GtkScrollable`.

## Props

`ref` receives the `Gtk.TextView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `acceptsTab`

`boolean` · default `true`

Whether Tab will result in a tab character being entered.

### `bottomMargin`

`number` · default `0`

The bottom margin for text in the text view.

Note that this property is confusingly named. In CSS terms,
the value set here is padding, and it is applied in addition
to the padding from the theme.

Don't confuse this property with `Gtk.Widget.marginBottom`.

### `buffer`

`Gtk.TextBuffer | ReactElement`

The buffer which is displayed.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `cursorVisible`

`boolean` · default `true`

If the insertion cursor is shown.

### `editable`

`boolean` · default `true`

Whether the text can be modified by the user.

### `extraMenu`

`Gio.MenuModel | ReactElement`

A menu model whose contents will be appended to the context menu.

### `hadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Horizontal `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `hscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when horizontal scrolling should start.

### `imModule`

`string` · default `null`

Which IM (input method) module should be used for this text_view.

See `Gtk.IMMulticontext`.

Setting this to a non-`null` value overrides the system-wide IM module
setting. See the GtkSettings `Gtk.Settings.gtkImModule` property.

### `indent`

`number` · default `0`

Amount to indent the paragraph, in pixels.

A negative value of indent will produce a hanging indentation.
That is, the first line will have the full width, and subsequent
lines will be indented by the absolute value of indent.

### `inputHints`

`Gtk.InputHints` · default `GTK_INPUT_HINT_NONE`

Additional hints (beyond `Gtk.TextView.inputPurpose`)
that allow input methods to fine-tune their behaviour.

### `inputPurpose`

`Gtk.InputPurpose` · default `GTK_INPUT_PURPOSE_FREE_FORM`

The purpose of this text field.

This property can be used by on-screen keyboards and other input
methods to adjust their behaviour.

### `justification`

`Gtk.Justification` · default `GTK_JUSTIFY_LEFT`

Left, right, or center justification.

### `leftMargin`

`number` · default `0`

The default left margin for text in the text view.

Tags in the buffer may override the default.

Note that this property is confusingly named. In CSS terms,
the value set here is padding, and it is applied in addition
to the padding from the theme.

### `monospace`

`boolean` · default `false`

Whether text should be displayed in a monospace font.

If `true`, set the .monospace style class on the
text view to indicate that a monospace font is desired.

### `overwrite`

`boolean` · default `false`

Whether entered text overwrites existing contents.

### `pixelsAboveLines`

`number` · default `0`

Pixels of blank space above paragraphs.

### `pixelsBelowLines`

`number` · default `0`

Pixels of blank space below paragraphs.

### `pixelsInsideWrap`

`number` · default `0`

Pixels of blank space between wrapped lines in a paragraph.

### `rightMargin`

`number` · default `0`

The default right margin for text in the text view.

Tags in the buffer may override the default.

Note that this property is confusingly named. In CSS terms,
the value set here is padding, and it is applied in addition
to the padding from the theme.

### `tabs`

`Pango.TabArray`

Custom tabs for this text.

### `topMargin`

`number` · default `0`

The top margin for text in the text view.

Note that this property is confusingly named. In CSS terms,
the value set here is padding, and it is applied in addition
to the padding from the theme.

Don't confuse this property with `Gtk.Widget.marginTop`.

### `vadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Vertical `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `vscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when vertical scrolling should start.

### `wrapMode`

`Gtk.WrapMode` · default `GTK_WRAP_NONE`

Whether to wrap lines never, at word boundaries, or at character boundaries.

## Signals

### `onBackspace`

```ts
(self: Gtk.TextView) => void
```

Gets emitted when the user asks for it.

The ::backspace signal is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Backspace</kbd> and <kbd>Shift</kbd>+<kbd>Backspace</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onCopyClipboard`

```ts
(self: Gtk.TextView) => void
```

Gets emitted to copy the selection to the clipboard.

The ::copy-clipboard signal is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>c</kbd> and
<kbd>Ctrl</kbd>+<kbd>Insert</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onCutClipboard`

```ts
(self: Gtk.TextView) => void
```

Gets emitted to cut the selection to the clipboard.

The ::cut-clipboard signal is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>x</kbd> and
<kbd>Shift</kbd>+<kbd>Delete</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onDeleteFromCursor`

```ts
(type: Gtk.DeleteType, count: number, self: Gtk.TextView) => void
```

Gets emitted when the user initiates a text deletion.

The ::delete-from-cursor signal is a [keybinding signal](class.SignalAction.html).

If the `type` is `GTK_DELETE_CHARS`, GTK deletes the selection
if there is one, otherwise it deletes the requested number
of characters.

The default bindings for this signal are <kbd>Delete</kbd> for
deleting a character, <kbd>Ctrl</kbd>+<kbd>Delete</kbd> for
deleting a word and <kbd>Ctrl</kbd>+<kbd>Backspace</kbd> for
deleting a word backwards.

**Parameters**

- `type`: the granularity of the deletion, as a `GtkDeleteType`
- `count`: the number of `type` units to delete
- `self`: The instance the signal was emitted on.

### `onExtendSelection`

```ts
(granularity: Gtk.TextExtendSelection, location: Gtk.TextIter, start: Gtk.TextIter, end: Gtk.TextIter, self: Gtk.TextView) => boolean | undefined
```

Emitted when the selection needs to be extended at `location`.

**Parameters**

- `granularity`: the granularity type
- `location`: the location where to extend the selection
- `start`: where the selection should start
- `end`: where the selection should end
- `self`: The instance the signal was emitted on.

**Returns** `GDK_EVENT_STOP` to stop other handlers from being invoked for the
  event. `GDK_EVENT_PROPAGATE` to propagate the event further.

### `onInsertAtCursor`

```ts
(string: string, self: Gtk.TextView) => void
```

Gets emitted when the user initiates the insertion of a
fixed string at the cursor.

The ::insert-at-cursor signal is a [keybinding signal](class.SignalAction.html).

This signal has no default bindings.

**Parameters**

- `string`: the string to insert
- `self`: The instance the signal was emitted on.

### `onInsertEmoji`

```ts
(self: Gtk.TextView) => void
```

Gets emitted to present the Emoji chooser for the `text_view`.

The ::insert-emoji signal is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>.</kbd> and
<kbd>Ctrl</kbd>+<kbd>;</kbd>

**Parameters**

- `self`: The instance the signal was emitted on.

### `onMoveCursor`

```ts
(step: Gtk.MovementStep, count: number, extendSelection: boolean, self: Gtk.TextView) => void
```

Gets emitted when the user initiates a cursor movement.

The ::move-cursor signal is a [keybinding signal](class.SignalAction.html).
If the cursor is not visible in `text_view`, this signal causes
the viewport to be moved instead.

Applications should not connect to it, but may emit it with
`g_signal_emit_by_name()` if they need to control the cursor
programmatically.


The default bindings for this signal come in two variants,
the variant with the <kbd>Shift</kbd> modifier extends the
selection, the variant without it does not.
There are too many key combinations to list them all here.

- <kbd>←</kbd>, <kbd>→</kbd>, <kbd>↑</kbd>, <kbd>↓</kbd>
  move by individual characters/lines
- <kbd>Ctrl</kbd>+<kbd>←</kbd>, etc. move by words/paragraphs
- <kbd>Home</kbd> and <kbd>End</kbd> move to the ends of the buffer
- <kbd>PgUp</kbd> and <kbd>PgDn</kbd> move vertically by pages
- <kbd>Ctrl</kbd>+<kbd>PgUp</kbd> and <kbd>Ctrl</kbd>+<kbd>PgDn</kbd>
  move horizontally by pages

**Parameters**

- `step`: the granularity of the move, as a `GtkMovementStep`
- `count`: the number of `step` units to move
- `extendSelection`: `true` if the move should extend the selection
- `self`: The instance the signal was emitted on.

### `onMoveViewport`

```ts
(step: Gtk.ScrollStep, count: number, self: Gtk.TextView) => void
```

Gets emitted to move the viewport.

The ::move-viewport signal is a [keybinding signal](class.SignalAction.html),
which can be bound to key combinations to allow the user to move the viewport,
i.e. change what part of the text view is visible in a containing scrolled
window.

There are no default bindings for this signal.

**Parameters**

- `step`: the granularity of the movement, as a `GtkScrollStep`
- `count`: the number of `step` units to move
- `self`: The instance the signal was emitted on.

### `onPasteClipboard`

```ts
(self: Gtk.TextView) => void
```

Gets emitted to paste the contents of the clipboard
into the text view.

The ::paste-clipboard signal is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>v</kbd> and
<kbd>Shift</kbd>+<kbd>Insert</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onPreeditChanged`

```ts
(preedit: string, self: Gtk.TextView) => void
```

Emitted when preedit text of the active IM changes.

If an input method is used, the typed text will not immediately
be committed to the buffer. So if you are interested in the text,
connect to this signal.

This signal is only emitted if the text at the given position
is actually editable.

**Parameters**

- `preedit`: the current preedit string
- `self`: The instance the signal was emitted on.

### `onSelectAll`

```ts
(select: boolean, self: Gtk.TextView) => void
```

Gets emitted to select or unselect the complete contents of the text view.

The ::select-all signal is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>a</kbd> and
<kbd>Ctrl</kbd>+<kbd>/</kbd> for selecting and
<kbd>Shift</kbd>+<kbd>Ctrl</kbd>+<kbd>a</kbd> and
<kbd>Ctrl</kbd>+<kbd>\</kbd> for unselecting.

**Parameters**

- `select`: `true` to select, `false` to unselect
- `self`: The instance the signal was emitted on.

### `onSetAnchor`

```ts
(self: Gtk.TextView) => void
```

Gets emitted when the user initiates settings the "anchor" mark.

The ::set-anchor signal is a [keybinding signal](class.SignalAction.html)
which gets emitted when the user initiates setting the "anchor"
mark. The "anchor" mark gets placed at the same position as the
"insert" mark.

This signal has no default bindings.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onToggleCursorVisible`

```ts
(self: Gtk.TextView) => void
```

Gets emitted to toggle the `cursor-visible` property.

The ::toggle-cursor-visible signal is a
[keybinding signal](class.SignalAction.html).

The default binding for this signal is <kbd>F7</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onToggleOverwrite`

```ts
(self: Gtk.TextView) => void
```

Gets emitted to toggle the overwrite mode of the text view.

The ::toggle-overwrite signal is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is <kbd>Insert</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.TextView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addChildAtAnchor`

```ts
addChildAtAnchor(child: Gtk.Widget, anchor: Gtk.TextChildAnchor): void
```

Adds a child widget in the text buffer, at the given `anchor`.

**Parameters**

- `child`: a `GtkWidget`
- `anchor`: a `GtkTextChildAnchor` in the `GtkTextBuffer` for `text_view`

### `addOverlay`

```ts
addOverlay(child: Gtk.Widget, xpos: number, ypos: number): void
```

Adds `child` at a fixed coordinate in the `GtkTextView`'s text window.

The `xpos` and `ypos` must be in buffer coordinates (see
`Gtk.TextView.getIterLocation()` to convert to
buffer coordinates).

`child` will scroll with the text view.

If instead you want a widget that will not move with the
`GtkTextView` contents see `GtkOverlay`.

**Parameters**

- `child`: a `GtkWidget`
- `xpos`: X position of child in window coordinates
- `ypos`: Y position of child in window coordinates

### `backwardDisplayLine`

```ts
backwardDisplayLine(iter: Gtk.TextIter): boolean
```

Moves the given `iter` backward by one display (wrapped) line.

A display line is different from a paragraph. Paragraphs are
separated by newlines or other paragraph separator characters.
Display lines are created by line-wrapping a paragraph. If
wrapping is turned off, display lines and paragraphs will be the
same. Display lines are divided differently for each view, since
they depend on the view’s width; paragraphs are the same in all
views, since they depend on the contents of the `GtkTextBuffer`.

**Parameters**

- `iter`: a `GtkTextIter`

**Returns** `true` if `iter` was moved and is not on the end iterator

### `backwardDisplayLineStart`

```ts
backwardDisplayLineStart(iter: Gtk.TextIter): boolean
```

Moves the given `iter` backward to the next display line start.

A display line is different from a paragraph. Paragraphs are
separated by newlines or other paragraph separator characters.
Display lines are created by line-wrapping a paragraph. If
wrapping is turned off, display lines and paragraphs will be the
same. Display lines are divided differently for each view, since
they depend on the view’s width; paragraphs are the same in all
views, since they depend on the contents of the `GtkTextBuffer`.

**Parameters**

- `iter`: a `GtkTextIter`

**Returns** `true` if `iter` was moved and is not on the end iterator

### `bufferToWindowCoords`

```ts
bufferToWindowCoords(win: Gtk.TextWindowType, bufferX: number, bufferY: number): [number, number]
```

Converts buffer coordinates to window coordinates.

**Parameters**

- `win`: a `GtkTextWindowType`
- `bufferX`: buffer x coordinate
- `bufferY`: buffer y coordinate

**Returns** Tuple of:

- `windowX`: window x coordinate return location
- `windowY`: window y coordinate return location

### `forwardDisplayLine`

```ts
forwardDisplayLine(iter: Gtk.TextIter): boolean
```

Moves the given `iter` forward by one display (wrapped) line.

A display line is different from a paragraph. Paragraphs are
separated by newlines or other paragraph separator characters.
Display lines are created by line-wrapping a paragraph. If
wrapping is turned off, display lines and paragraphs will be the
same. Display lines are divided differently for each view, since
they depend on the view’s width; paragraphs are the same in all
views, since they depend on the contents of the `GtkTextBuffer`.

**Parameters**

- `iter`: a `GtkTextIter`

**Returns** `true` if `iter` was moved and is not on the end iterator

### `forwardDisplayLineEnd`

```ts
forwardDisplayLineEnd(iter: Gtk.TextIter): boolean
```

Moves the given `iter` forward to the next display line end.

A display line is different from a paragraph. Paragraphs are
separated by newlines or other paragraph separator characters.
Display lines are created by line-wrapping a paragraph. If
wrapping is turned off, display lines and paragraphs will be the
same. Display lines are divided differently for each view, since
they depend on the view’s width; paragraphs are the same in all
views, since they depend on the contents of the `GtkTextBuffer`.

**Parameters**

- `iter`: a `GtkTextIter`

**Returns** `true` if `iter` was moved and is not on the end iterator

### `getAcceptsTab`

```ts
getAcceptsTab(): boolean
```

Returns whether pressing the <kbd>Tab</kbd> key inserts a tab characters.

See `Gtk.TextView.setAcceptsTab()`.

**Returns** `true` if pressing the Tab key inserts a tab character,
  `false` if pressing the Tab key moves the keyboard focus.

### `getBottomMargin`

```ts
getBottomMargin(): number
```

Gets the bottom margin for text in the `text_view`.

**Returns** bottom margin in pixels

### `getBuffer`

```ts
getBuffer(): Gtk.TextBuffer
```

Returns the `GtkTextBuffer` being displayed by this text view.

The reference count on the buffer is not incremented; the caller
of this function won’t own a new reference.

**Returns** a `GtkTextBuffer`

### `getCursorLocations`

```ts
getCursorLocations(iter: Gtk.TextIter | null): [Gdk.Rectangle, Gdk.Rectangle]
```

Determine the positions of the strong and weak cursors if the
insertion point is at `iter`.

The position of each cursor is stored as a zero-width rectangle.
The strong cursor location is the location where characters of
the directionality equal to the base direction of the paragraph
are inserted. The weak cursor location is the location where
characters of the directionality opposite to the base direction
of the paragraph are inserted.

If `iter` is `null`, the actual cursor position is used.

Note that if `iter` happens to be the actual cursor position, and
there is currently an IM preedit sequence being entered, the
returned locations will be adjusted to account for the preedit
cursor’s offset within the preedit sequence.

The rectangle position is in buffer coordinates; use
`Gtk.TextView.bufferToWindowCoords()` to convert these
coordinates to coordinates for one of the windows in the text view.

**Parameters**

- `iter`: a `GtkTextIter`

**Returns** Tuple of:

- `strong`: location to store the strong cursor position
- `weak`: location to store the weak cursor position

### `getCursorVisible`

```ts
getCursorVisible(): boolean
```

Find out whether the cursor should be displayed.

**Returns** whether the insertion mark is visible

### `getEditable`

```ts
getEditable(): boolean
```

Returns the default editability of the `GtkTextView`.

Tags in the buffer may override this setting for some ranges of text.

**Returns** whether text is editable by default

### `getExtraMenu`

```ts
getExtraMenu(): Gio.MenuModel | null
```

Gets the menu model that gets added to the context menu
or `null` if none has been set.

**Returns** the menu model

### `getGutter`

```ts
getGutter(win: Gtk.TextWindowType): Gtk.Widget | null
```

Gets a `GtkWidget` that has previously been set as gutter.

See `Gtk.TextView.setGutter()`.

`win` must be one of `GTK_TEXT_WINDOW_LEFT`, `GTK_TEXT_WINDOW_RIGHT`,
`GTK_TEXT_WINDOW_TOP`, or `GTK_TEXT_WINDOW_BOTTOM`.

**Parameters**

- `win`: a `GtkTextWindowType`

**Returns** a `GtkWidget`

### `getIndent`

```ts
getIndent(): number
```

Gets the default indentation of paragraphs in `text_view`.

Tags in the view’s buffer may override the default.
The indentation may be negative.

**Returns** number of pixels of indentation

### `getInputHints`

```ts
getInputHints(): Gtk.InputHints
```

Gets the `input-hints` of the `GtkTextView`.

**Returns** the input hints

### `getInputPurpose`

```ts
getInputPurpose(): Gtk.InputPurpose
```

Gets the `input-purpose` of the `GtkTextView`.

**Returns** the input purpose

### `getIterAtLocation`

```ts
getIterAtLocation(x: number, y: number): [boolean, Gtk.TextIter]
```

Retrieves the iterator at buffer coordinates `x` and `y`.

Buffer coordinates are coordinates for the entire buffer, not just
the currently-displayed portion. If you have coordinates from an
event, you have to convert those to buffer coordinates with
`Gtk.TextView.windowToBufferCoords()`.

**Parameters**

- `x`: x position, in buffer coordinates
- `y`: y position, in buffer coordinates

**Returns** Tuple of:

- `result`: `true` if the position is over text
- `iter`: a `GtkTextIter`

### `getIterAtPosition`

```ts
getIterAtPosition(x: number, y: number): [boolean, Gtk.TextIter, number]
```

Retrieves the iterator pointing to the character at buffer
coordinates `x` and `y`.

Buffer coordinates are coordinates for the entire buffer, not just
the currently-displayed portion. If you have coordinates from an event,
you have to convert those to buffer coordinates with
`Gtk.TextView.windowToBufferCoords()`.

Note that this is different from `Gtk.TextView.getIterAtLocation()`,
which returns cursor locations, i.e. positions between characters.

**Parameters**

- `x`: x position, in buffer coordinates
- `y`: y position, in buffer coordinates

**Returns** Tuple of:

- `result`: `true` if the position is over text
- `iter`: a `GtkTextIter`
- `trailing`: if non-`null`, location to store an integer indicating where in the grapheme the user clicked. It will either be zero, or the number of characters in the grapheme. 0 represents the trailing edge of the grapheme.

### `getIterLocation`

```ts
getIterLocation(iter: Gtk.TextIter): Gdk.Rectangle
```

Gets a rectangle which roughly contains the character at `iter`.

The rectangle position is in buffer coordinates; use
`Gtk.TextView.bufferToWindowCoords()` to convert these
coordinates to coordinates for one of the windows in the text view.

**Parameters**

- `iter`: a `GtkTextIter`

**Returns** bounds of the character at `iter`

### `getJustification`

```ts
getJustification(): Gtk.Justification
```

Gets the default justification of paragraphs in `text_view`.

Tags in the buffer may override the default.

**Returns** default justification

### `getLeftMargin`

```ts
getLeftMargin(): number
```

Gets the default left margin size of paragraphs in the `text_view`.

Tags in the buffer may override the default.

**Returns** left margin in pixels

### `getLineAtY`

```ts
getLineAtY(y: number): [Gtk.TextIter, number]
```

Gets the `GtkTextIter` at the start of the line containing
the coordinate `y`.

`y` is in buffer coordinates, convert from window coordinates with
`Gtk.TextView.windowToBufferCoords()`. If non-`null`,
`line_top` will be filled with the coordinate of the top edge
of the line.

**Parameters**

- `y`: a y coordinate

**Returns** Tuple of:

- `targetIter`: a `GtkTextIter`
- `lineTop`: return location for top coordinate of the line

### `getLineYrange`

```ts
getLineYrange(iter: Gtk.TextIter): [number, number]
```

Gets the y coordinate of the top of the line containing `iter`,
and the height of the line.

The coordinate is a buffer coordinate; convert to window
coordinates with `Gtk.TextView.bufferToWindowCoords()`.

**Parameters**

- `iter`: a `GtkTextIter`

**Returns** Tuple of:

- `y`: return location for a y coordinate
- `height`: return location for a height

### `getLtrContext`

```ts
getLtrContext(): Pango.Context
```

Gets the `PangoContext` that is used for rendering LTR directed
text layouts.

The context may be replaced when CSS changes occur.

**Returns** a `PangoContext`

_Available since 4.4._

### `getMonospace`

```ts
getMonospace(): boolean
```

Gets whether the `GtkTextView` uses monospace styling.

**Returns** `true` if monospace fonts are desired

### `getOverwrite`

```ts
getOverwrite(): boolean
```

Returns whether the `GtkTextView` is in overwrite mode or not.

**Returns** whether `text_view` is in overwrite mode or not.

### `getPixelsAboveLines`

```ts
getPixelsAboveLines(): number
```

Gets the default number of pixels to put above paragraphs.

Adding this function with `Gtk.TextView.getPixelsBelowLines()`
is equal to the line space between each paragraph.

**Returns** default number of pixels above paragraphs

### `getPixelsBelowLines`

```ts
getPixelsBelowLines(): number
```

Gets the default number of pixels to put below paragraphs.

The line space is the sum of the value returned by this function and
the value returned by `Gtk.TextView.getPixelsAboveLines()`.

**Returns** default number of blank pixels below paragraphs

### `getPixelsInsideWrap`

```ts
getPixelsInsideWrap(): number
```

Gets the default number of pixels to put between wrapped lines
inside a paragraph.

**Returns** default number of pixels of blank space between wrapped lines

### `getRightMargin`

```ts
getRightMargin(): number
```

Gets the default right margin for text in `text_view`.

Tags in the buffer may override the default.

**Returns** right margin in pixels

### `getRtlContext`

```ts
getRtlContext(): Pango.Context
```

Gets the `PangoContext` that is used for rendering RTL directed
text layouts.

The context may be replaced when CSS changes occur.

**Returns** a `PangoContext`

_Available since 4.4._

### `getTabs`

```ts
getTabs(): Pango.TabArray | null
```

Gets the default tabs for `text_view`.

Tags in the buffer may override the defaults. The returned array
will be `null` if “standard” (8-space) tabs are used. Free the
return value with `Pango.TabArray.free()`.

**Returns** copy of default tab array,
  or `null` if standard tabs are used; must be freed with
  `Pango.TabArray.free()`.

### `getTopMargin`

```ts
getTopMargin(): number
```

Gets the top margin for text in the `text_view`.

**Returns** top margin in pixels

### `getVisibleOffset`

```ts
getVisibleOffset(): [number | null, number | null]
```

Gets the X,Y offset in buffer coordinates of the top-left corner of
the textview's text contents.

This allows for more-precise positioning than what is provided by
`Gtk.TextView.getVisibleRect()` as you can discover what
device pixel is being quantized for text positioning.

You might want this when making ulterior widgets align with quantized
device pixels of the textview contents such as line numbers.

**Returns** Tuple of:

- `xOffset`: a location for the X offset
- `yOffset`: a location for the Y offset

_Available since 4.18._

### `getVisibleRect`

```ts
getVisibleRect(): Gdk.Rectangle
```

Fills `visible_rect` with the currently-visible
region of the buffer, in buffer coordinates.

Convert to window coordinates with
`Gtk.TextView.bufferToWindowCoords()`.

**Returns** rectangle to fill

### `getWrapMode`

```ts
getWrapMode(): Gtk.WrapMode
```

Gets the line wrapping for the view.

**Returns** the line wrap setting

### `imContextFilterKeypress`

```ts
imContextFilterKeypress(event: Gdk.Event): boolean
```

Allow the `GtkTextView` input method to internally handle key press
and release events.

If this function returns `true`, then no further processing should be
done for this key event. See `Gtk.IMContext.filterKeypress()`.

Note that you are expected to call this function from your handler
when overriding key event handling. This is needed in the case when
you need to insert your own key handling between the input method
and the default key event handling of the `GtkTextView`.

```c
static gboolean
gtk_foo_bar_key_press_event (GtkWidget *widget,
                             GdkEvent  *event)
{
  guint keyval;

  gdk_event_get_keyval ((GdkEvent*)event, &keyval);

  if (keyval == GDK_KEY_Return || keyval == GDK_KEY_KP_Enter)
    {
      if (gtk_text_view_im_context_filter_keypress (GTK_TEXT_VIEW (widget), event))
        return TRUE;
    }

  // Do some stuff

  return GTK_WIDGET_CLASS (gtk_foo_bar_parent_class)->key_press_event (widget, event);
}
```

**Parameters**

- `event`: the key event

**Returns** `true` if the input method handled the key event.

### `moveMarkOnscreen`

```ts
moveMarkOnscreen(mark: Gtk.TextMark): boolean
```

Moves a mark within the buffer so that it's
located within the currently-visible text area.

**Parameters**

- `mark`: a `GtkTextMark`

**Returns** `true` if the mark moved (wasn’t already onscreen)

### `moveOverlay`

```ts
moveOverlay(child: Gtk.Widget, xpos: number, ypos: number): void
```

Updates the position of a child.

See `Gtk.TextView.addOverlay()`.

**Parameters**

- `child`: a widget already added with `Gtk.TextView.addOverlay()`
- `xpos`: new X position in buffer coordinates
- `ypos`: new Y position in buffer coordinates

### `moveVisually`

```ts
moveVisually(iter: Gtk.TextIter, count: number): boolean
```

Move the iterator a given number of characters visually, treating
it as the strong cursor position.

If `count` is positive, then the new strong cursor position will
be `count` positions to the right of the old cursor position.
If `count` is negative then the new strong cursor position will
be `count` positions to the left of the old cursor position.

In the presence of bi-directional text, the correspondence
between logical and visual order will depend on the direction
of the current run, and there may be jumps when the cursor
is moved off of the end of a run.

**Parameters**

- `iter`: a `GtkTextIter`
- `count`: number of characters to move (negative moves left, positive moves right)

**Returns** `true` if `iter` moved and is not on the end iterator

### `placeCursorOnscreen`

```ts
placeCursorOnscreen(): boolean
```

Moves the cursor to the currently visible region of the
buffer.

**Returns** `true` if the cursor had to be moved.

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes a child widget from `text_view`.

**Parameters**

- `child`: the child to remove

### `resetCursorBlink`

```ts
resetCursorBlink(): void
```

Ensures that the cursor is shown.

This also resets the time that it will stay blinking (or
visible, in case blinking is disabled).

This function should be called in response to user input
(e.g. from derived classes that override the textview's
event handlers).

### `resetImContext`

```ts
resetImContext(): void
```

Reset the input method context of the text view if needed.

This can be necessary in the case where modifying the buffer
would confuse on-going input method behavior.

### `scrollMarkOnscreen`

```ts
scrollMarkOnscreen(mark: Gtk.TextMark): void
```

Scrolls `text_view` the minimum distance such that `mark` is contained
within the visible area of the widget.

**Parameters**

- `mark`: a mark in the buffer for `text_view`

### `scrollToIter`

```ts
scrollToIter(iter: Gtk.TextIter, withinMargin: number, useAlign: boolean, xalign: number, yalign: number): boolean
```

Scrolls `text_view` so that `iter` is on the screen in the position
indicated by `xalign` and `yalign`.

An alignment of 0.0 indicates left or top, 1.0 indicates right or
bottom, 0.5 means center. If `use_align` is `false`, the text scrolls
the minimal distance to get the mark onscreen, possibly not scrolling
at all. The effective screen for purposes of this function is reduced
by a margin of size `within_margin`.

Note that this function uses the currently-computed height of the
lines in the text buffer. Line heights are computed in an idle
handler; so this function may not have the desired effect if it’s
called before the height computations. To avoid oddness, consider
using `Gtk.TextView.scrollToMark()` which saves a point to be
scrolled to after line validation.

**Parameters**

- `iter`: a `GtkTextIter`
- `withinMargin`: margin as a [0.0,0.5) fraction of screen size
- `useAlign`: whether to use alignment arguments (if `false`, just get the mark onscreen)
- `xalign`: horizontal alignment of mark within visible area
- `yalign`: vertical alignment of mark within visible area

**Returns** `true` if scrolling occurred

### `scrollToMark`

```ts
scrollToMark(mark: Gtk.TextMark, withinMargin: number, useAlign: boolean, xalign: number, yalign: number): void
```

Scrolls `text_view` so that `mark` is on the screen in the position
indicated by `xalign` and `yalign`.

An alignment of 0.0 indicates left or top, 1.0 indicates right or
bottom, 0.5 means center. If `use_align` is `false`, the text scrolls
the minimal distance to get the mark onscreen, possibly not scrolling
at all. The effective screen for purposes of this function is reduced
by a margin of size `within_margin`.

**Parameters**

- `mark`: a `GtkTextMark`
- `withinMargin`: margin as a [0.0,0.5) fraction of screen size
- `useAlign`: whether to use alignment arguments (if `false`, just get the mark onscreen)
- `xalign`: horizontal alignment of mark within visible area
- `yalign`: vertical alignment of mark within visible area

### `setAcceptsTab`

```ts
setAcceptsTab(acceptsTab: boolean): void
```

Sets the behavior of the text widget when the <kbd>Tab</kbd> key is pressed.

If `accepts_tab` is `true`, a tab character is inserted. If `accepts_tab`
is `false` the keyboard focus is moved to the next widget in the focus
chain.

Focus can always be moved using <kbd>Ctrl</kbd>+<kbd>Tab</kbd>.

**Parameters**

- `acceptsTab`: `true` if pressing the Tab key should insert a tab character, `false`, if pressing the Tab key should move the keyboard focus.

### `setBottomMargin`

```ts
setBottomMargin(bottomMargin: number): void
```

Sets the bottom margin for text in `text_view`.

Note that this function is confusingly named.
In CSS terms, the value set here is padding.

**Parameters**

- `bottomMargin`: bottom margin in pixels

### `setBuffer`

```ts
setBuffer(buffer: Gtk.TextBuffer | null): void
```

Sets `buffer` as the buffer being displayed by `text_view`.

The previous buffer displayed by the text view is unreferenced, and
a reference is added to `buffer`. If you owned a reference to `buffer`
before passing it to this function, you must remove that reference
yourself; `GtkTextView` will not “adopt” it.

**Parameters**

- `buffer`: a `GtkTextBuffer`

### `setCursorVisible`

```ts
setCursorVisible(setting: boolean): void
```

Toggles whether the insertion point should be displayed.

A buffer with no editable text probably shouldn’t have a visible
cursor, so you may want to turn the cursor off.

Note that this property may be overridden by the
`Gtk.Settings.gtkKeynavUseCaret` setting.

**Parameters**

- `setting`: whether to show the insertion cursor

### `setEditable`

```ts
setEditable(setting: boolean): void
```

Sets the default editability of the `GtkTextView`.

You can override this default setting with tags in the buffer,
using the “editable” attribute of tags.

**Parameters**

- `setting`: whether it’s editable

### `setExtraMenu`

```ts
setExtraMenu(model: Gio.MenuModel | null): void
```

Sets a menu model to add when constructing the context
menu for `text_view`.

You can pass `null` to remove a previously set extra menu.

**Parameters**

- `model`: a `GMenuModel`

### `setGutter`

```ts
setGutter(win: Gtk.TextWindowType, widget: Gtk.Widget | null): void
```

Places `widget` into the gutter specified by `win`.

`win` must be one of `GTK_TEXT_WINDOW_LEFT`, `GTK_TEXT_WINDOW_RIGHT`,
`GTK_TEXT_WINDOW_TOP`, or `GTK_TEXT_WINDOW_BOTTOM`.

**Parameters**

- `win`: a `GtkTextWindowType`
- `widget`: a `GtkWidget`

### `setIndent`

```ts
setIndent(indent: number): void
```

Sets the default indentation for paragraphs in `text_view`.

Tags in the buffer may override the default.

**Parameters**

- `indent`: indentation in pixels

### `setInputHints`

```ts
setInputHints(hints: Gtk.InputHints): void
```

Sets the `input-hints` of the `GtkTextView`.

The `input-hints` allow input methods to fine-tune
their behaviour.

**Parameters**

- `hints`: the hints

### `setInputPurpose`

```ts
setInputPurpose(purpose: Gtk.InputPurpose): void
```

Sets the `input-purpose` of the `GtkTextView`.

The `input-purpose` can be used by on-screen keyboards
and other input methods to adjust their behaviour.

**Parameters**

- `purpose`: the purpose

### `setJustification`

```ts
setJustification(justification: Gtk.Justification): void
```

Sets the default justification of text in `text_view`.

Tags in the view’s buffer may override the default.

**Parameters**

- `justification`: justification

### `setLeftMargin`

```ts
setLeftMargin(leftMargin: number): void
```

Sets the default left margin for text in `text_view`.

Tags in the buffer may override the default.

Note that this function is confusingly named.
In CSS terms, the value set here is padding.

**Parameters**

- `leftMargin`: left margin in pixels

### `setMonospace`

```ts
setMonospace(monospace: boolean): void
```

Sets whether the `GtkTextView` should display text in
monospace styling.

**Parameters**

- `monospace`: `true` to request monospace styling

### `setOverwrite`

```ts
setOverwrite(overwrite: boolean): void
```

Changes the `GtkTextView` overwrite mode.

**Parameters**

- `overwrite`: `true` to turn on overwrite mode, `false` to turn it off

### `setPixelsAboveLines`

```ts
setPixelsAboveLines(pixelsAboveLines: number): void
```

Sets the default number of blank pixels above paragraphs in `text_view`.

Tags in the buffer for `text_view` may override the defaults.

**Parameters**

- `pixelsAboveLines`: pixels above paragraphs

### `setPixelsBelowLines`

```ts
setPixelsBelowLines(pixelsBelowLines: number): void
```

Sets the default number of pixels of blank space
to put below paragraphs in `text_view`.

May be overridden by tags applied to `text_view`’s buffer.

**Parameters**

- `pixelsBelowLines`: pixels below paragraphs

### `setPixelsInsideWrap`

```ts
setPixelsInsideWrap(pixelsInsideWrap: number): void
```

Sets the default number of pixels of blank space to leave between
display/wrapped lines within a paragraph.

May be overridden by tags in `text_view`’s buffer.

**Parameters**

- `pixelsInsideWrap`: default number of pixels between wrapped lines

### `setRightMargin`

```ts
setRightMargin(rightMargin: number): void
```

Sets the default right margin for text in the text view.

Tags in the buffer may override the default.

Note that this function is confusingly named.
In CSS terms, the value set here is padding.

**Parameters**

- `rightMargin`: right margin in pixels

### `setTabs`

```ts
setTabs(tabs: Pango.TabArray): void
```

Sets the default tab stops for paragraphs in `text_view`.

Tags in the buffer may override the default.

**Parameters**

- `tabs`: tabs as a `PangoTabArray`

### `setTopMargin`

```ts
setTopMargin(topMargin: number): void
```

Sets the top margin for text in `text_view`.

Note that this function is confusingly named.
In CSS terms, the value set here is padding.

**Parameters**

- `topMargin`: top margin in pixels

### `setWrapMode`

```ts
setWrapMode(wrapMode: Gtk.WrapMode): void
```

Sets the line wrapping for the view.

**Parameters**

- `wrapMode`: a `GtkWrapMode`

### `startsDisplayLine`

```ts
startsDisplayLine(iter: Gtk.TextIter): boolean
```

Determines whether `iter` is at the start of a display line.

See `Gtk.TextView.forwardDisplayLine()` for an
explanation of display lines vs. paragraphs.

**Parameters**

- `iter`: a `GtkTextIter`

**Returns** `true` if `iter` begins a wrapped line

### `windowToBufferCoords`

```ts
windowToBufferCoords(win: Gtk.TextWindowType, windowX: number, windowY: number): [number, number]
```

Converts coordinates on the window identified by `win` to buffer
coordinates.

**Parameters**

- `win`: a `GtkTextWindowType`
- `windowX`: window x coordinate
- `windowY`: window y coordinate

**Returns** Tuple of:

- `bufferX`: buffer x coordinate return location
- `bufferY`: buffer y coordinate return location
