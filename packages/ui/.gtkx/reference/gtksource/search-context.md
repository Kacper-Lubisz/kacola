---
description: "Search context."
---

# GtkSourceSearchContext

Search context.

A `GtkSourceSearchContext` is used for the search and replace in a
`Buffer`. The search settings are represented by a
`SearchSettings` object. There can be a many-to-many relationship
between buffers and search settings, with the search contexts in-between: a
search settings object can be shared between several search contexts; and a
buffer can contain several search contexts at the same time.

The total number of search occurrences can be retrieved with
`SearchContext.getOccurrencesCount()`. To know the position of a
certain match, use `SearchContext.getOccurrencePosition()`.

The buffer is scanned asynchronously, so it doesn't block the user interface.
For each search, the buffer is scanned at most once. After that, navigating
through the occurrences doesn't require to re-scan the buffer entirely.

To search forward, use `SearchContext.forward()` or
`SearchContext.forwardAsync()` for the asynchronous version.
The backward search is done similarly. To replace a search match, or all
matches, use `SearchContext.replace()` and
`SearchContext.replaceAll()`.

The search occurrences are highlighted by default. To disable it, use
`SearchContext.setHighlight()`. You can enable the search
highlighting for several `GtkSourceSearchContext`s attached to the
same buffer. Moreover, each of those `GtkSourceSearchContext`s can
have a different text style associated. Use
`SearchContext.setMatchStyle()` to specify the `Style`
to apply on search matches.

Note that the `SearchContext.highlight` and
`SearchContext.matchStyle` properties are in the
`GtkSourceSearchContext` class, not `SearchSettings`. Appearance
settings should be tied to one, and only one buffer, as different buffers can
have different style scheme associated (a `SearchSettings` object
can be bound indirectly to several buffers).

The concept of "current match" doesn't exist yet. A way to highlight
differently the current match is to select it.

A search occurrence's position doesn't depend on the cursor position or other
parameters. Take for instance the buffer "aaaa" with the search text "aa".
The two occurrences are at positions [0:2] and [2:4]. If you begin to search
at position 1, you will get the occurrence [2:4], not [1:3]. This is a
prerequisite for regular expression searches. The pattern ".*" matches the
entire line. If the cursor is at the middle of the line, you don't want the
rest of the line as the occurrence, you want an entire line. (As a side note,
regular expression searches can also match multiple lines.)

In the GtkSourceView source code, there is an example of how to use the
search and replace API: see the tests/test-search.c file. It is a mini
application for the search and replace, with a basic user interface.

```tsx
import { GtkSourceSearchContext } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceSearchContext**

## Props

`ref` receives the `GtkSource.SearchContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `buffer`

`GtkSource.Buffer` · construct-only

The `Buffer` associated to the search context.

### `highlight`

`boolean` · default `true`

Highlight the search occurrences.

### `matchStyle`

`GtkSource.Style | ReactElement`

A `Style`, or `null` for theme's scheme default style.

### `occurrencesCount`

`number` · default `0` · read-only, observe with `onNotifyOccurrencesCount`

The total number of search occurrences. If the search is disabled,
the value is 0. If the buffer is not already fully scanned, the value
is -1.

### `regexError`

`GLib.Error` · read-only, observe with `onNotifyRegexError`

If the regex search pattern doesn't follow all the rules, this
`GError` property will be set. If the pattern is valid, the value is
`null`.

Free with `GLib.Error.free()`.

### `settings`

`GtkSource.SearchSettings` · construct-only

The `SearchSettings` associated to the search context.

This property is construct-only since version 4.0.

## Methods

