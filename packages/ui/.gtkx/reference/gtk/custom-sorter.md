---
description: "Sorts items via a callback function."
---

# GtkCustomSorter

Sorts items via a callback function.

```tsx
import { GtkCustomSorter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkSorter](.gtkx/reference/gtk/sorter.md) → **GtkCustomSorter**

## Props

`ref` receives the `Gtk.CustomSorter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.CustomSorter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `setSortFunc`

```ts
setSortFunc(sortFunc: ((a: GObject.Object | null, b: GObject.Object | null) => number) | null): void
```

Sets (or unsets) the function used for sorting items.

If `sort_func` is `null`, all items are considered equal.

If the sort func changes its sorting behavior,
`gtk_sorter_changed()` needs to be called.

If a previous function was set, its `user_destroy` will be
called now.

**Parameters**

- `sortFunc`: function to sort items
