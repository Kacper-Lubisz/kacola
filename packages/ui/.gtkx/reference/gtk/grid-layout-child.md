---
description: "GtkLayoutChild subclass for children in a GtkGridLayout."
---

# GtkGridLayoutChild

`GtkLayoutChild` subclass for children in a `GtkGridLayout`.

```tsx
import { GtkGridLayoutChild } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkLayoutChild](.gtkx/reference/gtk/layout-child.md) → **GtkGridLayoutChild**

## Props

`ref` receives the `Gtk.GridLayoutChild` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `column`

`number` · default `0`

The column to place the child in.

### `columnSpan`

`number` · default `1`

The number of columns the child spans to.

### `row`

`number` · default `0`

The row to place the child in.

### `rowSpan`

`number` · default `1`

The number of rows the child spans to.

## Methods

Methods are called on the `Gtk.GridLayoutChild` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getColumn`

```ts
getColumn(): number
```

Retrieves the column number to which `child` attaches its left side.

**Returns** the column number

### `getColumnSpan`

```ts
getColumnSpan(): number
```

Retrieves the number of columns that `child` spans to.

**Returns** the number of columns

### `getRow`

```ts
getRow(): number
```

Retrieves the row number to which `child` attaches its top side.

**Returns** the row number

### `getRowSpan`

```ts
getRowSpan(): number
```

Retrieves the number of rows that `child` spans to.

**Returns** the number of row

### `setColumn`

```ts
setColumn(column: number): void
```

Sets the column number to attach the left side of `child`.

**Parameters**

- `column`: the attach point for `child`

### `setColumnSpan`

```ts
setColumnSpan(span: number): void
```

Sets the number of columns `child` spans to.

**Parameters**

- `span`: the span of `child`

### `setRow`

```ts
setRow(row: number): void
```

Sets the row to place `child` in.

**Parameters**

- `row`: the row for `child`

### `setRowSpan`

```ts
setRowSpan(span: number): void
```

Sets the number of rows `child` spans to.

**Parameters**

- `span`: the span of `child`
