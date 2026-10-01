---
description: "Stores text and attributes for display in a GtkTextView."
---

# GtkTextBuffer

Stores text and attributes for display in a `GtkTextView`.

You may wish to begin by reading the
[text widget conceptual overview](section-text-widget.html),
which gives an overview of all the objects and data types
related to the text widget and how they work together.

GtkTextBuffer can support undoing changes to the buffer
content, see `Gtk.TextBuffer.setEnableUndo()`.

```tsx
import { GtkTextBuffer } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkTextBuffer**

## Props

`ref` receives the `Gtk.TextBuffer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `canRedo`

`boolean` · default `false` · read-only, observe with `onNotifyCanRedo`

Denotes that the buffer can reapply the last undone action.

### `canUndo`

`boolean` · default `false` · read-only, observe with `onNotifyCanUndo`

Denotes that the buffer can undo the last applied action.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `cursorPosition`

`number` · default `0` · read-only, observe with `onNotifyCursorPosition`

The position of the insert mark.

This is an offset from the beginning of the buffer.
It is useful for getting notified when the cursor moves.

### `enableUndo`

`boolean` · default `true`

Denotes if support for undoing and redoing changes to the buffer is allowed.

### `hasSelection`

`boolean` · default `false` · read-only, observe with `onNotifyHasSelection`

Whether the buffer has some text currently selected.

### `tagTable`

`Gtk.TextTagTable` · construct-only

The GtkTextTagTable for the buffer.

### `text`

`string`

The text content of the buffer.

Without child widgets and images,
see `Gtk.TextBuffer.getText()` for more information.

## Signals

### `onApplyTag`

```ts
(tag: Gtk.TextTag, start: Gtk.TextIter, end: Gtk.TextIter, self: Gtk.TextBuffer) => void
```

Emitted to apply a tag to a range of text in a `GtkTextBuffer`.

Applying actually occurs in the default handler.

Note that if your handler runs before the default handler
it must not invalidate the `start` and `end` iters (or has to
revalidate them).

See also:
`Gtk.TextBuffer.applyTag()`,
`Gtk.TextBuffer.insertWithTags()`,
`Gtk.TextBuffer.insertRange()`.

**Parameters**

- `tag`: the applied tag
- `start`: the start of the range the tag is applied to
- `end`: the end of the range the tag is applied to
- `self`: The instance the signal was emitted on.

### `onBeginUserAction`

```ts
(self: Gtk.TextBuffer) => void
```

Emitted at the beginning of a single user-visible
operation on a `GtkTextBuffer`.

See also:
`Gtk.TextBuffer.beginUserAction()`,
`Gtk.TextBuffer.insertInteractive()`,
`Gtk.TextBuffer.insertRangeInteractive()`,
`Gtk.TextBuffer.deleteInteractive()`,
`Gtk.TextBuffer.backspace()`,
`Gtk.TextBuffer.deleteSelection()`.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onChanged`

```ts
(self: Gtk.TextBuffer) => void
```

Emitted when the content of a `GtkTextBuffer` has changed.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onDeleteRange`

```ts
(start: Gtk.TextIter, end: Gtk.TextIter, self: Gtk.TextBuffer) => void
```

Emitted to delete a range from a `GtkTextBuffer`.

Note that if your handler runs before the default handler
it must not invalidate the `start` and `end` iters (or has
to revalidate them). The default signal handler revalidates
the `start` and `end` iters to both point to the location
where text was deleted. Handlers which run after the default
handler (see `g_signal_connect_after()`) do not have access to
the deleted text.

See also: `Gtk.TextBuffer.delete()`.

**Parameters**

- `start`: the start of the range to be deleted
- `end`: the end of the range to be deleted
- `self`: The instance the signal was emitted on.

### `onEndUserAction`

```ts
(self: Gtk.TextBuffer) => void
```

Emitted at the end of a single user-visible
operation on the `GtkTextBuffer`.

