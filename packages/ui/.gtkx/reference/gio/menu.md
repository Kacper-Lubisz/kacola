---
description: "GMenu is a simple implementation of Gio.MenuModel."
---

# GMenu

`GMenu` is a simple implementation of `Gio.MenuModel`.
You populate a `GMenu` by adding `Gio.MenuItem` instances to it.

There are some convenience functions to allow you to directly
add items (avoiding `Gio.MenuItem`) for the common cases. To add
a regular item, use `Gio.Menu.insert()`. To add a section, use
`Gio.Menu.insertSection()`. To add a submenu, use
`Gio.Menu.insertSubmenu()`.

_Available since 2.32._

```tsx
import { GMenu } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GMenuModel](.gtkx/reference/gio/menu-model.md) → **GMenu**

## Props

`ref` receives the `Gio.Menu` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `items`

`MenuItem[] | null`

Entries the menu is rebuilt from whenever they change.

## Methods

Methods are called on the `Gio.Menu` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(label: string | null, detailedAction: string | null): void
```

Convenience function for appending a normal menu item to the end of
`menu`.  Combine `g_menu_item_new()` and `g_menu_insert_item()` for a more
flexible alternative.

**Parameters**

- `label`: the section label, or `null`
- `detailedAction`: the detailed action string, or `null`

_Available since 2.32._

### `appendItem`

```ts
appendItem(item: Gio.MenuItem): void
```

Appends `item` to the end of `menu`.

See `g_menu_insert_item()` for more information.

**Parameters**

- `item`: a `GMenuItem` to append

_Available since 2.32._

### `appendSection`

```ts
appendSection(label: string | null, section: Gio.MenuModel): void
```

Convenience function for appending a section menu item to the end of
`menu`.  Combine `g_menu_item_new_section()` and `g_menu_insert_item()` for a
more flexible alternative.

**Parameters**

- `label`: the section label, or `null`
- `section`: a `GMenuModel` with the items of the section

_Available since 2.32._

### `appendSubmenu`

```ts
appendSubmenu(label: string | null, submenu: Gio.MenuModel): void
```

Convenience function for appending a submenu menu item to the end of
`menu`.  Combine `g_menu_item_new_submenu()` and `g_menu_insert_item()` for a
more flexible alternative.

**Parameters**

- `label`: the section label, or `null`
- `submenu`: a `GMenuModel` with the items of the submenu

_Available since 2.32._

### `freeze`

```ts
freeze(): void
```

Marks `menu` as frozen.

After the menu is frozen, it is an error to attempt to make any
changes to it.  In effect this means that the `GMenu` API must no
longer be used.

This function causes `g_menu_model_is_mutable()` to begin returning
`false`, which has some positive performance implications.

_Available since 2.32._

### `insert`

```ts
insert(position: number, label: string | null, detailedAction: string | null): void
```

Convenience function for inserting a normal menu item into `menu`.
Combine `g_menu_item_new()` and `g_menu_insert_item()` for a more flexible
alternative.

**Parameters**

- `position`: the position at which to insert the item
- `label`: the section label, or `null`
- `detailedAction`: the detailed action string, or `null`

_Available since 2.32._

### `insertItem`

```ts
insertItem(position: number, item: Gio.MenuItem): void
```

Inserts `item` into `menu`.

The "insertion" is actually done by copying all of the attribute and
link values of `item` and using them to form a new item within `menu`.
As such, `item` itself is not really inserted, but rather, a menu item
that is exactly the same as the one presently described by `item`.

This means that `item` is essentially useless after the insertion
occurs.  Any changes you make to it are ignored unless it is inserted
again (at which point its updated values will be copied).

You should probably just free `item` once you're done.

There are many convenience functions to take care of common cases.
See `g_menu_insert()`, `g_menu_insert_section()` and
`g_menu_insert_submenu()` as well as "prepend" and "append" variants of
each of these functions.

**Parameters**

- `position`: the position at which to insert the item
- `item`: the `GMenuItem` to insert

_Available since 2.32._

### `insertSection`

```ts
insertSection(position: number, label: string | null, section: Gio.MenuModel): void
```

Convenience function for inserting a section menu item into `menu`.
Combine `g_menu_item_new_section()` and `g_menu_insert_item()` for a more
flexible alternative.

**Parameters**

- `position`: the position at which to insert the item
- `label`: the section label, or `null`
- `section`: a `GMenuModel` with the items of the section

_Available since 2.32._

### `insertSubmenu`

```ts
insertSubmenu(position: number, label: string | null, submenu: Gio.MenuModel): void
```

Convenience function for inserting a submenu menu item into `menu`.
Combine `g_menu_item_new_submenu()` and `g_menu_insert_item()` for a more
flexible alternative.

**Parameters**

- `position`: the position at which to insert the item
- `label`: the section label, or `null`
- `submenu`: a `GMenuModel` with the items of the submenu

_Available since 2.32._

### `prepend`

```ts
prepend(label: string | null, detailedAction: string | null): void
```

Convenience function for prepending a normal menu item to the start
of `menu`.  Combine `g_menu_item_new()` and `g_menu_insert_item()` for a more
flexible alternative.

**Parameters**

- `label`: the section label, or `null`
- `detailedAction`: the detailed action string, or `null`

_Available since 2.32._

### `prependItem`

```ts
prependItem(item: Gio.MenuItem): void
```

Prepends `item` to the start of `menu`.

See `g_menu_insert_item()` for more information.

**Parameters**

- `item`: a `GMenuItem` to prepend

_Available since 2.32._

### `prependSection`

```ts
prependSection(label: string | null, section: Gio.MenuModel): void
```

Convenience function for prepending a section menu item to the start
of `menu`.  Combine `g_menu_item_new_section()` and `g_menu_insert_item()` for
a more flexible alternative.

**Parameters**

- `label`: the section label, or `null`
- `section`: a `GMenuModel` with the items of the section

_Available since 2.32._

### `prependSubmenu`

```ts
prependSubmenu(label: string | null, submenu: Gio.MenuModel): void
```

Convenience function for prepending a submenu menu item to the start
of `menu`.  Combine `g_menu_item_new_submenu()` and `g_menu_insert_item()` for
a more flexible alternative.

**Parameters**

- `label`: the section label, or `null`
- `submenu`: a `GMenuModel` with the items of the submenu

_Available since 2.32._

### `remove`

```ts
remove(position: number): void
```

Removes an item from the menu.

`position` gives the index of the item to remove.

It is an error if position is not in range the range from 0 to one
less than the number of items in the menu.

It is not possible to remove items by identity since items are added
to the menu simply by copying their links and attributes (ie:
identity of the item itself is not preserved).

**Parameters**

- `position`: the position of the item to remove

_Available since 2.32._

### `removeAll`

```ts
removeAll(): void
```

Removes all items in the menu.

_Available since 2.38._
