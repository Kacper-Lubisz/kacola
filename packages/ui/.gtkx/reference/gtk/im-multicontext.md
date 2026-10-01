---
description: "Supports switching between multiple input methods."
---

# GtkIMMulticontext

Supports switching between multiple input methods.

Text widgets such as `GtkText` or `GtkTextView` use a `GtkIMMultiContext`
to implement their `im-module` property for switching between different
input methods.

```tsx
import { GtkIMMulticontext } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkIMContext](.gtkx/reference/gtk/im-context.md) → **GtkIMMulticontext**

## Props

`ref` receives the `Gtk.IMMulticontext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.IMMulticontext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getContextId`

```ts
getContextId(): string
```

Gets the id of the currently active delegate of the `context`.

**Returns** the id of the currently active delegate

### `setContextId`

```ts
setContextId(contextId: string | null): void
```

Sets the context id for `context`.

This causes the currently active delegate of `context` to be
replaced by the delegate corresponding to the new context id.

Setting this to a non-`null` value overrides the system-wide
IM module setting. See the `Gtk.Settings.gtkImModule`
property.

**Parameters**

- `contextId`: the id to use
