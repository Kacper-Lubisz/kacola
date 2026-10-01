---
description: "Holds the text that is displayed in a single-line text entry widget."
---

# GtkEntryBuffer

Holds the text that is displayed in a single-line text entry widget.

A single `GtkEntryBuffer` object can be shared by multiple widgets
which will then share the same text content, but not the cursor
position, visibility attributes, icon etc.

`GtkEntryBuffer` may be derived from. Such a derived class might allow
text to be stored in an alternate location, such as non-pageable memory,
useful in the case of important passwords. Or a derived class could
integrate with an application’s concept of undo/redo.

```tsx
import { GtkEntryBuffer } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkEntryBuffer**

## Props

`ref` receives the `Gtk.EntryBuffer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `length`

`number` · default `0` · read-only, observe with `onNotifyLength`

The length (in characters) of the text in buffer.

### `maxLength`

`number` · default `0`

The maximum length (in characters) of the text in the buffer.

### `text`

`string`

The contents of the buffer.

## Signals

### `onDeletedText`

```ts
(position: number, nChars: number, self: Gtk.EntryBuffer) => void
```

The text is altered in the default handler for this signal.

If you want access to the text after the text has been modified,
use `G_CONNECT_AFTER`.

**Parameters**

- `position`: the position the text was deleted at.
- `nChars`: The number of characters that were deleted.
- `self`: The instance the signal was emitted on.

### `onInsertedText`

```ts
(position: number, chars: string, nChars: number, self: Gtk.EntryBuffer) => void
```

This signal is emitted after text is inserted into the buffer.

**Parameters**

- `position`: the position the text was inserted at.
- `chars`: The text that was inserted.
- `nChars`: The number of characters that were inserted.
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.EntryBuffer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `deleteText`

```ts
deleteText(position: number, nChars: number): number
```

Deletes a sequence of characters from the buffer.

`n_chars` characters are deleted starting at `position`.
If `n_chars` is negative, then all characters until the
end of the text are deleted.

If `position` or `n_chars` are out of bounds, then they
are coerced to sane values.

Note that the positions are specified in characters,
not bytes.

**Parameters**

- `position`: position at which to delete text
- `nChars`: number of characters to delete

**Returns** The number of characters deleted.

### `emitDeletedText`

```ts
emitDeletedText(position: number, nChars: number): void
```

Used when subclassing `GtkEntryBuffer`.

**Parameters**

- `position`: position at which text was deleted
- `nChars`: number of characters deleted

### `emitInsertedText`

```ts
emitInsertedText(position: number, chars: string, nChars: number): void
```

Used when subclassing `GtkEntryBuffer`.

**Parameters**

- `position`: position at which text was inserted
- `chars`: text that was inserted
- `nChars`: number of characters inserted

### `getBytes`

```ts
getBytes(): number
```

Retrieves the length in bytes of the buffer.

See `Gtk.EntryBuffer.getLength()`.

**Returns** The byte length of the buffer.

### `getLength`

```ts
getLength(): number
```

Retrieves the length in characters of the buffer.

**Returns** The number of characters in the buffer.

### `getMaxLength`

```ts
getMaxLength(): number
```

Retrieves the maximum allowed length of the text in `buffer`.

**Returns** the maximum allowed number of characters
  in `GtkEntryBuffer`, or 0 if there is no maximum.

### `getText`

```ts
getText(): string
```

Retrieves the contents of the buffer.

The memory pointer returned by this call will not change
unless this object emits a signal, or is finalized.

**Returns** a pointer to the contents of the widget as a
  string. This string points to internally allocated storage
  in the buffer and must not be freed, modified or stored.

### `insertText`

```ts
insertText(position: number, chars: string, nChars: number): number
```

Inserts `n_chars` characters of `chars` into the contents of the
buffer, at position `position`.

If `n_chars` is negative, then characters from chars will be inserted
until a null-terminator is found. If `position` or `n_chars` are out of
bounds, or the maximum buffer text length is exceeded, then they are
coerced to sane values.

Note that the position and length are in characters, not in bytes.

**Parameters**

- `position`: the position at which to insert text.
- `chars`: the text to insert into the buffer.
- `nChars`: the length of the text in characters, or -1

**Returns** The number of characters actually inserted.

### `setMaxLength`

```ts
setMaxLength(maxLength: number): void
```

Sets the maximum allowed length of the contents of the buffer.

If the current contents are longer than the given length, then
they will be truncated to fit.

**Parameters**

- `maxLength`: the maximum length of the entry buffer, or 0 for no maximum. (other than the maximum length of entries.) The value passed in will be clamped to the range 0-65536.

### `setText`

```ts
setText(chars: string, nChars: number): void
```

Sets the text in the buffer.

This is roughly equivalent to calling
`Gtk.EntryBuffer.deleteText()` and
`Gtk.EntryBuffer.insertText()`.

Note that `n_chars` is in characters, not in bytes.

**Parameters**

- `chars`: the new text
- `nChars`: the number of characters in `text`, or -1