See also:
`Gtk.TextBuffer.endUserAction()`,
`Gtk.TextBuffer.insertInteractive()`,
`Gtk.TextBuffer.insertRangeInteractive()`,
`Gtk.TextBuffer.deleteInteractive()`,
`Gtk.TextBuffer.backspace()`,
`Gtk.TextBuffer.deleteSelection()`,
`Gtk.TextBuffer.backspace()`.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onInsertChildAnchor`

```ts
(location: Gtk.TextIter, anchor: Gtk.TextChildAnchor, self: Gtk.TextBuffer) => void
```

Emitted to insert a `GtkTextChildAnchor` in a `GtkTextBuffer`.

Insertion actually occurs in the default handler.

Note that if your handler runs before the default handler
it must not invalidate the `location` iter (or has to
revalidate it). The default signal handler revalidates
it to be placed after the inserted `anchor`.

See also: `Gtk.TextBuffer.insertChildAnchor()`.

**Parameters**

- `location`: position to insert `anchor` in `textbuffer`
- `anchor`: the `GtkTextChildAnchor` to be inserted
- `self`: The instance the signal was emitted on.

### `onInsertPaintable`

```ts
(location: Gtk.TextIter, paintable: Gdk.Paintable, self: Gtk.TextBuffer) => void
```

Emitted to insert a `GdkPaintable` in a `GtkTextBuffer`.

Insertion actually occurs in the default handler.

Note that if your handler runs before the default handler
it must not invalidate the `location` iter (or has to
revalidate it). The default signal handler revalidates
it to be placed after the inserted `paintable`.

See also: `Gtk.TextBuffer.insertPaintable()`.

**Parameters**

- `location`: position to insert `paintable` in `textbuffer`
- `paintable`: the `GdkPaintable` to be inserted
- `self`: The instance the signal was emitted on.

### `onInsertText`

```ts
(location: Gtk.TextIter, text: string, len: number, self: Gtk.TextBuffer) => void
```

Emitted to insert text in a `GtkTextBuffer`.

Insertion actually occurs in the default handler.

Note that if your handler runs before the default handler
it must not invalidate the `location` iter (or has to
revalidate it). The default signal handler revalidates
it to point to the end of the inserted text.

See also: `Gtk.TextBuffer.insert()`,
`Gtk.TextBuffer.insertRange()`.

**Parameters**

- `location`: position to insert `text` in `textbuffer`
- `text`: the UTF-8 text to be inserted
- `len`: length of the inserted text in bytes
- `self`: The instance the signal was emitted on.

### `onMarkDeleted`

```ts
(mark: Gtk.TextMark, self: Gtk.TextBuffer) => void
```

Emitted as notification after a `GtkTextMark` is deleted.

See also: `Gtk.TextBuffer.deleteMark()`.

**Parameters**

- `mark`: The mark that was deleted
- `self`: The instance the signal was emitted on.

### `onMarkSet`

```ts
(location: Gtk.TextIter, mark: Gtk.TextMark, self: Gtk.TextBuffer) => void
```

Emitted as notification after a `GtkTextMark` is set.

See also:
`Gtk.TextBuffer.createMark()`,
`Gtk.TextBuffer.moveMark()`.

**Parameters**

- `location`: The location of `mark` in `textbuffer`
- `mark`: The mark that is set
- `self`: The instance the signal was emitted on.

### `onModifiedChanged`

```ts
(self: Gtk.TextBuffer) => void
```

Emitted when the modified bit of a `GtkTextBuffer` flips.

See also: `Gtk.TextBuffer.setModified()`.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onPasteDone`

```ts
(clipboard: Gdk.Clipboard, self: Gtk.TextBuffer) => void
```

Emitted after paste operation has been completed.

This is useful to properly scroll the view to the end
of the pasted text. See `Gtk.TextBuffer.pasteClipboard()`
for more details.

**Parameters**

- `clipboard`: the `GdkClipboard` pasted from
- `self`: The instance the signal was emitted on.

### `onRedo`

```ts
(self: Gtk.TextBuffer) => void
```

Emitted when a request has been made to redo the
previously undone operation.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onRemoveTag`

```ts
(tag: Gtk.TextTag, start: Gtk.TextIter, end: Gtk.TextIter, self: Gtk.TextBuffer) => void
```

Emitted to remove all occurrences of `tag` from a range
of text in a `GtkTextBuffer`.

Removal actually occurs in the default handler.

Note that if your handler runs before the default handler
it must not invalidate the `start` and `end` iters (or has
to revalidate them).

See also: `Gtk.TextBuffer.removeTag()`.

**Parameters**

- `tag`: the tag to be removed
- `start`: the start of the range the tag is removed from
- `end`: the end of the range the tag is removed from
- `self`: The instance the signal was emitted on.

### `onUndo`

```ts
(self: Gtk.TextBuffer) => void
```

Emitted when a request has been made to undo the
previous operation or set of operations that have
been grouped together.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.TextBuffer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addCommitNotify`

```ts
addCommitNotify(flags: Gtk.TextBufferNotifyFlags, commitNotify: Gtk.TextBufferCommitNotify): number
```

Adds a `Gtk.TextBufferCommitNotify` to be called when a change
is to be made to the `Gtk.TextBuffer`.

Functions are explicitly forbidden from making changes to the
`Gtk.TextBuffer` from this callback. It is intended for tracking
changes to the buffer only.

It may be advantageous to use `Gtk.TextBufferCommitNotify` over
connecting to the `Gtk.TextBuffer.insert-text` or
`Gtk.TextBuffer.delete-range` signals to avoid ordering issues with
other signal handlers which may further modify the `Gtk.TextBuffer`.

**Parameters**

- `flags`: which notifications should be dispatched to `callback`
- `commitNotify`: a `Gtk.TextBufferCommitNotify` to call for commit notifications

**Returns** a handler id which may be used to remove the commit notify
  callback using `Gtk.TextBuffer.removeCommitNotify()`.

_Available since 4.16._

### `addMark`

```ts
addMark(mark: Gtk.TextMark, where: Gtk.TextIter): void
```

Adds the mark at position `where`.

The mark must not be added to another buffer, and if its name
is not `null` then there must not be another mark in the buffer
with the same name.

Emits the `Gtk.TextBuffer.mark-set` signal as notification
of the mark's initial placement.

**Parameters**

- `mark`: the mark to add
- `where`: location to place mark

### `addSelectionClipboard`

