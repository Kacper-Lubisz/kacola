---
description: "Provides access to Snippet."
---

# GtkSourceSnippetManager

Provides access to `Snippet`.

`GtkSourceSnippetManager` is an object which processes snippet description
files and creates `Snippet` objects.

Use `SnippetManager.getDefault()` to retrieve the default
instance of `GtkSourceSnippetManager`.

Use `SnippetManager.getSnippet()` to retrieve snippets for
a given snippets.

```tsx
import { GtkSourceSnippetManager } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceSnippetManager**

## Props

`ref` receives the `GtkSource.SnippetManager` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `searchPath`

`string[]`

Contains a list of directories to search for files containing snippets (*.snippets).

## Methods

Methods are called on the `GtkSource.SnippetManager` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getSearchPath`

```ts
getSearchPath(): string[]
```

Gets the list directories where `self` looks for snippet files.

**Returns** `null`-terminated array
  containing a list of snippet files directories.
  The array is owned by `lm` and must not be modified.

### `getSnippet`

```ts
getSnippet(group: string | null, languageId: string | null, trigger: string): GtkSource.Snippet | null
```

Queries the known snippets for the first matching `group`, `language_id`,
and/or `trigger`.

If `group` or `language_id` are `null`, they will be ignored.

**Parameters**

- `group`: a group name or `null`
- `languageId`: a `GtkSourceLanguage.id` or `null`
- `trigger`: the trigger for the snippet

**Returns** a `GtkSourceSnippet` or `null` if no
  matching snippet was found.

### `listAll`

```ts
listAll(): Gio.ListModel
```

Gets a `Gio.ListModel` of all snippets.

This can be used to get an unfiltered list of all of the snippets
known to the snippet manager.

**Returns** a `Gio.ListModel` of `GtkSource.Snippet`

_Available since 5.6._

### `listGroups`

```ts
listGroups(): string[]
```

List all the known groups within the snippet manager.

The result should be freed with `g_free()`, and the individual strings are
owned by `self` and should never be freed by the caller.

**Returns** An array of strings which should be freed with `g_free()`.

### `listMatching`

```ts
listMatching(group: string | null, languageId: string | null, triggerPrefix: string | null): Gio.ListModel
```

Queries the known snippets for those matching `group`, `language_id`, and/or
`trigger_prefix`.

If any of these are `null`, they will be ignored when filtering the available snippets.

The `Gio.ListModel` only contains information about the available snippets until
`Gio.ListModel.getItem()` is called for a specific snippet. This helps reduce
the number of `GObject.Object`'s that are created at runtime to those needed by
the calling application.

**Parameters**

- `group`: a group name or `null`
- `languageId`: a `GtkSourceLanguage.id` or `null`
- `triggerPrefix`: a prefix for a trigger to activate

**Returns** a `GListModel` of `GtkSourceSnippet`.

### `setSearchPath`

```ts
setSearchPath(dirs: string[] | null): void
```

Sets the list of directories in which the `GtkSourceSnippetManager` looks for
snippet files.

If `dirs` is `null`, the search path is reset to default.

At the moment this function can be called only before the
snippet files are loaded for the first time. In practice
to set a custom search path for a `GtkSourceSnippetManager`,
you have to call this function right after creating it.

**Parameters**

- `dirs`: a `null`-terminated array of strings or `null`.
