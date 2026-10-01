---
description: "Subclass of Gtk.TextBuffer."
---

# GtkSourceBuffer

Subclass of `Gtk.TextBuffer`.

A `GtkSourceBuffer` object is the model for `View` widgets.
It extends the `Gtk.TextBuffer` class by adding features useful to display
and edit source code such as syntax highlighting and bracket matching.

To create a `GtkSourceBuffer` use `GtkSource.Buffer.new()` or
`GtkSource.Buffer.newWithLanguage()`. The second form is just a convenience
function which allows you to initially set a `Language`. You can also
directly create a `View` and get its `Buffer` with
`Gtk.TextView.getBuffer()`.

The highlighting is enabled by default, but you can disable it with
`Buffer.setHighlightSyntax()`.

## Context Classes:

It is possible to retrieve some information from the syntax highlighting
engine. The default context classes that are applied to regions of a
`GtkSourceBuffer`:

 - **comment**: the region delimits a comment;
 - **no-spell-check**: the region should not be spell checked;
 - **path**: the region delimits a path to a file;
 - **string**: the region delimits a string.

Custom language definition files can create their own context classes,
since the functions like `Buffer.iterHasContextClass()` take
a string parameter as the context class.

`GtkSourceBuffer` provides an API to access the context classes:
`Buffer.iterHasContextClass()`,
`Buffer.getContextClassesAtIter()`,
`Buffer.iterForwardToContextClassToggle()` and
`Buffer.iterBackwardToContextClassToggle()`.

And the `GtkSource.Buffer.highlight-updated` signal permits to be notified
when a context class region changes.

Each context class has also an associated `Gtk.TextTag` with the name
`gtksourceview:context-classes:<name>`. For example to
retrieve the `Gtk.TextTag` for the string context class, one can write:
```c
GtkTextTagTable *tag_table;
GtkTextTag *tag;

tag_table = gtk_text_buffer_get_tag_table (buffer);
tag = gtk_text_tag_table_lookup (tag_table, "gtksourceview:context-classes:string");
```
```python
buffer = GtkSource.Buffer()

tag_table = buffer.get_tag_table()
tag = tag_table.lookup(name="gtksourceview:context-classes:string")
```

The tag must be used for read-only purposes.

Accessing a context class via the associated `Gtk.TextTag` is less
convenient than the `GtkSourceBuffer` API, because:

 - The tag doesn't always exist, you need to listen to the
   `Gtk.TextTagTable.tag-added` and `Gtk.TextTagTable.tag-removed` signals.
 - Instead of the `GtkSource.Buffer.highlight-updated` signal, you can listen
   to the `Gtk.TextBuffer.apply-tag` and `Gtk.TextBuffer.remove-tag` signals.

A possible use-case for accessing a context class via the associated
`Gtk.TextTag` is to read the region but without adding a hard dependency on the
GtkSourceView library (for example for a spell-checking library that wants to
read the no-spell-check region).

```tsx
import { GtkSourceBuffer } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkTextBuffer](.gtkx/reference/gtk/text-buffer.md) → **GtkSourceBuffer**

## Props

`ref` receives the `GtkSource.Buffer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `highlightMatchingBrackets`

`boolean` · default `true`

Whether to highlight matching brackets in the buffer.

### `highlightSyntax`

`boolean` · default `true`

Whether to highlight syntax in the buffer.

### `implicitTrailingNewline`

`boolean` · default `true`

Whether the buffer has an implicit trailing newline. See
`Buffer.setImplicitTrailingNewline()`.

### `language`

`GtkSource.Language | ReactElement`

### `loading`

`boolean` · default `false` · read-only, observe with `onNotifyLoading`

The "loading" property denotes that a `GtkSourceFileLoader` is
currently loading the buffer.

Applications may want to use this setting to avoid doing work
while the buffer is loading such as spellchecking.

_Available since 5.10._

### `styleScheme`

`GtkSource.StyleScheme | ReactElement`

Style scheme. It contains styles for syntax highlighting, optionally
foreground, background, cursor color, current line color, and matching
brackets style.

## Signals

### `onBracketMatched`

```ts
(iter: Gtk.TextIter | null, state: GtkSource.BracketMatchType, self: GtkSource.Buffer) => void
```