```ts
addSelectionClipboard(clipboard: Gdk.Clipboard): void
```

Adds `clipboard` to the list of clipboards in which the selection
contents of `buffer` are available.

In most cases, `clipboard` will be the `GdkClipboard` returned by
`Gtk.Widget.getPrimaryClipboard()` for a view of `buffer`.

**Parameters**

- `clipboard`: a `GdkClipboard`

### `applyTag`

```ts
applyTag(tag: Gtk.TextTag, start: Gtk.TextIter, end: Gtk.TextIter): void
```

Emits the “apply-tag” signal on `buffer`.

The default handler for the signal applies
`tag` to the given range. `start` and `end` do
not have to be in order.

**Parameters**

- `tag`: a `GtkTextTag`
- `start`: one bound of range to be tagged
- `end`: other bound of range to be tagged

### `applyTagByName`

```ts
applyTagByName(name: string, start: Gtk.TextIter, end: Gtk.TextIter): void
```

Emits the “apply-tag” signal on `buffer`.

Calls `Gtk.TextTagTable.lookup()` on the buffer’s
tag table to get a `GtkTextTag`, then calls
`Gtk.TextBuffer.applyTag()`.

**Parameters**

- `name`: name of a named `GtkTextTag`
- `start`: one bound of range to be tagged
- `end`: other bound of range to be tagged

### `backspace`

```ts
backspace(iter: Gtk.TextIter, interactive: boolean, defaultEditable: boolean): boolean
```

Performs the appropriate action as if the user hit the delete
key with the cursor at the position specified by `iter`.

In the normal case a single character will be deleted, but when
combining accents are involved, more than one character can
be deleted, and when precomposed character and accent combinations
are involved, less than one character will be deleted.

Because the buffer is modified, all outstanding iterators become
invalid after calling this function; however, the `iter` will be
re-initialized to point to the location where text was deleted.

**Parameters**

- `iter`: a position in `buffer`
- `interactive`: whether the deletion is caused by user interaction
- `defaultEditable`: whether the buffer is editable by default

**Returns** `true` if the buffer was modified

### `beginIrreversibleAction`

```ts
beginIrreversibleAction(): void
```

Denotes the beginning of an action that may not be undone.

This will cause any previous operations in the undo/redo queue
to be cleared.

This should be paired with a call to
`Gtk.TextBuffer.endIrreversibleAction()` after the irreversible
action has completed.

You may nest calls to `gtk_text_buffer_begin_irreversible_action()`
and `gtk_text_buffer_end_irreversible_action()` pairs.

### `beginUserAction`

```ts
beginUserAction(): void
```

Called to indicate that the buffer operations between here and a
call to `gtk_text_buffer_end_user_action()` are part of a single
user-visible operation.

The operations between `gtk_text_buffer_begin_user_action()` and
`gtk_text_buffer_end_user_action()` can then be grouped when creating
an undo stack. `GtkTextBuffer` maintains a count of calls to
`gtk_text_buffer_begin_user_action()` that have not been closed with
a call to `gtk_text_buffer_end_user_action()`, and emits the
“begin-user-action” and “end-user-action” signals only for the
outermost pair of calls. This allows you to build user actions
from other user actions.

The “interactive” buffer mutation functions, such as
`Gtk.TextBuffer.insertInteractive()`, automatically call
begin/end user action around the buffer operations they perform,
so there's no need to add extra calls if you user action consists
solely of a single call to one of those functions.

### `copyClipboard`

```ts
copyClipboard(clipboard: Gdk.Clipboard): void
```

Copies the currently-selected text to a clipboard.

**Parameters**

- `clipboard`: the `GdkClipboard` object to copy to

### `createChildAnchor`

```ts
createChildAnchor(iter: Gtk.TextIter): Gtk.TextChildAnchor
```

Creates and inserts a child anchor.

This is a convenience function which simply creates a child anchor
with `Gtk.TextChildAnchor.new()` and inserts it into the buffer
with `Gtk.TextBuffer.insertChildAnchor()`.

The new anchor is owned by the buffer; no reference count is
returned to the caller of this function.

**Parameters**

- `iter`: location in the buffer

**Returns** the created child anchor

### `createMark`

```ts
createMark(markName: string | null, where: Gtk.TextIter, leftGravity: boolean): Gtk.TextMark
```

Creates a mark at position `where`.

If `mark_name` is `null`, the mark is anonymous; otherwise, the mark
can be retrieved by name using `Gtk.TextBuffer.getMark()`.
If a mark has left gravity, and text is inserted at the mark’s
current location, the mark will be moved to the left of the
newly-inserted text. If the mark has right gravity
(`left_gravity` = `false`), the mark will end up on the right of
newly-inserted text. The standard left-to-right cursor is a mark
with right gravity (when you type, the cursor stays on the right
side of the text you’re typing).

The caller of this function does not own a
reference to the returned `GtkTextMark`, so you can ignore the
return value if you like. Marks are owned by the buffer and go
away when the buffer does.

Emits the `Gtk.TextBuffer.mark-set` signal as notification
of the mark's initial placement.

**Parameters**

- `markName`: name for mark
- `where`: location to place mark
- `leftGravity`: whether the mark has left gravity

