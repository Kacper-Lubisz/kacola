---
description: "A CompletionProvider for the completion of snippets."
---

# GtkSourceCompletionSnippets

A `CompletionProvider` for the completion of snippets.

The `GtkSourceCompletionSnippets` is an example of an implementation of
the `CompletionProvider` interface. The proposals are snippets
registered with the `SnippetManager`.

```tsx
import { GtkSourceCompletionSnippets } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceCompletionSnippets**

Implements `GtkSourceCompletionProvider`.

## Props

`ref` receives the `GtkSource.CompletionSnippets` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `priority`

`number` · default `0`

### `title`

`string` · default `null`
