---
description: "Allows users to edit the displayed text by switching to an “edit mode”."
---

# GtkEditableLabel

Allows users to edit the displayed text by switching to an “edit mode”.



`GtkEditableLabel` does not have API of its own, but it
implements the `Gtk.Editable` interface.

The default bindings for activating the edit mode is
to click or press the Enter key. The default bindings
for leaving the edit mode are the Enter key (to save
the results) or the Escape key (to cancel the editing).

## Shortcuts and Gestures

`GtkEditableLabel` supports the following keyboard shortcuts:

- <kbd>Enter</kbd> starts editing.
- <kbd>Escape</kbd> stops editing.

## Actions

`GtkEditableLabel` defines a set of built-in actions:

- `editing.starts` switches the widget into editing mode.
- `editing.stop` switches the widget out of editing mode.

## CSS nodes

```
editablelabel[.editing]
╰── stack
    ├── label
    ╰── text
```

`GtkEditableLabel` has a main node with the name editablelabel.
When the entry is in editing mode, it gets the .editing style
class.

For all the subnodes added to the text node in various situations,
see `Gtk.Text`.

```tsx
import { GtkEditableLabel } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkEditableLabel**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkEditable`.

## Props

`ref` receives the `Gtk.EditableLabel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `cursorPosition`

`number` · default `0` · read-only, observe with `onNotifyCursorPosition` · from `GtkEditable`

The current position of the insertion cursor in chars.

### `editable`

`boolean` · default `true` · from `GtkEditable`

Whether the entry contents can be edited.

### `editing`

`boolean` · default `false`

This property is `true` while the widget is in edit mode.

### `enableUndo`

`boolean` · default `true` · from `GtkEditable`

If undo/redo should be enabled for the editable.

### `maxWidthChars`

`number` · default `-1` · from `GtkEditable`

The desired maximum width of the entry, in characters.

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

### `onChanged`

```ts
(self: Gtk.EditableLabel) => void
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
(startPos: number, endPos: number, self: Gtk.EditableLabel) => void
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
(text: string, length: number, position: number, self: Gtk.EditableLabel) => number
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

Methods are called on the `Gtk.EditableLabel` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getEditing`

```ts
getEditing(): boolean
```

Returns whether the label is currently in “editing mode”.

**Returns** `true` if `self` is currently in editing mode

### `startEditing`

```ts
startEditing(): void
```

Switches the label into “editing mode”.

### `stopEditing`

```ts
stopEditing(commit: boolean): void
```

Switches the label out of “editing mode”.

If `commit` is `true`, the resulting text is kept as the
`Gtk.Editable.text` property value, otherwise the
resulting text is discarded and the label will keep its
previous `Gtk.Editable.text` property value.

**Parameters**

- `commit`: whether to set the edited text on the label