**Returns** the new `GtkTextMark` object

### `cutClipboard`

```ts
cutClipboard(clipboard: Gdk.Clipboard, defaultEditable: boolean): void
```

Copies the currently-selected text to a clipboard,
then deletes said text if it’s editable.

**Parameters**

- `clipboard`: the `GdkClipboard` object to cut to
- `defaultEditable`: default editability of the buffer

### `delete`

```ts
delete(start: Gtk.TextIter, end: Gtk.TextIter): void
```

Deletes text between `start` and `end`.

The order of `start` and `end` is not actually relevant;
`gtk_text_buffer_delete()` will reorder them.

This function actually emits the “delete-range” signal, and
the default handler of that signal deletes the text. Because the
buffer is modified, all outstanding iterators become invalid after
calling this function; however, the `start` and `end` will be
re-initialized to point to the location where text was deleted.

**Parameters**

- `start`: a position in `buffer`
- `end`: another position in `buffer`

### `deleteInteractive`

```ts
deleteInteractive(startIter: Gtk.TextIter, endIter: Gtk.TextIter, defaultEditable: boolean): boolean
```

Deletes all editable text in the given range.

Calls `Gtk.TextBuffer.delete()` for each editable
sub-range of [`start`,`end`). `start` and `end` are revalidated
to point to the location of the last deleted range, or left
untouched if no text was deleted.

**Parameters**

- `startIter`: start of range to delete
- `endIter`: end of range
- `defaultEditable`: whether the buffer is editable by default

**Returns** whether some text was actually deleted

### `deleteMark`

```ts
deleteMark(mark: Gtk.TextMark): void
```

Deletes `mark`, so that it’s no longer located anywhere in the
buffer.

Removes the reference the buffer holds to the mark, so if
you haven’t called `g_object_ref()` on the mark, it will be freed.
Even if the mark isn’t freed, most operations on `mark` become
invalid, until it gets added to a buffer again with
`Gtk.TextBuffer.addMark()`. Use `Gtk.TextMark.getDeleted()`
to find out if a mark has been removed from its buffer.

The `Gtk.TextBuffer.mark-deleted` signal will be emitted as
notification after the mark is deleted.

**Parameters**

- `mark`: a `GtkTextMark` in `buffer`

### `deleteMarkByName`

```ts
deleteMarkByName(name: string): void
```

Deletes the mark named `name`; the mark must exist.

See `Gtk.TextBuffer.deleteMark()` for details.

**Parameters**

- `name`: name of a mark in `buffer`

### `deleteSelection`

```ts
deleteSelection(interactive: boolean, defaultEditable: boolean): boolean
```

Deletes the range between the “insert” and “selection_bound” marks,
that is, the currently-selected text.

If `interactive` is `true`, the editability of the selection will be
considered (users can’t delete uneditable text).

**Parameters**

- `interactive`: whether the deletion is caused by user interaction
- `defaultEditable`: whether the buffer is editable by default

**Returns** whether there was a non-empty selection to delete

### `endIrreversibleAction`

```ts
endIrreversibleAction(): void
```

Denotes the end of an action that may not be undone.

This will cause any previous operations in the undo/redo
queue to be cleared.

This should be called after completing modifications to the
text buffer after `Gtk.TextBuffer.beginIrreversibleAction()`
was called.

You may nest calls to `gtk_text_buffer_begin_irreversible_action()`
and `gtk_text_buffer_end_irreversible_action()` pairs.

### `endUserAction`

```ts
endUserAction(): void
```

Ends a user-visible operation.

Should be paired with a call to
`Gtk.TextBuffer.beginUserAction()`.
See that function for a full explanation.

### `getBounds`

```ts
getBounds(): [Gtk.TextIter, Gtk.TextIter]
```

Retrieves the first and last iterators in the buffer, i.e. the
entire buffer lies within the range [`start`,`end`).

**Returns** Tuple of:

- `start`: iterator to initialize with first position in the buffer
- `end`: iterator to initialize with the end iterator

### `getCanRedo`

```ts
getCanRedo(): boolean
```

Gets whether there is a redoable action in the history.

**Returns** `true` if there is a redoable action

### `getCanUndo`

```ts
getCanUndo(): boolean
```

Gets whether there is an undoable action in the history.

**Returns** `true` if there is an undoable action

### `getCharCount`

```ts
getCharCount(): number
```

Gets the number of characters in the buffer.

Note that characters and bytes are not the same, you can’t e.g.
expect the contents of the buffer in string form to be this
many bytes long.

The character count is cached, so this function is very fast.

**Returns** number of characters in the buffer

### `getEnableUndo`

```ts
getEnableUndo(): boolean
```

Gets whether the buffer is saving modifications to the buffer
to allow for undo and redo actions.

See `Gtk.TextBuffer.beginIrreversibleAction()` and
`Gtk.TextBuffer.endIrreversibleAction()` to create
changes to the buffer that cannot be undone.

**Returns** `true` if undoing and redoing changes to the buffer is allowed.

### `getEndIter`

```ts
getEndIter(): Gtk.TextIter
```

Initializes `iter` with the “end iterator,” one past the last valid
character in the text buffer.

