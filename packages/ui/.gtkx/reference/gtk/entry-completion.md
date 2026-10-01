---
description: "GtkEntryCompletion is an auxiliary object to provide completion functionality for GtkEntry."
---

# GtkEntryCompletion

`GtkEntryCompletion` is an auxiliary object to provide completion functionality
for `GtkEntry`.

It implements the `Gtk.CellLayout` interface, to allow the user
to add extra cells to the `GtkTreeView` with completion matches.

“Completion functionality” means that when the user modifies the text
in the entry, `GtkEntryCompletion` checks which rows in the model match
the current content of the entry, and displays a list of matches.
By default, the matching is done by comparing the entry text
case-insensitively against the text column of the model (see
`Gtk.EntryCompletion.setTextColumn()`), but this can be overridden
with a custom match function (see `Gtk.EntryCompletion.setMatchFunc()`).

When the user selects a completion, the content of the entry is
updated. By default, the content of the entry is replaced by the
text column of the model, but this can be overridden by connecting
to the `Gtk.EntryCompletion.match-selected` signal and updating the
entry in the signal handler. Note that you should return `true` from
the signal handler to suppress the default behaviour.

To add completion functionality to an entry, use
`Gtk.Entry.setCompletion()`.

`GtkEntryCompletion` uses a `Gtk.TreeModelFilter` model to
represent the subset of the entire model that is currently matching.
While the `GtkEntryCompletion` signals
`Gtk.EntryCompletion.match-selected` and
`Gtk.EntryCompletion.cursor-on-match` take the original model
and an iter pointing to that model as arguments, other callbacks and
signals (such as `GtkCellLayoutDataFunc` or
[signal@Gtk.CellArea::apply-attributes)]
will generally take the filter model as argument. As long as you are
only calling `Gtk.TreeModel.get()`, this will make no difference to
you. If for some reason, you need the original model, use
`Gtk.TreeModelFilter.getModel()`. Don’t forget to use
`Gtk.TreeModelFilter.convertIterToChildIter()` to obtain a
matching iter.

> **Deprecated since 4.10.**

```tsx
import { GtkEntryCompletion } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkEntryCompletion**

Implements `GtkBuildable`, `GtkCellLayout`.

## Props

`ref` receives the `Gtk.EntryCompletion` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `cellArea`

`Gtk.CellArea` · construct-only

The `GtkCellArea` used to layout cell renderers in the treeview column.

If no area is specified when creating the entry completion with
`Gtk.EntryCompletion.newWithArea()`, a horizontally oriented
`Gtk.CellAreaBox` will be used.

### `inlineCompletion`

`boolean` · default `false`

Determines whether the common prefix of the possible completions
should be inserted automatically in the entry.

Note that this requires text-column to be set, even if you are
using a custom match function.

### `inlineSelection`

`boolean` · default `false`

Determines whether the possible completions on the popup
will appear in the entry as you navigate through them.

### `minimumKeyLength`

`number` · default `1`

The minimum key length as set for completion.

### `model`

`Gtk.TreeModel | ReactElement`

The model used as data source.

### `popupCompletion`

`boolean` · default `true`

Determines whether the possible completions should be
shown in a popup window.

### `popupSetWidth`

`boolean` · default `true`

Determines whether the completions popup window will be
resized to the width of the entry.

### `popupSingleMatch`

`boolean` · default `true`

Determines whether the completions popup window will shown
for a single possible completion.

You probably want to set this to `false` if you are using
`Gtk.EntryCompletion.inlineCompletion`.

### `textColumn`

`number` · default `-1`

The column of the model containing the strings.

Note that the strings must be UTF-8.

## Signals

### `onCursorOnMatch`

```ts
(model: Gtk.TreeModel, iter: Gtk.TreeIter, self: Gtk.EntryCompletion) => boolean | undefined
```

Emitted when a match from the cursor is on a match of the list.

The default behaviour is to replace the contents
of the entry with the contents of the text column in the row
pointed to by `iter`.

Note that `model` is the model that was passed to
`Gtk.EntryCompletion.setModel()`.

**Parameters**

- `model`: the `GtkTreeModel` containing the matches
- `iter`: a `GtkTreeIter` positioned at the selected match
- `self`: The instance the signal was emitted on.

**Returns** `true` if the signal has been handled

### `onInsertPrefix`

```ts
(prefix: string, self: Gtk.EntryCompletion) => boolean | undefined
```

Emitted when the inline autocompletion is triggered.

The default behaviour is to make the entry display the
whole prefix and select the newly inserted part.

Applications may connect to this signal in order to insert only a
smaller part of the `prefix` into the entry - e.g. the entry used in
the `GtkFileChooser` inserts only the part of the prefix up to the
next '/'.

**Parameters**

- `prefix`: the common prefix of all possible completions
- `self`: The instance the signal was emitted on.

**Returns** `true` if the signal has been handled

### `onMatchSelected`

```ts
(model: Gtk.TreeModel, iter: Gtk.TreeIter, self: Gtk.EntryCompletion) => boolean | undefined
```

Emitted when a match from the list is selected.

The default behaviour is to replace the contents of the
entry with the contents of the text column in the row
pointed to by `iter`.

Note that `model` is the model that was passed to
`Gtk.EntryCompletion.setModel()`.

**Parameters**

- `model`: the `GtkTreeModel` containing the matches
- `iter`: a `GtkTreeIter` positioned at the selected match
- `self`: The instance the signal was emitted on.

**Returns** `true` if the signal has been handled

### `onNoMatches`

```ts
(self: Gtk.EntryCompletion) => void
```

Emitted when the filter model has zero
number of rows in completion_complete method.

In other words when `GtkEntryCompletion` is out of suggestions.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.EntryCompletion` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `complete`

