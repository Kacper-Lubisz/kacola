---
description: "Used by list widgets to represent the headers they display."
---

# GtkListHeader

Used by list widgets to represent the headers they display.

`GtkListHeader` objects are managed just like `Gtk.ListItem`
objects via their factory, but provide a different set of properties suitable
for managing the header instead of individual items.

_Available since 4.12._

```tsx
import { GtkListHeader } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkListHeader**

## Props

`ref` receives the `Gtk.ListHeader` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `end`

`number` · default `4294967295` · read-only, observe with `onNotifyEnd`

The first position no longer part of this section.

_Available since 4.12._

### `item`

`GObject.Object` · read-only, observe with `onNotifyItem`

The item at the start of the section.

_Available since 4.12._

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

Number of items in this section.

_Available since 4.12._

### `start`

`number` · default `4294967295` · read-only, observe with `onNotifyStart`

First position of items in this section.

_Available since 4.12._

## Methods

Methods are called on the `Gtk.ListHeader` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child previously set via `gtk_list_header_set_child()` or
`null` if none was set.

**Returns** The child

_Available since 4.12._

### `getEnd`

```ts
getEnd(): number
```

Gets the end position in the model of the section that `self` is
currently the header for.

If `self` is unbound, `GTK_INVALID_LIST_POSITION` is returned.

**Returns** The end position of the section

_Available since 4.12._

### `getItem`

```ts
getItem(): GObject.Object | null
```

Gets the model item at the start of the section.
This is the item that occupies the list model at position
`Gtk.ListHeader.start`.

If `self` is unbound, this function returns `null`.

**Returns** The item displayed

_Available since 4.12._

### `getNItems`

```ts
getNItems(): number
```

Gets the the number of items in the section.

If `self` is unbound, 0 is returned.

**Returns** The number of items in the section

_Available since 4.12._

### `getStart`

```ts
getStart(): number
```

Gets the start position in the model of the section that `self` is
currently the header for.

If `self` is unbound, `GTK_INVALID_LIST_POSITION` is returned.

**Returns** The start position of the section

_Available since 4.12._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child to be used for this listitem.

This function is typically called by applications when
setting up a header so that the widget can be reused when
binding it multiple times.

**Parameters**

- `child`: The list item's child or `null` to unset

_Available since 4.12._