If dereferenced with `Gtk.TextIter.getChar()`, the end
iterator has a character value of 0.
The entire buffer lies in the range from the first position in
the buffer (call `Gtk.TextBuffer.getStartIter()` to get
character position 0) to the end iterator.

**Returns** iterator to initialize

### `getHasSelection`

```ts
getHasSelection(): boolean
```

Indicates whether the buffer has some text currently selected.

**Returns** `true` if the there is text selected

### `getInsert`

```ts
getInsert(): Gtk.TextMark
```

Returns the mark that represents the cursor (insertion point).

Equivalent to calling `Gtk.TextBuffer.getMark()`
to get the mark named “insert”, but very slightly more
efficient, and involves less typing.

**Returns** insertion point mark

### `getIterAtChildAnchor`

```ts
getIterAtChildAnchor(anchor: Gtk.TextChildAnchor): Gtk.TextIter
```

Obtains the location of `anchor` within `buffer`.

**Parameters**

- `anchor`: a child anchor that appears in `buffer`

**Returns** an iterator to be initialized

### `getIterAtLine`

```ts
getIterAtLine(lineNumber: number): [boolean, Gtk.TextIter]
```

Initializes `iter` to the start of the given line.

If `line_number` is greater than or equal to the number of lines
in the `buffer`, the end iterator is returned.

**Parameters**

- `lineNumber`: line number counting from 0

**Returns** Tuple of:

- `result`: whether the exact position has been found
- `iter`: iterator to initialize

### `getIterAtLineIndex`

```ts
getIterAtLineIndex(lineNumber: number, byteIndex: number): [boolean, Gtk.TextIter]
```

Obtains an iterator pointing to `byte_index` within the given line.

`byte_index` must be the start of a UTF-8 character. Note bytes, not
characters; UTF-8 may encode one character as multiple bytes.

If `line_number` is greater than or equal to the number of lines in the `buffer`,
the end iterator is returned. And if `byte_index` is off the
end of the line, the iterator at the end of the line is returned.

**Parameters**

- `lineNumber`: line number counting from 0
- `byteIndex`: byte index from start of line

**Returns** Tuple of:

- `result`: whether the exact position has been found
- `iter`: iterator to initialize

### `getIterAtLineOffset`

```ts
getIterAtLineOffset(lineNumber: number, charOffset: number): [boolean, Gtk.TextIter]
```

Obtains an iterator pointing to `char_offset` within the given line.

Note characters, not bytes; UTF-8 may encode one character as multiple
bytes.

If `line_number` is greater than or equal to the number of lines in the `buffer`,
the end iterator is returned. And if `char_offset` is off the
end of the line, the iterator at the end of the line is returned.

**Parameters**

- `lineNumber`: line number counting from 0
- `charOffset`: char offset from start of line

**Returns** Tuple of:

- `result`: whether the exact position has been found
- `iter`: iterator to initialize

### `getIterAtMark`

```ts
getIterAtMark(mark: Gtk.TextMark): Gtk.TextIter
```

Initializes `iter` with the current position of `mark`.

**Parameters**

- `mark`: a `GtkTextMark` in `buffer`

**Returns** iterator to initialize

### `getIterAtOffset`

```ts
getIterAtOffset(charOffset: number): Gtk.TextIter
```

Initializes `iter` to a position `char_offset` chars from the start
of the entire buffer.

If `char_offset` is -1 or greater than the number
of characters in the buffer, `iter` is initialized to the end iterator,
the iterator one past the last valid character in the buffer.

**Parameters**

- `charOffset`: char offset from start of buffer, counting from 0, or -1

**Returns** iterator to initialize

### `getLineCount`

```ts
getLineCount(): number
```

Obtains the number of lines in the buffer.

This value is cached, so the function is very fast.

**Returns** number of lines in the buffer

### `getMark`

```ts
getMark(name: string): Gtk.TextMark | null
```

Returns the mark named `name` in buffer `buffer`, or `null` if no such
mark exists in the buffer.

**Parameters**

- `name`: a mark name

**Returns** a `GtkTextMark`

### `getMaxUndoLevels`

```ts
getMaxUndoLevels(): number
```

Gets the maximum number of undo levels to perform.

If 0, unlimited undo actions may be performed. Note that this may
have a memory usage impact as it requires storing an additional
copy of the inserted or removed text within the text buffer.

**Returns** The max number of undo levels allowed (0 indicates unlimited).

### `getModified`

```ts
getModified(): boolean
```

Indicates whether the buffer has been modified since the last call
to `Gtk.TextBuffer.setModified()` set the modification flag to
`false`.

Used for example to enable a “save” function in a text editor.

**Returns** `true` if the buffer has been modified

### `getSelectionBound`

```ts
getSelectionBound(): Gtk.TextMark
```

Returns the mark that represents the selection bound.

Equivalent to calling `Gtk.TextBuffer.getMark()`
to get the mark named “selection_bound”, but very slightly
more efficient, and involves less typing.

The currently-selected text in `buffer` is the region between the
“selection_bound” and “insert” marks. If “selection_bound” and
“insert” are in the same place, then there is no current selection.
`Gtk.TextBuffer.getSelectionBounds()` is another convenient
function for handling the selection, if you just want to know whether
there’s a selection and what its bounds are.

