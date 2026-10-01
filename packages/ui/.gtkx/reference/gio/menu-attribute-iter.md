---
description: "GMenuAttributeIter is an opaque structure type."
---

# GMenuAttributeIter

`GMenuAttributeIter` is an opaque structure type.  You must access it
using the functions below.

_Available since 2.32._

```tsx
import { GMenuAttributeIter } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GMenuAttributeIter**

## Props

`ref` receives the `Gio.MenuAttributeIter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.MenuAttributeIter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getName`

```ts
getName(): string
```

Gets the name of the attribute at the current iterator position, as
a string.

The iterator is not advanced.

**Returns** the name of the attribute

_Available since 2.32._

### `getNext`

```ts
getNext(): [boolean, string, GLib.Variant]
```

This function combines `g_menu_attribute_iter_next()` with
`g_menu_attribute_iter_get_name()` and `g_menu_attribute_iter_get_value()`.

First the iterator is advanced to the next (possibly first) attribute.
If that fails, then `false` is returned and there are no other
effects.

If successful, `name` and `value` are set to the name and value of the
attribute that has just been advanced to.  At this point,
`g_menu_attribute_iter_get_name()` and `g_menu_attribute_iter_get_value()` will
return the same values again.

The value returned in `name` remains valid for as long as the iterator
remains at the current position.  The value returned in `value` must
be unreffed using `g_variant_unref()` when it is no longer in use.

**Returns** Tuple of:

- `result`: `true` on success, or `false` if there is no additional attribute
- `outName`: the type of the attribute
- `value`: the attribute value

_Available since 2.32._

### `getValue`

```ts
getValue(): GLib.Variant
```

Gets the value of the attribute at the current iterator position.

The iterator is not advanced.

**Returns** the value of the current attribute

_Available since 2.32._

### `next`

```ts
next(): boolean
```

Attempts to advance the iterator to the next (possibly first)
attribute.

`true` is returned on success, or `false` if there are no more
attributes.

You must call this function when you first acquire the iterator
to advance it to the first attribute (and determine if the first
attribute exists at all).

**Returns** `true` on success, or `false` when there are no more attributes

_Available since 2.32._
