---
description: "A CompletionProvider for the completion of words."
---

# GtkSourceCompletionWords

A `CompletionProvider` for the completion of words.

The `GtkSourceCompletionWords` is an example of an implementation of
the `CompletionProvider` interface. The proposals are words
appearing in the registered `Gtk.TextBuffer`s.

```tsx
import { GtkSourceCompletionWords } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceCompletionWords**

Implements `GtkSourceCompletionProvider`.

## Props

`ref` receives the `GtkSource.CompletionWords` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `minimumWordSize`

`number` · default `2`

### `priority`

`number` · default `0`

### `proposalsBatchSize`

`number` · default `300`

### `scanBatchSize`

`number` · default `50`

### `title`

`string` · default `null`

## Methods

Methods are called on the `GtkSource.CompletionWords` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `register`

```ts
register(buffer: Gtk.TextBuffer): void
```

Registers `buffer` in the `words` provider.

**Parameters**

- `buffer`: a `GtkTextBuffer`

### `unregister`

```ts
unregister(buffer: Gtk.TextBuffer): void
```

Unregisters `buffer` from the `words` provider.

**Parameters**

- `buffer`: a `GtkTextBuffer`
