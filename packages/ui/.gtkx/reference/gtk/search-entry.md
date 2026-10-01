---
description: "A single-line text entry widget for use as a search entry."
---

# GtkSearchEntry

A single-line text entry widget for use as a search entry.

The main API for interacting with a `GtkSearchEntry` as entry
is the `GtkEditable` interface.



It will show an inactive symbolic “find” icon when the search
entry is empty, and a symbolic “clear” icon when there is text.
Clicking on the “clear” icon will empty the search entry.

To make filtering appear more reactive, it is a good idea to
not react to every change in the entry text immediately, but
only after a short delay. To support this, `GtkSearchEntry`
emits the `Gtk.SearchEntry.search-changed` signal which
can be used instead of the `Gtk.Editable.changed` signal.

The `Gtk.SearchEntry.previous-match`,
`Gtk.SearchEntry.next-match` and
`Gtk.SearchEntry.stop-search` signals can be used to
implement moving between search results and ending the search.

Often, `GtkSearchEntry` will be fed events by means of being
placed inside a `Gtk.SearchBar`. If that is not the case,
you can use `Gtk.SearchEntry.setKeyCaptureWidget()` to
let it capture key input from another widget.

`GtkSearchEntry` provides only minimal API and should be used with
the `Gtk.Editable` API.

### Shortcuts and Gestures

The following signals have default keybindings:

- `Gtk.SearchEntry.activate`
- `Gtk.SearchEntry.next-match`
- `Gtk.SearchEntry.previous-match`
- `Gtk.SearchEntry.stop-search`

### CSS Nodes

```
entry.search
╰── text
```

`GtkSearchEntry` has a single CSS node with name entry that carries
a `.search` style class, and the text node is a child of that.

### Accessibility

`GtkSearchEntry` uses the `Gtk.AccessibleRole.search_box` role.

```tsx
import { GtkSearchEntry } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkSearchEntry**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkEditable`.

## Props

`ref` receives the `Gtk.SearchEntry` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `activatesDefault`

`boolean` · default `false`

Whether to activate the default widget when Enter is pressed.

### `cursorPosition`

`number` · default `0` · read-only, observe with `onNotifyCursorPosition` · from `GtkEditable`

The current position of the insertion cursor in chars.

### `editable`

`boolean` · default `true` · from `GtkEditable`

Whether the entry contents can be edited.

### `enableUndo`

`boolean` · default `true` · from `GtkEditable`

If undo/redo should be enabled for the editable.

### `inputHints`

`Gtk.InputHints` · default `GTK_INPUT_HINT_NONE`

The hints about input for the `GtkSearchEntry` used to alter the
behaviour of input methods.

_Available since 4.14._

### `inputPurpose`

`Gtk.InputPurpose` · default `GTK_INPUT_PURPOSE_FREE_FORM`

The purpose for the `GtkSearchEntry` input used to alter the
behaviour of input methods.

_Available since 4.14._

### `keyCaptureWidget`

`Gtk.Widget | ReactElement`

The widget that the entry will use to capture key events.

Key events are consumed by the search entry to start or continue a search.

_Available since 4.22._

### `maxWidthChars`

`number` · default `-1` · from `GtkEditable`

The desired maximum width of the entry, in characters.

### `placeholderText`

`string` · default `null`

The text that will be displayed in the `GtkSearchEntry`
when it is empty and unfocused.

### `searchDelay`

`number` · default `150`

The delay in milliseconds from last keypress to the search
changed signal.

_Available since 4.8._

### `selectionBound`

`number` · default `0` · read-only, observe with `onNotifySelectionBound` · from `GtkEditable`

The position of the opposite end of the selection from the cursor in chars.

### `text`

`string` · from `GtkEditable`

The contents of the entry.

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
(self: Gtk.SearchEntry) => void
```

Emitted when the entry is activated.

The keybindings for this signal are all forms of the <kbd>Enter</kbd> key.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onChanged`

```ts
(self: Gtk.SearchEntry) => void
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

### `onDeleteText`

```ts
(startPos: number, endPos: number, self: Gtk.SearchEntry) => void
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