**Returns** selection bound mark

### `getSelectionBounds`

```ts
getSelectionBounds(): [boolean, Gtk.TextIter, Gtk.TextIter]
```

Returns `true` if some text is selected; places the bounds
of the selection in `start` and `end`.

If the selection has length 0, then `start` and `end` are filled
in with the same value. `start` and `end` will be in ascending order.
If `start` and `end` are `null`, then they are not filled in, but the
return value still indicates whether text is selected.

**Returns** Tuple of:

- `result`: whether the selection has nonzero length
- `start`: iterator to initialize with selection start
- `end`: iterator to initialize with selection end

### `getSelectionContent`

```ts
getSelectionContent(): Gdk.ContentProvider
```

Get a content provider for this buffer.

It can be used to make the content of `buffer` available
in a `GdkClipboard`, see `Gdk.Clipboard.setContent()`.

**Returns** a new `GdkContentProvider`.

### `getSlice`

```ts
getSlice(start: Gtk.TextIter, end: Gtk.TextIter, includeHiddenChars: boolean): string
```

Returns the text in the range [`start`,`end`).

Excludes undisplayed text (text marked with tags that set the
invisibility attribute) if `include_hidden_chars` is `false`.
The returned string includes a 0xFFFC character whenever the
buffer contains embedded images, so byte and character indexes
into the returned string do correspond to byte and character
indexes into the buffer. Contrast with `Gtk.TextBuffer.getText()`.
Note that 0xFFFC can occur in normal text as well, so it is not a
reliable indicator that a paintable or widget is in the buffer.

**Parameters**

- `start`: start of a range
- `end`: end of a range
- `includeHiddenChars`: whether to include invisible text

**Returns** an allocated UTF-8 string

### `getStartIter`

```ts
getStartIter(): Gtk.TextIter
```

Initialized `iter` with the first position in the text buffer.

This is the same as using `Gtk.TextBuffer.getIterAtOffset()`
to get the iter at character offset 0.

**Returns** iterator to initialize

### `getTagTable`

```ts
getTagTable(): Gtk.TextTagTable
```

Get the `GtkTextTagTable` associated with this buffer.

**Returns** the buffer’s tag table

### `getText`

```ts
getText(start: Gtk.TextIter, end: Gtk.TextIter, includeHiddenChars: boolean): string
```

Returns the text in the range [`start`,`end`).

Excludes undisplayed text (text marked with tags that set the
invisibility attribute) if `include_hidden_chars` is `false`.
Does not include characters representing embedded images, so
byte and character indexes into the returned string do not
correspond to byte and character indexes into the buffer.
Contrast with `Gtk.TextBuffer.getSlice()`.

**Parameters**

- `start`: start of a range
- `end`: end of a range
- `includeHiddenChars`: whether to include invisible text

**Returns** an allocated UTF-8 string

### `insert`

```ts
insert(iter: Gtk.TextIter, text: string, len: number): void
```

Inserts `len` bytes of `text` at position `iter`.

If `len` is -1, `text` must be nul-terminated and will be inserted in its
entirety. Emits the “insert-text” signal; insertion actually occurs
in the default handler for the signal. `iter` is invalidated when
insertion occurs (because the buffer contents change), but the
default signal handler revalidates it to point to the end of the
inserted text.

**Parameters**

- `iter`: a position in the buffer
- `text`: text in UTF-8 format
- `len`: length of text in bytes, or -1

### `insertAtCursor`

```ts
insertAtCursor(text: string, len: number): void
```

Inserts `text` in `buffer`.

Simply calls `Gtk.TextBuffer.insert()`,
using the current cursor position as the insertion point.

**Parameters**

- `text`: text in UTF-8 format
- `len`: length of text, in bytes

### `insertChildAnchor`

```ts
insertChildAnchor(iter: Gtk.TextIter, anchor: Gtk.TextChildAnchor): void
```

Inserts a child widget anchor into the text buffer at `iter`.

The anchor will be counted as one character in character counts, and
when obtaining the buffer contents as a string, will be represented
by the Unicode “object replacement character” 0xFFFC. Note that the
“slice” variants for obtaining portions of the buffer as a string
include this character for child anchors, but the “text” variants do
not. E.g. see `Gtk.TextBuffer.getSlice()` and
`Gtk.TextBuffer.getText()`.

Consider `Gtk.TextBuffer.createChildAnchor()` as a more
convenient alternative to this function. The buffer will add a
reference to the anchor, so you can unref it after insertion.

**Parameters**

- `iter`: location to insert the anchor
- `anchor`: a `GtkTextChildAnchor`

### `insertInteractive`

```ts
insertInteractive(iter: Gtk.TextIter, text: string, len: number, defaultEditable: boolean): boolean
```

Inserts `text` in `buffer`.

Like `Gtk.TextBuffer.insert()`, but the insertion will not occur
if `iter` is at a non-editable location in the buffer. Usually you
want to prevent insertions at ineditable locations if the insertion
results from a user action (is interactive).

`default_editable` indicates the editability of text that doesn't
have a tag affecting editability applied to it. Typically the
result of `Gtk.TextView.getEditable()` is appropriate here.

