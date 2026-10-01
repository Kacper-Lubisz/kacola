---
description: "Context for expanding SnippetChunk."
---

# GtkSourceSnippetContext

Context for expanding `SnippetChunk`.

This class is currently used primary as a hashtable. However, the longer
term goal is to have it hold onto a `GjsContext` as well as other languages
so that `SnippetChunk` can expand themselves by executing
script within the context.

The `Snippet` will build the context and then expand each of the
chunks during the insertion/edit phase.

```tsx
import { GtkSourceSnippetContext } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceSnippetContext**

## Props

`ref` receives the `GtkSource.SnippetContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onChanged`

```ts
(self: GtkSource.SnippetContext) => void
```

The signal is emitted when a change has been
discovered in one of the chunks of the snippet which has
caused a variable or other dynamic data within the context
to have changed.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `GtkSource.SnippetContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `clearVariables`

```ts
clearVariables(): void
```

Removes all variables from the context.

### `expand`

```ts
expand(input: string): string
```

### `getVariable`

```ts
getVariable(key: string): string | null
```

Gets the current value for a variable named `key`.

**Parameters**

- `key`: the name of the variable

**Returns** the value for the variable, or `null`

### `setConstant`

```ts
setConstant(key: string, value: string): void
```

Sets a constatnt within the context.

This is similar to a variable set with `SnippetContext.setVariable()`
but is expected to not change during use of the snippet.

Examples would be the date or users name.

**Parameters**

- `key`: the constant name
- `value`: the value of the constant

### `setLinePrefix`

```ts
setLinePrefix(linePrefix: string): void
```

### `setTabWidth`

```ts
setTabWidth(tabWidth: number): void
```

### `setUseSpaces`

```ts
setUseSpaces(useSpaces: boolean): void
```

### `setVariable`

```ts
setVariable(key: string, value: string): void
```

Sets a variable within the context.

This variable may be overridden by future updates to the
context.

**Parameters**

- `key`: the variable name
- `value`: the value for the variable