### `onInsertText`

```ts
(text: string, length: number, position: number, self: Gtk.SearchEntry) => number
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

### `onNextMatch`

```ts
(self: Gtk.SearchEntry) => void
```

Emitted when the user initiates a move to the next match
for the current search string.

This is a [keybinding signal](class.SignalAction.html).

Applications should connect to it, to implement moving
between matches.

The default bindings for this signal is <kbd>Ctrl</kbd>+<kbd>g</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onPreviousMatch`

```ts
(self: Gtk.SearchEntry) => void
```

Emitted when the user initiates a move to the previous match
for the current search string.

This is a [keybinding signal](class.SignalAction.html).

Applications should connect to it, to implement moving
between matches.

The default bindings for this signal is
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>g</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onSearchChanged`

```ts
(self: Gtk.SearchEntry) => void
```

Emitted with a delay. The length of the delay can be
changed with the `Gtk.SearchEntry.searchDelay`
property.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onSearchStarted`

```ts
(self: Gtk.SearchEntry) => void
```

Emitted when the user initiated a search on the entry.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onStopSearch`

```ts
(self: Gtk.SearchEntry) => void
```

Emitted when the user stops a search via keyboard input.

This is a [keybinding signal](class.SignalAction.html).

Applications should connect to it, to implement hiding
the search entry in this case.

The default bindings for this signal is <kbd>Escape</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.SearchEntry` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getInputHints`

```ts
getInputHints(): Gtk.InputHints
```

Gets the input purpose for `entry`.

**Returns** The input hints

_Available since 4.14._

### `getInputPurpose`

```ts
getInputPurpose(): Gtk.InputPurpose
```

Gets the input purpose of `entry`.

**Returns** The input hints

_Available since 4.14._

### `getKeyCaptureWidget`

```ts
getKeyCaptureWidget(): Gtk.Widget | null
```

Gets the widget that `entry` is capturing key events from.

**Returns** The key capture widget.

### `getPlaceholderText`

```ts
getPlaceholderText(): string | null
```

Gets the placeholder text associated with `entry`.

**Returns** The placeholder text.

_Available since 4.10._

### `getSearchDelay`

```ts
getSearchDelay(): number
```

Get the delay to be used between the last keypress and the
`Gtk.SearchEntry.search-changed` signal being emitted.

**Returns** a delay in milliseconds.

_Available since 4.8._

### `setInputHints`

```ts
setInputHints(hints: Gtk.InputHints): void
```

Sets the input hints for `entry`.

**Parameters**

- `hints`: the new input hints

_Available since 4.14._

### `setInputPurpose`

```ts
setInputPurpose(purpose: Gtk.InputPurpose): void
```

Sets the input purpose of `entry`.

**Parameters**

- `purpose`: the new input purpose

_Available since 4.14._

### `setKeyCaptureWidget`

```ts
setKeyCaptureWidget(widget: Gtk.Widget | null): void
```

Sets `widget` as the widget that `entry` will capture key
events from.

Key events are consumed by the search entry to start or
continue a search.

If the entry is part of a `GtkSearchBar`, it is preferable
to call `Gtk.SearchBar.setKeyCaptureWidget()` instead,
which will reveal the entry in addition to triggering the
search entry.

Note that despite the name of this function, the events
are only 'captured' in the bubble phase, which means that
editable child widgets of `widget` will receive text input
before it gets captured. If that is not desired, you can
capture and forward the events yourself with
`Gtk.EventControllerKey.forward()`.

**Parameters**

- `widget`: a `GtkWidget`

### `setPlaceholderText`

```ts
setPlaceholderText(text: string | null): void
```

Sets the placeholder text associated with `entry`.

**Parameters**

- `text`: the text to set as a placeholder

_Available since 4.10._

### `setSearchDelay`

```ts
setSearchDelay(delay: number): void
```

Set the delay to be used between the last keypress and the
`Gtk.SearchEntry.search-changed` signal being emitted.

**Parameters**

- `delay`: a delay in milliseconds

_Available since 4.8._
