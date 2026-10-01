---
description: "Quick insertion code snippets."
---

# GtkSourceSnippet

Quick insertion code snippets.

The `GtkSourceSnippet` represents a series of chunks that can quickly be
inserted into the `View`.

Snippets are defined in XML files which are loaded by the
`SnippetManager`. Alternatively, applications can create snippets
on demand and insert them into the `View` using
`View.pushSnippet()`.

Snippet chunks can reference other snippet chunks as well as post-process
the values from other chunks such as capitalization.

```tsx
import { GtkSourceSnippet } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceSnippet**

## Props

`ref` receives the `GtkSource.Snippet` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `buffer`

`Gtk.TextBuffer` · read-only, observe with `onNotifyBuffer`

### `description`

`string` · default `null`

### `focusPosition`

`number` · default `-1` · read-only, observe with `onNotifyFocusPosition`

### `languageId`

`string` · default `null`

### `name`

`string` · default `null`

### `trigger`

`string` · default `null`

## Methods

Methods are called on the `GtkSource.Snippet` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `addChunk`

```ts
addChunk(chunk: GtkSource.SnippetChunk): void
```

Appends `chunk` to the `snippet`.

This may only be called before the snippet has been expanded.

**Parameters**

- `chunk`: a `GtkSourceSnippetChunk`

### `copy`

```ts
copy(): GtkSource.Snippet
```

Does a deep copy of the snippet.

**Returns** A new `GtkSourceSnippet`

### `getContext`

```ts
getContext(): GtkSource.SnippetContext | null
```

Gets the context used for expanding the snippet.

**Returns** an `GtkSourceSnippetContext`

### `getDescription`

```ts
getDescription(): string
```

Gets the description for the snippet.

### `getFocusPosition`

```ts
getFocusPosition(): number
```

Gets the current focus for the snippet.

This is changed as the user tabs through focus locations.

**Returns** The focus position, or -1 if unset.

### `getLanguageId`

```ts
getLanguageId(): string
```

Gets the language-id used for the source snippet.

The language identifier should be one that matches a
source language `Language.id` property.

**Returns** the language identifier

### `getName`

```ts
getName(): string
```

Gets the name for the snippet.

### `getNChunks`

```ts
getNChunks(): number
```

Gets the number of chunks in the snippet.

Note that not all chunks are editable.

**Returns** The number of chunks.

### `getNthChunk`

```ts
getNthChunk(nth: number): GtkSource.SnippetChunk
```

Gets the chunk at `nth`.

**Parameters**

- `nth`: the nth chunk to get

**Returns** an `GtkSourceSnippetChunk`

### `getTrigger`

```ts
getTrigger(): string | null
```

Gets the trigger for the source snippet.

A trigger is a word that can be expanded into the full snippet when
the user presses Tab.

**Returns** A string or `null`

### `setDescription`

```ts
setDescription(description: string): void
```

Sets the description for the snippet.

**Parameters**

- `description`: the snippet description

### `setLanguageId`

```ts
setLanguageId(languageId: string): void
```

Sets the language identifier for the snippet.

This should match the `Language.id` identifier.

**Parameters**

- `languageId`: the language identifier for the snippet

### `setName`

```ts
setName(name: string): void
```

Sets the name for the snippet.

**Parameters**

- `name`: the snippet name

### `setTrigger`

```ts
setTrigger(trigger: string): void
```

Sets the trigger for the snippet.

**Parameters**

- `trigger`: the trigger word
