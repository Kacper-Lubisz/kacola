---
description: "Search settings."
---

# GtkSourceSearchSettings

Search settings.

A `GtkSourceSearchSettings` object represents the settings of a search. The
search settings can be associated with one or several
`SearchContext`s.

```tsx
import { GtkSourceSearchSettings } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceSearchSettings**

## Props

`ref` receives the `GtkSource.SearchSettings` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `atWordBoundaries`

`boolean` · default `false`

If `true`, a search match must start and end a word. The match can
span multiple words.

### `caseSensitive`

`boolean` · default `false`

Whether the search is case sensitive.

### `regexEnabled`

`boolean` · default `false`

Search by regular expressions with
`SearchSettings.searchText` as the pattern.

### `searchText`

`string` · default `null`

A search string, or `null` if the search is disabled.

If the regular expression search is enabled, `SearchSettings.searchText` is
the pattern.

### `visibleOnly`

`boolean` · default `true`

Exclude invisible text from the search.
A search match may have invisible text interspersed.

_Available since 5.12._

### `wrapAround`

`boolean` · default `false`

For a forward search, continue at the beginning of the buffer if no
search occurrence is found. For a backward search, continue at the
end of the buffer.

## Methods

Methods are called on the `GtkSource.SearchSettings` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getAtWordBoundaries`

```ts
getAtWordBoundaries(): boolean
```

**Returns** whether to search at word boundaries.

### `getCaseSensitive`

```ts
getCaseSensitive(): boolean
```

**Returns** whether the search is case sensitive.

### `getRegexEnabled`

```ts
getRegexEnabled(): boolean
```

**Returns** whether to search by regular expressions.

### `getSearchText`

```ts
getSearchText(): string | null
```

Gets the text to search.

The return value must not be freed.

You may be interested to call `utilsEscapeSearchText()` after
this function.

**Returns** the text to search, or `null` if the search is disabled.

### `getVisibleOnly`

```ts
getVisibleOnly(): boolean
```

**Returns** whether to exclude invisible text from the search.

_Available since 5.12._

### `getWrapAround`

```ts
getWrapAround(): boolean
```

**Returns** whether to wrap around the search.

### `setAtWordBoundaries`

```ts
setAtWordBoundaries(atWordBoundaries: boolean): void
```

Change whether the search is done at word boundaries.

If `at_word_boundaries` is `true`, a search match must start and end a word.
The match can span multiple words. See also `Gtk.TextIter.startsWord()` and
`Gtk.TextIter.endsWord()`.

**Parameters**

- `atWordBoundaries`: the setting.

### `setCaseSensitive`

```ts
setCaseSensitive(caseSensitive: boolean): void
```

Enables or disables the case sensitivity for the search.

**Parameters**

- `caseSensitive`: the setting.

### `setRegexEnabled`

```ts
setRegexEnabled(regexEnabled: boolean): void
```

Enables or disables whether to search by regular expressions.

If enabled, the `SearchSettings.searchText` property contains the
pattern of the regular expression.

`SearchContext` uses `GRegex` when regex search is enabled. See the
[Regular expression syntax](https://developer.gnome.org/glib/stable/glib-regex-syntax.html)
page in the GLib reference manual.

**Parameters**

- `regexEnabled`: the setting.

### `setSearchText`

```ts
setSearchText(searchText: string | null): void
```

Sets the text to search.

If `search_text` is `null` or is empty, the search will be disabled. A copy of `search_text`
will be made, so you can safely free `search_text` after a call to this function.

You may be interested to call `utilsUnescapeSearchText()` before
this function.

**Parameters**

- `searchText`: the nul-terminated text to search, or `null` to disable the search.

### `setVisibleOnly`

```ts
setVisibleOnly(visibleOnly: boolean): void
```

Enables or disables whether to exclude invisible text from the search.

If enabled, only visible text will be searched.
A search match may have invisible text interspersed.

**Parameters**

- `visibleOnly`: the setting.

_Available since 5.12._

### `setWrapAround`

```ts
setWrapAround(wrapAround: boolean): void
```

Enables or disables the wrap around search.

If `wrap_around` is `true`, the forward search continues at the beginning of the buffer
if no search occurrences are found. Similarly, the backward search continues to search at
the end of the buffer.

**Parameters**

- `wrapAround`: the setting.