```ts
complete(): void
```

Requests a completion operation, or in other words a refiltering of the
current list with completions, using the current key.

The completion list view will be updated accordingly.

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `computePrefix`

```ts
computePrefix(key: string): string | null
```

Computes the common prefix that is shared by all rows in `completion`
that start with `key`.

If no row matches `key`, `null` will be returned.
Note that a text column must have been set for this function to work,
see `Gtk.EntryCompletion.setTextColumn()` for details.

**Parameters**

- `key`: The text to complete for

**Returns** The common prefix all rows
  starting with `key`

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `getCompletionPrefix`

```ts
getCompletionPrefix(): string | null
```

Get the original text entered by the user that triggered
the completion or `null` if there’s no completion ongoing.

**Returns** the prefix for the current completion

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `getEntry`

```ts
getEntry(): Gtk.Widget
```

Gets the entry `completion` has been attached to.

**Returns** The entry `completion` has been attached to

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `getInlineCompletion`

```ts
getInlineCompletion(): boolean
```

Returns whether the common prefix of the possible completions should
be automatically inserted in the entry.

**Returns** `true` if inline completion is turned on

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `getInlineSelection`

```ts
getInlineSelection(): boolean
```

Returns `true` if inline-selection mode is turned on.

**Returns** `true` if inline-selection mode is on

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `getMinimumKeyLength`

```ts
getMinimumKeyLength(): number
```

Returns the minimum key length as set for `completion`.

**Returns** The currently used minimum key length

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `getModel`

```ts
getModel(): Gtk.TreeModel | null
```

Returns the model the `GtkEntryCompletion` is using as data source.

Returns `null` if the model is unset.

**Returns** A `GtkTreeModel`

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `getPopupCompletion`

```ts
getPopupCompletion(): boolean
```

Returns whether the completions should be presented in a popup window.

**Returns** `true` if popup completion is turned on

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `getPopupSetWidth`

```ts
getPopupSetWidth(): boolean
```

Returns whether the completion popup window will be resized to the
width of the entry.

**Returns** `true` if the popup window will be resized to the width of
  the entry

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `getPopupSingleMatch`

```ts
getPopupSingleMatch(): boolean
```

Returns whether the completion popup window will appear even if there is
only a single match.

**Returns** `true` if the popup window will appear regardless of the
   number of matches

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `getTextColumn`

```ts
getTextColumn(): number
```

Returns the column in the model of `completion` to get strings from.

**Returns** the column containing the strings

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `insertPrefix`

```ts
insertPrefix(): void
```

Requests a prefix insertion.

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `setInlineCompletion`

```ts
setInlineCompletion(inlineCompletion: boolean): void
```

Sets whether the common prefix of the possible completions should
be automatically inserted in the entry.

**Parameters**

- `inlineCompletion`: `true` to do inline completion

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `setInlineSelection`

```ts
setInlineSelection(inlineSelection: boolean): void
```

Sets whether it is possible to cycle through the possible completions
inside the entry.

**Parameters**

- `inlineSelection`: `true` to do inline selection

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `setMatchFunc`

```ts
setMatchFunc(func: Gtk.EntryCompletionMatchFunc): void
```

Sets the match function for `completion` to be `func`.

The match function is used to determine if a row should or
should not be in the completion list.

**Parameters**

- `func`: the `GtkEntryCompletion`MatchFunc to use

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `setMinimumKeyLength`

```ts
setMinimumKeyLength(length: number): void
```

Requires the length of the search key for `completion` to be at least
`length`.

This is useful for long lists, where completing using a small
key takes a lot of time and will come up with meaningless results anyway
(ie, a too large dataset).

**Parameters**

- `length`: the minimum length of the key in order to start completing

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `setModel`

```ts
setModel(model: Gtk.TreeModel | null): void
```

Sets the model for a `GtkEntryCompletion`.

If `completion` already has a model set, it will remove it
before setting the new model. If model is `null`, then it
will unset the model.

**Parameters**

- `model`: the `GtkTreeModel`

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `setPopupCompletion`

```ts
setPopupCompletion(popupCompletion: boolean): void
```

Sets whether the completions should be presented in a popup window.

**Parameters**

- `popupCompletion`: `true` to do popup completion

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `setPopupSetWidth`

```ts
setPopupSetWidth(popupSetWidth: boolean): void
```

Sets whether the completion popup window will be resized to be the same
width as the entry.

**Parameters**

- `popupSetWidth`: `true` to make the width of the popup the same as the entry

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `setPopupSingleMatch`

```ts
setPopupSingleMatch(popupSingleMatch: boolean): void
```

Sets whether the completion popup window will appear even if there is
only a single match.

You may want to set this to `false` if you
are using `Gtk.EntryCompletion.inlineCompletion`.

**Parameters**

- `popupSingleMatch`: `true` if the popup should appear even for a single match

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `setTextColumn`

```ts
setTextColumn(column: number): void
```

Convenience function for setting up the most used case of this code: a
completion list with just strings.

This function will set up `completion`
to have a list displaying all (and just) strings in the completion list,
and to get those strings from `column` in the model of `completion`.

This functions creates and adds a `GtkCellRendererText` for the selected
column. If you need to set the text column, but don't want the cell
renderer, use `g_object_set()` to set the
`Gtk.EntryCompletion.textColumn` property directly.

**Parameters**

- `column`: the column in the model of `completion` to get strings from

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.
