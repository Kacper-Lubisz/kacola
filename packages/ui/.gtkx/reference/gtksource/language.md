---
description: "Represents a syntax highlighted language."
---

# GtkSourceLanguage

Represents a syntax highlighted language.

A `GtkSourceLanguage` represents a programming or markup language, affecting
syntax highlighting and [context classes](./class.Buffer.html#context-classes).

Use `LanguageManager` to obtain a `GtkSourceLanguage` instance, and
`Buffer.setLanguage()` to apply it to a `Buffer`.

```tsx
import { GtkSourceLanguage } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceLanguage**

## Props

`ref` receives the `GtkSource.Language` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `hidden`

`boolean` · default `false` · read-only, observe with `onNotifyHidden`

### `id`

`string` · default `null` · read-only, observe with `onNotifyId`

### `name`

`string` · default `null` · read-only, observe with `onNotifyName`

### `section`

`string` · default `null` · read-only, observe with `onNotifySection`

## Methods

Methods are called on the `GtkSource.Language` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getGlobs`

```ts
getGlobs(): string[] | null
```

Returns the globs associated to this language.

This is just an utility wrapper around `Language.getMetadata()` to
retrieve the "globs" metadata property and split it into an array.

**Returns** a newly-allocated `null` terminated array containing the globs or `null`
if no globs are found.
The returned array must be freed with `g_strfreev()`.

### `getHidden`

```ts
getHidden(): boolean
```

Returns whether the language should be hidden from the user.

**Returns** `true` if the language should be hidden, `false` otherwise.

### `getId`

```ts
getId(): string
```

Returns the ID of the language.

The ID is not locale-dependent.The returned string is owned by `language`
and should not be freed or modified.

**Returns** the ID of `language`.

### `getMetadata`

```ts
getMetadata(name: string): string | null
```

**Parameters**

- `name`: metadata property name.

**Returns** value of property `name` stored in
the metadata of `language` or `null` if language does not contain the
specified metadata property.
The returned string is owned by `language` and should not be freed
or modified.

### `getMimeTypes`

```ts
getMimeTypes(): string[] | null
```

Returns the mime types associated to this language.

This is just an utility wrapper around `Language.getMetadata()` to
retrieve the "mimetypes" metadata property and split it into an
array.

**Returns** a newly-allocated `null` terminated array containing the mime types
or `null` if no mime types are found.
The returned array must be freed with `g_strfreev()`.

### `getName`

```ts
getName(): string
```

Returns the localized name of the language.

The returned string is owned by `language` and should not be freed
or modified.

**Returns** the name of `language`.

### `getSection`

```ts
getSection(): string
```

Returns the localized section of the language.

Each language belong to a section (ex. HTML belongs to the
Markup section).
The returned string is owned by `language` and should not be freed
or modified.

**Returns** the section of `language`.

### `getStyleFallback`

```ts
getStyleFallback(styleId: string): string | null
```

Returns the ID of the style to use if the specified `style_id`
is not present in the current style scheme.

**Parameters**

- `styleId`: a style ID.

**Returns** the ID of the style to use if the
specified `style_id` is not present in the current style scheme or `null`
if the style has no fallback defined.
The returned string is owned by the `language` and must not be modified.

### `getStyleIds`

```ts
getStyleIds(): string[] | null
```

Returns the ids of the styles defined by this `language`.

**Returns** a newly-allocated `null` terminated array containing ids of the
styles defined by this `language` or `null` if no style is defined.
The returned array must be freed with `g_strfreev()`.

### `getStyleName`

```ts
getStyleName(styleId: string): string | null
```

Returns the name of the style with ID `style_id` defined by this `language`.

**Parameters**

- `styleId`: a style ID.

**Returns** the name of the style with ID `style_id`
defined by this `language` or `null` if the style has no name or there is no
style with ID `style_id` defined by this `language`.
The returned string is owned by the `language` and must not be modified.
