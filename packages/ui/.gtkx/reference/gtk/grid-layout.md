---
description: "Arranges child widgets in rows and columns."
---

# GtkGridLayout

Arranges child widgets in rows and columns.

Children have an "attach point" defined by the horizontal and vertical
index of the cell they occupy; children can span multiple rows or columns.
The layout properties for setting the attach points and spans are set
using the `Gtk.GridLayoutChild` associated to each child widget.

The behaviour of `GtkGridLayout` when several children occupy the same
grid cell is undefined.

`GtkGridLayout` can be used like a `GtkBoxLayout` if all children are
attached to the same row or column; however, if you only ever need a
single row or column, you should consider using `GtkBoxLayout`.

```tsx
import { GtkGridLayout } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkLayoutManager](.gtkx/reference/gtk/layout-manager.md) → **GtkGridLayout**

## Props

`ref` receives the `Gtk.GridLayout` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `baselineRow`

`number` · default `0`

The row to align to the baseline, when `GtkWidget:valign` is set
to `GTK_ALIGN_BASELINE`.

### `columnHomogeneous`

`boolean` · default `false`

Whether all the columns in the grid have the same width.

### `columnSpacing`

`number` · default `0`

The amount of space between to consecutive columns.

### `rowHomogeneous`

`boolean` · default `false`

Whether all the rows in the grid have the same height.

### `rowSpacing`

`number` · default `0`

The amount of space between to consecutive rows.

## Methods

Methods are called on the `Gtk.GridLayout` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getBaselineRow`

```ts
getBaselineRow(): number
```

Retrieves the row set with `gtk_grid_layout_set_baseline_row()`.

**Returns** the global baseline row

### `getColumnHomogeneous`

```ts
getColumnHomogeneous(): boolean
```

Checks whether all columns of `grid` should have the same width.

**Returns** `true` if the columns are homogeneous, and `false` otherwise

### `getColumnSpacing`

```ts
getColumnSpacing(): number
```

Retrieves the spacing set with `gtk_grid_layout_set_column_spacing()`.

**Returns** the spacing between consecutive columns

### `getRowBaselinePosition`

```ts
getRowBaselinePosition(row: number): Gtk.BaselinePosition
```

Returns the baseline position of `row`.

If no value has been set with
`Gtk.GridLayout.setRowBaselinePosition()`,
the default value of `GTK_BASELINE_POSITION_CENTER`
is returned.

**Parameters**

- `row`: a row index

**Returns** the baseline position of `row`

### `getRowHomogeneous`

```ts
getRowHomogeneous(): boolean
```

Checks whether all rows of `grid` should have the same height.

**Returns** `true` if the rows are homogeneous, and `false` otherwise

### `getRowSpacing`

```ts
getRowSpacing(): number
```

Retrieves the spacing set with `gtk_grid_layout_set_row_spacing()`.

**Returns** the spacing between consecutive rows

### `setBaselineRow`

```ts
setBaselineRow(row: number): void
```

Sets which row defines the global baseline for the entire grid.

Each row in the grid can have its own local baseline, but only
one of those is global, meaning it will be the baseline in the
parent of the `grid`.

**Parameters**

- `row`: the row index

### `setColumnHomogeneous`

```ts
setColumnHomogeneous(homogeneous: boolean): void
```

Sets whether all columns of `grid` should have the same width.

**Parameters**

- `homogeneous`: `true` to make columns homogeneous

### `setColumnSpacing`

```ts
setColumnSpacing(spacing: number): void
```

Sets the amount of space to insert between consecutive columns.

**Parameters**

- `spacing`: the amount of space between columns, in pixels

### `setRowBaselinePosition`

```ts
setRowBaselinePosition(row: number, pos: Gtk.BaselinePosition): void
```

Sets how the baseline should be positioned on `row` of the
grid, in case that row is assigned more space than is requested.

**Parameters**

- `row`: a row index
- `pos`: a `GtkBaselinePosition`

### `setRowHomogeneous`

```ts
setRowHomogeneous(homogeneous: boolean): void
```

Sets whether all rows of `grid` should have the same height.

**Parameters**

- `homogeneous`: `true` to make rows homogeneous

### `setRowSpacing`

```ts
setRowSpacing(spacing: number): void
```

Sets the amount of space to insert between consecutive rows.

**Parameters**

- `spacing`: the amount of space between rows, in pixels
