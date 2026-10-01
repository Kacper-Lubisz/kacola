---
description: "A Gtk.ListBoxRow with an embedded text entry."
---

# AdwEntryRow

A `Gtk.ListBoxRow` with an embedded text entry.



`AdwEntryRow` has a title that doubles as placeholder text. It shows an icon
indicating that it's editable and can receive additional widgets before or
after the editable part.

If `EntryRow.showApplyButton` is set to `TRUE`, `AdwEntryRow` can
show an apply button when editing its contents. This can be useful if
changing its contents can result in an expensive operation, such as network
activity.

`AdwEntryRow` provides only minimal API and should be used with the
`Gtk.Editable` API.

See also `PasswordEntryRow`.

### AdwEntryRow as GtkBuildable

The `AdwEntryRow` implementation of the `Gtk.Buildable` interface
supports adding a child at its end by specifying “suffix” or omitting the
“type” attribute of a <child> element.

It also supports adding a child as a prefix widget by specifying “prefix” as
the “type” attribute of a <child> element.

### CSS nodes

`AdwEntryRow` has a single CSS node with name `row` and the `.entry` style
class.

_Available since 1.2._

```tsx
import { AdwEntryRow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkListBoxRow](.gtkx/reference/gtk/list-box-row.md) → [AdwPreferencesRow](.gtkx/reference/adw/preferences-row.md) → **AdwEntryRow**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`, `GtkEditable`.

## Props

`ref` receives the `Adw.EntryRow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `activatesDefault`

`boolean` · default `false`

Whether activating the embedded entry can activate the default widget.

_Available since 1.2._

### `attributes`

`Pango.AttrList`

A list of Pango attributes to apply to the text of the embedded entry.

The `Pango.Attribute`'s `start_index` and `end_index` must refer to
the `Gtk.EntryBuffer` text, i.e. without the preedit string.

_Available since 1.2._

### `cursorPosition`

`number` · default `0` · read-only, observe with `onNotifyCursorPosition` · from `GtkEditable`

The current position of the insertion cursor in chars.

### `editable`

`boolean` · default `true` · from `GtkEditable`

Whether the entry contents can be edited.

### `enableEmojiCompletion`

`boolean` · default `false`

Whether to suggest emoji replacements on the entry row.

Emoji replacement is done with :-delimited names, like `:heart:`.

_Available since 1.2._

### `enableUndo`

`boolean` · default `true` · from `GtkEditable`

If undo/redo should be enabled for the editable.

### `inputHints`

`Gtk.InputHints` · default `GTK_INPUT_HINT_NONE`

Additional input hints for the entry row.

Input hints allow input methods to fine-tune their behavior.

See also: `Adw.EntryRow.inputPurpose`

_Available since 1.2._

### `inputPurpose`

`Gtk.InputPurpose` · default `GTK_INPUT_PURPOSE_FREE_FORM`

The input purpose of the entry row.

The input purpose can be used by input methods to adjust their behavior.

_Available since 1.2._

### `maxLength`

`number` · default `0`

Maximum number of characters for the entry.

_Available since 1.6._

### `maxWidthChars`

`number` · default `-1` · from `GtkEditable`

The desired maximum width of the entry, in characters.

### `prefix`

`ReactNode | null`

Widgets added at the start of the row, before its title.

### `selectionBound`

`number` · default `0` · read-only, observe with `onNotifySelectionBound` · from `GtkEditable`

The position of the opposite end of the selection from the cursor in chars.

### `showApplyButton`

`boolean` · default `false`

Whether to show the apply button.

When set to `TRUE`, typing text in the entry will reveal an apply button.
Clicking it or pressing the <kbd>Enter</kbd> key will hide the button and
emit the `EntryRow.apply` signal.

This is useful if changing the entry contents can trigger an expensive
operation, e.g. network activity, to avoid triggering it after typing every
character.

_Available since 1.2._

### `suffix`

`ReactNode | null`

Widgets added at the end of the row.

### `text`

`string` · from `GtkEditable`

The contents of the entry.

### `textLength`

`number` · default `0` · read-only, observe with `onNotifyTextLength`

The length of the text in the entry row.

_Available since 1.5._

### `widthChars`

`number` · default `-1` · from `GtkEditable`

Number of characters to leave space for in the entry.

### `xalign`

`number` · default `0.000000` · from `GtkEditable`

The horizontal alignment, from 0 (left) to 1 (right).

Reversed for RTL layouts.

## Signals

### `onApply`

```ts
(self: Adw.EntryRow) => void
```

Emitted when the apply button is pressed.

See `EntryRow.showApplyButton`.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.2._

### `onChanged`

```ts
(self: Adw.EntryRow) => void
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
(startPos: number, endPos: number, self: Adw.EntryRow) => void
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

### `onEntryActivated`

```ts
(self: Adw.EntryRow) => void
```