Methods are called on the `GtkSource.SearchContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `backward`

```ts
backward(iter: Gtk.TextIter): [boolean, Gtk.TextIter, Gtk.TextIter, boolean]
```

Synchronous backward search.

It is recommended to use the asynchronous functions instead, to not block the user interface.
However, if you are sure that the `buffer` is small, this function is more convenient to use.

If the `SearchSettings.wrapAround` property is `false`, this function
doesn't try to wrap around.

The `has_wrapped_around` out parameter is set independently of whether a match
is found. So if this function returns `false`, `has_wrapped_around` will have
the same value as the `SearchSettings.wrapAround` property.

**Parameters**

- `iter`: start of search.

**Returns** Tuple of:

- `result`: whether a match was found.
- `matchStart`: return location for start of match, or `null`.
- `matchEnd`: return location for end of match, or `null`.
- `hasWrappedAround`: return location to know whether the search has wrapped around, or `null`.

### `backwardAsync`

```ts
backwardAsync(iter: Gtk.TextIter, cancellable?: Gio.Cancellable | null): Promise<[Gtk.TextIter, Gtk.TextIter, boolean]>
```

The asynchronous version of `SearchContext.backward()`.

See the `Gio.AsyncResult` documentation to know how to use this function.

If the operation is cancelled, the `callback` will only be called if
`cancellable` was not `null`. The method takes
ownership of `cancellable`, so you can unref it after calling this function.

**Parameters**

- `iter`: start of search.
- `cancellable`: a `GCancellable`, or `null`.

**Returns** Tuple of:

- `matchStart`: return location for start of match, or `null`.
- `matchEnd`: return location for end of match, or `null`.
- `hasWrappedAround`: return location to know whether the search has wrapped around, or `null`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `backwardFinish`

```ts
backwardFinish(result: Gio.AsyncResult): [boolean, Gtk.TextIter, Gtk.TextIter, boolean]
```

Finishes a backward search started with
`SearchContext.backwardAsync()`.

See the documentation of `SearchContext.backward()` for more
details.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** Tuple of:

- `result`: whether a match was found.
- `matchStart`: return location for start of match, or `null`.
- `matchEnd`: return location for end of match, or `null`.
- `hasWrappedAround`: return location to know whether the search has wrapped around, or `null`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `forward`

```ts
forward(iter: Gtk.TextIter): [boolean, Gtk.TextIter, Gtk.TextIter, boolean]
```

Synchronous forward search.

It is recommended to use the asynchronous functions instead, to not block the user interface.
However, if you are sure that the `buffer` is small, this function is more convenient to use.

If the `SearchSettings.wrapAround` property is `false`, this function
doesn't try to wrap around.

The `has_wrapped_around` out parameter is set independently of whether a match
is found. So if this function returns `false`, `has_wrapped_around` will have
the same value as the  `SearchSettings.wrapAround` property.

**Parameters**

- `iter`: start of search.

**Returns** Tuple of:

- `result`: whether a match was found.
- `matchStart`: return location for start of match, or `null`.
- `matchEnd`: return location for end of match, or `null`.
- `hasWrappedAround`: return location to know whether the search has wrapped around, or `null`.

### `forwardAsync`

```ts
forwardAsync(iter: Gtk.TextIter, cancellable?: Gio.Cancellable | null): Promise<[Gtk.TextIter, Gtk.TextIter, boolean]>
```

The asynchronous version of `SearchContext.forward()`.

See the `Gio.AsyncResult` documentation to know how to use this function.

If the operation is cancelled, the `callback` will only be called if
`cancellable` was not `null`. The method takes
ownership of `cancellable`, so you can unref it after calling this function.

**Parameters**

- `iter`: start of search.
- `cancellable`: a `GCancellable`, or `null`.

**Returns** Tuple of:

- `matchStart`: return location for start of match, or `null`.
- `matchEnd`: return location for end of match, or `null`.
- `hasWrappedAround`: return location to know whether the search has wrapped around, or `null`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `forwardFinish`

```ts
forwardFinish(result: Gio.AsyncResult): [boolean, Gtk.TextIter, Gtk.TextIter, boolean]
```

Finishes a forward search started with `SearchContext.forwardAsync()`.

See the documentation of `SearchContext.forward()` for more
details.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** Tuple of:

- `result`: whether a match was found.
- `matchStart`: return location for start of match, or `null`.
- `matchEnd`: return location for end of match, or `null`.
- `hasWrappedAround`: return location to know whether the search has wrapped around, or `null`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `getBuffer`

```ts
getBuffer(): GtkSource.Buffer
```

**Returns** the associated buffer.

### `getHighlight`

```ts
getHighlight(): boolean
```

**Returns** whether to highlight the search occurrences.

### `getMatchStyle`

```ts
getMatchStyle(): GtkSource.Style | null
```

**Returns** the `GtkSourceStyle` to apply on search matches.

### `getOccurrencePosition`

```ts
getOccurrencePosition(matchStart: Gtk.TextIter, matchEnd: Gtk.TextIter): number
```

Gets the position of a search occurrence.

If the buffer is not already fully scanned, the position may be unknown,
and -1 is returned. If 0 is returned, it means that this part of the buffer
has already been scanned, and that `match_start` and `match_end` don't delimit an occurrence.

**Parameters**

- `matchStart`: the start of the occurrence.
- `matchEnd`: the end of the occurrence.

**Returns** the position of the search occurrence. The first occurrence has the
position 1 (not 0). Returns 0 if `match_start` and `match_end` don't delimit
an occurrence. Returns -1 if the position is not yet known.

### `getOccurrencesCount`

```ts
getOccurrencesCount(): number
```

Gets the total number of search occurrences.

If the buffer is not already fully scanned, the total number of occurrences is
unknown, and -1 is returned.

**Returns** the total number of search occurrences, or -1 if unknown.

### `getRegexError`

```ts
getRegexError(): GLib.Error | null
```

Regular expression patterns must follow certain rules. If
`SearchSettings.searchText` breaks a rule, the error can be
retrieved with this function.

The error domain is `GLib.RegexError`.

Free the return value with `GLib.Error.free()`.

**Returns** the `GError`, or `null` if the
  pattern is valid.

### `getSettings`

```ts
getSettings(): GtkSource.SearchSettings
```

**Returns** the search settings.

### `replace`

```ts
replace(matchStart: Gtk.TextIter, matchEnd: Gtk.TextIter, replace: string, replaceLength: number): boolean
```

Replaces a search match by another text. If `match_start` and `match_end`
doesn't correspond to a search match, `false` is returned.

`match_start` and `match_end` iters are revalidated to point to the replacement
text boundaries.

For a regular expression replacement, you can check if `replace` is valid by
calling `GLib.Regex.checkReplacement()`. The `replace` text can contain
backreferences.

**Parameters**

- `matchStart`: the start of the match to replace.
- `matchEnd`: the end of the match to replace.
- `replace`: the replacement text.
- `replaceLength`: the length of `replace` in bytes, or -1.

**Returns** whether the match has been replaced.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `replaceAll`

```ts
replaceAll(replace: string, replaceLength: number): number
```

Replaces all search matches by another text.

It is a synchronous function, so it can block the user interface.

For a regular expression replacement, you can check if `replace` is valid by
calling `GLib.Regex.checkReplacement()`. The `replace` text can contain
backreferences.

**Parameters**

- `replace`: the replacement text.
- `replaceLength`: the length of `replace` in bytes, or -1.

**Returns** the number of replaced matches.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `setHighlight`

```ts
setHighlight(highlight: boolean): void
```

Enables or disables the search occurrences highlighting.

**Parameters**

- `highlight`: the setting.

### `setMatchStyle`

```ts
setMatchStyle(matchStyle: GtkSource.Style | null): void
```

Set the style to apply on search matches.

If `match_style` is `null`, default theme's scheme 'match-style' will be used.
To enable or disable the search highlighting, use `SearchContext.setHighlight()`.

**Parameters**

- `matchStyle`: a `GtkSourceStyle`, or `null`.