`iter` is set to a valid iterator pointing to the matching bracket
if `state` is `GTK_SOURCE_BRACKET_MATCH_FOUND`. Otherwise `iter` is
meaningless.

The signal is emitted only when the `state` changes, typically when
the cursor moves.

A use-case for this signal is to show messages in a `Gtk.Statusbar`.

**Parameters**

- `iter`: if found, the location of the matching bracket.
- `state`: state of bracket matching.
- `self`: The instance the signal was emitted on.

### `onCursorMoved`

```ts
(self: GtkSource.Buffer) => void
```

The "cursor-moved" signal is emitted when then insertion mark has moved.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onHighlightUpdated`

```ts
(start: Gtk.TextIter, end: Gtk.TextIter, self: GtkSource.Buffer) => void
```

The ::highlight-updated signal is emitted when the syntax
highlighting and [context classes](./class.Buffer.html#context-classes) are updated in a
certain region of the `buffer`.

**Parameters**

- `start`: the start of the updated region
- `end`: the end of the updated region
- `self`: The instance the signal was emitted on.

### `onSourceMarkUpdated`

```ts
(mark: Gtk.TextMark, self: GtkSource.Buffer) => void
```

The ::source-mark-updated signal is emitted each time
a mark is added to, moved or removed from the `buffer`.

**Parameters**

- `mark`: the `Mark`
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `GtkSource.Buffer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `backwardIterToSourceMark`

```ts
backwardIterToSourceMark(iter: Gtk.TextIter, category: string | null): boolean
```

Moves `iter` to the position of the previous `Mark` of the given
category.

Returns `true` if `iter` was moved. If `category` is NULL, the
previous source mark can be of any category.

**Parameters**

- `iter`: an iterator.
- `category`: category to search for, or `null`

**Returns** whether `iter` was moved.

### `changeCase`

```ts
changeCase(caseType: GtkSource.ChangeCaseType, start: Gtk.TextIter, end: Gtk.TextIter): void
```

Changes the case of the text between the specified iterators.

Since 5.4, this function will update the position of `start` and
`end` to surround the modified text.

**Parameters**

- `caseType`: how to change the case.
- `start`: a `GtkTextIter`.
- `end`: a `GtkTextIter`.

### `createSourceMark`

```ts
createSourceMark(name: string | null, category: string, where: Gtk.TextIter): GtkSource.Mark
```

Creates a source mark in the `buffer` of category `category`.

A source mark is a `Gtk.TextMark` but organized into categories.
Depending on the category a pixbuf can be specified that will be displayed
along the line of the mark.

Like a `Gtk.TextMark`, a `Mark` can be anonymous if the
passed `name` is `null`.  Also, the buffer owns the marks so you
shouldn't unreference it.

Marks always have left gravity and are moved to the beginning of
the line when the user deletes the line they were in.

Typical uses for a source mark are bookmarks, breakpoints, current
executing instruction indication in a source file, etc..

**Parameters**

- `name`: the name of the mark, or `null`.
- `category`: a string defining the mark category.
- `where`: location to place the mark.

**Returns** a new `Mark`, owned by the buffer.

### `ensureHighlight`

```ts
ensureHighlight(start: Gtk.TextIter, end: Gtk.TextIter): void
```

Forces buffer to analyze and highlight the given area synchronously.

**Note**:

This is a potentially slow operation and should be used only
when you need to make sure that some text not currently
visible is highlighted, for instance before printing.

**Parameters**

- `start`: start of the area to highlight.
- `end`: end of the area to highlight.

### `forwardIterToSourceMark`

```ts
forwardIterToSourceMark(iter: Gtk.TextIter, category: string | null): boolean
```

Moves `iter` to the position of the next `Mark` of the given
`category`.

Returns `true` if `iter` was moved. If `category` is NULL, the
next source mark can be of any category.

**Parameters**

- `iter`: an iterator.
- `category`: category to search for, or `null`

**Returns** whether `iter` was moved.

### `getContextClassesAtIter`

```ts
getContextClassesAtIter(iter: Gtk.TextIter): string[]
```

Get all defined context classes at `iter`.

See the `Buffer` description for the list of default context classes.

**Parameters**

- `iter`: a `GtkTextIter`.

