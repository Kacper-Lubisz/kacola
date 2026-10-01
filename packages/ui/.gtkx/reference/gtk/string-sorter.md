---
description: "Sorts items by comparing strings."
---

# GtkStringSorter

Sorts items by comparing strings.

To obtain the strings to compare, this sorter evaluates a
`Gtk.Expression`.

It does the comparison in a linguistically correct way using the
current locale by normalizing Unicode strings and possibly case-folding
them before performing the comparison.

```tsx
import { GtkStringSorter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkSorter](.gtkx/reference/gtk/sorter.md) → **GtkStringSorter**

## Props

`ref` receives the `Gtk.StringSorter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `collation`

`Gtk.Collation` · default `GTK_COLLATION_UNICODE`

The collation method to use for sorting.

The `GTK_COLLATION_NONE` value is useful when the expression already
returns collation keys, or strings that need to be compared byte-by-byte.

The default value, `GTK_COLLATION_UNICODE`, compares strings according
to the [Unicode collation algorithm](https://www.unicode.org/reports/tr10/).

_Available since 4.10._

### `expression`

`Gtk.Expression`

The expression to evaluate on item to get a string to compare with.

### `ignoreCase`

`boolean` · default `true`

If sorting is case sensitive.

## Methods

Methods are called on the `Gtk.StringSorter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getCollation`

```ts
getCollation(): Gtk.Collation
```

Gets which collation method the sorter uses.

**Returns** The collation method

_Available since 4.10._

### `getExpression`

```ts
getExpression(): Gtk.Expression | null
```

Gets the expression that is evaluated to obtain strings from items.

**Returns** a `GtkExpression`

### `getIgnoreCase`

```ts
getIgnoreCase(): boolean
```

Gets whether the sorter ignores case differences.

**Returns** `true` if `self` is ignoring case differences

### `setCollation`

```ts
setCollation(collation: Gtk.Collation): void
```

Sets the collation method to use for sorting.

**Parameters**

- `collation`: the collation method

_Available since 4.10._

### `setExpression`

```ts
setExpression(expression: Gtk.Expression | null): void
```

Sets the expression that is evaluated to obtain strings from items.

The expression must have the type `G_TYPE_STRING`.

**Parameters**

- `expression`: a `GtkExpression`

### `setIgnoreCase`

```ts
setIgnoreCase(ignoreCase: boolean): void
```

Sets whether the sorter will ignore case differences.

**Parameters**

- `ignoreCase`: `true` to ignore case differences
