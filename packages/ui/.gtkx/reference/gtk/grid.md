---
description: "Arranges its child widgets in rows and columns."
---

# GtkGrid

Arranges its child widgets in rows and columns.



It supports arbitrary positions and horizontal/vertical spans.

Children are added using `Gtk.Grid.attach()`. They can span multiple
rows or columns. It is also possible to add a child next to an existing
child, using `Gtk.Grid.attachNextTo()`. To remove a child from the
grid, use `Gtk.Grid.remove()`.

The behaviour of `GtkGrid` when several children occupy the same grid
cell is undefined.

## GtkGrid as GtkBuildable

Every child in a `GtkGrid` has access to a custom `Gtk.Buildable`
element, called `<layout>`. It can by used to specify a position in the
grid and optionally spans. All properties that can be used in the `<layout>`
element are implemented by `Gtk.GridLayoutChild`.

It is implemented by `GtkWidget` using `Gtk.LayoutManager`.

To showcase it, here is a simple example:

```xml
<object class="GtkGrid" id="my_grid">
  <child>
    <object class="GtkButton" id="button1">
      <property name="label">Button 1</property>
      <layout>
        <property name="column">0</property>
        <property name="row">0</property>
      </layout>
    </object>
  </child>
  <child>
    <object class="GtkButton" id="button2">
      <property name="label">Button 2</property>
      <layout>
        <property name="column">1</property>
        <property name="row">0</property>
      </layout>
    </object>
  </child>
  <child>
    <object class="GtkButton" id="button3">
      <property name="label">Button 3</property>
      <layout>
        <property name="column">2</property>
        <property name="row">0</property>
        <property name="row-span">2</property>
      </layout>
    </object>
  </child>
  <child>
    <object class="GtkButton" id="button4">
      <property name="label">Button 4</property>
      <layout>
        <property name="column">0</property>
        <property name="row">1</property>
        <property name="column-span">2</property>
      </layout>
    </object>
  </child>
</object>
```

It organizes the first two buttons side-by-side in one cell each.
The third button is in the last column but spans across two rows.
This is defined by the `row-span` property. The last button is
located in the second row and spans across two columns, which is
defined by the `column-span` property.

## CSS nodes

`GtkGrid` uses a single CSS node with name `grid`.

## Accessibility

Until GTK 4.10, `GtkGrid` used the `Gtk.AccessibleRole.group` role.

Starting from GTK 4.12, `GtkGrid` uses the `Gtk.AccessibleRole.generic` role.

```tsx
import { GtkGrid } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkGrid**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.Grid` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `baselineRow`

`number` · default `0`

The row to align to the baseline when valign is using baseline alignment.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `columnHomogeneous`

`boolean` · default `false`

If `true`, the columns are all the same width.

### `columnSpacing`

`number` · default `0`

The amount of space between two consecutive columns.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `rowHomogeneous`

`boolean` · default `false`

If `true`, the rows are all the same height.

### `rowSpacing`

`number` · default `0`

The amount of space between two consecutive rows.

## Methods

Methods are called on the `Gtk.Grid` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `attach`

```ts
attach(child: Gtk.Widget, column: number, row: number, width: number, height: number): void
```

Adds a widget to the grid.

The position of `child` is determined by `column` and `row`.
The number of “cells” that `child` will occupy is determined
by `width` and `height`.

**Parameters**

- `child`: the widget to add
- `column`: the column number to attach the left side of `child` to
- `row`: the row number to attach the top side of `child` to
- `width`: the number of columns that `child` will span
- `height`: the number of rows that `child` will span

### `attachNextTo`

```ts
attachNextTo(child: Gtk.Widget, sibling: Gtk.Widget | null, side: Gtk.PositionType, width: number, height: number): void
```

Adds a widget to the grid.

The widget is placed next to `sibling`, on the side determined by
`side`. When `sibling` is `null`, the widget is placed in row (for
left or right placement) or column 0 (for top or bottom placement),
at the end indicated by `side`.

Attaching widgets labeled `[1]`, `[2]`, `[3]` with `@sibling == %NULL` and
`@side == %GTK_POS_LEFT` yields a layout of `[3][2][1]`.

**Parameters**

- `child`: the widget to add
- `sibling`: the child of `grid` that `child` will be placed next to, or `null` to place `child` at the beginning or end
- `side`: the side of `sibling` that `child` is positioned next to
- `width`: the number of columns that `child` will span
- `height`: the number of rows that `child` will span

### `getBaselineRow`

```ts
getBaselineRow(): number
```

Returns which row defines the global baseline of `grid`.

**Returns** the row index defining the global baseline

### `getChildAt`

