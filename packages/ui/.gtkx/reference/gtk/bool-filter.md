---
description: "Evaluates a boolean expression to determine whether to include items."
---

# GtkBoolFilter

Evaluates a boolean expression to determine whether to include items.

```tsx
import { GtkBoolFilter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkFilter](.gtkx/reference/gtk/filter.md) → **GtkBoolFilter**

## Props

`ref` receives the `Gtk.BoolFilter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `expression`

`Gtk.Expression`

The boolean expression to evaluate on each item.

### `invert`

`boolean` · default `false`

If the expression result should be inverted.

## Methods

Methods are called on the `Gtk.BoolFilter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getExpression`

```ts
getExpression(): Gtk.Expression | null
```

Gets the expression that the filter evaluates for
each item.

**Returns** the expression

### `getInvert`

```ts
getInvert(): boolean
```

Returns whether the filter inverts the expression.

**Returns** true if the filter inverts

### `setExpression`

```ts
setExpression(expression: Gtk.Expression | null): void
```

Sets the expression that the filter uses to check if items
should be filtered.

The expression must have a value type of `G_TYPE_BOOLEAN`.

**Parameters**

- `expression`: the expression

### `setInvert`

```ts
setInvert(invert: boolean): void
```

Sets whether the filter should invert the expression.

**Parameters**

- `invert`: true to invert