**Parameters**

- `iter`: a position in `buffer`
- `text`: some UTF-8 text
- `len`: length of text in bytes, or -1
- `defaultEditable`: default editability of buffer

**Returns** whether text was actually inserted

### `insertInteractiveAtCursor`

```ts
insertInteractiveAtCursor(text: string, len: number, defaultEditable: boolean): boolean
```

Inserts `text` in `buffer`.

Calls `Gtk.TextBuffer.insertInteractive()`
at the cursor position.

`default_editable` indicates the editability of text that doesn't
have a tag affecting editability applied to it. Typically the
result of `Gtk.TextView.getEditable()` is appropriate here.

**Parameters**

- `text`: text in UTF-8 format
- `len`: length of text in bytes, or -1
- `defaultEditable`: default editability of buffer

**Returns** whether text was actually inserted

### `insertMarkup`

```ts
insertMarkup(iter: Gtk.TextIter, markup: string, len: number): void
```

Inserts the text in `markup` at position `iter`.

`markup` will be inserted in its entirety and must be nul-terminated
and valid UTF-8. Emits the `Gtk.TextBuffer.insert-text` signal,
possibly multiple times; insertion actually occurs in the default handler
for the signal. `iter` will point to the end of the inserted text on return.

**Parameters**

- `iter`: location to insert the markup
- `markup`: a nul-terminated UTF-8 string containing Pango markup
- `len`: length of `markup` in bytes, or -1

### `insertPaintable`

```ts
insertPaintable(iter: Gtk.TextIter, paintable: Gdk.Paintable): void
```

Inserts an image into the text buffer at `iter`.

The image will be counted as one character in character counts,
and when obtaining the buffer contents as a string, will be
represented by the Unicode “object replacement character” 0xFFFC.
Note that the “slice” variants for obtaining portions of the buffer
as a string include this character for paintable, but the “text”
variants do not. e.g. see `Gtk.TextBuffer.getSlice()` and
`Gtk.TextBuffer.getText()`.

**Parameters**

- `iter`: location to insert the paintable
- `paintable`: a `GdkPaintable`

### `insertRange`

```ts
insertRange(iter: Gtk.TextIter, start: Gtk.TextIter, end: Gtk.TextIter): void
```

Copies text, tags, and paintables between `start` and `end`
and inserts the copy at `iter`.

The order of `start` and `end` doesn’t matter.

Used instead of simply getting/inserting text because it preserves
images and tags. If `start` and `end` are in a different buffer from
`buffer`, the two buffers must share the same tag table.

Implemented via emissions of the ::insert-text and ::apply-tag signals,
so expect those.

**Parameters**

- `iter`: a position in `buffer`
- `start`: a position in a `GtkTextBuffer`
- `end`: another position in the same buffer as `start`

### `insertRangeInteractive`

```ts
insertRangeInteractive(iter: Gtk.TextIter, start: Gtk.TextIter, end: Gtk.TextIter, defaultEditable: boolean): boolean
```

Copies text, tags, and paintables between `start` and `end`
and inserts the copy at `iter`.

Same as `Gtk.TextBuffer.insertRange()`, but does nothing
if the insertion point isn’t editable. The `default_editable`
parameter indicates whether the text is editable at `iter` if
no tags enclosing `iter` affect editability. Typically the result
of `Gtk.TextView.getEditable()` is appropriate here.

**Parameters**

- `iter`: a position in `buffer`
- `start`: a position in a `GtkTextBuffer`
- `end`: another position in the same buffer as `start`
- `defaultEditable`: default editability of the buffer

**Returns** whether an insertion was possible at `iter`

### `moveMark`

```ts
moveMark(mark: Gtk.TextMark, where: Gtk.TextIter): void
```

Moves `mark` to the new location `where`.

Emits the `Gtk.TextBuffer.mark-set` signal
as notification of the move.

**Parameters**

- `mark`: a `GtkTextMark`
- `where`: new location for `mark` in `buffer`

### `moveMarkByName`

```ts
moveMarkByName(name: string, where: Gtk.TextIter): void
```

Moves the mark named `name` (which must exist) to location `where`.

See `Gtk.TextBuffer.moveMark()` for details.

**Parameters**

- `name`: name of a mark
- `where`: new location for mark

### `pasteClipboard`

```ts
pasteClipboard(clipboard: Gdk.Clipboard, overrideLocation: Gtk.TextIter | null, defaultEditable: boolean): void
```

Pastes the contents of a clipboard.

If `override_location` is `null`, the pasted text will be inserted
at the cursor position, or the buffer selection will be replaced
if the selection is non-empty.

Note: pasting is asynchronous, that is, we’ll ask for the paste data
and return, and at some point later after the main loop runs, the paste
data will be inserted.

**Parameters**

- `clipboard`: the `GdkClipboard` to paste from
- `overrideLocation`: location to insert pasted text
- `defaultEditable`: whether the buffer is editable by default

### `placeCursor`

```ts
placeCursor(where: Gtk.TextIter): void
```

This function moves the “insert” and “selection_bound” marks
simultaneously.

