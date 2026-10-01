---
description: "A chunk of text within the source snippet."
---

# GtkSourceSnippetChunk

A chunk of text within the source snippet.

The `GtkSourceSnippetChunk` represents a single chunk of text that
may or may not be an edit point within the snippet. Chunks that are
an edit point (also called a tab stop) have the
`SnippetChunk.focusPosition` property set.

```tsx
import { GtkSourceSnippetChunk } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → **GtkSourceSnippetChunk**

## Props

`ref` receives the `GtkSource.SnippetChunk` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `context`

`GtkSource.SnippetContext | ReactElement`

### `focusPosition`

`number` · default `-1`

### `spec`

`string` · default `null`

### `text`

`string` · default `null`

### `textSet`

`boolean` · default `false`

### `tooltipText`

`string` · default `null`

## Methods

Methods are called on the `GtkSource.SnippetChunk` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `copy`

```ts
copy(): GtkSource.SnippetChunk
```

Copies the source snippet.

**Returns** A `GtkSourceSnippetChunk`

### `getContext`

```ts
getContext(): GtkSource.SnippetContext
```

Gets the context for the snippet insertion.

**Returns** A `GtkSourceSnippetContext`

### `getFocusPosition`

```ts
getFocusPosition(): number
```

Gets the `SnippetChunk.focusPosition`.

The focus-position is used to determine how many tabs it takes for the
snippet to advanced to this chunk.

A focus-position of zero will be the last focus position of the snippet
and snippet editing ends when it has been reached.

A focus-position of -1 means the chunk cannot be focused by the user.

**Returns** the focus-position

### `getSpec`

```ts
getSpec(): string | null
```

Gets the specification for the chunk.

The specification is evaluated for variables when other chunks are edited
within the snippet context. If the user has changed the text, the
`SnippetChunk.text` and `SnippetChunk.textSet` properties
are updated.

**Returns** the specification, if any

### `getText`

```ts
getText(): string
```

Gets the `SnippetChunk.text` property.

The text property is updated when the user edits the text of the chunk.
If it has not been edited, the `SnippetChunk.spec` property is
returned.

**Returns** the text of the chunk

### `getTextSet`

```ts
getTextSet(): boolean
```

Gets the `SnippetChunk.textSet` property.

This is typically set when the user has edited a snippet chunk.

### `getTooltipText`

```ts
getTooltipText(): string
```

### `setContext`

```ts
setContext(context: GtkSource.SnippetContext): void
```

### `setFocusPosition`

```ts
setFocusPosition(focusPosition: number): void
```

Sets the `SnippetChunk.focusPosition` property.

The focus-position is used to determine how many tabs it takes for the
snippet to advanced to this chunk.

A focus-position of zero will be the last focus position of the snippet
and snippet editing ends when it has been reached.

A focus-position of -1 means the chunk cannot be focused by the user.

**Parameters**

- `focusPosition`: the focus-position

### `setSpec`

```ts
setSpec(spec: string): void
```

Sets the specification for the chunk.

The specification is evaluated for variables when other chunks are edited
within the snippet context. If the user has changed the text, the
[property@SnippetChunk:text and] `SnippetChunk.textSet` properties
are updated.

**Parameters**

- `spec`: the new specification for the chunk

### `setText`

```ts
setText(text: string): void
```

Sets the text for the snippet chunk.

This is usually used by the snippet engine to update the text, but may
be useful when creating custom snippets to avoid expansion of any
specification.

**Parameters**

- `text`: the text of the property

### `setTextSet`

```ts
setTextSet(textSet: boolean): void
```

Sets the `SnippetChunk.textSet` property.

This is typically set when the user has edited a snippet chunk by the
snippet engine.

**Parameters**

- `textSet`: the property value

### `setTooltipText`

```ts
setTooltipText(tooltipText: string): void
```