**Returns** a new `null`
terminated array of context class names.
Use `g_strfreev()` to free the array if it is no longer needed.

### `getHighlightMatchingBrackets`

```ts
getHighlightMatchingBrackets(): boolean
```

Determines whether bracket match highlighting is activated for the
source buffer.

**Returns** `true` if the source buffer will highlight matching
brackets.

### `getHighlightSyntax`

```ts
getHighlightSyntax(): boolean
```

Determines whether syntax highlighting is activated in the source
buffer.

**Returns** `true` if syntax highlighting is enabled, `false` otherwise.

### `getImplicitTrailingNewline`

```ts
getImplicitTrailingNewline(): boolean
```

**Returns** whether the `buffer` has an implicit trailing newline.

### `getLanguage`

```ts
getLanguage(): GtkSource.Language | null
```

Returns the `Language` associated with the buffer,
see `Buffer.setLanguage()`.

The returned object should not be unreferenced by the user.

**Returns** the `Language` associated
with the buffer, or `null`.

### `getLoading`

```ts
getLoading(): boolean
```

### `getMarkup`

```ts
getMarkup(start: Gtk.TextIter, end: Gtk.TextIter): string
```

Returns the text in the specified range converting any text formatting
to equivalent Pango markup tags.
This allows the styled text to be displayed in other widgets that support
Pango markup, such as `GtkLabel`.

For very long ranges this function can take long enough that you could
potentially miss frame renderings.

**Parameters**

- `start`: start of range as a `GtkTextIter`
- `end`: end of range as a `GtkTextIter`

**Returns** a newly-allocated string containing the text
  with Pango markup, or `null` if `start` and `end` are invalid.

_Available since 5.18._

### `getSourceMarksAtIter`

```ts
getSourceMarksAtIter(iter: Gtk.TextIter, category: string | null): GtkSource.Mark[]
```

Returns the list of marks of the given category at `iter`.

If `category` is `null` it returns all marks at `iter`.

**Parameters**

- `iter`: an iterator.
- `category`: category to search for, or `null`

**Returns** a newly allocated `GSList`.

### `getSourceMarksAtLine`

```ts
getSourceMarksAtLine(line: number, category: string | null): GtkSource.Mark[]
```

Returns the list of marks of the given category at `line`.

If `category` is `null`, all marks at `line` are returned.

**Parameters**

- `line`: a line number.
- `category`: category to search for, or `null`

**Returns** a newly allocated `GSList`.

### `getStyleScheme`

```ts
getStyleScheme(): GtkSource.StyleScheme | null
```

Returns the `StyleScheme` associated with the buffer,
see `Buffer.setStyleScheme()`.

The returned object should not be unreferenced by the user.

**Returns** the `StyleScheme`
associated with the buffer, or `null`.

### `iterBackwardToContextClassToggle`

```ts
iterBackwardToContextClassToggle(iter: Gtk.TextIter, contextClass: string): boolean
```

Moves backward to the next toggle (on or off) of the context class.

If no matching context class toggles are found, returns `false`, otherwise `true`.
Does not return toggles located at `iter`, only toggles after `iter`. Sets
`iter` to the location of the toggle, or to the end of the buffer if no
toggle is found.

See the `Buffer` description for the list of default context classes.

**Parameters**

- `iter`: a `GtkTextIter`.
- `contextClass`: the context class.

**Returns** whether we found a context class toggle before `iter`

### `iterForwardToContextClassToggle`

```ts
iterForwardToContextClassToggle(iter: Gtk.TextIter, contextClass: string): boolean
```

Moves forward to the next toggle (on or off) of the context class.

If no matching context class toggles are found, returns `false`, otherwise `true`.
Does not return toggles located at `iter`, only toggles after `iter`. Sets
`iter` to the location of the toggle, or to the end of the buffer if no
toggle is found.

See the `Buffer` description for the list of default context classes.

**Parameters**

- `iter`: a `GtkTextIter`.
- `contextClass`: the context class.

**Returns** whether we found a context class toggle after `iter`

### `iterHasContextClass`

```ts
iterHasContextClass(iter: Gtk.TextIter, contextClass: string): boolean
```

Check if the class `context_class` is set on `iter`.

See the `Buffer` description for the list of default context classes.