If you move them to the same place in two steps with
`Gtk.TextBuffer.moveMark()`, you will temporarily select a
region in between their old and new locations, which can be pretty
inefficient since the temporarily-selected region will force stuff
to be recalculated. This function moves them as a unit, which can
be optimized.

**Parameters**

- `where`: where to put the cursor

### `redo`

```ts
redo(): void
```

Redoes the next redoable action on the buffer, if there is one.

### `removeAllTags`

```ts
removeAllTags(start: Gtk.TextIter, end: Gtk.TextIter): void
```

Removes all tags in the range between `start` and `end`.

Be careful with this function; it could remove tags added in code
unrelated to the code you’re currently writing. That is, using this
function is probably a bad idea if you have two or more unrelated
code sections that add tags.

**Parameters**

- `start`: one bound of range to be untagged
- `end`: other bound of range to be untagged

### `removeCommitNotify`

```ts
removeCommitNotify(commitNotifyHandler: number): void
```

Removes the `GtkTextBufferCommitNotify` handler previously registered
with `Gtk.TextBuffer.addCommitNotify()`.

This may result in the `user_data_destroy` being called that was passed when registering
the commit notify functions.

**Parameters**

- `commitNotifyHandler`: the notify handler identifier returned from `Gtk.TextBuffer.addCommitNotify()`.

_Available since 4.16._

### `removeSelectionClipboard`

```ts
removeSelectionClipboard(clipboard: Gdk.Clipboard): void
```

Removes a `GdkClipboard` added with
`Gtk.TextBuffer.addSelectionClipboard()`

**Parameters**

- `clipboard`: a `GdkClipboard` added to `buffer` by `Gtk.TextBuffer.addSelectionClipboard()`

### `removeTag`

```ts
removeTag(tag: Gtk.TextTag, start: Gtk.TextIter, end: Gtk.TextIter): void
```

Emits the “remove-tag” signal.

The default handler for the signal removes all occurrences
of `tag` from the given range. `start` and `end` don’t have
to be in order.

**Parameters**

- `tag`: a `GtkTextTag`
- `start`: one bound of range to be untagged
- `end`: other bound of range to be untagged

### `removeTagByName`

```ts
removeTagByName(name: string, start: Gtk.TextIter, end: Gtk.TextIter): void
```

Emits the “remove-tag” signal.

Calls `Gtk.TextTagTable.lookup()` on the buffer’s
tag table to get a `GtkTextTag`, then calls
`Gtk.TextBuffer.removeTag()`.

**Parameters**

- `name`: name of a `GtkTextTag`
- `start`: one bound of range to be untagged
- `end`: other bound of range to be untagged

### `selectRange`

```ts
selectRange(ins: Gtk.TextIter, bound: Gtk.TextIter): void
```

This function moves the “insert” and “selection_bound” marks
simultaneously.

If you move them in two steps with
`Gtk.TextBuffer.moveMark()`, you will temporarily select a
region in between their old and new locations, which can be pretty
inefficient since the temporarily-selected region will force stuff
to be recalculated. This function moves them as a unit, which can
be optimized.

**Parameters**

- `ins`: where to put the “insert” mark
- `bound`: where to put the “selection_bound” mark

### `setEnableUndo`

```ts
setEnableUndo(enableUndo: boolean): void
```

Sets whether or not to enable undoable actions in the text buffer.

Undoable actions in this context are changes to the text content of
the buffer. Changes to tags and marks are not tracked.

If enabled, the user will be able to undo the last number of actions
up to `Gtk.TextBuffer.getMaxUndoLevels()`.

See `Gtk.TextBuffer.beginIrreversibleAction()` and
`Gtk.TextBuffer.endIrreversibleAction()` to create
changes to the buffer that cannot be undone.

**Parameters**

- `enableUndo`: `true` to enable undo

### `setMaxUndoLevels`

```ts
setMaxUndoLevels(maxUndoLevels: number): void
```

Sets the maximum number of undo levels to perform.

If 0, unlimited undo actions may be performed. Note that this may
have a memory usage impact as it requires storing an additional
copy of the inserted or removed text within the text buffer.

**Parameters**

- `maxUndoLevels`: the maximum number of undo actions to perform

### `setModified`

```ts
setModified(setting: boolean): void
```

Used to keep track of whether the buffer has been
modified since the last time it was saved.

Whenever the buffer is saved to disk, call
`gtk_text_buffer_set_modified (@buffer, FALSE)`.
When the buffer is modified, it will automatically
toggle on the modified bit again. When the modified
bit flips, the buffer emits the
`Gtk.TextBuffer.modified-changed` signal.

**Parameters**

- `setting`: modification flag setting

### `setText`

```ts
setText(text: string, len: number): void
```

Deletes current contents of `buffer`, and inserts `text` instead. This is
automatically marked as an irreversible action in the undo stack. If you
wish to mark this action as part of a larger undo operation, call
`TextBuffer.delete()` and `TextBuffer.insert()` directly instead.

If `len` is -1, `text` must be nul-terminated.
`text` must be valid UTF-8.

**Parameters**

- `text`: UTF-8 text to insert
- `len`: length of `text` in bytes

### `undo`

```ts
undo(): void
```

Undoes the last undoable action on the buffer, if there is one.
