---
description: "Determines whether to include items by comparing strings to a fixed search term."
---

# GtkStringFilter

Determines whether to include items by comparing strings to a fixed search term.

The strings are obtained from the items by evaluating an expression
set with `Gtk.StringFilter.setExpression()`, and they are
compared against a search term set with `Gtk.StringFilter.setSearch()`.

`GtkStringFilter` has several different modes of comparison - it
can match the whole string, just a prefix, or any substring. Use
`Gtk.StringFilter.setMatchMode()` choose a mode.

It is also possible to make case-insensitive comparisons, with
`Gtk.StringFilter.setIgnoreCase()`.

```tsx
import { GtkStringFilter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkFilter](.gtkx/reference/gtk/filter.md) → **GtkStringFilter**

## Props

`ref` receives the `Gtk.StringFilter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `expression`

`Gtk.Expression`

The expression to evaluate on each item to get a
string to compare with.

### `ignoreCase`

`boolean` · default `true`

If matching is case sensitive.

### `matchMode`

`Gtk.StringFilterMatchMode` · default `GTK_STRING_FILTER_MATCH_MODE_SUBSTRING`

If exact matches are necessary or if substrings are allowed.

### `search`

`string` · default `null`

The search term.

## Methods

Methods are called on the `Gtk.StringFilter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getExpression`

```ts
getExpression(): Gtk.Expression | null
```

Gets the expression that the string filter uses to
obtain strings from items.

**Returns** the expression

### `getIgnoreCase`

```ts
getIgnoreCase(): boolean
```

Returns whether the filter ignores case differences.

**Returns** true if the filter ignores case

### `getMatchMode`

```ts
getMatchMode(): Gtk.StringFilterMatchMode
```

Returns the match mode that the filter is using.

**Returns** the match mode of the filter

### `getSearch`

```ts
getSearch(): string | null
```

Gets the search term.

**Returns** the search term

### `setExpression`

```ts
setExpression(expression: Gtk.Expression | null): void
```

Sets the expression that the string filter uses to
obtain strings from items.

The expression must have a value type of `G_TYPE_STRING`.

**Parameters**

- `expression`: the expression

### `setIgnoreCase`

```ts
setIgnoreCase(ignoreCase: boolean): void
```

Sets whether the filter ignores case differences.

**Parameters**

- `ignoreCase`: true to ignore case

### `setMatchMode`

```ts
setMatchMode(mode: Gtk.StringFilterMatchMode): void
```

Sets the match mode for the filter.

**Parameters**

- `mode`: the new match mode

### `setSearch`

```ts
setSearch(search: string | null): void
```

Sets the string to search for.

**Parameters**

- `search`: the string to search for
