---
description: "Determines whether to include items with a callback."
---

# GtkCustomFilter

Determines whether to include items with a callback.

```tsx
import { GtkCustomFilter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkFilter](.gtkx/reference/gtk/filter.md) → **GtkCustomFilter**

## Props

`ref` receives the `Gtk.CustomFilter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.CustomFilter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `setFilterFunc`

```ts
setFilterFunc(matchFunc: Gtk.CustomFilterFunc | null): void
```

Sets the function used for filtering items.

If `match_func` is `NULL`, the filter matches all items.

If the filter func changes its filtering behavior,
`Gtk.Filter.changed()` needs to be called.

If a previous function was set, its `user_destroy`
will be called.

**Parameters**

- `matchFunc`: function to filter items
