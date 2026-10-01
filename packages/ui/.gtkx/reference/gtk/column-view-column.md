---
description: "Represents the columns in a GtkColumnView."
---

# GtkColumnViewColumn

Represents the columns in a `GtkColumnView`.

The main ingredient for a `GtkColumnViewColumn` is the `GtkListItemFactory`
that tells the columnview how to create cells for this column from items in
the model.

Columns have a title, and can optionally have a header menu set
with `Gtk.ColumnViewColumn.setHeaderMenu()`.

A sorter can be associated with a column using
`Gtk.ColumnViewColumn.setSorter()`, to let users influence sorting
by clicking on the column header.

```tsx
import { GtkColumnViewColumn } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkColumnViewColumn**

## Props

`ref` receives the `Gtk.ColumnViewColumn` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `columnView`

`Gtk.ColumnView` · read-only, observe with `onNotifyColumnView`

The `GtkColumnView` this column is a part of.

### `expand`

`boolean` · default `false`

Column gets share of extra width allocated to the view.

### `factory`

`Gtk.ListItemFactory | ReactElement`

Factory for populating list items.

The factory must be for configuring `Gtk.ColumnViewCell` objects.

### `fixedWidth`

`number` · default `-1`

If not -1, this is the width that the column is allocated,
regardless of the size of its content.

### `headerMenu`

`Gio.MenuModel | ReactElement`

Menu model used to create the context menu for the column header.

### `id`

`string` · default `null`

An ID for the column.

GTK is not currently using the ID for anything, but
it can be used by applications when saving column view
configurations.

It is up to applications to ensure uniqueness of IDs.

_Available since 4.10._

### `resizable`

`boolean` · default `false`

Whether this column is resizable.

### `sorter`

`Gtk.Sorter | ReactElement`

Sorter for sorting items according to this column.

### `title`

`string` · default `null`

Title displayed in the header.

### `visible`

`boolean` · default `true`

Whether this column is visible.

## Methods

Methods are called on the `Gtk.ColumnViewColumn` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getColumnView`

```ts
getColumnView(): Gtk.ColumnView | null
```

Gets the column view that's currently displaying this column.

If `self` has not been added to a column view yet, `NULL` is returned.

**Returns** The column view displaying `self`.

### `getExpand`

```ts
getExpand(): boolean
```

Returns whether this column should expand.

**Returns** true if this column expands

### `getFactory`

```ts
getFactory(): Gtk.ListItemFactory | null
```

Gets the factory that's currently used to populate list items
for this column.

**Returns** The factory in use

### `getFixedWidth`

```ts
getFixedWidth(): number
```

Gets the fixed width of the column.

**Returns** the fixed with of the column

### `getHeaderMenu`

```ts
getHeaderMenu(): Gio.MenuModel | null
```

Gets the menu model that is used to create the context menu
for the column header.

**Returns** the `GMenuModel`

### `getId`

```ts
getId(): string | null
```

Returns the ID set with `Gtk.ColumnViewColumn.setId()`.

**Returns** The column's ID

_Available since 4.10._

### `getResizable`

```ts
getResizable(): boolean
```

Returns whether this column is resizable.

**Returns** true if this column is resizable

### `getSorter`

```ts
getSorter(): Gtk.Sorter | null
```

Returns the sorter that is associated with the column.

**Returns** the `GtkSorter` of `self`

### `getTitle`

```ts
getTitle(): string | null
```

Returns the title set with `Gtk.ColumnViewColumn.setTitle()`.

**Returns** The column's title

### `getVisible`

```ts
getVisible(): boolean
```

Returns whether this column is visible.

**Returns** true if this column is visible

### `setExpand`

```ts
setExpand(expand: boolean): void
```

Sets the column to take available extra space.

The extra space is shared equally amongst all columns that
have are set to expand.

**Parameters**

- `expand`: whether this column should expand to fill available space

### `setFactory`

```ts
setFactory(factory: Gtk.ListItemFactory | null): void
```

Sets the `GtkListItemFactory` to use for populating list items
for this column.

**Parameters**

- `factory`: the factory to use

### `setFixedWidth`

```ts
setFixedWidth(fixedWidth: number): void
```

Sets the fixed width of the column.

If `fixed_width` is -1, the fixed width of the column is unset.

Setting a fixed width overrides the automatically calculated
width. Interactive resizing also sets the “fixed-width” property.

**Parameters**

- `fixedWidth`: the new fixed width, or -1

### `setHeaderMenu`

```ts
setHeaderMenu(menu: Gio.MenuModel | null): void
```

Sets the menu model that is used to create the context menu
for the column header.

**Parameters**

- `menu`: a `GMenuModel`

### `setId`

```ts
setId(id: string | null): void
```

Sets the id of this column.

GTK makes no use of this, but applications can use it when
storing column view configuration.

It is up to callers to ensure uniqueness of IDs.

**Parameters**

- `id`: ID to use for this column

_Available since 4.10._

### `setResizable`

```ts
setResizable(resizable: boolean): void
```

Sets whether this column should be resizable by dragging.

**Parameters**

- `resizable`: whether this column should be resizable

### `setSorter`

```ts
setSorter(sorter: Gtk.Sorter | null): void
```

Associates a sorter with the column.

If `sorter` is unset, the column will not let users change
the sorting by clicking on its header.

This sorter can be made active by clicking on the column
header, or by calling `Gtk.ColumnView.sortByColumn()`.

See `Gtk.ColumnView.getSorter()` for the necessary steps
for setting up customizable sorting for `Gtk.ColumnView`.

**Parameters**

- `sorter`: the `GtkSorter` to associate with `column`

### `setTitle`

```ts
setTitle(title: string | null): void
```

Sets the title of this column.

The title is displayed in the header of a `GtkColumnView`
for this column and is therefore user-facing text that should
be translated.

**Parameters**

- `title`: Title to use for this column

### `setVisible`

```ts
setVisible(visible: boolean): void
```

Sets whether this column should be visible in views.

**Parameters**

- `visible`: whether this column should be visible
