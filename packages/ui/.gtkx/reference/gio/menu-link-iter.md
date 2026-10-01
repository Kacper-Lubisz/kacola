---
description: "GMenuLinkIter is an opaque structure type."
---

# GMenuLinkIter

`GMenuLinkIter` is an opaque structure type.  You must access it using
the functions below.

_Available since 2.32._

```tsx
import { GMenuLinkIter } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GMenuLinkIter**

## Props

`ref` receives the `Gio.MenuLinkIter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.MenuLinkIter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getName`

```ts
getName(): string
```

Gets the name of the link at the current iterator position.

The iterator is not advanced.

**Returns** the type of the link

_Available since 2.32._

### `getNext`

```ts
getNext(): [boolean, string, Gio.MenuModel]
```

This function combines `g_menu_link_iter_next()` with
`g_menu_link_iter_get_name()` and `g_menu_link_iter_get_value()`.

First the iterator is advanced to the next (possibly first) link.
If that fails, then `false` is returned and there are no other effects.

If successful, `out_link` and `value` are set to the name and `GMenuModel`
of the link that has just been advanced to.  At this point,
`g_menu_link_iter_get_name()` and `g_menu_link_iter_get_value()` will return the
same values again.

The value returned in `out_link` remains valid for as long as the iterator
remains at the current position.  The value returned in `value` must
be unreffed using `g_object_unref()` when it is no longer in use.

**Returns** Tuple of:

- `result`: `true` on success, or `false` if there is no additional link
- `outLink`: the name of the link
- `value`: the linked `GMenuModel`

_Available since 2.32._

### `getValue`

```ts
getValue(): Gio.MenuModel
```

Gets the linked `GMenuModel` at the current iterator position.

The iterator is not advanced.

**Returns** the `GMenuModel` that is linked to

_Available since 2.32._

### `next`

```ts
next(): boolean
```

Attempts to advance the iterator to the next (possibly first)
link.

`true` is returned on success, or `false` if there are no more links.

You must call this function when you first acquire the iterator to
advance it to the first link (and determine if the first link exists
at all).

**Returns** `true` on success, or `false` when there are no more links

_Available since 2.32._
