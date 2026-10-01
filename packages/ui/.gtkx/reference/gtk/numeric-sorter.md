---
description: "Sorts items numerically."
---

# GtkNumericSorter

Sorts items numerically.

To obtain the numbers to compare, this sorter evaluates a
`Gtk.Expression`.

```tsx
import { GtkNumericSorter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkSorter](.gtkx/reference/gtk/sorter.md) → **GtkNumericSorter**

## Props

`ref` receives the `Gtk.NumericSorter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `expression`

`Gtk.Expression`

The expression to evaluate on items to get a number to compare with.

### `sortOrder`

`Gtk.SortType` · default `GTK_SORT_ASCENDING`

Whether the sorter will sort smaller numbers first.

## Methods

Methods are called on the `Gtk.NumericSorter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getExpression`

```ts
getExpression(): Gtk.Expression | null
```

Gets the expression that is evaluated to obtain numbers from items.

**Returns** a `GtkExpression`

### `getSortOrder`

```ts
getSortOrder(): Gtk.SortType
```

Gets whether this sorter will sort smaller numbers first.

**Returns** the order of the numbers

### `setExpression`

```ts
setExpression(expression: Gtk.Expression | null): void
```

Sets the expression that is evaluated to obtain numbers from items.

Unless an expression is set on `self`, the sorter will always
compare items as invalid.

The expression must have a return type that can be compared
numerically, such as `G_TYPE_INT` or `G_TYPE_DOUBLE`.

**Parameters**

- `expression`: a `GtkExpression`

### `setSortOrder`

```ts
setSortOrder(sortOrder: Gtk.SortType): void
```

Sets whether to sort smaller numbers before larger ones.

**Parameters**

- `sortOrder`: whether to sort smaller numbers first
