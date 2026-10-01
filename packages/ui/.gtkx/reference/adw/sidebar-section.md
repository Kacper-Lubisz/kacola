---
description: "A section within Sidebar."
---

# AdwSidebarSection

A section within `Sidebar`.

`AdwSidebarSection` contains `SidebarItem` objects.

Section can optionally have a title, set with the
`SidebarSection.title` property. If a title is not set, the section
will have a separator in front of it, or just spacing in the
`Adw.SidebarMode.page` mode.

To add items, use `SidebarSection.append()`,
`SidebarSection.prepend()` or `SidebarSection.insert()`.

To remove items, use `SidebarSection.remove()` or
`SidebarSection.removeAll()`.

To inspect the items, use `SidebarSection.getItem()` or
`SidebarSection.items`.

To get the sidebar the section is in, use`SidebarSection.sidebar`.

### Binding models

`AdwSidebarSection` can show items from a provided `Gio.ListModel`,
using `SidebarSection.bindModel()`. It works the same way as
`Gtk.ListBox.bindModel()`, except the provided function creates an
`SidebarItem` rather than a `Gtk.ListBoxRow`.

While a model is bound, adding or removing items manually is not allowed.
Inspecting them is still allowed, but discouraged.

### `AdwSidebarSection` as `GtkBuildable`

`AdwSidebarSection` allows adding items as children.

Example of an `AdwSidebarSection` UI definition:

```xml
<object class="AdwSidebarSection">
  <property name="title" translatable="yes">Places</property>
  <child>
    <object class="AdwSidebarItem">
      <property name="title" translatable="yes">Music</property>
      <property name="icon-name">folder-music-symbolic</property>
    </object>
  </child>
  <child>
    <object class="AdwSidebarItem">
      <property name="title" translatable="yes">Pictures</property>
      <property name="icon-name">folder-pictures-symbolic</property>
    </object>
  </child>
  <child>
    <object class="AdwSidebarItem">
      <property name="title" translatable="yes">Videos</property>
      <property name="icon-name">folder-videos-symbolic</property>
    </object>
  </child>
</object>
```

Result:

_Available since 1.9._

```tsx
import { AdwSidebarSection } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwSidebarSection**

Implements `GtkBuildable`.

## Props

`ref` receives the `Adw.SidebarSection` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `items`

`Gio.ListModel` · read-only, observe with `onNotifyItems`

A list model with the section's items.

This can be used to keep an up-to-date view.

_Available since 1.9._

### `menuModel`

`Gio.MenuModel | ReactElement`

Context menu model for the section items.

When a context menu is shown for an item, it will be constructed from the
provided menu model. Use the `Sidebar.setup-menu` signal to set up
the menu actions for the particular item.

If not set, `Sidebar.menuModel` will be used instead.

_Available since 1.9._

### `sidebar`

`Adw.Sidebar` · read-only, observe with `onNotifySidebar`

The sidebar the section is in.

_Available since 1.9._

### `title`

`string`

Title of the section.

If set, it will be displayed instead of the separator before the section.

_Available since 1.9._

## Methods

Methods are called on the `Adw.SidebarSection` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(item: Adw.SidebarItem): void
```

Appends `item` to `self`.

Cannot be used while a model is bound via `SidebarSection.bindModel()`.

**Parameters**

- `item`: an item to append

_Available since 1.9._

### `bindModel`

```ts
bindModel(model: Gio.ListModel | null, createItemFunc: Adw.SidebarSectionCreateItemFunc | null): void
```

Binds `model` to `self`.

If `self` was already bound to a model, that previous binding is
destroyed.

The contents of `self` are cleared and then filled with items that
represent items from `model`. `self` is updated whenever `model` changes.

If `model` is `NULL`, `self` is left empty.

Calling `SidebarSection.prepend()`, `SidebarSection.insert()`,
`SidebarSection.append()`, `SidebarSection.remove()` or
`SidebarSection.removeAll()` while a model is bound is not allowed.

Accessing items and modifying them is allowed, but the changes will be erased
whenever that part of the model changes, so it's not recommended.

**Parameters**

- `model`: the model to be bound
- `createItemFunc`: a function that creates `SidebarItem` for model items, or `NULL` in case `model` is also `NULL`

_Available since 1.9._

### `getItem`

```ts
getItem(index: number): Adw.SidebarItem | null
```

Gets the item at `index` within `self`.

The index starts from 0 at the top of the section, and is same as the one
returned by `SidebarItem.getSectionIndex()`.

Can return `NULL` if `index` is larger or equal to the number of items.

**Parameters**

- `index`: index of the item

**Returns** the item at `index`

_Available since 1.9._

### `getItems`

```ts
getItems(): Gio.ListModel
```

Gets a list model with `self`'s items.

This can be used to keep an up-to-date view.

**Returns** a model containing the items

_Available since 1.9._

### `getMenuModel`

```ts
getMenuModel(): Gio.MenuModel | null
```

Gets the context menu model for `self`'s items.

**Returns** the context menu model

_Available since 1.9._

### `getSidebar`

```ts
getSidebar(): Adw.Sidebar | null
```

Gets the sidebar `self` is in.

**Returns** the sidebar of `self`

_Available since 1.9._

### `getTitle`

```ts
getTitle(): string | null
```

Gets the title of `self`.

**Returns** the title

_Available since 1.9._

### `insert`

```ts
insert(item: Adw.SidebarItem, position: number): void
```

Inserts `item` at `position` to `self`.

If `position` is -1, or larger than the total number of items in `self`,
the item will be appended to the end.

Cannot be used while a model is bound via `SidebarSection.bindModel()`.

**Parameters**

- `item`: an item to insert
- `position`: position to insert `item` at

_Available since 1.9._

### `prepend`

```ts
prepend(item: Adw.SidebarItem): void
```

Prepends `item` to `self`.

Cannot be used while a model is bound via `SidebarSection.bindModel()`.

**Parameters**

- `item`: an item to prepend

_Available since 1.9._

### `remove`

```ts
remove(item: Adw.SidebarItem): void
```

Removes `item` from `self`.

Cannot be used while a model is bound via `SidebarSection.bindModel()`.

**Parameters**

- `item`: an item to remove

_Available since 1.9._

### `removeAll`

```ts
removeAll(): void
```

Removes all items from `self`.

Cannot be used while a model is bound via `SidebarSection.bindModel()`.

_Available since 1.9._

### `setMenuModel`

```ts
setMenuModel(menuModel: Gio.MenuModel | null): void
```

Sets the context menu model for `self`'s items.

When a context menu is shown for an item, it will be constructed from the
provided menu model. Use the `Sidebar.setup-menu` signal to set up
the menu actions for the particular item.

If not set, `Sidebar.menuModel` will be used instead.

**Parameters**

- `menuModel`: a menu model

_Available since 1.9._

### `setTitle`

```ts
setTitle(title: string | null): void
```

Sets the title of `self`.

If set, it will be displayed instead of the separator before the section.

**Parameters**

- `title`: the title

_Available since 1.9._