```ts
getChildAt(column: number, row: number): Gtk.Widget | null
```

Gets the child of `grid` whose area covers the grid
cell at `column`, `row`.

**Parameters**

- `column`: the left edge of the cell
- `row`: the top edge of the cell

**Returns** the child at the given position

### `getColumnHomogeneous`

```ts
getColumnHomogeneous(): boolean
```

Returns whether all columns of `grid` have the same width.

**Returns** whether all columns of `grid` have the same width.

### `getColumnSpacing`

```ts
getColumnSpacing(): number
```

Returns the amount of space between the columns of `grid`.

**Returns** the column spacing of `grid`

### `getRowBaselinePosition`

```ts
getRowBaselinePosition(row: number): Gtk.BaselinePosition
```

Returns the baseline position of `row`.

See `Gtk.Grid.setRowBaselinePosition()`.

**Parameters**

- `row`: a row index

**Returns** the baseline position of `row`

### `getRowHomogeneous`

```ts
getRowHomogeneous(): boolean
```

Returns whether all rows of `grid` have the same height.

**Returns** whether all rows of `grid` have the same height.

### `getRowSpacing`

```ts
getRowSpacing(): number
```

Returns the amount of space between the rows of `grid`.

**Returns** the row spacing of `grid`

### `insertColumn`

```ts
insertColumn(position: number): void
```

Inserts a column at the specified position.

Children which are attached at or to the right of this position
are moved one column to the right. Children which span across this
position are grown to span the new column.

**Parameters**

- `position`: the position to insert the column at

### `insertNextTo`

```ts
insertNextTo(sibling: Gtk.Widget, side: Gtk.PositionType): void
```

Inserts a row or column at the specified position.

The new row or column is placed next to `sibling`, on the side
determined by `side`. If `side` is `GTK_POS_TOP` or `GTK_POS_BOTTOM`,
a row is inserted. If `side` is `GTK_POS_LEFT` of `GTK_POS_RIGHT`,
a column is inserted.

**Parameters**

- `sibling`: the child of `grid` that the new row or column will be placed next to
- `side`: the side of `sibling` that `child` is positioned next to

### `insertRow`

```ts
insertRow(position: number): void
```

Inserts a row at the specified position.

Children which are attached at or below this position
are moved one row down. Children which span across this
position are grown to span the new row.

**Parameters**

- `position`: the position to insert the row at

### `queryChild`

```ts
queryChild(child: Gtk.Widget): [number, number, number, number]
```

Queries the attach points and spans of `child` inside the given `GtkGrid`.

**Parameters**

- `child`: a `GtkWidget` child of `grid`

**Returns** Tuple of:

- `column`: the column used to attach the left side of `child`
- `row`: the row used to attach the top side of `child`
- `width`: the number of columns `child` spans
- `height`: the number of rows `child` spans

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes a child from `grid`.

The child must have been added with
`Gtk.Grid.attach()` or `Gtk.Grid.attachNextTo()`.

**Parameters**

- `child`: the child widget to remove

### `removeColumn`

```ts
removeColumn(position: number): void
```

Removes a column from the grid.

Children that are placed in this column are removed,
spanning children that overlap this column have their
width reduced by one, and children after the column
are moved to the left.

**Parameters**

- `position`: the position of the column to remove

### `removeRow`

```ts
removeRow(position: number): void
```

Removes a row from the grid.

Children that are placed in this row are removed,
spanning children that overlap this row have their
height reduced by one, and children below the row
are moved up.

**Parameters**

- `position`: the position of the row to remove

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

Sets whether all columns of `grid` will have the same width.

**Parameters**

- `homogeneous`: `true` to make columns homogeneous

### `setColumnSpacing`

```ts
setColumnSpacing(spacing: number): void
```

Sets the amount of space between columns of `grid`.

**Parameters**

- `spacing`: the amount of space to insert between columns

### `setRowBaselinePosition`

```ts
setRowBaselinePosition(row: number, pos: Gtk.BaselinePosition): void
```

Sets how the baseline should be positioned on `row` of the
grid, in case that row is assigned more space than is requested.

The default baseline position is `GTK_BASELINE_POSITION_CENTER`.

**Parameters**

- `row`: a row index
- `pos`: a `GtkBaselinePosition`

### `setRowHomogeneous`

```ts
setRowHomogeneous(homogeneous: boolean): void
```

Sets whether all rows of `grid` will have the same height.

**Parameters**

- `homogeneous`: `true` to make rows homogeneous

### `setRowSpacing`

```ts
setRowSpacing(spacing: number): void
```

Sets the amount of space between rows of `grid`.

**Parameters**

- `spacing`: the amount of space to insert between rows