**Parameters**

- `iter`: a `GtkTextIter`.
- `contextClass`: class to search for.

**Returns** whether `iter` has the context class.

### `joinLines`

```ts
joinLines(start: Gtk.TextIter, end: Gtk.TextIter): void
```

Joins the lines of text between the specified iterators.

**Parameters**

- `start`: a `GtkTextIter`.
- `end`: a `GtkTextIter`.

### `removeSourceMarks`

```ts
removeSourceMarks(start: Gtk.TextIter, end: Gtk.TextIter, category: string | null): void
```

Remove all marks of `category` between `start` and `end` from the buffer.

If `category` is NULL, all marks in the range will be removed.

**Parameters**

- `start`: a `GtkTextIter`.
- `end`: a `GtkTextIter`.
- `category`: category to search for, or `null`.

### `setHighlightMatchingBrackets`

```ts
setHighlightMatchingBrackets(highlight: boolean): void
```

Controls the bracket match highlighting function in the buffer.

If activated, when you position your cursor over a bracket character
(a parenthesis, a square bracket, etc.) the matching opening or
closing bracket character will be highlighted.

**Parameters**

- `highlight`: `true` if you want matching brackets highlighted.

### `setHighlightSyntax`

```ts
setHighlightSyntax(highlight: boolean): void
```

Controls whether syntax is highlighted in the buffer.

If `highlight` is `true`, the text will be highlighted according to the syntax
patterns specified in the `Language` set with `Buffer.setLanguage()`.

If `highlight` is `false`, syntax highlighting is disabled and all the
`Gtk.TextTag` objects that have been added by the syntax highlighting engine
are removed from the buffer.

**Parameters**

- `highlight`: `true` to enable syntax highlighting, `false` to disable it.

### `setImplicitTrailingNewline`

```ts
setImplicitTrailingNewline(implicitTrailingNewline: boolean): void
```

Sets whether the `buffer` has an implicit trailing newline.

If an explicit trailing newline is present in a `Gtk.TextBuffer`, `Gtk.TextView`
shows it as an empty line. This is generally not what the user expects.

If `implicit_trailing_newline` is `true` (the default value):
 - when a `FileLoader` loads the content of a file into the `buffer`,
   the trailing newline (if present in the file) is not inserted into the
   `buffer`.
 - when a `FileSaver` saves the content of the `buffer` into a file, a
   trailing newline is added to the file.

On the other hand, if `implicit_trailing_newline` is `false`, the file's
content is not modified when loaded into the `buffer`, and the `buffer`'s
content is not modified when saved into a file.

**Parameters**

- `implicitTrailingNewline`: the new value.

### `setLanguage`

```ts
setLanguage(language: GtkSource.Language | null): void
```

Associates a `Language` with the buffer.

Note that a `Language` affects not only the syntax highlighting, but
also the [context classes](./class.Buffer.html#context-classes). If you want to disable just the
syntax highlighting, see `Buffer.setHighlightSyntax()`.

The buffer holds a reference to `language`.

**Parameters**

- `language`: a `GtkSourceLanguage` to set, or `null`.

### `setStyleScheme`

```ts
setStyleScheme(scheme: GtkSource.StyleScheme | null): void
```

Sets a `StyleScheme` to be used by the buffer and the view.

Note that a `StyleScheme` affects not only the syntax highlighting,
but also other `View` features such as highlighting the current line,
matching brackets, the line numbers, etc.

Instead of setting a `null` `scheme`, it is better to disable syntax
highlighting with `Buffer.setHighlightSyntax()`, and setting the
`StyleScheme` with the "classic" or "tango" ID, because those two
style schemes follow more closely the GTK theme (for example for the
background color).

The buffer holds a reference to `scheme`.

**Parameters**

- `scheme`: a `GtkSourceStyleScheme` or `null`.

### `sortLines`

```ts
sortLines(start: Gtk.TextIter, end: Gtk.TextIter, flags: GtkSource.SortFlags, column: number): void
```

Sort the lines of text between the specified iterators.

**Parameters**

- `start`: a `GtkTextIter`.
- `end`: a `GtkTextIter`.
- `flags`: `GtkSourceSortFlags` specifying how the sort should behave
- `column`: sort considering the text starting at the given column