Emitted when the embedded entry is activated.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.2._

### `onInsertText`

```ts
(text: string, length: number, position: number, self: Adw.EntryRow) => number
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

## Methods

Methods are called on the `Adw.EntryRow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addPrefix`

```ts
addPrefix(widget: Gtk.Widget): void
```

Adds a prefix widget to `self`.

**Parameters**

- `widget`: a widget

_Available since 1.2._

### `addSuffix`

```ts
addSuffix(widget: Gtk.Widget): void
```

Adds a suffix widget to `self`.

**Parameters**

- `widget`: a widget

_Available since 1.2._

### `getActivatesDefault`

```ts
getActivatesDefault(): boolean
```

Gets whether activating the embedded entry can activate the default widget.

**Returns** whether to activate the default widget

_Available since 1.2._

### `getAttributes`

```ts
getAttributes(): Pango.AttrList | null
```

Gets Pango attributes applied to the text of the embedded entry.

**Returns** the list of attributes

_Available since 1.2._

### `getEnableEmojiCompletion`

```ts
getEnableEmojiCompletion(): boolean
```

Gets whether to suggest emoji replacements on `self`.

**Returns** whether or not emoji completion is enabled

_Available since 1.2._

### `getInputHints`

```ts
getInputHints(): Gtk.InputHints
```

Gets the additional input hints of `self`.

**Returns** The input hints

_Available since 1.2._

### `getInputPurpose`

```ts
getInputPurpose(): Gtk.InputPurpose
```

Gets the input purpose of `self`.

**Returns** the input purpose

_Available since 1.2._

### `getMaxLength`

```ts
getMaxLength(): number
```

Retrieves the maximum length of the entry.

**Returns** The maximum length of the entry.

_Available since 1.6._

### `getShowApplyButton`

```ts
getShowApplyButton(): boolean
```

Gets whether `self` can show the apply button.

**Returns** whether to show the apply button

_Available since 1.2._

### `getTextLength`

```ts
getTextLength(): number
```

Retrieves the current length of the text in `self`.

**Returns** The current number of characters in `self`, or 0 if there are none.

_Available since 1.5._

### `grabFocusWithoutSelecting`

```ts
grabFocusWithoutSelecting(): boolean
```

Causes `self` to have keyboard focus without selecting the text.

See `Gtk.Text.grabFocusWithoutSelecting()` for more information.

**Returns** whether the focus is now inside `self`

_Available since 1.3._

### `remove`

```ts
remove(widget: Gtk.Widget): void
```

Removes a child from `self`.

**Parameters**

- `widget`: the child to be removed

_Available since 1.2._

### `setActivatesDefault`

```ts
setActivatesDefault(activates: boolean): void
```

Sets whether activating the embedded entry can activate the default widget.

**Parameters**

- `activates`: whether to activate the default widget

_Available since 1.2._

### `setAttributes`

```ts
setAttributes(attributes: Pango.AttrList | null): void
```

Sets Pango attributes to apply to the text of the embedded entry.

The `Pango.Attribute`'s `start_index` and `end_index` must refer to
the `Gtk.EntryBuffer` text, i.e. without the preedit string.

**Parameters**

- `attributes`: a list of attributes

_Available since 1.2._

### `setEnableEmojiCompletion`

```ts
setEnableEmojiCompletion(enableEmojiCompletion: boolean): void
```

Sets whether to suggest emoji replacements on `self`.

Emoji replacement is done with :-delimited names, like `:heart:`.

**Parameters**

- `enableEmojiCompletion`: Whether emoji completion should be enabled or not

_Available since 1.2._

### `setInputHints`

```ts
setInputHints(hints: Gtk.InputHints): void
```

Set additional input hints for `self`.

Input hints allow input methods to fine-tune their behavior.

See also: `AdwEntryRow.inputPurpose`

**Parameters**

- `hints`: the hints

_Available since 1.2._

### `setInputPurpose`

```ts
setInputPurpose(purpose: Gtk.InputPurpose): void
```

Sets the input purpose of `self`.

The input purpose can be used by input methods to adjust their behavior.

**Parameters**

- `purpose`: the purpose

_Available since 1.2._

### `setMaxLength`

```ts
setMaxLength(maxLength: number): void
```

Sets the maximum length of the entry.

**Parameters**

- `maxLength`: maximum length of the entry

_Available since 1.6._

### `setShowApplyButton`

```ts
setShowApplyButton(showApplyButton: boolean): void
```

Sets whether `self` can show the apply button.

When set to `TRUE`, typing text in the entry will reveal an apply button.
Clicking it or pressing the <kbd>Enter</kbd> key will hide the button and
emit the `EntryRow.apply` signal.

This is useful if changing the entry contents can trigger an expensive
operation, e.g. network activity, to avoid triggering it after typing every
character.

**Parameters**

- `showApplyButton`: whether to show the apply button

_Available since 1.2._
