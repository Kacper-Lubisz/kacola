---
description: "Provides access to Languages."
---

# GtkSourceLanguageManager

Provides access to `Language`s.

`GtkSourceLanguageManager` is an object which processes language description
files and creates and stores `Language` objects, and provides API to
access them.

Use `LanguageManager.getDefault()` to retrieve the default
instance of `GtkSourceLanguageManager`, and
`LanguageManager.guessLanguage()` to get a `Language` for
given file name and content type.

```tsx
import { GtkSourceLanguageManager } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceLanguageManager**

## Props

`ref` receives the `GtkSource.LanguageManager` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `languageIds`

`string[]` · read-only, observe with `onNotifyLanguageIds`

### `searchPath`

`string[]`

## Methods

Methods are called on the `GtkSource.LanguageManager` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `appendSearchPath`

```ts
appendSearchPath(path: string): void
```

Appends `path` to the list of directories where the `manager` looks for
language files.

See `LanguageManager.setSearchPath()` for details.

**Parameters**

- `path`: a directory or a filename.

_Available since 5.4._

### `getLanguage`

```ts
getLanguage(id: string): GtkSource.Language | null
```

Gets the `Language` identified by the given `id` in the language
manager.

**Parameters**

- `id`: a language id.

**Returns** a `GtkSourceLanguage`, or `null`
if there is no language identified by the given `id`. Return value is
owned by `lm` and should not be freed.

### `getLanguageIds`

```ts
getLanguageIds(): string[] | null
```

Returns the ids of the available languages.

**Returns** a `null`-terminated array of strings containing the ids of the available
languages or `null` if no language is available.
The array is sorted alphabetically according to the language name.
The array is owned by `lm` and must not be modified.

### `getSearchPath`

```ts
getSearchPath(): string[]
```

Gets the list directories where `lm` looks for language files.

**Returns** `null`-terminated array
containing a list of language files directories.
The array is owned by `lm` and must not be modified.

### `guessLanguage`

```ts
guessLanguage(filename: string | null, contentType: string | null): GtkSource.Language | null
```

Picks a `Language` for given file name and content type,
according to the information in lang files.

Either `filename` or `content_type` may be `null`. This function can be used as follows:

```c
GtkSourceLanguage *lang;
GtkSourceLanguageManager *manager;
lm = gtk_source_language_manager_get_default ();
lang = gtk_source_language_manager_guess_language (manager, filename, NULL);
gtk_source_buffer_set_language (buffer, lang);
```
```python
manager = GtkSource.LanguageManager.get_default()
language = manager.guess_language(filename=filename, content_type=None)
buffer.set_language(language=language)
```

or

```c
GtkSourceLanguage *lang = NULL;
GtkSourceLanguageManager *manager;
gboolean result_uncertain;
gchar *content_type;

content_type = g_content_type_guess (filename, NULL, 0, &result_uncertain);
if (result_uncertain)
  {
    g_free (content_type);
    content_type = NULL;
  }

manager = gtk_source_language_manager_get_default ();
lang = gtk_source_language_manager_guess_language (manager, filename, content_type);
gtk_source_buffer_set_language (buffer, lang);

g_free (content_type);
```
```python
content_type, uncertain = Gio.content_type_guess(filename=filename, data=None)
if uncertain:
    content_type = None

manager = GtkSource.LanguageManager.get_default()
language = manager.guess_language(filename=filename, content_type=content_type)
buffer.set_language(language=language)
```

etc. Use `Language.getMimeTypes()` and `Language.getGlobs()`
if you need full control over file -> language mapping.

**Parameters**

- `filename`: a filename in Glib filename encoding, or `null`.
- `contentType`: a content type (as in GIO API), or `null`.

**Returns** a `GtkSourceLanguage`, or `null` if there
is no suitable language for given `filename` and/or `content_type`. Return
value is owned by `lm` and should not be freed.

### `prependSearchPath`

```ts
prependSearchPath(path: string): void
```

Prepends `path` to the list of directories where the `manager` looks
for language files.

See `LanguageManager.setSearchPath()` for details.

**Parameters**

- `path`: a directory or a filename.

_Available since 5.4._

### `setSearchPath`

```ts
setSearchPath(dirs: string[] | null): void
```

Sets the list of directories where the `lm` looks for
language files.

If `dirs` is `null`, the search path is reset to default.

At the moment this function can be called only before the
language files are loaded for the first time. In practice
to set a custom search path for a `GtkSourceLanguageManager`,
you have to call this function right after creating it.

Since GtkSourceView 5.4 this function will allow you to provide
paths in the form of "resource:///" URIs to embedded `GResource`s.
They must contain the path of a directory within the `GResource`.

**Parameters**

- `dirs`: a `null`-terminated array of strings or `null`.
